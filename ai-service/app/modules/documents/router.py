import logging

from fastapi import APIRouter

from app.modules.documents.repository import delete_material_chunks
from app.modules.documents.schemas import (
    DeleteMaterialResponse,
    IngestMaterialRequest,
    IngestMaterialResponse,
)
from app.modules.documents.service import ingest_material

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingest"])


@router.delete("/material/{material_id}", response_model=DeleteMaterialResponse)
async def delete_material_vectors(material_id: str) -> DeleteMaterialResponse:
    try:
        delete_material_chunks(material_id)
    except Exception as exc:
        logger.warning("Failed to delete Qdrant chunks for material %s: %s", material_id, exc)
    return DeleteMaterialResponse(success=True, material_id=material_id)


@router.post("/material", response_model=IngestMaterialResponse)
async def ingest_material_endpoint(req: IngestMaterialRequest) -> IngestMaterialResponse:
    chunks_indexed, document_type = ingest_material(
        url=req.url,
        material_id=req.material_id,
        source_id=req.source_id or req.material_id,
        file_name=req.file_name,
        content_type=req.content_type,
        replace_existing=req.replace_existing,
        school_id=req.school_id,
        class_id=req.class_id,
        section_id=req.section_id,
        subject_name=req.subject_name,
        chapter_id=req.chapter_id,
        chapter_title=req.chapter_title,
        topic_title=req.topic_title,
    )
    return IngestMaterialResponse(
        success=True,
        material_id=req.material_id,
        chunks_indexed=chunks_indexed,
        document_type=document_type,
    )
