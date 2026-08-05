"""
Genuine per-word pronunciation scoring via wav2vec2 CTC forced alignment.

Uses torchaudio's built-in WAV2VEC2_ASR_BASE_960H pipeline — no transformers
library needed. The forced_align algorithm pins each reference word to the
audio and returns a per-token score that reflects how closely the acoustic
signal matches the expected pronunciation.

Pipeline:
  1. Full audio → wav2vec2 → emission matrix [T, vocab]
  2. Tokenise the reference transcript (character-level CTC)
  3. torchaudio.functional.forced_align → per-token frame spans + scores
  4. Aggregate token scores per word → word pronunciation score 0-100
  5. Flag words below threshold as mispronounced
"""

import io
import logging
import os
import re
import tempfile
from difflib import SequenceMatcher

import torch
import torchaudio

logger = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000

_bundle = None
_model = None
_labels = None
_device = None


def _get_model():
    global _bundle, _model, _labels, _device
    if _model is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Loading WAV2VEC2_ASR_BASE_960H on %s…", _device)
        _bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        _model = _bundle.get_model().to(_device)
        _model.eval()
        _labels = _bundle.get_labels()
        logger.info("wav2vec2 pronunciation model ready. Labels: %s", _labels[:10])
    return _model, _labels, _device, _bundle.sample_rate


def _load_waveform(audio_bytes: bytes, target_sr: int) -> torch.Tensor:
    """
    Load audio bytes → mono float32 [1, T] resampled to target_sr.
    Uses ffmpeg (via soundfile/av) to decode WebM/Opus since newer torchaudio
    requires TorchCodec for non-WAV formats.
    """
    import subprocess
    import numpy as np

    with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as f:
        f.write(audio_bytes)
        webm_path = f.name

    wav_path = webm_path + ".wav"
    try:
        # Decode to 16-bit PCM WAV via ffmpeg (always available alongside faster-whisper)
        subprocess.run(
            [
                "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                "-i", webm_path,
                "-ar", str(target_sr),
                "-ac", "1",
                "-f", "wav",
                wav_path,
            ],
            check=True,
            timeout=30,
        )
        waveform, sr = torchaudio.load(wav_path)  # WAV loads without TorchCodec
    finally:
        for p in (webm_path, wav_path):
            try:
                os.unlink(p)
            except OSError:
                pass

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sr != target_sr:
        waveform = torchaudio.functional.resample(waveform, sr, target_sr)
    return waveform  # [1, T]


def _tokenise(text: str, dictionary: dict[str, int]) -> list[int]:
    """Convert text to token ids, skipping unknown characters."""
    return [dictionary[c] for c in text.upper() if c in dictionary]


def _clean_word(w: str) -> str:
    return re.sub(r"[^A-Za-z']", "", w).upper()


def compute_emissions(audio_bytes: bytes) -> dict | None:
    """
    Phase 1 (parallelisable): load audio + run wav2vec2 forward pass.
    Returns the emission matrix and metadata needed for forced alignment.
    Returns None on failure so the caller can fall back gracefully.
    """
    try:
        model, labels, device, model_sr = _get_model()
        waveform = _load_waveform(audio_bytes, model_sr).to(device)  # [1, T]

        with torch.no_grad():
            emissions, _ = model(waveform)  # [1, T_frames, vocab]

        emissions = emissions[0]  # [T_frames, vocab]
        log_probs = torch.nn.functional.log_softmax(emissions, dim=-1)
        total_frames = log_probs.shape[0]
        total_samples = waveform.shape[1]

        return {
            "log_probs": log_probs,
            "waveform": waveform,
            "labels": labels,
            "device": device,
            "frames_per_sample": total_frames / total_samples,
            "total_frames": total_frames,
        }
    except Exception as exc:
        logger.warning("wav2vec2 forward pass failed (%s)", exc)
        return None


