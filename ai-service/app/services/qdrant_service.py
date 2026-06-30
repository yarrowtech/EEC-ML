import os
import uuid
import logging
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
COLLECTION = os.getenv("QDRANT_COLLECTION", "teacher_documents")
VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "768"))


def _make_client() -> QdrantClient:
    if QDRANT_API_KEY:
        return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    return QdrantClient(url=QDRANT_URL)


def ensure_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection %s", COLLECTION)


def _point_id(material_id: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{material_id}:{chunk_index}"))


def upsert_chunks(
    material_id: str,
    school_id: str,
    class_id: str,
    section_id: str,
    subject_name: str,
    chapter_id: str,
    chapter_title: str,
    topic_title: str,
    chunks: list[str],
    vectors: list[list[float]],
) -> int:
    client = _make_client()
    ensure_collection(client)

    points = [
        PointStruct(
            id=_point_id(material_id, i),
            vector=vector,
            payload={
                "material_id": material_id,
                "school_id": school_id,
                "class_id": class_id,
                "section_id": section_id,
                "subject_name": subject_name,
                "chapter_id": chapter_id,
                "chapter_title": chapter_title,
                "topic_title": topic_title,
                "chunk_text": chunk,
                "chunk_index": i,
            },
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]

    client.upsert(collection_name=COLLECTION, points=points, wait=True)
    return len(points)


def search_chunks(
    query_vector: list[float],
    school_id: str,
    chapter_title: str | None = None,
    subject_name: str | None = None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    client = _make_client()

    conditions: list[FieldCondition] = [
        FieldCondition(key="school_id", match=MatchValue(value=school_id))
    ]
    if chapter_title:
        conditions.append(
            FieldCondition(key="chapter_title", match=MatchValue(value=chapter_title))
        )
    if subject_name and not chapter_title:
        conditions.append(
            FieldCondition(key="subject_name", match=MatchValue(value=subject_name))
        )

    results = client.search(
        collection_name=COLLECTION,
        query_vector=query_vector,
        query_filter=Filter(must=conditions),
        limit=limit,
        with_payload=True,
    )

    return [
        {
            "id": str(hit.id),
            "score": hit.score,
            "text": hit.payload.get("chunk_text", ""),
            "chapter_title": hit.payload.get("chapter_title", ""),
            "topic_title": hit.payload.get("topic_title", ""),
        }
        for hit in results
    ]


def delete_material_chunks(material_id: str) -> None:
    client = _make_client()
    client.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="material_id", match=MatchValue(value=material_id))]
        ),
    )
