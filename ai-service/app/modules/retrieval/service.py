# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

import logging
import random
import re

from app.core.config import settings
from app.modules.documents.repository import get_chapter_chunks, keyword_search_chunks, search_chunks
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


def _reciprocal_rank_fusion(lists: list[list[dict]], k: int = 60) -> list[dict]:
    """Merge multiple ranked result lists using Reciprocal Rank Fusion.

    RRF score = sum(1 / (k + rank)) across all lists. Deduplication by chunk ID.
    Higher score = earlier in more ranked lists = better combined hit.
    """
    scores: dict[str, dict] = {}
    for ranked in lists:
        for rank, item in enumerate(ranked):
            cid = item.get("id", "")
            if not cid:
                continue
            if cid not in scores:
                scores[cid] = {**item, "rrf_score": 0.0}
            scores[cid]["rrf_score"] += 1.0 / (k + rank + 1)
    return sorted(scores.values(), key=lambda x: x["rrf_score"], reverse=True)


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


# Modes that answer a specific question — worth focusing the chapter window on it.
# (Whole-chapter modes like notes / mind_map / summarize keep the positional window.)
_QUESTION_MODES = {"explain", "visual_explain", "custom"}


def _select_relevant_chapter_window(query_text: str, ordered: list[dict], limit: int) -> list[dict]:
    """Pick the `limit` chapter chunks most relevant to `query_text`, keeping reading order.

    The chapter branch normally returns the first `limit` chunks (the chapter opening),
    which makes every follow-up question see the same text. When the student asked a
    specific question, score the chunks against it and take a focused slice instead.
    Falls back to the positional window when nothing matches.
    """
    stop_words = {
        "the", "and", "for", "with", "from", "this", "that", "show", "explain",
        "how", "using", "use", "visual", "page", "example", "another", "more",
        "give", "different", "chapter", "about",
    }
    tokens = {
        token for token in re.findall(r"[a-z0-9]+", query_text.casefold())
        if len(token) >= 3 and token not in stop_words
    }
    if not tokens:
        return ordered[:limit]

    def score(chunk: dict) -> int:
        searchable = str(chunk.get("text", "")).casefold()
        return sum(1 for token in tokens if token in searchable)

    scored = [(score(chunk), idx, chunk) for idx, chunk in enumerate(ordered)]
    if not any(s > 0 for s, _, _ in scored):
        return ordered[:limit]

    top = sorted(scored, key=lambda t: (-t[0], t[1]))[:limit]
    return [chunk for _, _, chunk in sorted(top, key=lambda t: t[1])]


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
    chapter_titles = [chapter_title]
    normalized_title = chapter_title.casefold()
    if "mathematics" in normalized_title:
        chapter_titles.append(re.sub(r"mathematics", "Mathematic", chapter_title, flags=re.IGNORECASE))
    elif re.search(r"\bmathematic\b", normalized_title):
        chapter_titles.append(re.sub(r"\bmathematic\b", "Mathematics", chapter_title, flags=re.IGNORECASE))

    chunks = []
    matched_title = chapter_title
    for candidate_title in dict.fromkeys(chapter_titles):
        chunks = get_chapter_chunks(
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            academic_year_id=academic_year_id,
            subject_id=subject_id,
            subject_name=subject_name,
            chapter_title=candidate_title,
        )
        if chunks:
            matched_title = candidate_title
            break
    if chunks or not subject_id or not subject_name:
        return chunks

    # Points created before subject_id metadata was introduced remain safely
    # scoped by school/class/section/chapter and the normalized subject name.
    logger.info(
        "No chapter chunks for subject_id=%s; retrying legacy subject_name=%r",
        subject_id,
        subject_name,
    )
    for candidate_title in dict.fromkeys([matched_title, *chapter_titles]):
        chunks = get_chapter_chunks(
            school_id=school_id,
            class_id=class_id,
            section_id=section_id,
            academic_year_id=academic_year_id,
            subject_id=None,
            subject_name=subject_name,
            chapter_title=candidate_title,
        )
        if chunks:
            return chunks
    return []


