import logging

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.modules.chat.schemas import TutorGenerateRequest
from app.modules.chat.service import NOT_FOUND_MESSAGE, build_prompt, retrieve_relevant_chunks
from app.modules.parser.cleaner import _strip_teacher_notes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Chat"])


# Modes that produce long structured output for an entire chapter need a higher token budget.
_LONG_OUTPUT_MODES = {"mind_map", "notes", "flashcards", "summarize"}


def _create_chain(mode: str = "") -> Runnable:
    num_predict = (
        settings.ollama_num_predict_extended
        if mode in _LONG_OUTPUT_MODES
        else settings.ollama_num_predict
    )
    llm = ChatOllama(
        base_url=settings.ollama_url,
        model=settings.ollama_model,
        num_ctx=settings.ollama_num_ctx,
        num_predict=num_predict,
    )
    return llm | StrOutputParser()


@router.post("/tutor")
async def generate_tutor_content(req: TutorGenerateRequest) -> dict:
    relevant_chunks = retrieve_relevant_chunks(req)
    if not relevant_chunks:
        return {
            "mode": req.mode,
            "model": None,
            "content": NOT_FOUND_MESSAGE,
            "groundedInMaterial": False,
            "noMaterialFound": True,
        }

    context = _strip_teacher_notes("\n\n".join(relevant_chunks))
    system, user_prompt = build_prompt(req, context)
    chain = _create_chain(mode=req.mode)
    try:
        content = chain.invoke([
            SystemMessage(content=system),
            HumanMessage(content=user_prompt),
        ])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    return {
        "mode": req.mode,
        "model": settings.ollama_model,
        "content": content,
        "groundedInMaterial": True,
        "noMaterialFound": False,
    }
