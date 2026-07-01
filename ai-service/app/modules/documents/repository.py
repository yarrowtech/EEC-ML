import logging
import uuid
from typing import Any

from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import settings
from app.core.qdrant import make_qdrant_client
logger = logging.getLogger(__name__)


def _ensure_collection() -> None:
    client = make_qdrant_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=settings.qdrant_vector_size, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection %s", settings.qdrant_collection)

    for field in (
        "school_id", "class_id", "section_id", "chapter_title",
        "chapter_id", "subject_name", "material_id", "source_id",
    ):
        try:
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass


def _point_id(source_id: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}:{chunk_index}"))


def upsert_chunks(
    *,
    material_id: str,
    source_id: str,
    source_name: str,
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
    _ensure_collection()
    client = make_qdrant_client()
    subject_name_norm = " ".join((subject_name or "").lower().split())
    points = [
        PointStruct(
            id=_point_id(source_id, i),
            vector=vector,
            payload={
                "material_id": material_id,
                "source_id": source_id,
                "source_name": source_name,
                "school_id": school_id,
                "class_id": class_id,
                "section_id": section_id,
                "subject_name": subject_name_norm,
                "chapter_id": chapter_id,
                "chapter_title": chapter_title,
                "topic_title": topic_title,
                "chunk_text": chunk,
                "chunk_index": i,
            },
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=settings.qdrant_collection, points=points, wait=True)
    return len(points)


def delete_material_chunks(material_id: str) -> None:
    client = make_qdrant_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=FilterSelector(
            filter=Filter(
                must=[FieldCondition(key="material_id", match=MatchValue(value=material_id))]
            )
        ),
    )


def search_chunks(
    *,
    query_vector: list[float],
    school_id: str,
    class_id: str | None = None,
    section_id: str | None = None,
    chapter_title: str | None = None,
    subject_name: str | None = None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    client = make_qdrant_client()
    conditions: list[FieldCondition] = [
        FieldCondition(key="school_id", match=MatchValue(value=school_id))
    ]
    if class_id:
        conditions.append(FieldCondition(key="class_id", match=MatchValue(value=class_id)))
    if section_id:
        conditions.append(FieldCondition(key="section_id", match=MatchValue(value=section_id)))
    if chapter_title:
        conditions.append(FieldCondition(key="chapter_title", match=MatchValue(value=chapter_title)))
    if subject_name and not chapter_title:
        conditions.append(FieldCondition(key="subject_name", match=MatchValue(value=subject_name)))

    try:
        response = client.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector,
            query_filter=Filter(must=conditions),
            limit=limit,
            with_payload=True,
        )
    except Exception as exc:
        logger.warning("Qdrant search failed (collection=%s): %s", settings.qdrant_collection, exc)
        return []

    return [
        {
            "id": str(hit.id),
            "score": hit.score,
            "text": hit.payload.get("chunk_text", ""),
            "chapter_title": hit.payload.get("chapter_title", ""),
            "topic_title": hit.payload.get("topic_title", ""),
        }
        for hit in response.points
    ]
