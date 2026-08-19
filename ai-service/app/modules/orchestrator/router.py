from fastapi import APIRouter

from app.modules.orchestrator.schemas import OrchestrateRequest
from app.modules.orchestrator.service import dispatch

router = APIRouter(tags=["Orchestrator"])


@router.post("/orchestrate")
async def orchestrate(req: OrchestrateRequest) -> dict:
    """Central AI Orchestrator — routes all AI tasks through a single entry point.

    Node.js sends all AI requests here with a task_type and a task-specific payload.
    The orchestrator dispatches to the correct internal module and returns the result
    in the same format as the underlying endpoint so Node.js callers need no
    special-casing.

    Supported task_types:
      generate           — RAG tutor generation (all modes: quiz, explain, notes, …)
      generate_questions — Teacher question generation with explicit difficulty
      evaluate           — Academic MCQ / written answer evaluation
      summarize_session  — Condense a conversation into a rolling memory summary
      class_performance  — AI narrative report for class performance analytics
    """
    return dispatch(req.task_type, req.payload)
