import logging

import ollama
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def embed_texts(texts: list[str], *, kind: str = "document") -> list[list[float]]:
    # nomic-embed-text requires task prefixes; retrieval quality degrades without them.
    prefix = ""
    if "nomic" in settings.ollama_embed_model:
        prefix = "search_query: " if kind == "query" else "search_document: "
    try:
        client = ollama.Client(host=settings.ollama_url)
        response = client.embed(
            model=settings.ollama_embed_model,
            input=[prefix + text for text in texts],
        )
        return response["embeddings"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc
