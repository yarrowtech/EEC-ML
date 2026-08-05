import asyncio
import json as _json
import logging
import re as _re
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.modules.assessment import service as assess_svc
from app.modules.speech import service as speech_svc
from app.modules.speech.pronunciation import compute_emissions, align_and_score

router = APIRouter(tags=["assessment"])
logger = logging.getLogger(__name__)

# Shared pool for the two parallel model forward passes
_model_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="model-fwd")


def _run_reading_pipeline(audio_bytes: bytes, reference_text: str, history: list) -> dict:
    """
    Optimised pipeline — Whisper and wav2vec2 forward passes run in parallel,
    then results are merged before the (much shorter) LLM evaluation step.

    Timeline (approximate):
      Before: Whisper(10s) → wav2vec2(8s) → LLM(60s) = ~78s
      After:  max(Whisper, wav2vec2)(10s) → LLM(15s)  = ~25s
    """
    # Phase 1: run Whisper transcription and wav2vec2 emission matrix concurrently
    whisper_future = _model_pool.submit(
        speech_svc.transcribe_audio, audio_bytes, "en", reference_text
    )
    wav2vec_future = _model_pool.submit(compute_emissions, audio_bytes)

    transcription = whisper_future.result()
    emissions_data = wav2vec_future.result()  # None if wav2vec2 unavailable

    transcript = transcription.get("transcript", "")
    duration = transcription.get("duration_seconds", 0)
    whisper_words = transcription.get("words", [])

    # Phase 2: forced alignment (fast, needs both emission matrix + word timestamps)
    pron = align_and_score(emissions_data, whisper_words)
    pronunciation_score = pron.get("overall_score", 70.0)
    word_scores = pron.get("word_scores", [])
    mispronounced = pron.get("mispronounced_words", [])

    # Phase 3: LLM evaluation (Qwen3 with thinking disabled)
    result = assess_svc.evaluate_reading(
        transcript=transcript,
        reference_text=reference_text,
        pronunciation_score=pronunciation_score,
        word_scores=word_scores,
        mispronounced_words=mispronounced,
        audio_duration_seconds=duration,
        previous_history=history,
    )
    return result


@router.post("/reading/evaluate")
async def reading_evaluate(
    audio: UploadFile = File(...),
    reference_text: str = Form(...),
    student_id: str = Form(default=""),
    assessment_id: str = Form(default=""),
    previous_history: str = Form(default="[]"),
):
    """
    Full reading evaluation pipeline (runs in thread executor — non-blocking):
    1. Whisper transcription
    2. wav2vec2 CTC forced alignment pronunciation scoring
    3. Qwen3 8B evaluation
    """
    try:
        audio_bytes = await audio.read()
        history = _json.loads(previous_history) if previous_history else []

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            partial(_run_reading_pipeline, audio_bytes, reference_text, history),
        )
        return result

    except Exception as exc:
        logger.exception("Reading evaluate error")
        # Strip filesystem paths from the detail so they don't reach the browser
        detail = str(exc)
        detail = _re.sub(r"(/tmp|/var|/home|/run|C:\\)[^\s\"']+", "<server-path>", detail)
        raise HTTPException(status_code=500, detail=detail) from exc


@router.post("/writing/evaluate")
async def writing_evaluate(request: Request):
    """
    Writing evaluation pipeline using Qwen3 8B.
    """
    try:
        body = await request.json()
        submission = body.get("submission", "")
        prompt_question = body.get("prompt_question", "")
        prompt_type = body.get("prompt_type", "essay")
        difficulty = body.get("difficulty", "medium")
        previous_history = body.get("previous_history", [])

        if not submission:
            raise HTTPException(status_code=400, detail="submission is required")

        result = assess_svc.evaluate_writing(
            submission=submission,
            prompt_question=prompt_question,
            prompt_type=prompt_type,
            difficulty=difficulty,
            previous_history=previous_history,
        )
        return result

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Writing evaluate error")
        detail = str(exc)
        detail = _re.sub(r"(/tmp|/var|/home|/run|C:\\)[^\s\"']+", "<server-path>", detail)
        raise HTTPException(status_code=500, detail=detail) from exc
