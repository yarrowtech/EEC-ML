from fastapi import APIRouter, UploadFile

from app.modules.summaries.schemas import OcrResponse, SummaryResponse
from app.modules.summaries.service import extract_pdf_text, summarize_document

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("", response_model=OcrResponse)
async def ocr_document(file: UploadFile) -> OcrResponse:
    return await extract_pdf_text(file)


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_document_endpoint(file: UploadFile) -> SummaryResponse:
    return await summarize_document(file)
