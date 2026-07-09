import json
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import HTTPException, UploadFile, status
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.modules.parser.ocr import ocr_pdf
from app.modules.parser.pdf import extract_text_pdf, is_text_pdf, validate_pdf_upload
from app.modules.summaries.schemas import OcrResponse, SummaryResponse
from app.utils.timer import Timer

logger = logging.getLogger(__name__)

_SUMMARY_SYSTEM = (
    "You summarize school learning materials. "
    "Return concise, valid JSON only. "
    "Use difficulty as one of Easy, Medium, or Hard."
)


async def save_upload_to_temp_pdf(file: UploadFile) -> Path:
    validate_pdf_upload(file)
    try:
        with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            while chunk := await file.read(1024 * 1024):
                tmp.write(chunk)
            return Path(tmp.name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read uploaded PDF: {exc}") from exc
    finally:
        await file.close()


async def extract_pdf_text(file: UploadFile) -> OcrResponse:
    timer = Timer()
    tmp_path = await save_upload_to_temp_pdf(file)
    ocr_used = False
    try:
        if is_text_pdf(tmp_path):
            text, pages = extract_text_pdf(tmp_path)
            document_type = "text_pdf"
        else:
            ocr_used = True
            text, pages = ocr_pdf(tmp_path)
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
        tmp_path.unlink(missing_ok=True)


def parse_summary_json(content: str) -> SummaryResponse:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="LLM returned an invalid summary response.") from exc
    try:
        return SummaryResponse(
            summary=str(payload.get("summary", "")).strip(),
            keywords=[str(i).strip() for i in payload.get("keywords", []) if str(i).strip()],
            topics=[str(i).strip() for i in payload.get("topics", []) if str(i).strip()],
            difficulty=str(payload.get("difficulty", "Easy")).strip() or "Easy",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="LLM summary response has an invalid shape.") from exc


async def summarize_document(file: UploadFile) -> SummaryResponse:
    ocr_result = await extract_pdf_text(file)
    if not ocr_result.text.strip():
        raise HTTPException(status_code=422, detail="No readable text found in the PDF.")

    prompt = (
        "Summarize this document.\n\n"
        "Return only valid JSON with this exact shape:\n"
        '{"summary":"...","keywords":[],"topics":[],"difficulty":"Easy"}\n\n'
        f"Document text:\n{ocr_result.text}"
    )

    llm = ChatOllama(
        base_url=settings.ollama_url,
        model=settings.ollama_summary_model,
        format="json",
    )
    chain = llm | StrOutputParser()
    try:
        content = chain.invoke([
            SystemMessage(content=_SUMMARY_SYSTEM),
            HumanMessage(content=prompt),
        ])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM summary request failed: {exc}",
        ) from exc

    return parse_summary_json(content)
