import logging

import ollama
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.modules.chat.schemas import TutorGenerateRequest
from app.modules.chat.service import NOT_FOUND_MESSAGE, build_prompt, retrieve_relevant_chunks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Chat"])


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

    system, user_prompt = build_prompt(req, "\n\n".join(relevant_chunks))
    try:
        client = ollama.Client(host=settings.ollama_url)
        response = client.chat(
            model=settings.ollama_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc

    return {
        "mode": req.mode,
        "model": settings.ollama_model,
        "content": response["message"]["content"],
        "groundedInMaterial": True,
        "noMaterialFound": False,
    }
