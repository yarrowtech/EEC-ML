# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

import logging
import re

from app.core.config import settings
from app.modules.documents.repository import get_chapter_chunks, search_chunks
from app.modules.embeddings.service import embed_texts
from app.modules.stem.service import rerank_stem_hits, stem_query_tokens

logger = logging.getLogger(__name__)


def _normalize_subject(value: str | None) -> str | None:
    normalized = " ".join((value or "").lower().split())
    return normalized or None


def _select_hybrid_hits(query_text: str, hits: list[dict]) -> list[dict]:
    """Blend dense relevance with tightly bounded exact STEM-token matches."""
    rescue_floor = max(0.0, settings.rag_relevance_threshold - 0.12)
    reranked = rerank_stem_hits(query_text, hits)
    return [
        hit for hit in reranked
        if hit.get("text") and (
            hit.get("dense_score", 0) >= settings.rag_relevance_threshold
            or (
                hit.get("exact_stem_matches", 0) > 0
                and hit.get("dense_score", 0) >= rescue_floor
            )
        )
    ][: settings.max_context_chunks]


def _rank_visual_chunks(query_text: str, chunks: list[dict]) -> list[dict]:
    stop_words = {
        "the", "and", "for", "with", "from", "this", "that", "show", "explain",
        "how", "using", "use", "visual", "page",
    }
    tokens = stem_query_tokens(query_text)
    tokens.update(
        token for token in re.findall(r"[a-z0-9]+", query_text.casefold())
        if len(token) >= 3 and token not in stop_words
    )

    def rank(chunk: dict) -> tuple[int, int]:
        searchable = str(chunk.get("text", "")).casefold()
        overlap = sum(1 for token in tokens if token in searchable)
        page_number = chunk.get("page_number")
        return overlap, -(page_number if isinstance(page_number, int) else 1000000)

    ranked = sorted(chunks, key=rank, reverse=True)
    if not ranked:
        return []
    best_overlap = rank(ranked[0])[0]
    if best_overlap <= 0:
        return ranked[:1]
    return [chunk for chunk in ranked if rank(chunk)[0] == best_overlap]


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


def _get_chapter_chunks_with_legacy_subject_fallback(
    *,
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    academic_year_id: str | None,
    subject_id: str | None,
    subject_name: str | None,
    chapter_title: str,
) -> list[dict]:
    chunks = get_chapter_chunks(
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        subject_name=subject_name,
        chapter_title=chapter_title,
    )
    if chunks or not subject_id or not subject_name:
        return chunks

    # Points created before subject_id metadata was introduced remain safely
    # scoped by school/class/section/chapter and the normalized subject name.
    logger.info(
        "No chapter chunks for subject_id=%s; retrying legacy subject_name=%r",
        subject_id,
        subject_name,
    )
    return get_chapter_chunks(
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=None,
        subject_name=subject_name,
        chapter_title=chapter_title,
    )


def _search_chunks_with_legacy_subject_fallback(
    *,
    query_vector: list[float],
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    academic_year_id: str | None,
    subject_id: str | None,
    subject_name: str | None,
    limit: int,
) -> list[dict]:
    hits = search_chunks(
        query_vector=query_vector,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        chapter_title=None,
        subject_name=subject_name,
        limit=limit,
    )
    if hits or not subject_id or not subject_name:
        return hits

    logger.info(
        "No subject hits for subject_id=%s; retrying legacy subject_name=%r",
        subject_id,
        subject_name,
    )
    return search_chunks(
        query_vector=query_vector,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=None,
        chapter_title=None,
        subject_name=subject_name,
        limit=limit,
    )


