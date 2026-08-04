"""
Adaptive language memory using Qdrant + LangChain embeddings.

Each completed assessment is embedded and stored in a dedicated Qdrant
collection (student_language_memory). Before a new assessment the student's
previous results are retrieved semantically so the LLM can personalise
feedback and difficulty recommendations.
"""

import json
import logging
import uuid
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.modules.embeddings.service import embed_texts

logger = logging.getLogger(__name__)

_qdrant_client: AsyncQdrantClient | None = None


async def _get_client() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
        )
    return _qdrant_client


async def _ensure_collection() -> None:
    client = await _get_client()
    exists = True
    try:
        await client.get_collection(settings.qdrant_language_collection)
    except Exception:
        exists = False

    if not exists:
        await client.create_collection(
            collection_name=settings.qdrant_language_collection,
            vectors_config=VectorParams(
                size=settings.qdrant_language_vector_size,
                distance=Distance.COSINE,
            ),
        )
        logger.info("Created Qdrant collection: %s", settings.qdrant_language_collection)

    # Ensure payload indexes exist for filtered scroll queries
    try:
        await client.create_payload_index(
            collection_name=settings.qdrant_language_collection,
            field_name="student_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        await client.create_payload_index(
            collection_name=settings.qdrant_language_collection,
            field_name="mode",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except Exception:
        pass  # Indexes already exist


async def store_assessment(
    student_id: str,
    school_id: str,
    assessment_id: str,
    mode: str,
    content: str,
    metadata: dict[str, Any],
) -> bool:
    """Embed and store an assessment result in Qdrant."""
    try:
        await _ensure_collection()
        client = await _get_client()

        # Build a descriptive text for embedding
        embed_text = (
            f"Student {student_id} {mode} assessment. "
            f"Content: {content[:500]}. "
            f"Metadata: {json.dumps(metadata)[:300]}"
        )
        vectors = await embed_texts([embed_text])
        vector = vectors[0]

        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "student_id": student_id,
                "school_id": school_id,
                "assessment_id": assessment_id,
                "mode": mode,
                "content_preview": content[:500],
                "metadata": metadata,
            },
        )
        await client.upsert(
            collection_name=settings.qdrant_language_collection,
            points=[point],
        )
        return True
    except Exception as exc:
        logger.warning("Memory store failed: %s", exc)
        return False


async def retrieve_history(
    student_id: str,
    mode: str,
    limit: int = 3,
) -> list[dict]:
    """Retrieve the most recent assessment results for a student."""
    try:
        await _ensure_collection()
        client = await _get_client()

        # Use scroll (not search) to get the student's recent results by filter
        results, _ = await client.scroll(
            collection_name=settings.qdrant_language_collection,
            scroll_filter=Filter(
                must=[
                    FieldCondition(key="student_id", match=MatchValue(value=student_id)),
                    FieldCondition(key="mode", match=MatchValue(value=mode)),
                ]
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        return [
            {
                "assessment_id": r.payload.get("assessment_id"),
                "mode": r.payload.get("mode"),
                "content_preview": r.payload.get("content_preview", ""),
                "metadata": r.payload.get("metadata", {}),
            }
            for r in results
        ]
    except Exception as exc:
        logger.warning("Memory retrieve failed: %s", exc)
        return []
