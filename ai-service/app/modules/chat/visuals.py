import re

from app.modules.chat.schemas import TutorGenerateRequest


_ANGLE_TURNS = (
    ("quarter", 90, "Quarter turn", "Right angle"),
    ("half", 180, "Half turn", "Straight angle"),
    ("three-quarter", 270, "Three-quarter turn", "Reflex angle"),
    ("full", 360, "Full turn", "Complete angle"),
)

_BALANCE_GROUPS = (
    ("a", [1, 2, 7, 9], [3, 4, 5, 9], 19, 21, [[2, 3]]),
    ("b", [5, 7, 12, 15], [9, 11, 13, 14], 39, 47, [[5, 9]]),
    ("c", [11, 15, 19, 23], [13, 17, 21, 25], 68, 76, [[11, 13], [15, 17]]),
    ("d", [77, 78, 79, 80], [81, 82, 83, 84], 314, 330, [[77, 81], [78, 82]]),
)


def _balance_sums_visual(searchable: str) -> dict | None:
    markers = ("making sums equal", "interchange pairs of numbers", "least number of moves")
    if sum(marker in searchable for marker in markers) < 2:
        return None
    required_numbers = ("19", "21", "39", "47", "68", "76", "314", "330")
    if sum(number in searchable for number in required_numbers) < 6:
        return None
    problems = []
    for label, left, right, left_total, right_total, swaps in _BALANCE_GROUPS:
        gap = right_total - left_total
        problems.append({
            "label": label,
            "left": left,
            "right": right,
            "left_total": left_total,
            "right_total": right_total,
            "gap": gap,
            "required_transfer": gap // 2,
            "example_swaps": swaps,
            "minimum_moves": len(swaps),
        })
    return {
        "id": "making-sums-equal",
        "type": "balance_swaps",
        "title": "Making sums equal",
        "caption": "Totals are shown below each group and are not numbers that can be swapped.",
        "rule": "If the right total exceeds the left by D, a one-pair swap must move D/2 more from right to left than from left to right: right value − left value = D/2.",
        "problems": problems,
        "activity_note": "The source asks students to find swaps using the least moves. Examples shown by the visual are verified demonstrations, not extra group members.",
    }


def _fraction_wholes_visual(searchable: str) -> dict | None:
    """Recognize the chapter's two different-sized chocolate wholes."""

    has_chocolates = "two chocolates of different sizes" in searchable or (
        "chocolate" in searchable and "different sizes" in searchable
    )
    has_halves_and_thirds = all(token in searchable for token in ("1/2", "1/3")) or all(
        token in searchable for token in ("frac{1}{2}", "frac{1}{3}")
    )
    if not has_chocolates or not has_halves_and_thirds:
        return None
    return {
        "id": "fraction-different-wholes",
        "type": "fraction_wholes",
        "title": "Fractions of different-sized wholes",
        "caption": "The blocks are the same visual unit size, but the two whole chocolates contain different numbers of blocks.",
        "items": [
            {
                "label": "Smaller chocolate",
                "rows": 2,
                "columns": 2,
                "numerator": 1,
                "denominator": 2,
                "highlighted_blocks": 2,
                "color": "#f59e0b",
            },
            {
                "label": "Larger chocolate",
                "rows": 3,
                "columns": 3,
                "numerator": 1,
                "denominator": 3,
                "highlighted_blocks": 3,
                "color": "#7c3aed",
            },
        ],
        "comparison": "In this picture, 2 equal blocks < 3 equal blocks, so 1/3 of the larger chocolate is bigger than 1/2 of the smaller chocolate.",
        "rule": "Fractions can be compared directly only when they refer to the same-sized whole. For different wholes, compare the actual represented amounts.",
        "source_activity_note": "The A, B, and C grids on the source page are blank student activities; they are not pre-shaded evidence.",
    }


def build_tutor_visuals(req: TutorGenerateRequest, context: str) -> list[dict]:
    """Build safe code-rendered visual specs from retrieved curriculum evidence."""

    if req.mode not in {"visual_explain", "visual_quiz"}:
        return []
    searchable = " ".join((req.topic or "", req.subTopic or "", req.question or "", context)).casefold()
    balance_visual = _balance_sums_visual(searchable)
    if balance_visual:
        return [balance_visual]
    fraction_visual = _fraction_wholes_visual(searchable)
    if fraction_visual:
        return [fraction_visual]
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
        if visual.get("type") == "angle_turns":
            for item in visual.get("items", []):
                lines.append(f"{item['label']} = {item['degrees']}° = {item['angle_name']}")
        elif visual.get("type") == "fraction_wholes":
            for item in visual.get("items", []):
                total = item["rows"] * item["columns"]
                lines.append(
                    f"{item['label']}: {item['rows']}×{item['columns']} = {total} equal blocks; "
                    f"{item['numerator']}/{item['denominator']} highlights {item['highlighted_blocks']} blocks"
                )
            lines.extend([
                visual["comparison"],
                visual["rule"],
                visual["source_activity_note"],
                "Do not invent dimensions for Grids A, B, or C. Do not describe those source grids as already shaded.",
                "Do not introduce pizza, ribbon, or other examples absent from the retrieved teacher material.",
            ])
        elif visual.get("type") == "balance_swaps":
            lines.extend([
                visual["caption"],
                visual["rule"],
            ])
            for problem in visual["problems"]:
                swaps = ", then ".join(f"{left}↔{right}" for left, right in problem["example_swaps"])
                lines.append(
                    f"Problem ({problem['label']}): left operands {problem['left']} total {problem['left_total']}; "
                    f"right operands {problem['right']} total {problem['right_total']}; gap {problem['gap']}; "
                    f"required transfer {problem['required_transfer']}; verified example {swaps}; "
                    f"minimum moves {problem['minimum_moves']}"
                )
            lines.extend([
                "Never treat 19, 21, 39, 47, 68, 76, 314, or 330 as operands; they are printed totals.",
                "Do not solve or reveal a different swap beyond the verified examples in this specification.",
                "The exact swap effect is: new left = old left − left-swapped value + right-swapped value; "
                "new right = old right − right-swapped value + left-swapped value.",
            ])
    if not lines:
        return ""
    return (
        "A code-rendered teaching visual will appear directly below the answer. Its verified labels are:\n- "
        + "\n- ".join(lines)
        + "\nThe explanation must agree with these labels and should invite the student to inspect the visual below. "
        "Do not introduce a new degree value, fractional turn, or calculated extension unless it is explicitly present "
        "in this verified list or the retrieved course material. Keep self-check and practice questions unsolved."
    )
