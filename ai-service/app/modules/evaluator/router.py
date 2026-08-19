import logging

from fastapi import APIRouter, HTTPException

from app.modules.evaluator.schemas import AnswerEvalRequest, AnswerEvalResult
from app.modules.evaluator.service import evaluate_answer

router = APIRouter(prefix="/evaluate", tags=["evaluator"])
logger = logging.getLogger(__name__)


@router.post("/answer", response_model=AnswerEvalResult)
async def evaluate_student_answer(req: AnswerEvalRequest):
    """
    Evaluate a student's answer (MCQ, short-answer, or long-answer).

    Returns: correctness, score (0-1), error type, Bloom level,
    missing concepts, student-facing feedback, and learning outcomes.
    """
    try:
        return evaluate_answer(req)
    except Exception as exc:
        logger.exception("Answer evaluation error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
