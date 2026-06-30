from pathlib import Path

import pytesseract
from fastapi import HTTPException
from PIL import Image
from pytesseract import TesseractNotFoundError

from app.services.pdf_service import convert_pdf_to_images, get_page_count


TESSERACT_CONFIG = "--oem 3 --psm 6"
TESSERACT_LANG = "eng"


def ocr_image(image: Image.Image) -> str:
    try:
        return pytesseract.image_to_string(image, lang=TESSERACT_LANG, config=TESSERACT_CONFIG).strip()
    except TesseractNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Tesseract OCR is not installed or not available.") from exc
    except pytesseract.TesseractError as exc:
        raise HTTPException(status_code=500, detail=f"OCR failure: {exc}") from exc


def ocr_pdf(path: Path) -> tuple[str, int]:
    page_count = get_page_count(path)
    page_texts: list[str] = []

    for page_number, image in convert_pdf_to_images(path):
        text = ocr_image(image)
        if text:
            page_texts.append(text)
        else:
            page_texts.append(f"[Page {page_number}: no readable text detected]")

    return "\n\n".join(page_texts), page_count
