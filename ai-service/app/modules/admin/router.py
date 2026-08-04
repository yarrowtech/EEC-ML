import logging
import random

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.modules.admin.schemas import AdminInsightsRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Admin Analytics"])


def _llm(temperature: float = 0.5) -> ChatOllama:
    return ChatOllama(
        base_url=settings.ollama_url,
        model=settings.ollama_model,
        num_ctx=settings.ollama_num_ctx,
        num_predict=settings.ollama_num_predict_extended,
        temperature=temperature,
        seed=random.randint(1, 2**31 - 1),
    )


def _build_overview_prompt(req: AdminInsightsRequest) -> tuple[str, str]:
    # Build mastery summary
    mastery_lines = []
    if req.mastery_matrix and req.mastery_matrix.grades:
        for grade in req.mastery_matrix.grades[:6]:
            row_scores = req.mastery_matrix.matrix.get(grade, {})
            if row_scores:
                avg = round(sum(row_scores.values()) / len(row_scores.values()), 1)
                low_subjs = [s for s, v in row_scores.items() if v < 55]
                mastery_lines.append(
                    f"  - {grade}: avg {avg}%"
                    + (f", weak in {', '.join(low_subjs)}" if low_subjs else "")
                )

    # Teacher effectiveness
    low_teachers = [t for t in req.teacher_effectiveness if t.avgClassMastery is not None and t.avgClassMastery < 55]
    high_teachers = [t for t in req.teacher_effectiveness if t.avgClassMastery is not None and t.avgClassMastery >= 75]

    # Cohort trend direction
    trend_desc = ""
    if len(req.cohort_trend) >= 2:
        first = req.cohort_trend[0].avgMarks
        last = req.cohort_trend[-1].avgMarks
        if first and last:
            delta = round(last - first, 1)
            trend_desc = f"Exam scores {'improved' if delta >= 0 else 'declined'} by {abs(delta)} marks over the tracked period."

    # AI tutor
    ai_weak = [r for r in req.ai_path_data if r.avgScore is not None and r.avgScore < 55]

    system = (
        "You are an experienced school analytics advisor. "
        "Generate a concise, actionable executive summary for a school administrator. "
        "Use clear Markdown with ## headings. Be direct and specific. "
        "Focus on what requires immediate attention, what is going well, and 3 concrete next steps. "
        "Do not repeat data back verbatim — synthesise it into insight."
    )

    user = f"""School: {req.school_name}
Key metrics: {req.total_students} students, {req.attendance_rate}% attendance, {req.average_score}% avg score.

Mastery by class (from AI tutor activity):
{chr(10).join(mastery_lines) if mastery_lines else "  No mastery data yet."}

Teacher effectiveness:
  - {len(high_teachers)} teacher(s) rated High, {len(low_teachers)} rated Needs Support.
  {("Low performers: " + ", ".join(f"{t.name} ({t.subject})" for t in low_teachers[:4])) if low_teachers else ""}

At-risk students: {len(req.dropout_risk)} flagged ({sum(1 for s in req.dropout_risk if s.riskLevel == "High")} High risk).

Cohort trend: {trend_desc if trend_desc else "Insufficient data for trend."}

Content usage: {req.content_summary.totalViews if req.content_summary else 0} total views, {req.content_summary.totalCompletions if req.content_summary else 0} completions.

AI tutor — subjects below 55% avg: {", ".join(r.subject for r in ai_weak) if ai_weak else "None (all above threshold)."}

Exam integrity: {req.integrity_summary.flaggedCount if req.integrity_summary else 0} flagged attempts out of {req.integrity_summary.totalAttempts if req.integrity_summary else 0}.

Write the executive summary now."""

    return system, user


def _build_dropout_prompt(req: AdminInsightsRequest) -> tuple[str, str]:
    high = [s for s in req.dropout_risk if s.riskLevel == "High"]
    medium = [s for s in req.dropout_risk if s.riskLevel == "Medium"]

    def fmt(students: list, limit: int = 8) -> str:
        return "\n".join(
            f"  - {s.name} (Grade {s.grade}): {', '.join(s.reasons)}"
            for s in students[:limit]
        ) or "  None"

    system = (
        "You are a school counsellor and intervention specialist. "
        "Generate targeted, practical intervention strategies for at-risk students. "
        "Structure your response with ## headings per risk tier. "
        "Each strategy must be actionable within a school week. Keep it under 400 words."
    )

    user = f"""School: {req.school_name}
Total at-risk students: {len(req.dropout_risk)}

HIGH RISK ({len(high)} students):
{fmt(high)}

MEDIUM RISK ({len(medium)} students):
{fmt(medium)}

Generate an intervention plan with:
1. Immediate actions for High Risk students (this week)
2. Monitoring plan for Medium Risk (this month)
3. Preventive measures to reduce future risk
Be specific — name the types of interventions (mentoring, parent calls, remedial classes, etc.)."""

    return system, user


