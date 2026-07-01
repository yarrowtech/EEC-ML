import logging

from app.core.config import settings
from app.modules.documents.repository import search_chunks
from app.modules.embeddings.service import embed_texts

logger = logging.getLogger(__name__)


def _normalize_subject(value: str | None) -> str | None:
    normalized = " ".join((value or "").lower().split())
    return normalized or None


def retrieve_from_qdrant(
    *,
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    subject: str | None,
    chapter_title: str | None,
    topic: str | None,
    sub_topic: str | None,
    question: str | None,
) -> list[str]:
    query_text = " ".join(filter(None, [subject, topic, sub_topic, (question or "").strip()]))
    vectors = embed_texts([query_text])
    query_vector = vectors[0]

    subject_norm = _normalize_subject(subject)

    search_attempts = [
        {"chapter_title": chapter_title or None, "subject_name": subject_norm},
        {"chapter_title": None, "subject_name": subject_norm},
    ]

    seen: set[tuple] = set()
    for attempt in search_attempts:
        key = (attempt["chapter_title"], attempt["subject_name"])
        if key in seen:
            continue
        seen.add(key)

        hits = search_chunks(
            query_vector=query_vector,
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            chapter_title=attempt["chapter_title"],
            subject_name=attempt["subject_name"],
            limit=settings.max_context_chunks,
        )
        relevant = [
            hit for hit in hits
            if hit.get("text") and hit.get("score", 0) >= settings.rag_relevance_threshold
        ]
        if relevant:
            logger.info(
                "Qdrant RAG matched %d chunks chapter=%r subject=%r scores=%s",
                len(relevant),
                attempt["chapter_title"],
                attempt["subject_name"],
                [round(h.get("score", 0), 3) for h in relevant],
            )
            return [h["text"] for h in relevant][: settings.max_context_chunks]

    logger.info(
        "Qdrant RAG found no chunks above threshold=%.2f school=%s subject=%r chapter=%r",
        settings.rag_relevance_threshold,
        school_id,
        subject,
        chapter_title,
    )
    return []
