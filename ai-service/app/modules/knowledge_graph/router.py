import logging

from fastapi import APIRouter, HTTPException

from app.modules.knowledge_graph.schemas import GraphAnalyzeRequest, GraphAnalyzeResult
from app.modules.knowledge_graph.service import analyze

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge_graph"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=GraphAnalyzeResult)
async def analyze_graph(req: GraphAnalyzeRequest) -> GraphAnalyzeResult:
    """Traverse a curriculum graph + mastery snapshot.

    Returns topological order, cycle detection, weak-topic gaps, root-cause
    prerequisites, ready topics, and (when target_topic is given) an ordered
    bridge path from the student's gaps up to the target.
    """
    try:
        return analyze(req)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("knowledge-graph analyze failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
