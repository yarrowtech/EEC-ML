import json
import logging
import os
from pathlib import Path
from tempfile import NamedTemporaryFile

import ollama
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.schemas.response import OcrResponse, SummaryResponse
from app.services.ocr_service import ocr_pdf
from app.services.pdf_service import extract_text_pdf, is_text_pdf, validate_pdf_upload
from app.utils.timer import Timer


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
SUMMARY_MODEL = os.getenv("OLLAMA_SUMMARY_MODEL", "qwen2.5:14b")


def get_ollama_client() -> ollama.Client:
    return ollama.Client(host=OLLAMA_URL)


async def save_upload_to_temp_pdf(file: UploadFile) -> Path:
    validate_pdf_upload(file)

    try:
        with NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)
            return Path(temp_file.name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read uploaded PDF: {exc}") from exc
    finally:
        await file.close()


async def extract_pdf_text(file: UploadFile) -> OcrResponse:
    timer = Timer()
    temp_path = await save_upload_to_temp_pdf(file)
    ocr_used = False

    try:
        if is_text_pdf(temp_path):
            text, pages = extract_text_pdf(temp_path)
            document_type = "text_pdf"
        else:
            ocr_used = True
            text, pages = ocr_pdf(temp_path)
            document_type = "scanned_pdf"

        processing_time = timer.elapsed
        logger.info(
            "PDF OCR completed",
            extra={
                "processing_time": processing_time,
                "pages": pages,
                "ocr_used": ocr_used,
                "document_type": document_type,
            },
        )
        return OcrResponse(
            success=True,
            document_type=document_type,
            pages=pages,
            text=text,
            processing_time=processing_time,
        )
    finally:
        temp_path.unlink(missing_ok=True)


@router.post("", response_model=OcrResponse)
async def ocr_document(file: UploadFile) -> OcrResponse:
    return await extract_pdf_text(file)


def parse_summary_response(content: str) -> SummaryResponse:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Ollama returned an invalid summary response.") from exc

    try:
        return SummaryResponse(
            summary=str(payload.get("summary", "")).strip(),
            keywords=[str(item).strip() for item in payload.get("keywords", []) if str(item).strip()],
            topics=[str(item).strip() for item in payload.get("topics", []) if str(item).strip()],
            difficulty=str(payload.get("difficulty", "Easy")).strip() or "Easy",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Ollama summary response has an invalid shape.") from exc


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_document(
    file: UploadFile,
    ollama_client: ollama.Client = Depends(get_ollama_client),
) -> SummaryResponse:
    ocr_result = await extract_pdf_text(file)
    if not ocr_result.text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the PDF.")

    prompt = (
        "Summarize this document.\n\n"
        "Return only valid JSON with this exact shape:\n"
        '{"summary":"...","keywords":[],"topics":[],"difficulty":"Easy"}\n\n'
        f"Document text:\n{ocr_result.text}"
    )

    try:
        response = ollama_client.chat(
            model=SUMMARY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You summarize school learning materials. Return concise, valid JSON only. "
                        "Use difficulty as one of Easy, Medium, or Hard."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            format="json",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ollama summary request failed: {exc}",
        ) from exc

    return parse_summary_response(response["message"]["content"])
