"""
Video understanding: lecture video -> transcript (faster-whisper, reused
unchanged since ffmpeg decodes audio out of any container) -> summary + quiz.
Fully mocked — no real Whisper/Ollama calls.
"""
import asyncio

import pytest
from fastapi import HTTPException, UploadFile
from io import BytesIO

from app.modules.summaries.schemas import SummaryResponse
from app.modules.video import service


def make_upload(content: bytes = b"fake-video-bytes") -> UploadFile:
    return UploadFile(filename="lecture.mp4", file=BytesIO(content))


def test_understand_video_combines_transcript_summary_and_quiz(monkeypatch):
    monkeypatch.setattr(service, "transcribe_audio", lambda audio_bytes: {
        "transcript": "Today we learn about photosynthesis.", "duration_seconds": 42.5,
    })
    monkeypatch.setattr(service, "summarize_text", lambda text: SummaryResponse(
        summary="A lesson on photosynthesis.", keywords=["photosynthesis"], topics=["Biology"], difficulty="Easy",
    ))
    monkeypatch.setattr(service, "generate_quiz_from_text", lambda text: "1. What is photosynthesis?\nA) ...\nAnswer: A")

    result = asyncio.run(service.understand_video(make_upload()))

    assert result.transcript == "Today we learn about photosynthesis."
    assert result.duration_seconds == 42.5
    assert result.summary == "A lesson on photosynthesis."
    assert result.keywords == ["photosynthesis"]
    assert "Answer: A" in result.quiz


def test_understand_video_rejects_empty_file():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.understand_video(make_upload(b"")))
    assert exc_info.value.status_code == 422


def test_understand_video_rejects_silent_video(monkeypatch):
    monkeypatch.setattr(service, "transcribe_audio", lambda audio_bytes: {"transcript": "", "duration_seconds": 10})

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(service.understand_video(make_upload()))
    assert exc_info.value.status_code == 422
    assert "speech" in exc_info.value.detail.lower()


def test_generate_quiz_from_text_truncates_very_long_transcripts(monkeypatch):
    captured = {}

    class FakeChain:
        def invoke(self, messages):
            captured["prompt"] = messages[1].content
            return "1. Q\nA) ...\nAnswer: A"

    class FakeLLM:
        def __or__(self, other):
            return FakeChain()

    monkeypatch.setattr(service, "ChatOllama", lambda **kwargs: FakeLLM())

    long_text = "word " * 10000
    service.generate_quiz_from_text(long_text)

    assert len(captured["prompt"]) < len(long_text) + 500
