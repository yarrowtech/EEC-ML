import logging

from fastapi import APIRouter, HTTPException, Response

from app.modules.documents.repository import delete_material_chunks, get_material_source
from app.modules.documents.schemas import (
    DeleteMaterialResponse,
    IngestMaterialRequest,
    IngestMaterialResponse,
    MaterialPageRequest,
)
from app.modules.documents.service import ingest_material, render_source_pdf_page

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingest"])


@router.post("/material-page")
async def render_material_page(req: MaterialPageRequest) -> Response:
    source = get_material_source(
        material_id=req.material_id,
        school_id=req.school_id,
        class_id=req.class_id or None,
        section_id=req.section_id or None,
    )
    if not source or not source.get("source_url"):
        raise HTTPException(status_code=404, detail="Material page not found in the requested scope")
    try:
        image = render_source_pdf_page(source["source_url"], req.page_number)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=image,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.delete("/material/{material_id}", response_model=DeleteMaterialResponse)
async def delete_material_vectors(material_id: str) -> DeleteMaterialResponse:
    try:
        delete_material_chunks(material_id)
    except Exception as exc:
        logger.warning("Failed to delete Qdrant chunks for material %s: %s", material_id, exc)
    return DeleteMaterialResponse(success=True, material_id=material_id)


@router.post("/material", response_model=IngestMaterialResponse)
async def ingest_material_endpoint(req: IngestMaterialRequest) -> IngestMaterialResponse:
    chunks_indexed, document_type, bloom_level, learning_outcomes, detected_topic = ingest_material(
        url=req.url,
        material_id=req.material_id,
        source_id=req.source_id or req.material_id,
        file_name=req.file_name,
        content_type=req.content_type,
        replace_existing=req.replace_existing,
        school_id=req.school_id,
        class_id=req.class_id,
        section_id=req.section_id,
        academic_year_id=req.academic_year_id,
        subject_id=req.subject_id,
        subject_name=req.subject_name,
        discipline=req.discipline,
        curriculum_code=req.curriculum_code,
        chapter_id=req.chapter_id,
        chapter_title=req.chapter_title,
        topic_title=req.topic_title,
        concepts=req.concepts,
        formulas=req.formulas,
        units=req.units,
    )
    return IngestMaterialResponse(
        success=True,
        material_id=req.material_id,
        chunks_indexed=chunks_indexed,
        document_type=document_type,
        bloom_level=bloom_level,
        learning_outcomes=learning_outcomes,
        detected_topic=detected_topic,
    )
