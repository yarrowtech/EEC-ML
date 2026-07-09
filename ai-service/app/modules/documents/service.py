import logging
import tempfile
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
from app.modules.parser.pdf import extract_text_pdf, is_text_pdf

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".doc", ".ppt"}


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
    subject_name: str,
    chapter_id: str,
    chapter_title: str,
    topic_title: str,
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
    finally:
        tmp_path.unlink(missing_ok=True)

    raw_text = (raw_text or "").strip()
    if not raw_text:
        logger.warning("No text extracted from material %s", material_id)
        return 0, document_type

    chunk_pairs = chunk_text_with_offsets(raw_text)
    if not chunk_pairs:
        return 0, document_type

    chunks = [text for text, _ in chunk_pairs]
    start_chars = [offset for _, offset in chunk_pairs]

    vectors = embed_texts(chunks, kind="document")

    if replace_existing:
        try:
            delete_material_chunks(material_id)
        except Exception:
            pass

    indexed = upsert_chunks(
        material_id=material_id,
        source_id=source_id or material_id,
        source_name=file_name,
        school_id=school_id,
        class_id=class_id,
        section_id=section_id,
        subject_name=subject_name,
        chapter_id=chapter_id,
        chapter_title=chapter_title,
        topic_title=topic_title,
        chunks=chunks,
        vectors=vectors,
        start_chars=start_chars,
    )
    logger.info("Ingested material %s → Qdrant: %d chunks (%s)", material_id, indexed, document_type)
    return indexed, document_type
