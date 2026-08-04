from pydantic import BaseModel
from typing import Any, Optional


class ReadingEvaluateRequest(BaseModel):
    reference_text: str
    student_id: str
    assessment_id: str
    previous_history: list[dict] = []


class WritingEvaluateRequest(BaseModel):
    submission: str
    prompt_question: str
    prompt_type: str = "essay"
    difficulty: str = "medium"
    student_id: str
    assessment_id: str
    previous_history: list[dict] = []


class ReadingEvaluationResult(BaseModel):
    transcript: str
    overall: float
    pronunciation: float
    grammar: float
    fluency: float
    confidence: float
    accent: float
    reading_speed: float
    mispronounced_words: list[str]
    missed_words: list[str]
    extra_words: list[str]
    suggestions: list[str]
    strengths: list[str]
    weaknesses: list[str]


class Correction(BaseModel):
    original: str
    corrected: str
    type: str
    explanation: str = ""


class WritingEvaluationResult(BaseModel):
    overall: float
    grammar: float
    vocabulary: float
    tone: float
    coherence: float
    verb_tense: float
    sentence_structure: float
    creativity: float
    suggestions: list[str]
    corrections: list[dict]
    improved_version: str
    cefr_level: str
    strengths: list[str]
    weaknesses: list[str]
