import json
import logging
import re

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm import active_model_name, create_chain
from app.modules.chat.schemas import LearningPathRequest, SummariseSessionRequest, TeacherAIRequest, TutorGenerateRequest
from app.modules.chat.service import (
    MODE_INSTRUCTIONS,
    generate_tutor_response,
    retrieve_relevant_chunks_with_citations,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Chat"])


# ── Student tutor ─────────────────────────────────────────────────────────────

@router.post("/tutor")
async def generate_tutor_content(req: TutorGenerateRequest) -> dict:
    """RAG-grounded student tutor. All pipeline logic lives in service.py."""
    return generate_tutor_response(req)


# ── Session summarization ─────────────────────────────────────────────────────

@router.post("/summarize-session")
async def summarize_session(req: SummariseSessionRequest) -> dict:
    """Condenses a tutor conversation into a rolling memory summary and key insights."""
    if not req.conversation or len(req.conversation.strip()) < 50:
        return {"summary": "", "keyInsights": []}

    system = (
        "You are an educational memory assistant. Your job is to compress a student's tutoring "
        "conversation into a short persistent memory so future tutoring sessions can be personalised.\n\n"
        "From the conversation below, extract:\n"
        "1. A 2-3 sentence SUMMARY of what the student learned, struggled with, and their general engagement level.\n"
        "2. Up to 5 KEY INSIGHTS — short bullet facts about this student's learning style or knowledge gaps.\n\n"
        "Return ONLY valid JSON in this exact format (no markdown fences):\n"
        '{"summary": "...", "keyInsights": ["...", "..."]}\n\n'
        "Rules:\n"
        "- Do NOT include the student's name or any identifying information.\n"
        "- Focus on learning patterns, not lesson content.\n"
        "- Keep summary under 80 words. Keep each insight under 20 words."
    )
    user_prompt = f"Tutoring session transcript:\n\n{req.conversation[:4000]}"

    chain = create_chain(mode="summarize")
    try:
        raw = chain.invoke([SystemMessage(content=system), HumanMessage(content=user_prompt)])
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)
        return {
            "summary": str(data.get("summary", ""))[:500],
            "keyInsights": [str(i) for i in data.get("keyInsights", [])[:5]],
        }
    except Exception:
        return {"summary": "", "keyInsights": []}


# ── Learning path ─────────────────────────────────────────────────────────────

_BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
_TIERS = ["blue", "orange", "purple", "green"]

_LEARNING_PATH_SYSTEM = """You are an expert curriculum designer. Your task is to generate a personalised \
learning path as a JSON array. Return ONLY valid JSON — no explanation, no markdown fences, no extra text.

Each element must have exactly these keys:
  "title"     - short, specific topic name (string)
  "bloom"     - one of: remember | understand | apply | analyze | evaluate | create
  "tier"      - one of: blue (foundation) | orange (intermediate) | purple (advanced) | green (final assessment)
  "hasLesson" - true for the first two nodes, false otherwise

Rules:
- Produce 5-7 nodes that form a coherent, scaffolded progression.
- Start from foundational concepts and end with a mastery assessment node (tier "green").
- Tailor depth and vocabulary to the student's mastery scores.
- The last node must always be titled "<focus> mastery assessment" and use bloom "evaluate" + tier "green".
- Only output the JSON array, nothing else.
"""


def _build_learning_path_prompt(req: LearningPathRequest) -> str:
    mastery_lines = "\n".join(
        f"  - {d.name}: {d.value}%" for d in req.mastery
    ) if req.mastery else "  - Overall: 50%"
    return (
        f"Student: {req.studentName}\n"
        f"Subject: {req.subject}\n"
        f"Focus area: {req.focus}\n"
        f"Pace: {req.pace}\n"
        f"Grade level: {req.gradeLevel or 'not specified'}\n"
        f"Teacher notes: {req.notes or 'none'}\n"
        f"Current mastery scores:\n{mastery_lines}\n\n"
        "Generate the personalised learning path JSON array now."
    )


def _extract_json_array(text: str) -> list:
    text = re.sub(r"```(?:json)?", "", text).strip()
    start = text.find("[")
    if start == -1:
        raise ValueError("No JSON array found in LLM output")
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start: i + 1])
    raise ValueError("Unclosed JSON array in LLM output")


def _validate_nodes(raw: list) -> list:
    nodes = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        bloom = item.get("bloom", "understand")
        if bloom not in _BLOOM_LEVELS:
            bloom = "understand"
        tier = item.get("tier", "blue")
        if tier not in _TIERS:
            tier = "blue"
        nodes.append({
            "title": str(item.get("title", "Topic")).strip(),
            "bloom": bloom,
            "tier": tier,
            "hasLesson": bool(item.get("hasLesson", False)),
        })
    return nodes


@router.post("/learning-path")
async def generate_learning_path(req: LearningPathRequest) -> dict:
    chain = create_chain(mode="notes")
    try:
        raw_text = chain.invoke([
            SystemMessage(content=_LEARNING_PATH_SYSTEM),
            HumanMessage(content=_build_learning_path_prompt(req)),
        ])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    try:
        raw_nodes = _extract_json_array(raw_text)
        nodes = _validate_nodes(raw_nodes)
    except Exception as exc:
        logger.warning("Failed to parse LLM learning-path output: %s\nRaw: %.500s", exc, raw_text)
        raise HTTPException(status_code=422, detail=f"LLM returned invalid JSON: {exc}") from exc

    if not nodes:
        raise HTTPException(status_code=422, detail="LLM returned empty node list")

    return {"nodes": nodes, "model": active_model_name()}


# ── Teacher AI ────────────────────────────────────────────────────────────────

_TEACHER_MODES = {
    "lesson_content", "hinge_question", "class_performance_summary",
    "parent_report", "exit_ticket_grade", "idoweedo", "quiz_generate",
    "differentiated_plan", "misconception_report",
    "intervention_recommendation", "curriculum_alignment",
    "intervention_plan", "rubric_generate", "rubric_grade",
    "progress_summary", "worksheet",
}

_TEACHER_LONG_OUTPUT_MODES = {
    "lesson_content", "idoweedo", "differentiated_plan",
    "class_performance_summary", "misconception_report",
    "curriculum_alignment", "rubric_generate", "intervention_plan",
    "quiz_generate",
}


@router.post("/teacher")
async def generate_teacher_content(req: TeacherAIRequest) -> dict:
    """Teacher-only AI generation — no RAG; caller supplies context directly."""
    if req.mode not in _TEACHER_MODES:
        raise HTTPException(status_code=400, detail=f"Unsupported teacher mode: {req.mode}")

    instruction = MODE_INSTRUCTIONS.get(req.mode, "")
    grade = req.gradeLevel or "school"

    system = (
        f"You are an expert AI assistant helping a {grade} teacher with {req.subject}. "
        "Follow the task instructions precisely. Be specific, actionable, and professional."
    )
    context_block = f"\nContext / Data:\n{req.context}" if req.context else ""
    question_block = f"\nAdditional details:\n{req.question}" if req.question else ""
    user_prompt = (
        f"Subject: {req.subject}\nTopic: {req.topic}\n"
        f"Task: {instruction}"
        f"{context_block}{question_block}"
    )

    chain = create_chain(mode=req.mode if req.mode in _TEACHER_LONG_OUTPUT_MODES else "explain")
    try:
        content = chain.invoke([SystemMessage(content=system), HumanMessage(content=user_prompt)])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    return {"mode": req.mode, "model": active_model_name(), "content": content}
