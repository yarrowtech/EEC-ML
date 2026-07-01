import logging

import ollama
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def embed_texts(texts: list[str]) -> list[list[float]]:
    try:
        client = ollama.Client(host=settings.ollama_url)
        response = client.embed(model=settings.ollama_embed_model, input=texts)
        return response["embeddings"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc
