# Copyright (c) 2026 HouseofMusa and YarrowTech
# All rights reserved. Unauthorized copying, modification, distribution,
# or duplication is prohibited without prior written permission.

import logging
import tempfile
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote, urlparse

import requests
from fastapi import HTTPException

from app.core.config import settings
from app.modules.documents.repository import delete_material_chunks, upsert_chunks
from app.modules.embeddings.service import embed_texts
from app.modules.parser.chunker import chunk_text_with_offsets
from app.modules.parser.ocr import ocr_pdf
from app.modules.parser.office import extract_office_text
from app.modules.parser.pdf import (
    extract_text_pdf,
    is_text_pdf,
    render_pdf_page_png,
    select_visual_pdf_pages,
)
from app.modules.stem.service import build_embedding_text, build_stem_metadata
from app.modules.vision.client import VisionExtractionError, extract_visual_content

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".doc", ".ppt"}


def _visual_extraction_text(page_number: int, extraction) -> str:
    sections = [f"Visual evidence from source PDF page {page_number}."]
    fields = (
        ("Visible text", extraction.visible_text),
        ("Formulas", extraction.formulas),
        ("Units", extraction.units),
        ("Diagram labels", extraction.diagram_labels),
        ("Chart labels", extraction.chart_labels),
    )
    for label, values in fields:
        if values:
            sections.append(f"{label}: " + " | ".join(values))
    if extraction.description:
        sections.append(f"Visual description: {extraction.description}")
    if extraction.uncertainties:
        sections.append("Uncertainties: " + " | ".join(extraction.uncertainties))
    return "\n".join(sections)[:12000]


def extract_pdf_visual_chunks(path: Path) -> list[tuple[int, str]]:
    """Extract bounded visual evidence without making text ingestion depend on Ollama."""

    if not settings.ollama_vision_enabled:
        return []
    try:
        page_numbers = select_visual_pdf_pages(
            path,
            max_pages=settings.ollama_vision_max_pages,
            min_text_chars=settings.ollama_vision_min_text_chars,
        )
    except Exception as exc:
        logger.warning("PDF visual page detection skipped: %s", exc)
        return []
    chunks: list[tuple[int, str]] = []
    for page_number in page_numbers:
        try:
            image = render_pdf_page_png(
                path,
                page_number,
                max_dimension=settings.ollama_vision_max_image_dimension,
            )
            extraction = extract_visual_content(image)
            chunks.append((page_number, _visual_extraction_text(page_number, extraction)))
        except VisionExtractionError as exc:
            logger.warning(
                "Vision extraction unavailable for PDF page %d; continuing with text ingestion: %s",
                page_number,
                exc,
            )
            break
        except Exception as exc:
            logger.warning("Vision extraction skipped for PDF page %d: %s", page_number, exc)
    return chunks


def resolve_extension(url: str, file_name: str, content_type: str) -> str:
    candidates = [file_name, Path(unquote(urlparse(url).path)).name]
    for candidate in candidates:
        suffix = Path(candidate or "").suffix.lower()
        if suffix:
            return suffix
    ct = content_type.lower()
    if "pdf" in ct:
        return ".pdf"
    if "wordprocessingml" in ct or "msword" in ct:
        return ".docx"
    if "presentationml" in ct or "powerpoint" in ct:
        return ".pptx"
    return ""


