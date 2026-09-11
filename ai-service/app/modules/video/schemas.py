from pydantic import BaseModel


class VideoUnderstandResponse(BaseModel):
    transcript: str
    duration_seconds: float
    summary: str
    keywords: list[str]
    topics: list[str]
    # Plain-text quiz in the same numbered "A-D + Answer: X" format the
    # existing tutor quiz mode produces, so the frontend can reuse QuizUI's
    # parseQuiz() unchanged.
    quiz: str
