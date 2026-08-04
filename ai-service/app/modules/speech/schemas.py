from pydantic import BaseModel
from typing import Optional


class TranscribeResponse(BaseModel):
    transcript: str
    confidence: float
    word_count: int
    duration_seconds: float
    words: list  # [{word, start, end, probability}]


class PronunciationResponse(BaseModel):
    score: float  # 0-100
    mispronounced_words: list[str]
    word_scores: list  # [{word, score, reference}]
