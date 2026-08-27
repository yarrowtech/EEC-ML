from app.modules.chat.schemas import TutorGenerateRequest
from app.modules.chat.visuals import build_tutor_visuals, visual_prompt_context


def test_visual_explain_builds_angle_turn_diagrams_from_material():
    req = TutorGenerateRequest(
        mode="visual_explain",
        subject="Mathematics",
        topic="Angles as Turns",
    )
    visuals = build_tutor_visuals(
        req,
        "A quarter turn is 90°. A half turn is 180°. A three-quarters turn is 270°. A full turn is 360°.",
    )

    assert visuals[0]["type"] == "angle_turns"
    assert [item["degrees"] for item in visuals[0]["items"]] == [90, 180, 270, 360]
    assert "Three-quarter turn = 270° = Reflex angle" in visual_prompt_context(visuals)
    assert "Keep self-check and practice questions unsolved" in visual_prompt_context(visuals)


def test_three_quarters_of_a_turn_is_recognized():
    req = TutorGenerateRequest(mode="visual_explain", subject="Mathematics", topic="Angles as Turns")
    visuals = build_tutor_visuals(req, "The straw makes three-quarters of a turn.")
    assert visuals[0]["items"] == [{
        "label": "Three-quarter turn",
        "degrees": 270,
        "angle_name": "Reflex angle",
    }]


def test_fraction_chocolates_build_verified_different_wholes_visual():
    req = TutorGenerateRequest(mode="visual_explain", subject="Mathematics", topic="Fractions")
    visuals = build_tutor_visuals(
        req,
        "She has two chocolates of different sizes. Identify 1/2 of one chocolate and 1/3 of the other.",
    )

    visual = visuals[0]
    assert visual["type"] == "fraction_wholes"
    assert [item["highlighted_blocks"] for item in visual["items"]] == [2, 3]
    assert "2 equal blocks < 3 equal blocks" in visual["comparison"]
    prompt = visual_prompt_context(visuals)
    assert "2×2 = 4 equal blocks" in prompt
    assert "3×3 = 9 equal blocks" in prompt
    assert "blank student activities" in prompt


def test_making_sums_equal_builds_verified_balance_visual():
    req = TutorGenerateRequest(mode="visual_explain", subject="Mathematics", topic="Making Sums Equal")
    context = (
        "Making Sums Equal. Interchange pairs of numbers between two groups using the least number of moves. "
        "Totals: 19 21 39 47 68 76 314 330."
    )
    visual = build_tutor_visuals(req, context)[0]
    assert visual["type"] == "balance_swaps"
    assert visual["problems"][0]["left"] == [1, 2, 7, 9]
    assert visual["problems"][0]["left_total"] == 19
    assert visual["problems"][2]["minimum_moves"] == 2
    assert "Never treat 19, 21" in visual_prompt_context([visual])


def test_regular_chat_does_not_add_generated_visual():
    req = TutorGenerateRequest(mode="custom", subject="Mathematics", topic="Angles as Turns")
    assert build_tutor_visuals(req, "A quarter turn is 90°.") == []


def test_visual_mode_does_not_invent_unsupported_topic_visual():
    req = TutorGenerateRequest(mode="visual_explain", subject="Biology", topic="Plants")
    assert build_tutor_visuals(req, "Plants need sunlight and water.") == []


def test_balance_visual_not_shown_for_unrelated_question_on_same_page():
    # The retrieved page prints the swap puzzles, but the student asked about fuel
    # arithmetic — the balance visual must not surface.
    req = TutorGenerateRequest(
        mode="visual_explain",
        subject="Mathematics",
        topic="Mathematic Chapter 004",
        question="can you give me more example?",
    )
    context = (
        "Making sums equal. Interchange pairs of numbers using the least number of moves. "
        "Totals 19 21 39 47 68 76 314 330. Also: a lorry starts with 28 litres and 75 more are added."
    )
    assert build_tutor_visuals(req, context) == []
