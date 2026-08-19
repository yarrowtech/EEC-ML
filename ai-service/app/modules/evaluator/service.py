"""
Academic answer evaluator.

Evaluates student answers for MCQ, short-answer, and long-answer questions.
Returns: correctness, score, error type, Bloom level, missing concepts, feedback.
All calls are to the local Ollama model — no network calls to external services.
"""

import json
import logging
import re

import httpx

from app.core.config import settings
from app.modules.evaluator.schemas import AnswerEvalRequest, AnswerEvalResult

logger = logging.getLogger(__name__)

BLOOM_LEVELS = ("remember", "understand", "apply", "analyse", "evaluate", "create")
ERROR_TYPES = ("Concept", "Calculation", "Reading", "Logic", "None")

# ── MCQ evaluation (deterministic, no LLM needed) ────────────────────────────

def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def evaluate_mcq(req: AnswerEvalRequest) -> AnswerEvalResult:
    """Fast deterministic MCQ evaluation — no LLM call."""
    correct = _normalize(req.correctAnswer)
    given   = _normalize(req.studentAnswer)
    is_correct = correct == given

    if is_correct:
        return AnswerEvalResult(
            isCorrect=True,
            score=1.0,
            confidenceScore=1.0,
            errorType="None",
            bloomLevel=_classify_bloom_fast(req.questionText),
            missingConcepts=[],
            feedback="Correct! Well done.",
            learningOutcomes=[],
        )

    # Classify error type heuristically
    error_type = _classify_error_fast(req.questionText, req.correctAnswer, req.studentAnswer)

    return AnswerEvalResult(
        isCorrect=False,
        score=0.0,
        confidenceScore=1.0,
        errorType=error_type,
        bloomLevel=_classify_bloom_fast(req.questionText),
        missingConcepts=[],
        feedback=f"The correct answer is {req.correctAnswer}. Review this concept and try again.",
        learningOutcomes=[],
    )


# ── Written answer evaluation (LLM-backed) ───────────────────────────────────

_EVAL_SYSTEM = (
    "You are an expert educational assessor. Evaluate the student's answer strictly and fairly. "
    "Return ONLY valid JSON — no markdown, no extra text."
)

_EVAL_PROMPT = """\
Evaluate this student answer.

Subject: {subject}
Topic: {topic}
Grade Level: {grade}
Question: {question}
Correct Answer / Model Answer: {correct}
Student's Answer: {student}
{context_block}

Return JSON in this exact shape:
{{
  "score": <float 0.0 to 1.0>,
  "confidenceScore": <float 0.0 to 1.0>,
  "errorType": "<Concept|Calculation|Reading|Logic|None>",
  "bloomLevel": "<remember|understand|apply|analyse|evaluate|create>",
  "missingConcepts": ["<concept>", ...],
  "feedback": "<2-3 sentence student-facing feedback>",
  "learningOutcomes": ["<Students will be able to ...>"]
}}

Rules:
- score: fraction of the model answer covered (0=entirely wrong, 1=fully correct)
- confidenceScore: how confident you are in your evaluation
- errorType: what type of error the student made (None if correct)
- bloomLevel: cognitive level the QUESTION tests (not the student answer)
- missingConcepts: key ideas in the model answer that the student missed
- feedback: encouraging, specific, under 60 words
- learningOutcomes: 1-2 outcomes this question targets, starting with "Students will be able to"
"""


def evaluate_written(req: AnswerEvalRequest) -> AnswerEvalResult:
    """LLM-backed evaluation for short and long written answers."""
    context_block = ""
    if req.context:
        context_block = f"\nRelevant Course Material:\n{req.context[:1500]}\n"

    prompt = _EVAL_PROMPT.format(
        subject=req.subject or "General",
        topic=req.topicTitle or "this topic",
        grade=req.gradeLevel or "school",
        question=req.questionText,
        correct=req.correctAnswer,
        student=req.studentAnswer,
        context_block=context_block,
    )

    try:
        resp = httpx.post(
            f"{settings.ollama_url}/api/chat",
            json={
                "model": settings.ollama_model,
                "think": False,
                "messages": [
                    {"role": "system", "content": _EVAL_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 500, "num_ctx": 4096},
            },
            timeout=120,
        )
        resp.raise_for_status()
        raw = resp.json()["message"]["content"]
        data = _parse_json(raw)
        if data:
            score = float(data.get("score", 0.0))
            return AnswerEvalResult(
                isCorrect=score >= 0.6,
                score=round(min(1.0, max(0.0, score)), 2),
                confidenceScore=round(float(data.get("confidenceScore", 0.7)), 2),
                errorType=data.get("errorType", "Concept") if score < 0.6 else "None",
                bloomLevel=data.get("bloomLevel", "understand"),
                missingConcepts=list(data.get("missingConcepts", [])),
                feedback=str(data.get("feedback", "")),
                learningOutcomes=list(data.get("learningOutcomes", [])),
            )
    except Exception as exc:
        logger.warning("Written answer evaluation LLM error: %s", exc)

    # Graceful fallback: lexical overlap heuristic
    return _lexical_fallback(req)


def evaluate_answer(req: AnswerEvalRequest) -> AnswerEvalResult:
    """Route to the correct evaluator based on question type."""
    if req.questionType == "mcq":
        return evaluate_mcq(req)
    return evaluate_written(req)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_json(raw: str) -> dict | None:
    try:
        # Strip markdown fences if present
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        return json.loads(cleaned)
    except Exception:
        # Try to find first {...} block
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


def _classify_bloom_fast(question_text: str) -> str:
    q = question_text.lower()
    if any(w in q for w in ("design", "create", "compose", "construct", "invent")):
        return "create"
    if any(w in q for w in ("evaluate", "judge", "assess", "critique", "justify")):
        return "evaluate"
    if any(w in q for w in ("analyse", "analyze", "compare", "contrast", "differentiate")):
        return "analyse"
    if any(w in q for w in ("apply", "use", "calculate", "solve", "demonstrate")):
        return "apply"
    if any(w in q for w in ("explain", "describe", "summarise", "summarize", "interpret")):
        return "understand"
    return "remember"


def _classify_error_fast(question: str, correct: str, given: str) -> str:
    q = question.lower()
    # Numeric answers → Calculation
    def is_num(s):
        return re.match(r"^-?\d[\d,. ]*$", s.strip()) is not None
    if is_num(correct) and is_num(given):
        return "Calculation"
    # Negation keywords → Reading
    if any(w in q for w in ("not", "except", "never", "always", "least", "most", "incorrect")):
        return "Reading"
    # MCQ letter confusion → Logic
    if len(correct.strip()) == 1 and len(given.strip()) == 1:
        return "Logic"
    return "Concept"


def _lexical_fallback(req: AnswerEvalRequest) -> AnswerEvalResult:
    """Simple word-overlap score when LLM call fails."""
    correct_words = set(re.findall(r"\b\w+\b", req.correctAnswer.lower()))
    student_words = set(re.findall(r"\b\w+\b", req.studentAnswer.lower()))
    stop = {"the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "and", "or"}
    correct_key = correct_words - stop
    student_key = student_words - stop
    overlap = len(correct_key & student_key)
    score = round(overlap / max(len(correct_key), 1), 2)
    return AnswerEvalResult(
        isCorrect=score >= 0.6,
        score=min(1.0, score),
        confidenceScore=0.5,
        errorType="Concept" if score < 0.6 else "None",
        bloomLevel=_classify_bloom_fast(req.questionText),
        missingConcepts=[],
        feedback="Keep revising this topic and try again.",
        learningOutcomes=[],
    )
