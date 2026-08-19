from typing import Any, Literal

from pydantic import BaseModel


SUPPORTED_TASKS = Literal[
    "generate",           # RAG tutor generation (all modes)
    "generate_questions", # Teacher question generation with explicit difficulty
    "evaluate",           # Academic answer evaluation
    "summarize_session",  # Condense conversation into rolling memory summary
    "class_performance",  # AI narrative for class performance analytics
]


class OrchestrateRequest(BaseModel):
    task_type: SUPPORTED_TASKS
    payload: dict[str, Any]


class OrchestrateResponse(BaseModel):
    task_type: str
    data: dict[str, Any]
    model: str = ""
