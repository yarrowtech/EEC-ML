from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator

import fitz
from fastapi import HTTPException, UploadFile
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError, PDFSyntaxError
from PIL import Image


MIN_TEXT_CHARS = 20


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

        pages = [page.get_text("text").strip() for page in document]
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