def retrieve_from_qdrant(
    *,
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    academic_year_id: str | None = None,
    subject_id: str | None = None,
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
        chunks = _get_chapter_chunks_with_legacy_subject_fallback(
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            academic_year_id=academic_year_id,
            subject_id=subject_id,
            subject_name=subject_norm,
            chapter_title=chapter_title,
        )
        if chunks:
            text_chunks = [chunk for chunk in chunks if chunk.get("chunk_type", "text") != "visual"]
            visual_chunks = [chunk for chunk in chunks if chunk.get("chunk_type") == "visual"]
            ordered = sorted(
                text_chunks,
                key=lambda h: h["start_char"] if h.get("start_char") is not None else h.get("chunk_index", 0),
            )
            capped = ordered[: settings.max_chapter_context_chunks]
            visual_query = " ".join(filter(None, [topic, sub_topic, question]))
            selected_visual = _rank_visual_chunks(visual_query, visual_chunks)[: settings.max_context_chunks]
            merged = _reconstruct_from_offsets(capped) if capped else ""
            logger.info(
                "Qdrant chapter scroll: %d text + %d visual chunks → %d chars chapter=%r",
                len(capped),
                len(selected_visual),
                len(merged),
                chapter_title,
            )
            return ([merged] if merged else []) + [chunk["text"] for chunk in selected_visual]

    # Subject-wide fallback: embed the query and retrieve by similarity.
    # Embedding is deferred until here so chapter requests pay no embed cost.
    query_text = " ".join(filter(None, [topic, sub_topic, (question or "").strip()])) or subject or ""
    vectors = embed_texts([query_text], kind="query")
    query_vector = vectors[0]

    hits = _search_chunks_with_legacy_subject_fallback(
        query_vector=query_vector,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        subject_name=subject_norm,
        limit=settings.max_context_chunks * 3,
    )
    relevant = _select_hybrid_hits(query_text, hits)
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


def retrieve_from_qdrant_with_meta(
    *,
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    academic_year_id: str | None = None,
    subject_id: str | None = None,
    subject: str | None,
    chapter_title: str | None,
    topic: str | None,
    sub_topic: str | None,
    question: str | None,
) -> tuple[list[str], list[dict]]:
    """Like retrieve_from_qdrant but also returns citation metadata per unique source."""
    subject_norm = _normalize_subject(subject)

    if chapter_title:
        chunks = _get_chapter_chunks_with_legacy_subject_fallback(
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            academic_year_id=academic_year_id,
            subject_id=subject_id,
            subject_name=subject_norm,
            chapter_title=chapter_title,
        )
        if chunks:
            text_chunks = [chunk for chunk in chunks if chunk.get("chunk_type", "text") != "visual"]
            visual_chunks = [chunk for chunk in chunks if chunk.get("chunk_type") == "visual"]
            ordered = sorted(
                text_chunks,
                key=lambda h: h["start_char"] if h.get("start_char") is not None else h.get("chunk_index", 0),
            )
            capped = ordered[: settings.max_chapter_context_chunks]
            visual_query = " ".join(filter(None, [topic, sub_topic, question]))
            selected_visual = _rank_visual_chunks(visual_query, visual_chunks)[: settings.max_context_chunks]
            merged = _reconstruct_from_offsets(capped) if capped else ""
            selected = capped + selected_visual
            citations = _dedupe_citations(selected)
            return ([merged] if merged else []) + [chunk["text"] for chunk in selected_visual], citations

    query_text = " ".join(filter(None, [topic, sub_topic, (question or "").strip()])) or subject or ""
    vectors = embed_texts([query_text], kind="query")
    query_vector = vectors[0]

    hits = _search_chunks_with_legacy_subject_fallback(
        query_vector=query_vector,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        subject_name=subject_norm,
        limit=settings.max_context_chunks * 3,
    )
    relevant = _select_hybrid_hits(query_text, hits)

    if relevant:
        return [h["text"] for h in relevant], _dedupe_citations(relevant)

    return [], []


def _dedupe_citations(chunks: list[dict]) -> list[dict]:
    """Return one citation per source, including retrieved visual page evidence."""
    citations_by_material: dict[str, dict] = {}
    for chunk in chunks:
        mid = chunk.get("material_id", "")
        if not mid:
            continue
        citation = citations_by_material.setdefault(
            mid,
            {
                "material_id": mid,
                "source_name": chunk.get("source_name", ""),
                "source_url": chunk.get("source_url", ""),
                "chapter_title": chunk.get("chapter_title", ""),
                "discipline": chunk.get("discipline", ""),
                "curriculum_code": chunk.get("curriculum_code", ""),
                "visual_pages": [],
            },
        )
        page_number = chunk.get("page_number")
        if chunk.get("chunk_type") == "visual" and isinstance(page_number, int):
            existing_pages = {page["page_number"] for page in citation["visual_pages"]}
            if page_number not in existing_pages:
                citation["visual_pages"].append({
                    "page_number": page_number,
                    "description": chunk.get("text", "")[:500],
                })
    return list(citations_by_material.values())
