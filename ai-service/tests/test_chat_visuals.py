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


def test_regular_chat_does_not_add_generated_visual():
    req = TutorGenerateRequest(mode="custom", subject="Mathematics", topic="Angles as Turns")
    assert build_tutor_visuals(req, "A quarter turn is 90°.") == []


def test_visual_mode_does_not_invent_unsupported_topic_visual():
    req = TutorGenerateRequest(mode="visual_explain", subject="Biology", topic="Plants")
    assert build_tutor_visuals(req, "Plants need sunlight and water.") == []
