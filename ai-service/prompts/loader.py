"""Prompt Library loader.

Reads prompt text from files under the prompts/ directory tree.
Falls back gracefully to an empty string when a file does not exist,
so MODE_INSTRUCTIONS in chat/service.py continues to act as the authoritative
fallback and no existing behaviour is broken.

Usage:
    from prompts.loader import load_prompt, load_all_prompts

    text = load_prompt("quiz")   # returns file content or ""
    all_ = load_all_prompts()    # dict[mode, text] for all discovered files
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent

# Map mode name → relative path (subdir/filename.txt).
# Modes not listed here are looked up by scanning all subdirs.
_MODE_SUBDIR: dict[str, str] = {
    # chat
    "custom":              "chat/custom.txt",
    "explain":             "chat/explain.txt",
    "visual_explain":      "chat/visual_explain.txt",
    "misconception":       "chat/misconception.txt",
    "real_world":          "chat/real_world.txt",
    "homework_help":       "chat/homework_help.txt",
    "engagement_swap":     "chat/engagement_swap.txt",
    "exam_explanation":    "chat/exam_explanation.txt",
    "assignment_feedback": "chat/assignment_feedback.txt",
    "practice_basic":      "chat/practice_basic.txt",
    "practice_intermediate": "chat/practice_intermediate.txt",
    "practice_advanced":   "chat/practice_advanced.txt",
    # question_generation
    "quiz":                "question_generation/quiz.txt",
    "visual_quiz":         "question_generation/visual_quiz.txt",
    "quiz_generate":       "question_generation/quiz_generate.txt",
    "hinge_question":      "question_generation/hinge_question.txt",
    "short_answer":        "question_generation/short_answer.txt",
    "long_answer":         "question_generation/long_answer.txt",
    "bloom_question":      "question_generation/bloom_question.txt",
    # summary
    "summarize":           "summary/summarize.txt",
    "notes":               "summary/notes.txt",
    # mindmap
    "mind_map":            "mindmap/mind_map.txt",
    # flashcards
    "flashcards":          "flashcards/flashcards.txt",
    # evaluation
    "at_risk_summary":         "evaluation/at_risk_summary.txt",
    "lesson_content":          "evaluation/lesson_content.txt",
    "class_performance_summary": "evaluation/class_performance_summary.txt",
    "parent_report":           "evaluation/parent_report.txt",
    "exit_ticket_grade":       "evaluation/exit_ticket_grade.txt",
    "idoweedo":                "evaluation/idoweedo.txt",
    "differentiated_plan":     "evaluation/differentiated_plan.txt",
    "misconception_report":    "evaluation/misconception_report.txt",
    "intervention_recommendation": "evaluation/intervention_recommendation.txt",
    "curriculum_alignment":    "evaluation/curriculum_alignment.txt",
    "exam_feedback":           "evaluation/exam_feedback.txt",
    "worksheet":               "evaluation/worksheet.txt",
    "progress_summary":        "evaluation/progress_summary.txt",
    "home_support":            "evaluation/home_support.txt",
    "progress_digest":         "evaluation/progress_digest.txt",
    "monthly_report":          "evaluation/monthly_report.txt",
    "intervention_plan":       "evaluation/intervention_plan.txt",
    "rubric_generate":         "evaluation/rubric_generate.txt",
    "rubric_grade":            "evaluation/rubric_grade.txt",
}

# Module-level cache — populated on first access per mode
_cache: dict[str, str] = {}


def load_prompt(mode: str) -> str:
    """Return the prompt text for *mode* from the file library, or '' if not found."""
    if mode in _cache:
        return _cache[mode]

    rel = _MODE_SUBDIR.get(mode)
    if rel is None:
        # Fall back to scanning: look for <mode>.txt anywhere under prompts/
        matches = list(_PROMPTS_DIR.rglob(f"{mode}.txt"))
        if not matches:
            _cache[mode] = ""
            return ""
        rel = str(matches[0].relative_to(_PROMPTS_DIR))

    path = _PROMPTS_DIR / rel
    if not path.exists():
        logger.debug("Prompt file not found: %s", path)
        _cache[mode] = ""
        return ""

    text = path.read_text(encoding="utf-8").strip()
    _cache[mode] = text
    return text


def load_all_prompts() -> dict[str, str]:
    """Load and return every prompt in the library as a dict keyed by mode name."""
    result: dict[str, str] = {}
    for txt_file in sorted(_PROMPTS_DIR.rglob("*.txt")):
        mode = txt_file.stem
        result[mode] = txt_file.read_text(encoding="utf-8").strip()
    return result
