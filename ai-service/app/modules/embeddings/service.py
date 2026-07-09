import logging

from fastapi import HTTPException
from langchain_ollama import OllamaEmbeddings

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_embeddings() -> OllamaEmbeddings:
    return OllamaEmbeddings(base_url=settings.ollama_url, model=settings.ollama_embed_model)


def embed_texts(texts: list[str], *, kind: str = "document") -> list[list[float]]:
    # nomic-embed-text requires task prefixes; retrieval quality degrades without them.
    prefix = ""
    if "nomic" in settings.ollama_embed_model:
        prefix = "search_query: " if kind == "query" else "search_document: "
    prefixed = [prefix + text for text in texts]
    try:
        embeddings = _get_embeddings()
        if kind == "query" and len(prefixed) == 1:
            return [embeddings.embed_query(prefixed[0])]
        return embeddings.embed_documents(prefixed)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc
