import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.modules.speech import service as speech_svc

router = APIRouter(prefix="/speech", tags=["speech"])
logger = logging.getLogger(__name__)


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(default="en"),
):
    """Transcribe uploaded audio using Whisper large-v3-turbo."""
    try:
        audio_bytes = await audio.read()
        result = speech_svc.transcribe_audio(audio_bytes, language=language)
        return result
    except Exception as exc:
        logger.exception("Transcription error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/pronunciation")
async def pronunciation(
    audio: UploadFile = File(...),
    reference_text: str = Form(...),
):
    """Score pronunciation against a reference text."""
    try:
        audio_bytes = await audio.read()
        transcription = speech_svc.transcribe_audio(audio_bytes)
        result = speech_svc.score_pronunciation(audio_bytes, reference_text, transcription)
        result["transcript"] = transcription.get("transcript", "")
        result["confidence"] = transcription.get("confidence", 0)
        return result
    except Exception as exc:
        logger.exception("Pronunciation scoring error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
