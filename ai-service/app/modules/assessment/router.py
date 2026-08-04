import logging

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.modules.assessment import service as assess_svc
from app.modules.speech import service as speech_svc

router = APIRouter(tags=["assessment"])
logger = logging.getLogger(__name__)


@router.post("/reading/evaluate")
async def reading_evaluate(
    audio: UploadFile = File(...),
    reference_text: str = Form(...),
    student_id: str = Form(default=""),
    assessment_id: str = Form(default=""),
    previous_history: str = Form(default="[]"),
):
    """
    Full reading evaluation pipeline:
    1. Whisper transcription
    2. Pronunciation scoring
    3. Qwen3 8B evaluation
    """
    import json as _json

    try:
        audio_bytes = await audio.read()
        history = _json.loads(previous_history) if previous_history else []

        # Step 1: transcribe
        transcription = speech_svc.transcribe_audio(audio_bytes)
        transcript = transcription.get("transcript", "")
        duration = transcription.get("duration_seconds", 0)

        # Step 2: pronunciation
        pron = speech_svc.score_pronunciation(audio_bytes, reference_text, transcription)
        pronunciation_score = pron.get("score", 70.0)
        word_scores = pron.get("word_scores", [])
        mispronounced = pron.get("mispronounced_words", [])

        # Step 3: LLM evaluation
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

    except Exception as exc:
        logger.exception("Reading evaluate error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
        raise HTTPException(status_code=500, detail=str(exc)) from exc
