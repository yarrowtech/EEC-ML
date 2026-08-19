# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

import logging
import uuid
from typing import Any

from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchText,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    TextIndexParams,
    TokenizerType,
    VectorParams,
)

from app.core.config import settings
from app.core.qdrant import make_qdrant_client
logger = logging.getLogger(__name__)
_collection_ready = False


def _ensure_collection() -> None:
    global _collection_ready
    if _collection_ready:
        return
    client = make_qdrant_client()
    existing = {c.name for c in client.get_collections().collections}
    if settings.qdrant_collection not in existing:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=settings.qdrant_vector_size, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection %s", settings.qdrant_collection)

    for field in (
        "school_id", "class_id", "section_id", "academic_year_id", "chapter_title",
        "chapter_id", "subject_id", "subject_name", "discipline", "curriculum_code",
        "material_id", "source_id", "concepts", "formulas", "units",
        "chunk_type",
    ):
        try:
            client.create_payload_index(
                collection_name=settings.qdrant_collection,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass

    # Full-text index on chunk_text enables BM25-style keyword search via MatchText.
    try:
        client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="chunk_text",
            field_schema=TextIndexParams(
                type="text",
                tokenizer=TokenizerType.WORD,
                min_token_len=3,
                max_token_len=30,
                lowercase=True,
            ),
        )
    except Exception:
        pass

    _collection_ready = True


def _point_id(source_id: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{source_id}:{chunk_index}"))


def upsert_chunks(
    *,
    material_id: str,
    source_id: str,
    source_url: str,
    source_name: str,
    school_id: str,
    class_id: str,
    section_id: str,
    academic_year_id: str,
    subject_id: str,
    subject_name: str,
    discipline: str,
    curriculum_code: str,
    chapter_id: str,
    chapter_title: str,
    topic_title: str,
    chunks: list[str],
    vectors: list[list[float]],
    start_chars: list[int | None] | None = None,
    chunk_metadata: list[dict] | None = None,
    page_numbers: list[int | None] | None = None,
    chunk_types: list[str] | None = None,
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
                "source_url": source_url,
                "source_name": source_name,
                "school_id": school_id,
                "class_id": class_id,
                "section_id": section_id,
                "academic_year_id": academic_year_id,
                "subject_id": subject_id,
                "subject_name": subject_name_norm,
                "discipline": discipline,
                "curriculum_code": curriculum_code,
                "chapter_id": chapter_id,
                "chapter_title": chapter_title,
                "topic_title": topic_title,
                "chunk_text": chunk,
                "chunk_index": i,
                "chunk_type": chunk_types[i] if chunk_types else "text",
                "page_number": page_numbers[i] if page_numbers else None,
                "start_char": start_chars[i] if start_chars else None,
                "concepts": (chunk_metadata[i].get("concepts", []) if chunk_metadata else []),
                "formulas": (chunk_metadata[i].get("formulas", []) if chunk_metadata else []),
                "units": (chunk_metadata[i].get("units", []) if chunk_metadata else []),
            },
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=settings.qdrant_collection, points=points, wait=True)
    return len(points)


