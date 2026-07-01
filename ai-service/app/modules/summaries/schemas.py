from pydantic import BaseModel, Field


class OcrResponse(BaseModel):
    success: bool = True
    document_type: str = Field(pattern="^(text_pdf|scanned_pdf)$")
    pages: int
    text: str
    processing_time: float


class SummaryResponse(BaseModel):
    summary: str
    keywords: list[str]
    topics: list[str]
    difficulty: str
