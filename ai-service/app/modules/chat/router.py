import json
import logging
import random
import re

from fastapi import APIRouter, HTTPException
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import Runnable
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.modules.chat.schemas import LearningPathRequest, SummariseSessionRequest, TeacherAIRequest, TutorGenerateRequest
from app.modules.chat.service import NOT_FOUND_MESSAGE, build_prompt, retrieve_relevant_chunks
from app.modules.parser.cleaner import _strip_teacher_notes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/generate", tags=["Chat"])


# Modes that produce long structured output for an entire chapter need a higher token budget.
_LONG_OUTPUT_MODES = {"mind_map", "notes", "flashcards", "summarize", "quiz"}

# Higher temperature for generative/creative modes so each run produces different questions/cards.
# Lower temperature for structured/factual modes so output is consistent and well-formatted.
_MODE_TEMPERATURE: dict[str, float] = {
    "quiz":                0.9,
    "flashcards":          0.85,
    "practice_basic":      0.5,
    "practice_intermediate": 0.6,
    "practice_advanced":   0.65,
    "engagement_swap":     0.8,
    "explain":             0.6,
    "homework_help":       0.6,
    "real_world":          0.7,
    "misconception":       0.5,
    "exam_explanation":    0.45,
    "exam_feedback":       0.55,
    "assignment_feedback": 0.5,
    "at_risk_summary":     0.4,
    "summarize":           0.4,
    "notes":               0.3,
    "mind_map":            0.3,
}
_DEFAULT_TEMPERATURE = 0.7


def _create_chain(mode: str = "") -> Runnable:
    temperature = _MODE_TEMPERATURE.get(mode, _DEFAULT_TEMPERATURE)

    if settings.openrouter_api_key:
        # Production: use OpenRouter API (any model, e.g. google/gemini-flash-1.5)
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            base_url=settings.openrouter_base_url,
            api_key=settings.openrouter_api_key,
            model=settings.openrouter_model,
            temperature=temperature,
            max_tokens=settings.ollama_num_predict_extended if mode in _LONG_OUTPUT_MODES else settings.ollama_num_predict,
        )
    else:
        # Development: use local Ollama
        num_predict = (
            settings.ollama_num_predict_extended
            if mode in _LONG_OUTPUT_MODES
            else settings.ollama_num_predict
        )
        llm = ChatOllama(
            base_url=settings.ollama_url,
            model=settings.ollama_model,
            num_ctx=settings.ollama_num_ctx,
            num_predict=num_predict,
            temperature=temperature,
            seed=random.randint(1, 2**31 - 1),  # prevent Ollama KV-cache reuse across requests
        )

    return llm | StrOutputParser()


@router.post("/tutor")
async def generate_tutor_content(req: TutorGenerateRequest) -> dict:
    relevant_chunks = retrieve_relevant_chunks(req)
    if not relevant_chunks:
        return {
            "mode": req.mode,
            "model": None,
            "content": NOT_FOUND_MESSAGE,
            "groundedInMaterial": False,
            "noMaterialFound": True,
        }

    context = _strip_teacher_notes("\n\n".join(relevant_chunks))
    system, user_prompt = build_prompt(req, context)
    chain = _create_chain(mode=req.mode)

    # Build message list: system + optional prior conversation turns + current user prompt.
    # Conversation history gives the LLM memory of what was discussed in this session.
    messages: list = [SystemMessage(content=system)]
    if req.conversationHistory:
        for turn in req.conversationHistory:
            if turn.role == "assistant":
                messages.append(AIMessage(content=turn.text))
            else:
                messages.append(HumanMessage(content=turn.text))
    messages.append(HumanMessage(content=user_prompt))

    try:
        content = chain.invoke(messages)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    active_model = settings.openrouter_model if settings.openrouter_api_key else settings.ollama_model
    return {
        "mode": req.mode,
        "model": active_model,
        "content": content,
        "groundedInMaterial": True,
        "noMaterialFound": False,
    }


@router.post("/summarize-session")
async def summarize_session(req: SummariseSessionRequest) -> dict:
    """
    Condenses a tutor conversation into a rolling memory summary and key insights.
    Called fire-and-forget after a session crosses the turn threshold.
    """
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

    chain = _create_chain(mode="summarize")
    try:
        raw = chain.invoke([SystemMessage(content=system), HumanMessage(content=user_prompt)])
        # Strip markdown fences if the model wrapped it anyway
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(cleaned)
        return {
            "summary": str(data.get("summary", ""))[:500],
            "keyInsights": [str(i) for i in data.get("keyInsights", [])[:5]],
        }
    except Exception:
        # JSON parse or LLM failure — return empty so the caller ignores it gracefully
        return {"summary": "", "keyInsights": []}


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
    """Pull the first JSON array out of raw LLM text (handles stray prose / fences)."""
    # Strip markdown fences
    text = re.sub(r"```(?:json)?", "", text).strip()
    # Find the first '[' and matching ']'
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
                return json.loads(text[start : i + 1])
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
    chain = _create_chain(mode="notes")  # structured, low-temperature
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

    return {"nodes": nodes, "model": settings.ollama_model}


_TEACHER_MODES = {
    "lesson_content", "hinge_question", "class_performance_summary",
    "parent_report", "exit_ticket_grade", "idoweedo", "quiz_generate",
    "differentiated_plan", "misconception_report",
    "intervention_recommendation", "curriculum_alignment",
    "intervention_plan", "rubric_generate",
    "progress_summary", "worksheet",
}

_TEACHER_LONG_OUTPUT_MODES = {
    "lesson_content", "idoweedo", "differentiated_plan",
    "class_performance_summary", "misconception_report",
    "curriculum_alignment", "rubric_generate", "intervention_plan",
}


@router.post("/teacher")
async def generate_teacher_content(req: TeacherAIRequest) -> dict:
    """Teacher-only AI generation — no RAG; caller supplies context directly."""
    from app.modules.chat.service import MODE_INSTRUCTIONS

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

    chain = _create_chain(mode=req.mode if req.mode in _TEACHER_LONG_OUTPUT_MODES else "explain")
    try:
        content = chain.invoke([
            SystemMessage(content=system),
            HumanMessage(content=user_prompt),
        ])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc

    return {"mode": req.mode, "model": settings.ollama_model, "content": content}
