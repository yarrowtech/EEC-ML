import re
from collections import Counter
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator

import fitz
from fastapi import HTTPException, UploadFile
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError, PDFSyntaxError
from PIL import Image


MIN_TEXT_CHARS = 20
REPEATED_LINE_MAX_CHARS = 80
REPEATED_LINE_MIN_PAGES = 3


def strip_repeated_lines(page_texts: list[str]) -> list[str]:
    """Drop headers/footers: short lines repeated across many pages, and bare page numbers."""
    if len(page_texts) < 4:
        return page_texts

    line_pages: Counter[str] = Counter()
    for page in page_texts:
        line_pages.update({" ".join(line.split()) for line in page.splitlines() if line.strip()})

    threshold = max(REPEATED_LINE_MIN_PAGES, len(page_texts) // 3)
    repeated = {
        line for line, count in line_pages.items()
        if count >= threshold and len(line) <= REPEATED_LINE_MAX_CHARS
    }

    cleaned: list[str] = []
    for page in page_texts:
        kept = []
        for line in page.splitlines():
            normalized = " ".join(line.split())
            if normalized in repeated or re.fullmatch(r"\d{1,4}", normalized):
                continue
            kept.append(line)
        cleaned.append("\n".join(kept).strip())
    return cleaned


def validate_pdf_upload(file: UploadFile) -> None:
    filename = (file.filename or "").lower()
    if file.content_type not in {"application/pdf", "application/x-pdf"} and not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file. Upload a PDF document.")


def open_pdf(path: Path) -> fitz.Document:
    try:
        return fitz.open(path)
    except (fitz.FileDataError, fitz.EmptyFileError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail="Corrupted or unreadable PDF.") from exc


def is_text_pdf(path: Path) -> bool:
    with open_pdf(path) as document:
        if document.page_count == 0:
            raise HTTPException(status_code=400, detail="Invalid PDF. The document has no pages.")

        for page in document:
            text = page.get_text("text").strip()
            if len(text) >= MIN_TEXT_CHARS:
                return True
    return False


def extract_text_pdf(path: Path) -> tuple[str, int]:
    with open_pdf(path) as document:
        if document.page_count == 0:
            raise HTTPException(status_code=400, detail="Invalid PDF. The document has no pages.")

        pages = strip_repeated_lines([page.get_text("text").strip() for page in document])
        return "\n\n".join(page_text for page_text in pages if page_text), document.page_count


def get_page_count(path: Path) -> int:
    with open_pdf(path) as document:
        if document.page_count == 0:
            raise HTTPException(status_code=400, detail="Invalid PDF. The document has no pages.")
        return document.page_count


def convert_pdf_to_images(path: Path, dpi: int = 300) -> Iterator[tuple[int, Image.Image]]:
    page_count = get_page_count(path)

    with TemporaryDirectory(prefix="ocr_pages_") as output_dir:
        for page_number in range(1, page_count + 1):
            try:
                images = convert_from_path(
                    str(path),
                    dpi=dpi,
                    first_page=page_number,
                    last_page=page_number,
                    fmt="png",
                    output_folder=output_dir,
                    paths_only=False,
                    single_file=True,
                )
            except PDFInfoNotInstalledError as exc:
                raise HTTPException(status_code=500, detail="Poppler is not installed or not available.") from exc
            except (PDFPageCountError, PDFSyntaxError) as exc:
                raise HTTPException(status_code=400, detail="Corrupted or unreadable PDF.") from exc
            except Exception as exc:
                raise HTTPException(status_code=500, detail=f"PDF image conversion failed: {exc}") from exc

            if not images:
                continue

            image = images[0]
            try:
                yield page_number, image
            finally:
                image.close()


def select_visual_pdf_pages(
    path: Path,
    *,
    max_pages: int,
    min_text_chars: int,
) -> list[int]:
    """Select bounded pages likely to contain evidence text extraction misses.

    Scanned/low-text pages rank first, followed by pages containing raster images
    or substantial vector drawings. Page numbers are one-based for citations.
    """

    if max_pages <= 0:
        return []

    candidates: list[tuple[int, int]] = []
    with open_pdf(path) as document:
        for index, page in enumerate(document):
            text_length = len(" ".join(page.get_text("text").split()))
            image_count = len(page.get_images(full=True))
            drawing_count = len(page.get_drawings())
            low_text = text_length < min_text_chars
            visually_significant = low_text or image_count > 0 or drawing_count >= 4
            if not visually_significant:
                continue

            score = 0
            if low_text:
                score += 1000 + max(0, min_text_chars - text_length)
            score += min(image_count, 10) * 100
            score += min(drawing_count, 50) * 3
            candidates.append((score, index + 1))

    selected = sorted(candidates, key=lambda item: (-item[0], item[1]))[:max_pages]
    return sorted(page_number for _, page_number in selected)


def render_pdf_page_png(path: Path, page_number: int, *, max_dimension: int) -> bytes:
    """Render one page to bounded PNG bytes using PyMuPDF."""

    if max_dimension < 256:
        raise ValueError("max_dimension must be at least 256 pixels")
    with open_pdf(path) as document:
        if page_number < 1 or page_number > document.page_count:
            raise ValueError(f"page_number must be between 1 and {document.page_count}")
        page = document[page_number - 1]
        rect = page.rect
        longest_side = max(float(rect.width), float(rect.height), 1.0)
        scale = min(2.0, max_dimension / longest_side)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        return pixmap.tobytes("png")
