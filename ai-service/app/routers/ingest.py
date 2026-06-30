import logging
import os
import tempfile
from pathlib import Path

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import ollama

from app.routers.ocr import extract_pdf_text
from app.services.chunker import chunk_text
from app.services.qdrant_service import delete_material_chunks, upsert_chunks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingest"])

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
DOWNLOAD_TIMEOUT = 30


class IngestMaterialRequest(BaseModel):
    url: str
    material_id: str
    school_id: str
    class_id: str = ""
    section_id: str = ""
    subject_name: str = ""
    chapter_id: str = ""
    chapter_title: str = ""
    topic_title: str = ""


class IngestMaterialResponse(BaseModel):
    success: bool
    material_id: str
    chunks_indexed: int
    document_type: str


@router.post("/material", response_model=IngestMaterialResponse)
async def ingest_material(req: IngestMaterialRequest) -> IngestMaterialResponse:
    # Download PDF from Cloudinary (or any URL)
    try:
        resp = requests.get(req.url, timeout=DOWNLOAD_TIMEOUT, stream=True)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Could not download PDF: {exc}") from exc

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        for chunk in resp.iter_content(chunk_size=1024 * 256):
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        # OCR — uses existing smart logic (text PDF vs scanned)
        from fastapi import UploadFile
        from io import BytesIO

        with open(tmp_path, "rb") as f:
            pdf_bytes = f.read()

        upload_file = UploadFile(
            filename=f"{req.material_id}.pdf",
            content_type="application/pdf",
            file=BytesIO(pdf_bytes),
        )
        ocr_result = await extract_pdf_text(upload_file)
        raw_text = ocr_result.text.strip()
        document_type = ocr_result.document_type
    finally:
        tmp_path.unlink(missing_ok=True)

    if not raw_text:
        return IngestMaterialResponse(
            success=True,
            material_id=req.material_id,
            chunks_indexed=0,
            document_type=document_type,
        )

    # Chunk the extracted text
    chunks = chunk_text(raw_text)
    if not chunks:
        return IngestMaterialResponse(
            success=True,
            material_id=req.material_id,
            chunks_indexed=0,
            document_type=document_type,
        )

    # Embed all chunks at once
    try:
        ollama_client = ollama.Client(host=OLLAMA_URL)
        embed_response = ollama_client.embed(model=EMBED_MODEL, input=chunks)
        vectors = embed_response["embeddings"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc

    # Remove stale chunks for this material before upserting new ones
    try:
        delete_material_chunks(req.material_id)
    except Exception:
        pass  # If collection doesn't exist yet, upsert will create it

    indexed = upsert_chunks(
        material_id=req.material_id,
        school_id=req.school_id,
        class_id=req.class_id,
        section_id=req.section_id,
        subject_name=req.subject_name,
        chapter_id=req.chapter_id,
        chapter_title=req.chapter_title,
        topic_title=req.topic_title,
        chunks=chunks,
        vectors=vectors,
    )

    logger.info(
        "Ingested material %s into Qdrant: %d chunks, type=%s",
        req.material_id,
        indexed,
        document_type,
    )

    return IngestMaterialResponse(
        success=True,
        material_id=req.material_id,
        chunks_indexed=indexed,
        document_type=document_type,
    )
