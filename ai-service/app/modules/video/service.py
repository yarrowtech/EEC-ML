"""
Video understanding: lecture video -> transcript -> summary + quiz.

Deliberately audio-only for this first pass — no frame/vision extraction.
faster-whisper decodes audio via ffmpeg internally regardless of container,
so a video file (mp4/webm/mov) can be handed to the existing speech
transcription path unchanged; no new model or binary dependency needed.
Visual-only content (silent slides, diagrams with no narration) is a known
gap of this approach and is out of scope for the MVP.
"""
import logging

from fastapi import HTTPException, UploadFile, status
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.modules.speech.service import transcribe_audio
from app.modules.summaries.service import summarize_text
from app.modules.video.schemas import VideoUnderstandResponse

logger = logging.getLogger(__name__)

# Keep the quiz prompt within a reasonable context budget for long lectures.
MAX_TRANSCRIPT_CHARS_FOR_QUIZ = 12000

_QUIZ_SYSTEM = "You write multiple-choice quizzes for school students based only on the given lecture transcript."


def generate_quiz_from_text(text: str) -> str:
    prompt = (
        "Write exactly 5 multiple-choice questions testing understanding of this lecture transcript. "
        "Cover a broad range of points across the whole transcript — do not repeat or rephrase the same question. "
        "Return them as a numbered list, each with 4 options labeled A-D and the correct answer marked at the end "
        "as 'Answer: <letter>'. Base every question solely on the transcript content.\n\n"
        f"Transcript:\n{text[:MAX_TRANSCRIPT_CHARS_FOR_QUIZ]}"
    )
    llm = ChatOllama(base_url=settings.ollama_url, model=settings.ollama_model, temperature=0.7)
    chain = llm | StrOutputParser()
    try:
        return chain.invoke([
            SystemMessage(content=_QUIZ_SYSTEM),
            HumanMessage(content=prompt),
        ])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM quiz request failed: {exc}",
        ) from exc


async def understand_video(file: UploadFile) -> VideoUnderstandResponse:
    video_bytes = await file.read()
    if not video_bytes:
        raise HTTPException(status_code=422, detail="Uploaded video file is empty.")

    transcription = transcribe_audio(video_bytes)
    transcript = (transcription.get("transcript") or "").strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not detect any speech in this video.")

    summary = summarize_text(transcript)
    quiz_text = generate_quiz_from_text(transcript)

    return VideoUnderstandResponse(
        transcript=transcript,
        duration_seconds=transcription.get("duration_seconds", 0),
        summary=summary.summary,
        keywords=summary.keywords,
        topics=summary.topics,
        quiz=quiz_text,
    )
