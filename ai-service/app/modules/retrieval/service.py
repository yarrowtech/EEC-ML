import logging

from app.core.config import settings
from app.modules.documents.repository import get_chapter_chunks, search_chunks
from app.modules.embeddings.service import embed_texts

logger = logging.getLogger(__name__)


def _normalize_subject(value: str | None) -> str | None:
    normalized = " ".join((value or "").lower().split())
    return normalized or None


def _reconstruct_from_offsets(chunks: list[dict]) -> str:
    """Reconstruct clean chapter text using stored start_char offsets.

    When start_char is available (new ingestion pipeline), this is deterministic
    and exact — no string matching needed. Falls back to suffix/prefix heuristic
    for chunks ingested before the offset field was added.
    """
    if not chunks:
        return ""

    # New path: use stored character offsets
    if chunks[0].get("start_char") is not None:
        ordered = sorted(chunks, key=lambda c: c["start_char"])
        text = ordered[0]["text"]
        last_end = ordered[0]["start_char"] + len(ordered[0]["text"])
        for chunk in ordered[1:]:
            start = chunk["start_char"]
            body = chunk["text"]
            if start < last_end:
                # Trim the overlapping prefix that is already in `text`
                trim = last_end - start
                if trim < len(body):
                    text += body[trim:]
                    last_end = start + len(body)
            else:
                text += "\n\n" + body
                last_end = start + len(body)
        return text

    # Legacy path: heuristic suffix/prefix matching for old chunks without start_char
    texts = [c["text"] for c in chunks]
    merged = texts[0]
    for next_chunk in texts[1:]:
        tail = merged[-200:]
        head = next_chunk[:200]
        best = 0
        for length in range(min(len(tail), len(head)), 19, -1):
            if tail[-length:] == head[:length]:
                best = length
                break
        merged = merged + (next_chunk[best:] if best > 0 else "\n\n" + next_chunk)
    return merged


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
    subject_norm = _normalize_subject(subject)

    # Chapter-scoped path: scroll ALL chapter chunks in document order.
    # Similarity ranking is deliberately skipped — narrative content (poems,
    # story text) scores low against task-style queries ("simplify", "quiz")
    # and would be dropped by query_points even with a large limit.
    if chapter_title:
        chunks = get_chapter_chunks(
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            chapter_title=chapter_title,
        )
        if chunks:
            ordered = sorted(
                chunks,
                key=lambda h: h["start_char"] if h.get("start_char") is not None else h.get("chunk_index", 0),
            )
            capped = ordered[: settings.max_chapter_context_chunks]
            merged = _reconstruct_from_offsets(capped)
            logger.info(
                "Qdrant chapter scroll: %d chunks → %d chars chapter=%r",
                len(capped),
                len(merged),
                chapter_title,
            )
            return [merged]

    # Subject-wide fallback: embed the query and retrieve by similarity.
    # Embedding is deferred until here so chapter requests pay no embed cost.
    query_text = " ".join(filter(None, [topic, sub_topic, (question or "").strip()])) or subject or ""
    vectors = embed_texts([query_text], kind="query")
    query_vector = vectors[0]

    hits = search_chunks(
        query_vector=query_vector,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        chapter_title=None,
        subject_name=subject_norm,
        limit=settings.max_context_chunks,
    )
    relevant = [
        hit for hit in hits
        if hit.get("text") and hit.get("score", 0) >= settings.rag_relevance_threshold
    ]
    if relevant:
        logger.info(
            "Qdrant subject RAG: %d chunks subject=%r scores=%s",
            len(relevant),
            subject,
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