def align_and_score(emissions_data: dict | None, whisper_words: list[dict]) -> dict:
    """
    Phase 2 (needs Whisper word timestamps): forced alignment + per-word scoring.
    Accepts emissions_data from compute_emissions(); falls back to Whisper confidence
    scores if emissions_data is None (e.g. wav2vec2 unavailable).
    """
    if not whisper_words:
        return {"overall_score": 70.0, "word_scores": [], "mispronounced_words": []}

    if emissions_data is None:
        return _whisper_fallback(whisper_words)

    log_probs = emissions_data["log_probs"]
    waveform = emissions_data["waveform"]
    labels = emissions_data["labels"]
    device = emissions_data["device"]
    frames_per_sample = emissions_data["frames_per_sample"]
    total_frames = emissions_data["total_frames"]

    dictionary = {c: i for i, c in enumerate(labels)}
    blank_id = 0

    word_results = []

    try:
        cleaned_words = [_clean_word(w.get("word", "")) for w in whisper_words]
        cleaned_words = [w for w in cleaned_words if w]
        reference_str = "|".join(cleaned_words)
        tokens = _tokenise(reference_str, dictionary)

        if tokens:
            token_tensor = torch.tensor([tokens], dtype=torch.long, device=device)
            aligned_tokens, token_scores = torchaudio.functional.forced_align(
                log_probs.unsqueeze(0),
                token_tensor,
                blank=blank_id,
            )
            aligned_tokens = aligned_tokens[0]
            token_scores = token_scores[0].exp()

            word_token_scores: list[list[float]] = []
            current: list[float] = []
            for tid, sc in zip(token_tensor[0].tolist(), token_scores.tolist()):
                if labels[tid] == "|":
                    word_token_scores.append(current)
                    current = []
                elif labels[tid] != "-":
                    current.append(sc)
            word_token_scores.append(current)

            for i, w in enumerate(whisper_words):
                raw = w.get("word", "").strip()
                word = _clean_word(raw)
                if not word:
                    continue
                start = w.get("start", 0.0)
                end = w.get("end", start + 0.3)

                if i < len(word_token_scores) and word_token_scores[i]:
                    avg_prob = sum(word_token_scores[i]) / len(word_token_scores[i])
                    score = round(avg_prob * 100, 1)
                else:
                    score = 70.0

                word_results.append({
                    "word": word,
                    "score": score,
                    "heard": word,
                    "is_correct": score >= 60.0,
                    "start": start,
                    "end": end,
                })

    except Exception as align_err:
        logger.warning("Forced alignment failed (%s), using segment decoding fallback", align_err)
        word_results = _segment_decode_fallback(
            log_probs, waveform, whisper_words, labels, dictionary,
            blank_id, frames_per_sample, total_frames
        )

    if not word_results:
        return {"overall_score": 70.0, "word_scores": [], "mispronounced_words": []}

    overall = sum(w["score"] for w in word_results) / len(word_results)
    mispronounced = [w["word"] for w in word_results if not w["is_correct"]]

    return {
        "overall_score": round(overall, 1),
        "word_scores": word_results,
        "mispronounced_words": mispronounced[:30],
    }


def score_pronunciation_genuine(
    audio_bytes: bytes,
    whisper_words: list[dict],
) -> dict:
    """Convenience wrapper (kept for backward compatibility)."""
    emissions_data = compute_emissions(audio_bytes)
    return align_and_score(emissions_data, whisper_words)


def _segment_decode_fallback(
    log_probs, waveform, whisper_words, labels, dictionary,
    blank_id, frames_per_sample, total_frames
) -> list[dict]:
    """
    Per-word fallback: extract audio segment → greedy CTC decode → compare to expected.
    """
    results = []
    for w in whisper_words:
        raw = w.get("word", "").strip()
        word = _clean_word(raw)
        if not word or len(word) < 2:
            continue

        start_sec = w.get("start", 0.0)
        end_sec = w.get("end", start_sec + 0.3)

        # Convert time → frame range (with 80ms padding)
        pad = int(0.08 * 50)  # ~4 frames at 50fps
        f_start = max(0, int(start_sec * 50) - pad)
        f_end = min(total_frames, int(end_sec * 50) + pad)

        if f_end - f_start < 3:
            results.append({"word": word, "score": 70.0, "heard": word,
                            "is_correct": True, "start": start_sec, "end": end_sec})
            continue

        segment = log_probs[f_start:f_end]

        # Greedy CTC decode of the segment
        ids = segment.argmax(dim=-1).tolist()
        decoded_chars = []
        prev = None
        for tid in ids:
            if tid != blank_id and tid != prev:
                decoded_chars.append(labels[tid] if tid < len(labels) else "")
            prev = tid
        heard = "".join(decoded_chars).replace("|", " ").strip()

        sim = SequenceMatcher(None, heard, word).ratio()
        avg_lp = segment.max(dim=-1).values.mean().item()  # in (-inf, 0]
        acoustic = max(0.0, min(1.0, (avg_lp + 5.0) / 5.0))
        score = round((sim * 0.7 + acoustic * 0.3) * 100, 1)
        if heard == word:
            score = max(score, 85.0)

        results.append({
            "word": word,
            "score": score,
            "heard": heard,
            "is_correct": score >= 60.0,
            "start": start_sec,
            "end": end_sec,
        })

    return results


def _whisper_fallback(whisper_words: list[dict]) -> dict:
    if not whisper_words:
        return {"overall_score": 70.0, "word_scores": [], "mispronounced_words": []}
    avg = sum(w.get("probability", 0.7) for w in whisper_words) / len(whisper_words)
    mispronounced = [
        _clean_word(w.get("word", ""))
        for w in whisper_words
        if w.get("probability", 1.0) < 0.65
    ]
    return {
        "overall_score": round(avg * 100, 1),
        "word_scores": [],
        "mispronounced_words": mispronounced,
    }
