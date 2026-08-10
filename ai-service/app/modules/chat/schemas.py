from pydantic import BaseModel


class Candidate(BaseModel):
    id: str
    text: str


class ConversationTurn(BaseModel):
    role: str   # "user" | "assistant"
    text: str


class TutorGenerateRequest(BaseModel):
    mode: str
    subject: str
    topic: str
    subTopic: str | None = None
    gradeLevel: str | None = None
    questionType: str | None = None
    question: str | None = None
    candidates: list[Candidate] = []
    schoolId: str | None = None
    classId: str | None = None
    sectionId: str | None = None
    chapterTitle: str | None = None
    difficulty: str | None = None
    wrongAnswer: str | None = None
    # Student personalisation fields
    studentContext: str | None = None          # built by studentContextBuilder.js
    conversationHistory: list[ConversationTurn] | None = None  # recent 3 turns


class SummariseSessionRequest(BaseModel):
    conversation: str   # raw joined conversation text


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
