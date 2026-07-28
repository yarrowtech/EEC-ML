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
    difficulty: str | None = None
    wrongAnswer: str | None = None


class MasteryDimension(BaseModel):
    name: str
    value: int


class LearningPathRequest(BaseModel):
    studentName: str
    subject: str
    focus: str
    pace: str = "1 week"
    notes: str = ""
    gradeLevel: str | None = None
    mastery: list[MasteryDimension] = []


class TeacherAIRequest(BaseModel):
    mode: str
    subject: str
    topic: str
    gradeLevel: str | None = None
    context: str | None = None   # caller-supplied text context (not from RAG)
    question: str | None = None  # extra prompt detail / data blob
