from pydantic import BaseModel


class Candidate(BaseModel):
    id: str
    text: str


class TutorGenerateRequest(BaseModel):
    mode: str
    subject: str
    topic: str
    subTopic: str | None = None
    gradeLevel: str | None = None
    question: str | None = None
    candidates: list[Candidate] = []
    schoolId: str | None = None
    classId: str | None = None
    sectionId: str | None = None
    chapterTitle: str | None = None
