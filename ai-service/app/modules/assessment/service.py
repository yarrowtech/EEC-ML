"""
LLM-based evaluation for reading and writing assessments.

Uses Qwen3 8B via Ollama locally. Falls back to OpenRouter (Claude Sonnet 4)
when OPENROUTER_API_KEY is set and the local model is unavailable.

All prompts instruct the model to return strict JSON only.
Responses are validated before returning to the caller.
"""

import json
import logging
import re
from difflib import SequenceMatcher

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── LLM helpers ─────────────────────────────────────────────────────────────

def _call_ollama(prompt: str, system: str, temperature: float = 0.3) -> str:
    payload = {
        "model": settings.ollama_assess_model,
        # "think" is a TOP-LEVEL Ollama field, not nested in "options".
        # Putting it inside options silently does nothing — Ollama ignores unknown option keys.
        "think": False,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 800,   # thinking disabled → JSON ≈ 400 tok; 400 slack
            "num_ctx": 4096,
        },
    }
    resp = httpx.post(
        f"{settings.ollama_url}/api/chat",
        json=payload,
        timeout=180,
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"]


def _call_openrouter(prompt: str, system: str, temperature: float = 0.3) -> str:
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://electroniceducare.com",
        "X-Title": "EEC AI Assessment",
    }
    payload = {
        "model": "anthropic/claude-sonnet-4",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": 2048,
    }
    resp = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        json=payload,
        headers=headers,
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_llm(prompt: str, system: str, temperature: float = 0.3) -> str:
    """Try Ollama first; fall back to OpenRouter if configured and Ollama fails."""
    try:
        return _call_ollama(prompt, system, temperature)
    except Exception as ollama_err:
        logger.warning("Ollama assess failed (%s), trying OpenRouter", ollama_err)
        if settings.openrouter_api_key:
            return _call_openrouter(prompt, system, temperature)
        raise


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from LLM output."""
    # Strip Qwen3 thinking chain — must happen before any other processing
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # Remove markdown code fences
    text = re.sub(r"```(?:json)?", "", text).strip()
    # Find the first { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        # Sanitize before logging/raising — thinking chain may contain file paths
        safe_preview = re.sub(r"(/tmp|/var|/home|/run|C:\\)[^\s\"']+", "<path>", text[:300])
        raise ValueError(f"No JSON object in LLM response: {safe_preview}")
    return json.loads(text[start : end + 1])


# ─── Reading evaluation ───────────────────────────────────────────────────────

def _word_accuracy(reference: str, hypothesis: str) -> tuple[float, list, list]:
    ref_words = re.sub(r"[^a-z0-9\s']", "", reference.lower()).split()
    hyp_words = re.sub(r"[^a-z0-9\s']", "", hypothesis.lower()).split()
    if not ref_words:
        return 100.0, [], []
    m = SequenceMatcher(None, ref_words, hyp_words)
    matched = sum(b.size for b in m.get_matching_blocks())
    accuracy = (matched / len(ref_words)) * 100
    ref_set = set(ref_words)
    hyp_set = set(hyp_words)
    missed = [w for w in ref_set if w not in hyp_set]
    extra = [w for w in hyp_set if w not in ref_set]
    return round(accuracy, 1), missed[:20], extra[:20]


def evaluate_reading(
    transcript: str,
    reference_text: str,
    pronunciation_score: float,
    word_scores: list,
    mispronounced_words: list,
    audio_duration_seconds: float,
    previous_history: list,
) -> dict:
    """Evaluate a student's reading using Qwen3 8B."""
    accuracy, missed_words, extra_words = _word_accuracy(reference_text, transcript)

    word_count = len(transcript.split())
    reading_speed = round((word_count / audio_duration_seconds) * 60, 1) if audio_duration_seconds > 0 else 0

    history_context = ""
    if previous_history:
        history_context = "\n\nStudent's previous assessment history (use to personalize feedback):\n"
        for h in previous_history[:3]:
            meta = h.get("metadata", {})
            history_context += (
                f"- Overall: {meta.get('overall', '?')}, "
                f"Weaknesses: {meta.get('weaknesses', [])}, "
                f"Mispronounced: {meta.get('mispronounced_words', [])}\n"
            )

    system = (
        "You are an expert English language teacher evaluating a student's oral reading. "
        "You MUST return ONLY a strict JSON object with no markdown, no prose, no explanations outside the JSON. "
        "Do NOT include any text before or after the JSON object."
    )

    prompt = f"""Evaluate this student's oral reading. Use the computed metrics below as hard anchors — your scores MUST be consistent with them.

REFERENCE TEXT (what the student was supposed to read):
{reference_text[:2000]}

STUDENT'S TRANSCRIPT (what Whisper heard):
{transcript}

COMPUTED METRICS (treat these as ground truth — do not contradict them):
- Word accuracy: {accuracy}% → pronunciation score MUST be within ±10 of this
- Reading speed: {reading_speed} WPM (native fluent = 130–180 WPM; beginners = 60–100 WPM)
- Acoustic pronunciation score: {pronunciation_score}/100
- Mispronounced words (low Whisper confidence): {mispronounced_words}
- Words missed entirely: {missed_words}
- Extra words added: {extra_words}
{history_context}

SCORING RUBRIC:
- pronunciation: base it on acoustic score ({pronunciation_score}) and mispronounced word count. 90-100 = near-native, 70-89 = clear with minor errors, 50-69 = noticeable errors, <50 = significant errors.
- fluency: base on reading speed and how complete the transcript is vs reference. 90-100 = smooth and natural, 70-89 = mostly fluent with pauses, 50-69 = choppy, <50 = very halting.
- grammar: did the student change words in ways that alter grammar? Check transcript vs reference. 90-100 = no changes, 70-89 = minor word substitutions, <70 = significant omissions or restructuring.
- confidence: derived from speed consistency and completeness. High if they read most words, low if many skipped.
- accent: how consistent is pronunciation style? Rate 70-100 unless there are clear systematic errors.
- overall: weighted average — pronunciation×0.35 + fluency×0.25 + grammar×0.2 + confidence×0.1 + accent×0.1

Return ONLY this JSON (all scores integers 0-100):
{{
  "overall": <integer>,
  "pronunciation": <integer>,
  "grammar": <integer>,
  "fluency": <integer>,
  "confidence": <integer>,
  "accent": <integer>,
  "reading_speed": {reading_speed},
  "mispronounced_words": {json.dumps(mispronounced_words)},
  "missed_words": {json.dumps(missed_words)},
  "extra_words": {json.dumps(extra_words)},
  "strengths": ["<specific observed strength>", "<specific observed strength>"],
  "weaknesses": ["<specific observed weakness>", "<specific observed weakness>"],
  "suggestions": ["<concrete practice exercise>", "<concrete practice exercise>", "<concrete practice exercise>"]
}}"""

    raw = _call_llm(prompt, system, temperature=0.1)
    result = _extract_json(raw)

    # Hard-clamp pronunciation to within 15 points of computed acoustic score
    # so LLM cannot wildly disagree with measurable signal
    computed_pron = round(pronunciation_score)
    llm_pron = result.get("pronunciation", computed_pron)
    result["pronunciation"] = max(computed_pron - 15, min(computed_pron + 15, llm_pron))

    # Guarantee required keys with safe defaults
    result.setdefault("overall", max(0, min(100, accuracy)))
    result.setdefault("pronunciation", pronunciation_score)
    result.setdefault("grammar", 70)
    result.setdefault("fluency", 70)
    result.setdefault("confidence", 70)
    result.setdefault("accent", 70)
    result["reading_speed"] = reading_speed
    result.setdefault("mispronounced_words", mispronounced_words)
    result.setdefault("missed_words", missed_words)
    result.setdefault("extra_words", extra_words)
    result.setdefault("strengths", [])
    result.setdefault("weaknesses", [])
    result.setdefault("suggestions", [])
    result["transcript"] = transcript

    # Attach computed ground-truth metrics so the frontend can compare
    # LLM scores against independently measurable values
    result["_computed"] = {
        "word_accuracy_pct": accuracy,
        "reading_speed_wpm": reading_speed,
        "acoustic_pronunciation": round(pronunciation_score, 1),
        "whisper_confidence_avg": round(
            sum(w.get("probability", 0) for w in word_scores) / len(word_scores) * 100, 1
        ) if word_scores else None,
        "words_in_transcript": len(transcript.split()),
        "words_in_reference": len(reference_text.split()),
        "missed_word_count": len(missed_words),
        "mispronounced_count": len(mispronounced_words),
        # Per-word CTC scores from wav2vec2 — used for passage highlighting in UI
        "word_scores": [
            {k: v for k, v in w.items()}
            for w in word_scores
            if isinstance(w, dict) and "word" in w and "score" in w
        ],
    }

    return result