def _build_teacher_prompt(req: AdminInsightsRequest) -> tuple[str, str]:
    rows = sorted(
        [t for t in req.teacher_effectiveness if t.avgClassMastery is not None],
        key=lambda t: t.avgClassMastery or 0,
    )
    low = [t for t in rows if (t.avgClassMastery or 0) < 55]
    moderate = [t for t in rows if 55 <= (t.avgClassMastery or 0) < 75]
    high = [t for t in rows if (t.avgClassMastery or 0) >= 75]

    def fmt(teachers: list) -> str:
        return "\n".join(
            f"  - {t.name} — {t.subject}, avg mastery {t.avgClassMastery}%, {t.studentCount} students, {t.topicsCovered} topics"
            for t in teachers[:6]
        ) or "  None"

    system = (
        "You are an instructional coach for K-12 schools. "
        "Generate specific, respectful, evidence-based coaching recommendations. "
        "Use ## headings. Be direct. Avoid generic platitudes — tie each suggestion to the data. "
        "Keep it under 500 words."
    )

    user = f"""School: {req.school_name}
Teacher effectiveness summary:

NEEDS SUPPORT (avg mastery < 55%):
{fmt(low)}

MODERATE (55–74%):
{fmt(moderate)}

HIGH PERFORMING (≥75%):
{fmt(high)}

For each tier, provide:
1. Root cause hypotheses (why might mastery be low/high?)
2. Specific coaching actions (e.g., peer observation, resource sharing, professional development)
3. For high performers — how to leverage them as mentors
Ground your suggestions in the subject and mastery data shown."""

    return system, user


def _build_integrity_prompt(req: AdminInsightsRequest) -> tuple[str, str]:
    summary = req.integrity_summary
    if not summary:
        return ("", "")

    system = (
        "You are an academic integrity officer for a school. "
        "Analyse the exam attempt data and produce a clear risk assessment and policy recommendations. "
        "Use ## headings. Keep it under 350 words. Be objective — these are patterns, not proven violations."
    )

    user = f"""School: {req.school_name}
Exam attempt data:
  - Total attempts reviewed: {summary.totalAttempts}
  - Flagged attempts: {summary.flaggedCount} ({round(summary.flaggedCount / max(summary.totalAttempts, 1) * 100, 1)}%)
  - Timed-out sessions: {summary.timedOutCount}
  - Suspiciously fast submissions: {summary.fastSubmissions}

Provide:
1. Risk assessment: what does this pattern suggest?
2. Likely causes (technical issues vs. academic integrity concerns)
3. Recommended policy changes or monitoring improvements
4. When to escalate to manual review"""

    return system, user


_PROMPT_BUILDERS = {
    "overview": (_build_overview_prompt, 0.45),
    "dropout": (_build_dropout_prompt, 0.5),
    "teacher": (_build_teacher_prompt, 0.5),
    "integrity": (_build_integrity_prompt, 0.4),
}


@router.post("/admin-insights")
async def generate_admin_insights(req: AdminInsightsRequest) -> dict:
    builder_entry = _PROMPT_BUILDERS.get(req.report_type)
    if not builder_entry:
        raise HTTPException(status_code=400, detail=f"Unknown report_type: {req.report_type}")

    builder_fn, temperature = builder_entry
    system_text, user_text = builder_fn(req)

    if not user_text:
        return {"content": "Insufficient data to generate insights.", "report_type": req.report_type}

    try:
        chain = _llm(temperature) | StrOutputParser()
        content = await chain.ainvoke([
            SystemMessage(content=system_text),
            HumanMessage(content=user_text),
        ])
        return {"content": content.strip(), "report_type": req.report_type}
    except Exception as exc:
        logger.exception("admin-insights generation failed: %s", exc)
        raise HTTPException(status_code=503, detail="Ollama generation failed. Is the AI service running?")
