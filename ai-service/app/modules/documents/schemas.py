from pydantic import BaseModel, Field


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
    academic_year_id: str = ""
    subject_id: str = ""
    subject_name: str = ""
    discipline: str = ""
    curriculum_code: str = ""
    chapter_id: str = ""
    chapter_title: str = ""
    topic_title: str = ""
    concepts: list[str] = Field(default_factory=list)
    formulas: list[str] = Field(default_factory=list)
    units: list[str] = Field(default_factory=list)


class IngestMaterialResponse(BaseModel):
    success: bool
    material_id: str
    chunks_indexed: int
    document_type: str


class DeleteMaterialResponse(BaseModel):
    success: bool
    material_id: str


class MaterialPageRequest(BaseModel):
    material_id: str
    page_number: int = Field(ge=1, le=5000)
    school_id: str
    class_id: str = ""
    section_id: str = ""
