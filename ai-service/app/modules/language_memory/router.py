import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.modules.language_memory import service as mem_svc

router = APIRouter(prefix="/memory", tags=["memory"])
logger = logging.getLogger(__name__)


class StoreRequest(BaseModel):
    student_id: str
    school_id: str = ""
    assessment_id: str
    mode: str  # "reading" | "writing"
    content: str
    metadata: dict[str, Any] = {}


class RetrieveRequest(BaseModel):
    student_id: str
    mode: str  # "reading" | "writing"
    limit: int = 3


@router.post("/store")
async def store(req: StoreRequest):
    """Store an assessment embedding in Qdrant for adaptive memory."""
    try:
        ok = await mem_svc.store_assessment(
            student_id=req.student_id,
            school_id=req.school_id,
            assessment_id=req.assessment_id,
            mode=req.mode,
            content=req.content,
            metadata=req.metadata,
        )
        return {"success": ok}
    except Exception as exc:
        logger.exception("Memory store error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/retrieve")
async def retrieve(req: RetrieveRequest):
    """Retrieve recent assessment history for a student."""
    try:
        results = await mem_svc.retrieve_history(
            student_id=req.student_id,
            mode=req.mode,
            limit=req.limit,
        )
        return {"results": results}
    except Exception as exc:
        logger.exception("Memory retrieve error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