def _search_chunks_with_legacy_subject_fallback(
    *,
    query_vector: list[float],
    query_text: str,
    school_id: str,
    class_id: str | None,
    section_id: str | None,
    academic_year_id: str | None,
    subject_id: str | None,
    subject_name: str | None,
    limit: int,
) -> list[dict]:
    # ── Semantic retrieval ─────────────────────────────────────────────────────
    semantic_hits = search_chunks(
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
    if not semantic_hits and subject_id and subject_name:
        logger.info(
            "No subject hits for subject_id=%s; retrying legacy subject_name=%r",
            subject_id,
            subject_name,
        )
        semantic_hits = search_chunks(
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

    # ── Keyword (BM25-style) retrieval — runs even when semantic succeeds ──────
    keyword_hits = keyword_search_chunks(
        query_text=query_text,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        subject_name=subject_name,
        limit=limit // 2,
    )

    if not keyword_hits and not semantic_hits:
        return []

    if not keyword_hits:
        return semantic_hits

    if not semantic_hits:
        return keyword_hits

    # ── Reciprocal Rank Fusion ─────────────────────────────────────────────────
    merged = _reciprocal_rank_fusion([semantic_hits, keyword_hits])
    logger.info(
        "Hybrid RRF: %d semantic + %d keyword → %d merged hits",
        len(semantic_hits), len(keyword_hits), len(merged),
    )
    return merged


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
    mode: str | None = None,
) -> list[str]:
    subject_norm = _normalize_subject(subject)

    # Chapter-scoped path: scroll the chapter chunks in document order. Similarity ranking is
    # deliberately skipped for whole-chapter modes (notes/quiz/summarize) — narrative content
    # scores low against task-style queries. For question-answering modes with an actual
    # question, focus the window on the question instead of always the chapter opening.
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
            question_text = (question or "").strip()
            if mode in _QUESTION_MODES and question_text and len(ordered) > settings.max_chapter_context_chunks:
                capped = _select_relevant_chapter_window(
                    " ".join(filter(None, [topic, sub_topic, question_text])),
                    ordered,
                    settings.max_chapter_context_chunks,
                )
            else:
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
        query_text=query_text,
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
            "Qdrant hybrid RAG: %d chunks subject=%r scores=%s",
            len(relevant),
            subject,
            [round(h.get("score", 0), 3) for h in relevant],
        )
        # Keep the top chunk as the anchor; shuffle the rest so the LLM sees
        # a different ordering each call and generates varied content.
        pool = relevant[: settings.max_context_chunks]
        if len(pool) > 2:
            top, rest = pool[:1], pool[1:]
            random.shuffle(rest)
            pool = top + rest
        return [h["text"] for h in pool]

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
    mode: str | None = None,
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
            question_text = (question or "").strip()
            if mode in _QUESTION_MODES and question_text and len(ordered) > settings.max_chapter_context_chunks:
                capped = _select_relevant_chapter_window(
                    " ".join(filter(None, [topic, sub_topic, question_text])),
                    ordered,
                    settings.max_chapter_context_chunks,
                )
            else:
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
        query_text=query_text,
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
        pool = relevant[: settings.max_context_chunks]
        if len(pool) > 2:
            top, rest = pool[:1], pool[1:]
            random.shuffle(rest)
            pool = top + rest
        return [h["text"] for h in pool], _dedupe_citations(pool)

    return [], []


def _dedupe_citations(chunks: list[dict]) -> list[dict]:
    """Return one citation per source, including retrieved visual page evidence."""
    citations_by_source: dict[str, dict] = {}
    for chunk in chunks:
        mid = chunk.get("material_id", "")
        if not mid:
            continue
        source_url = chunk.get("source_url", "")
        source_name = chunk.get("source_name", "")
        source_key = source_url.strip().casefold() or f"{source_name.strip().casefold()}::{mid}"
        citation = citations_by_source.setdefault(
            source_key,
            {
                "material_id": mid,
                "source_name": source_name,
                "source_url": source_url,
                "chapter_title": chunk.get("chapter_title", ""),
                "discipline": chunk.get("discipline", ""),
                "curriculum_code": chunk.get("curriculum_code", ""),
                "visual_pages": [],
            },
        )
        if re.fullmatch(r"[0-9a-f]{24}", str(mid), re.IGNORECASE):
            citation["material_id"] = mid
        page_number = chunk.get("page_number")
        if chunk.get("chunk_type") == "visual" and isinstance(page_number, int):
            existing_pages = {page["page_number"] for page in citation["visual_pages"]}
            if page_number not in existing_pages:
                citation["visual_pages"].append({
                    "page_number": page_number,
                    "description": chunk.get("text", "")[:500],
                })
    return list(citations_by_source.values())