def download_to_temp(url: str, extension: str) -> Path:
    try:
        resp = requests.get(url, timeout=settings.download_timeout, stream=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Could not download material: {exc}") from exc

    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as tmp:
        for chunk in resp.iter_content(chunk_size=256 * 1024):
            tmp.write(chunk)
        return Path(tmp.name)


@lru_cache(maxsize=64)
def render_source_pdf_page(source_url: str, page_number: int) -> bytes:
    """Render a tenant-authorized Qdrant source page with a small in-process cache."""

    tmp_path = download_to_temp(source_url, ".pdf")
    try:
        return render_pdf_page_png(
            tmp_path,
            page_number,
            max_dimension=settings.ollama_vision_max_image_dimension,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


def parse_document(tmp_path: Path, extension: str) -> tuple[str, str]:
    if extension == ".pdf":
        if is_text_pdf(tmp_path):
            raw_text, _ = extract_text_pdf(tmp_path)
            return raw_text, "text_pdf"
        raw_text, _ = ocr_pdf(tmp_path)
        return raw_text, "scanned_pdf"
    raw_text, document_type = extract_office_text(tmp_path, extension)
    return raw_text, document_type


def ingest_material(
    *,
    url: str,
    material_id: str,
    source_id: str,
    file_name: str,
    content_type: str,
    replace_existing: bool,
    school_id: str,
    class_id: str,
    section_id: str,
    academic_year_id: str = "",
    subject_id: str = "",
    subject_name: str,
    discipline: str = "",
    curriculum_code: str = "",
    chapter_id: str,
    chapter_title: str,
    topic_title: str,
    concepts: list[str] | None = None,
    formulas: list[str] | None = None,
    units: list[str] | None = None,
) -> tuple[int, str]:
    """Download, parse, chunk, embed and upsert a material. Returns (chunks_indexed, document_type)."""
    extension = resolve_extension(url, file_name, content_type)
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported material format: {extension or 'unknown'}",
        )

    tmp_path = download_to_temp(url, extension)
    try:
        raw_text, document_type = parse_document(tmp_path, extension)
        visual_pairs = extract_pdf_visual_chunks(tmp_path) if extension == ".pdf" else []
    finally:
        tmp_path.unlink(missing_ok=True)

    raw_text = (raw_text or "").strip()
    if not raw_text and not visual_pairs:
        logger.warning("No text extracted from material %s", material_id)
        return 0, document_type

    chunk_pairs = chunk_text_with_offsets(raw_text) if raw_text else []
    if not chunk_pairs and not visual_pairs:
        return 0, document_type

    text_chunks = [text for text, _ in chunk_pairs]
    chunks = text_chunks + [text for _, text in visual_pairs]
    start_chars: list[int | None] = [offset for _, offset in chunk_pairs] + [None] * len(visual_pairs)
    page_numbers: list[int | None] = [None] * len(text_chunks) + [page for page, _ in visual_pairs]
    chunk_types = ["text"] * len(text_chunks) + ["visual"] * len(visual_pairs)
    document_stem = build_stem_metadata(
        raw_text or "\n".join(text for _, text in visual_pairs),
        subject_name=subject_name,
        discipline=discipline,
        chapter_title=chapter_title,
        topic_title=topic_title,
        concepts=concepts,
        formulas=formulas,
        units=units,
    )
    chunk_metadata = [
        build_stem_metadata(
            chunk,
            subject_name=subject_name,
            discipline=str(document_stem["discipline"]),
            chapter_title=chapter_title,
            topic_title=topic_title,
            concepts=concepts,
            formulas=formulas,
            units=units,
        )
        for chunk in chunks
    ]
    embedding_texts = [
        build_embedding_text(
            chunk,
            subject_name=subject_name,
            discipline=str(meta["discipline"]),
            chapter_title=chapter_title,
            topic_title=topic_title,
            concepts=list(meta["concepts"]),
            formulas=list(meta["formulas"]),
            units=list(meta["units"]),
        )
        for chunk, meta in zip(chunks, chunk_metadata)
    ]

    vectors = embed_texts(embedding_texts, kind="document")

    if replace_existing:
        try:
            delete_material_chunks(material_id)
        except Exception:
            pass

    indexed = upsert_chunks(
        material_id=material_id,
        source_id=source_id or material_id,
        source_url=url,
        source_name=file_name,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        academic_year_id=academic_year_id,
        subject_id=subject_id,
        subject_name=subject_name,
        discipline=str(document_stem["discipline"]),
        curriculum_code=curriculum_code,
        chapter_id=chapter_id,
        chapter_title=chapter_title,
        topic_title=topic_title,
        chunks=chunks,
        vectors=vectors,
        start_chars=start_chars,
        chunk_metadata=chunk_metadata,
        page_numbers=page_numbers,
        chunk_types=chunk_types,
    )
    logger.info(
        "Ingested material %s → Qdrant: %d chunks (%s, %d visual pages)",
        material_id,
        indexed,
        document_type,
        len(visual_pairs),
    )
    return indexed, document_type
