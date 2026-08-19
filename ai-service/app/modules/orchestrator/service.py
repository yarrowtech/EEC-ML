import logging
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Lazy imports — keeps start-up fast and avoids circular imports at module level.
# Each handler imports only what it needs when it is actually called.


def _handle_generate(payload: dict[str, Any]) -> dict[str, Any]:
    from app.modules.chat.schemas import TutorGenerateRequest
    from app.modules.chat.service import generate_tutor_response
    try:
        req = TutorGenerateRequest(**payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"generate payload invalid: {exc}")
    return generate_tutor_response(req)


def _handle_evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    from app.modules.evaluator.schemas import AnswerEvalRequest
    from app.modules.evaluator.service import evaluate_answer
    try:
        req = AnswerEvalRequest(**payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"evaluate payload invalid: {exc}")
    result = evaluate_answer(req)
    # AnswerEvalResult is a pydantic model — serialise to dict for uniform response
    return result.model_dump() if hasattr(result, "model_dump") else dict(result)


def _handle_summarize_session(payload: dict[str, Any]) -> dict[str, Any]:
    """Condense a conversation string into a rolling memory summary."""
    import json
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.core.llm import create_chain

    conversation = payload.get("conversation", "")
    if not conversation or len(conversation.strip()) < 50:
        return {"summary": "", "keyInsights": []}

    system = (
        "You are an educational memory assistant. Compress the student tutoring "
        "conversation into a short persistent memory.\n\n"
        "Return ONLY valid JSON: "
        '{"summary": "...", "keyInsights": ["...", ...]}\n\n'
        "Rules: summary < 80 words; up to 5 insights < 20 words each; no student names."
    )
    chain = create_chain(mode="summarize")
    try:
        raw = chain.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"Transcript:\n\n{conversation[:4000]}"),
        ])
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)
        return {
            "summary": str(data.get("summary", ""))[:500],
            "keyInsights": [str(i) for i in data.get("keyInsights", [])[:5]],
        }
    except Exception:
        return {"summary": "", "keyInsights": []}


def _handle_class_performance(payload: dict[str, Any]) -> dict[str, Any]:
    """Generate an AI narrative for class performance data."""
    from langchain_core.messages import HumanMessage, SystemMessage
    from app.core.llm import create_chain

    context = payload.get("context", "")
    if not context:
        return {"insight": "No class data provided."}

    system = (
        "You are an experienced educational analyst. "
        "Given class performance data, write a concise diagnostic report "
        "(3-4 sentences) and exactly 3 actionable teaching recommendations."
    )
    chain = create_chain(mode="summarize")
    try:
        raw = chain.invoke([
            SystemMessage(content=system),
            HumanMessage(content=context[:3000]),
        ])
        return {"insight": raw.strip()}
    except Exception as exc:
        logger.warning("class_performance generation failed: %s", exc)
        return {"insight": "Unable to generate insight at this time."}


# ── Main dispatcher ────────────────────────────────────────────────────────────

_HANDLERS = {
    "generate":           _handle_generate,
    "generate_questions": _handle_generate,   # same pipeline, caller sets mode
    "evaluate":           _handle_evaluate,
    "summarize_session":  _handle_summarize_session,
    "class_performance":  _handle_class_performance,
}


def dispatch(task_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    handler = _HANDLERS.get(task_type)
    if handler is None:
        raise HTTPException(status_code=400, detail=f"Unknown task_type: {task_type!r}")
    logger.info("Orchestrator dispatching task_type=%s", task_type)
    return handler(payload)
