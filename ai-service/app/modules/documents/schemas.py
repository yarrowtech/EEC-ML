from pydantic import BaseModel


class IngestMaterialRequest(BaseModel):
    url: str
    material_id: str
    source_id: str = ""
    file_name: str = ""
    content_type: str = ""
    replace_existing: bool = True
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


class DeleteMaterialResponse(BaseModel):
    success: bool
    material_id: str