def get_chapter_chunks(
    *,
    school_id: str,
    class_id: str | None = None,
    section_id: str | None = None,
    academic_year_id: str | None = None,
    subject_id: str | None = None,
    subject_name: str | None = None,
    chapter_title: str,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Scroll all chunks for a chapter without vector similarity ranking.

    Using scroll instead of query_points so every chunk is considered regardless
    of how its embedding scores against the current query. This prevents narrative
    content (poems, story text) from being dropped because it happens to score
    below exercise or vocabulary chunks on a 'simplify notes' query vector.
    """
    client = make_qdrant_client()
    conditions: list[FieldCondition] = [
        FieldCondition(key="school_id", match=MatchValue(value=school_id)),
        FieldCondition(key="chapter_title", match=MatchValue(value=chapter_title)),
    ]
    if class_id:
        conditions.append(FieldCondition(key="class_id", match=MatchValue(value=class_id)))
    if section_id:
        conditions.append(FieldCondition(key="section_id", match=MatchValue(value=section_id)))
    if academic_year_id:
        conditions.append(FieldCondition(key="academic_year_id", match=MatchValue(value=academic_year_id)))
    if subject_id:
        conditions.append(FieldCondition(key="subject_id", match=MatchValue(value=subject_id)))
    elif subject_name:
        conditions.append(FieldCondition(key="subject_name", match=MatchValue(value=subject_name)))

    try:
        results, _ = client.scroll(
            collection_name=settings.qdrant_collection,
            scroll_filter=Filter(must=conditions),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    except Exception as exc:
        logger.warning("Qdrant chapter scroll failed: %s", exc)
        return []

    return [
        {
            "id": str(point.id),
            "score": 1.0,
            "text": point.payload.get("chunk_text", ""),
            "chapter_title": point.payload.get("chapter_title", ""),
            "topic_title": point.payload.get("topic_title", ""),
            "chunk_index": point.payload.get("chunk_index", 0),
            "start_char": point.payload.get("start_char"),
            "source_name": point.payload.get("source_name", ""),
            "source_url": point.payload.get("source_url", ""),
            "material_id": point.payload.get("material_id", ""),
            "chunk_type": point.payload.get("chunk_type", "text"),
            "page_number": point.payload.get("page_number"),
            "subject_id": point.payload.get("subject_id", ""),
            "discipline": point.payload.get("discipline", ""),
            "curriculum_code": point.payload.get("curriculum_code", ""),
            "concepts": point.payload.get("concepts", []),
            "formulas": point.payload.get("formulas", []),
            "units": point.payload.get("units", []),
        }
        for point in results
        if point.payload.get("chunk_text")
    ]


def keyword_search_chunks(
    *,
    query_text: str,
    school_id: str,
    class_id: str | None = None,
    section_id: str | None = None,
    academic_year_id: str | None = None,
    subject_id: str | None = None,
    subject_name: str | None = None,
    limit: int = 12,
) -> list[dict]:
    """Keyword retrieval using Qdrant full-text search on chunk_text.

    Runs parallel to semantic search and merged via RRF to form the hybrid result.
    Returns same dict shape as search_chunks() so callers handle them uniformly.
    """
    _ensure_collection()
    client = make_qdrant_client()
    conditions: list[FieldCondition] = [
        FieldCondition(key="school_id", match=MatchValue(value=school_id)),
        FieldCondition(key="chunk_text", match=MatchText(text=query_text)),
    ]
    if class_id:
        conditions.append(FieldCondition(key="class_id", match=MatchValue(value=class_id)))
    if section_id:
        conditions.append(FieldCondition(key="section_id", match=MatchValue(value=section_id)))
    if academic_year_id:
        conditions.append(FieldCondition(key="academic_year_id", match=MatchValue(value=academic_year_id)))
    if subject_id:
        conditions.append(FieldCondition(key="subject_id", match=MatchValue(value=subject_id)))
    elif subject_name:
        conditions.append(FieldCondition(key="subject_name", match=MatchValue(value=subject_name)))

    try:
        results, _ = client.scroll(
            collection_name=settings.qdrant_collection,
            scroll_filter=Filter(must=conditions),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    except Exception as exc:
        logger.warning("Qdrant keyword search failed: %s", exc)
        return []

    return [
        {
            "id": str(point.id),
            "score": 1.0,  # keyword hits are binary; RRF handles ranking
            "dense_score": 0.0,
            "text": point.payload.get("chunk_text", ""),
            "chapter_title": point.payload.get("chapter_title", ""),
            "topic_title": point.payload.get("topic_title", ""),
            "chunk_index": point.payload.get("chunk_index", 0),
            "start_char": point.payload.get("start_char"),
            "source_name": point.payload.get("source_name", ""),
            "source_url": point.payload.get("source_url", ""),
            "material_id": point.payload.get("material_id", ""),
            "chunk_type": point.payload.get("chunk_type", "text"),
            "page_number": point.payload.get("page_number"),
            "subject_id": point.payload.get("subject_id", ""),
            "discipline": point.payload.get("discipline", ""),
            "curriculum_code": point.payload.get("curriculum_code", ""),
            "concepts": point.payload.get("concepts", []),
            "formulas": point.payload.get("formulas", []),
            "units": point.payload.get("units", []),
        }
        for point in results
        if point.payload.get("chunk_text")
    ]


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


def get_material_source(
    *,
    material_id: str,
    school_id: str,
    class_id: str | None = None,
    section_id: str | None = None,
) -> dict[str, Any] | None:
    """Resolve one source only inside the requesting student's tenant/class scope."""

    conditions = [
        FieldCondition(key="material_id", match=MatchValue(value=material_id)),
        FieldCondition(key="school_id", match=MatchValue(value=school_id)),
    ]
    if class_id:
        conditions.append(FieldCondition(key="class_id", match=MatchValue(value=class_id)))
    if section_id:
        conditions.append(FieldCondition(key="section_id", match=MatchValue(value=section_id)))
    try:
        points, _ = make_qdrant_client().scroll(
            collection_name=settings.qdrant_collection,
            scroll_filter=Filter(must=conditions),
            limit=1,
            with_payload=True,
            with_vectors=False,
        )
    except Exception as exc:
        logger.warning("Qdrant material source lookup failed: %s", exc)
        return None
    if not points:
        return None
    payload = points[0].payload or {}
    return {
        "source_url": payload.get("source_url", ""),
        "source_name": payload.get("source_name", ""),
    }


def search_chunks(
    *,
    query_vector: list[float],
    school_id: str,
    class_id: str | None = None,
    section_id: str | None = None,
    academic_year_id: str | None = None,
    subject_id: str | None = None,
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
    if academic_year_id:
        conditions.append(FieldCondition(key="academic_year_id", match=MatchValue(value=academic_year_id)))
    if subject_id:
        conditions.append(FieldCondition(key="subject_id", match=MatchValue(value=subject_id)))
    if chapter_title:
        conditions.append(FieldCondition(key="chapter_title", match=MatchValue(value=chapter_title)))
    if subject_name and not chapter_title and not subject_id:
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
            "chunk_index": hit.payload.get("chunk_index", 0),
            "source_name": hit.payload.get("source_name", ""),
            "source_url": hit.payload.get("source_url", ""),
            "material_id": hit.payload.get("material_id", ""),
            "chunk_type": hit.payload.get("chunk_type", "text"),
            "page_number": hit.payload.get("page_number"),
            "subject_id": hit.payload.get("subject_id", ""),
            "discipline": hit.payload.get("discipline", ""),
            "curriculum_code": hit.payload.get("curriculum_code", ""),
            "concepts": hit.payload.get("concepts", []),
            "formulas": hit.payload.get("formulas", []),
            "units": hit.payload.get("units", []),
        }
        for hit in response.points
    ]