# ─── Writing evaluation ───────────────────────────────────────────────────────

def evaluate_writing(
    submission: str,
    prompt_question: str,
    prompt_type: str,
    difficulty: str,
    previous_history: list,
) -> dict:
    """Evaluate student writing using Qwen3 8B."""
    history_context = ""
    if previous_history:
        history_context = "\n\nStudent's previous writing history (personalize feedback accordingly):\n"
        for h in previous_history[:3]:
            meta = h.get("metadata", {})
            history_context += (
                f"- Overall: {meta.get('overall', '?')}, "
                f"Weaknesses: {meta.get('weaknesses', [])}, "
                f"CEFR: {meta.get('cefr_level', '?')}\n"
            )

    system = (
        "You are an expert English language teacher and writing evaluator. "
        "You MUST return ONLY a strict JSON object. No markdown fences, no prose outside the JSON. "
        "Do NOT include any text before or after the JSON object."
    )

    prompt = f"""Evaluate this student's writing submission.

WRITING PROMPT ({prompt_type}, difficulty: {difficulty}):
{prompt_question}

STUDENT'S SUBMISSION:
{submission}
{history_context}

Return this exact JSON structure (all scores 0-100):
{{
  "overall": <number>,
  "grammar": <number>,
  "vocabulary": <number>,
  "tone": <number>,
  "coherence": <number>,
  "verb_tense": <number>,
  "sentence_structure": <number>,
  "creativity": <number>,
  "cefr_level": "<A1|A2|B1|B2|C1|C2>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "suggestions": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "corrections": [
    {{"original": "<wrong phrase>", "corrected": "<correct phrase>", "type": "<grammar|spelling|verb_tense|punctuation|word_choice>", "explanation": "<brief why>"}}
  ],
  "improved_version": "<rewritten version of the submission with all corrections applied>"
}}

Evaluate thoroughly. Provide up to 5 corrections. The improved_version should be a complete rewrite fixing all issues.
Return ONLY the JSON."""

    raw = _call_llm(prompt, system, temperature=0.4)
    result = _extract_json(raw)

    # Safe defaults
    for key in ["overall", "grammar", "vocabulary", "tone", "coherence", "verb_tense", "sentence_structure", "creativity"]:
        result.setdefault(key, 70)
    result.setdefault("cefr_level", "B1")
    result.setdefault("strengths", [])
    result.setdefault("weaknesses", [])
    result.setdefault("suggestions", [])
    result.setdefault("corrections", [])
    result.setdefault("improved_version", submission)

    return result
