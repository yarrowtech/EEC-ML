from typing import Any, Optional
from pydantic import BaseModel


class MasteryMatrixData(BaseModel):
    subjects: list[str] = []
    grades: list[str] = []
    matrix: dict[str, dict[str, float]] = {}


class TeacherRow(BaseModel):
    name: str
    subject: str
    avgClassMastery: Optional[float] = None
    studentCount: int = 0
    topicsCovered: int = 0
    effectiveness: str = "No data"


class DropoutRow(BaseModel):
    name: str
    grade: str
    attendanceRate: Any = None
    failedExams: int = 0
    riskLevel: str
    reasons: list[str] = []


class CohortPoint(BaseModel):
    month: str
    avgMarks: Optional[float] = None
    passRate: Optional[float] = None
    studentCount: int = 0


class ContentSummary(BaseModel):
    totalMaterials: int = 0
    totalViews: int = 0
    totalDownloads: int = 0
    totalCompletions: int = 0


class IntegritySummary(BaseModel):
    totalAttempts: int = 0
    flaggedCount: int = 0
    timedOutCount: int = 0
    fastSubmissions: int = 0


class AiPathRow(BaseModel):
    subject: str
    studentCount: int = 0
    avgScore: Optional[float] = None
    strongTopics: int = 0
    weakTopics: int = 0
    totalTopics: int = 0
    totalAttempts: int = 0


class AdminInsightsRequest(BaseModel):
    report_type: str  # "overview" | "dropout" | "teacher" | "integrity"
    school_name: str = "the school"
    # overview
    total_students: int = 0
    attendance_rate: float = 0
    average_score: float = 0
    mastery_matrix: Optional[MasteryMatrixData] = None
    teacher_effectiveness: list[TeacherRow] = []
    dropout_risk: list[DropoutRow] = []
    cohort_trend: list[CohortPoint] = []
    content_summary: Optional[ContentSummary] = None
    integrity_summary: Optional[IntegritySummary] = None
    ai_path_data: list[AiPathRow] = []
