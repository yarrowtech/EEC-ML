import re

from app.modules.chat.schemas import TutorGenerateRequest


_ANGLE_TURNS = (
    ("quarter", 90, "Quarter turn", "Right angle"),
    ("half", 180, "Half turn", "Straight angle"),
    ("three-quarter", 270, "Three-quarter turn", "Reflex angle"),
    ("full", 360, "Full turn", "Complete angle"),
)


def build_tutor_visuals(req: TutorGenerateRequest, context: str) -> list[dict]:
    """Build safe code-rendered visual specs from retrieved curriculum evidence."""

    if req.mode not in {"visual_explain", "visual_quiz"}:
        return []
    searchable = " ".join((req.topic or "", req.subTopic or "", req.question or "", context)).casefold()
    if "angle" not in searchable or not any(token in searchable for token in ("turn", "degree", "°")):
        return []

    items = []
    for term, degrees, label, angle_name in _ANGLE_TURNS:
        term_pattern = term.replace("-", r"[\s-]")
        if term == "three-quarter":
            turn_match = re.search(r"\bthree[\s-]quarters?(?:\s+of\s+a)?\s+turn\b", searchable)
        else:
            turn_match = re.search(rf"\b{term_pattern}\s+turn\b", searchable)
        if turn_match or f"{degrees}°" in searchable:
            items.append({
                "label": label,
                "degrees": degrees,
                "angle_name": angle_name,
            })

    if not items:
        return []
    return [{
        "id": "angle-turns",
        "type": "angle_turns",
        "title": "Angles as turns",
        "caption": "Follow the curved arrow from the starting ray to see how each turn creates an angle.",
        "items": items,
    }]


def visual_prompt_context(visuals: list[dict]) -> str:
    """Describe deterministic render facts so tutor prose agrees with the SVG."""

    lines = []
    for visual in visuals:
        if visual.get("type") != "angle_turns":
            continue
        for item in visual.get("items", []):
            lines.append(f"{item['label']} = {item['degrees']}° = {item['angle_name']}")
    if not lines:
        return ""
    return (
        "A code-rendered teaching visual will appear directly below the answer. Its verified labels are:\n- "
        + "\n- ".join(lines)
        + "\nThe explanation must agree with these labels and should invite the student to inspect the visual below. "
        "Do not introduce a new degree value, fractional turn, or calculated extension unless it is explicitly present "
        "in this verified list or the retrieved course material. Keep self-check and practice questions unsolved."
    )
