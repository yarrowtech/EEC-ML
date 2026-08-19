from pydantic import BaseModel


class AnswerEvalRequest(BaseModel):
    questionText: str
    correctAnswer: str
    studentAnswer: str
    subject: str = ""
    topicTitle: str = ""
    chapterTitle: str = ""
    gradeLevel: str = ""
    questionType: str = "mcq"   # mcq | short_answer | long_answer
    context: str = ""           # optional retrieved course text for written answers


class AnswerEvalResult(BaseModel):
    isCorrect: bool
    score: float                # 0.0–1.0
    confidenceScore: float      # how confident the model is in its evaluation (0-1)
    errorType: str              # Concept | Calculation | Reading | Logic | None
    bloomLevel: str             # remember | understand | apply | analyse | evaluate | create
    missingConcepts: list[str]  # concepts the student's answer failed to address
    feedback: str               # short student-facing feedback
    learningOutcomes: list[str] # which learning outcomes this question targets
