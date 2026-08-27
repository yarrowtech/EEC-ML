import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.modules.chat import service
from app.modules.chat.schemas import Candidate


# --- build_prompt ---


def test_build_prompt_enforces_material_only_answers(make_request):
    system, user = service.build_prompt(make_request(), "chunk one\n\nchunk two")
    assert "ONLY the retrieved course material" in system
    assert "chunk one" in user
    assert "Photosynthesis" in user


@pytest.mark.parametrize("mode", sorted(service.MODE_INSTRUCTIONS))
def test_build_prompt_supports_every_documented_mode(make_request, mode):
    _, user = service.build_prompt(make_request(mode=mode), "context")
    # Prompt library may supply a file-based override; either way the prompt must be non-empty.
    from prompts.loader import load_prompt
    file_prompt = load_prompt(mode)
    expected = file_prompt if file_prompt else service.MODE_INSTRUCTIONS[mode]
    assert expected in user


def test_build_prompt_rejects_unknown_mode(make_request):
    with pytest.raises(HTTPException) as excinfo:
        service.build_prompt(make_request(mode="poetry"), "context")
    assert excinfo.value.status_code == 400


def test_homework_help_includes_student_question(make_request):
    req = make_request(mode="homework_help", question="Why is the sky blue?")
    _, user = service.build_prompt(req, "context")
    assert "Why is the sky blue?" in user


def test_grade_level_defaults_to_school(make_request):
    system, _ = service.build_prompt(make_request(gradeLevel=None), "context")
    assert "for a school student" in system


def test_physics_prompt_requires_variables_units_and_dimensions(make_request):
    system, _ = service.build_prompt(make_request(subject="Physics"), "context")
    assert "Define every variable" in system
    assert "dimensional consistency" in system


def test_visual_explanation_prompt_requires_page_linked_walkthrough(make_request):
    context = (
        "Visual evidence from source PDF page 8.\n"
        "Diagram labels: 2,300; 2,350; 2,400.\n"
        "Diagram descriptions: A number line showing neighbouring hundreds."
    )
    system, user = service.build_prompt(
        make_request(mode="explain", subject="Mathematics"),
        context,
    )
    assert "PDF page(s) 8" in system
    assert "Visual walkthrough" in system
    assert "Look" in system
    assert "Notice" in system
    assert "Connect" in system
    assert "VISIBLE-LABEL FIDELITY" in system
    assert "SOURCE-EXERCISE LOCK" in system
    assert "calculate its requested distances/results" in system
    assert "FINAL VISUAL RESPONSE CONSTRAINT" in user
    assert "SOURCE-EXERCISE LOCK" in user


def test_visual_quiz_prompt_requests_new_page_dependent_question(make_request):
    context = "Visual evidence from source PDF page 7.\nDiagram descriptions: A labelled number line."
    system, _ = service.build_prompt(make_request(mode="quiz"), context)
    assert "Visual question — use page N" in system
    assert "do not copy, solve, or reveal" in system


def test_generated_visual_prompt_tells_model_diagram_is_on_screen(make_request):
    visual = [{
        "type": "angle_turns",
        "items": [{"label": "Quarter turn", "degrees": 90, "angle_name": "Right angle"}],
    }]
    system, user = service.build_prompt(
        make_request(mode="visual_explain", topic="Angles as Turns"),
        "A quarter turn creates a 90° angle.",
        generated_visuals=visual,
    )
    assert "Do not say that no visual is available" in system
    assert "Quarter turn = 90° = Right angle" in user


def test_visual_explain_uses_structured_diagram_format(make_request):
    # visual_explain has its own DIAGRAM + EXPLANATION structure; the old Look-Notice-Connect
    # depth/goal instructions are intentionally NOT appended (they conflict with the format).
    _, user = service.build_prompt(
        make_request(
            mode="visual_explain",
            responseDepth="deep",
            learningGoal="revision",
        ),
        "A visual concept from the material.",
    )
    assert "DIAGRAM:" in user
    assert "```mermaid" in user
    assert "MERMAID SYNTAX RULES" in user
    assert "**Overview:**" in user
    # old depth/goal wording must not leak back in
    assert "three progressively harder" not in user
    assert "exam-ready recap" not in user


def test_text_only_prompt_does_not_claim_visual_evidence(make_request):
    system, _ = service.build_prompt(make_request(mode="explain"), "A plain text explanation.")
    assert "VISUAL EVIDENCE RULES" not in system


def test_visual_context_is_bounded_around_requested_topic(make_request):
    chapter = ("unrelated introduction " * 500) + "ROUNDING TARGET SECTION " + ("later text " * 500)
    visual = "Visual evidence from source PDF page 8. Diagram labels: 2,300 | 2,400."

    context = service._focused_visual_context(
        make_request(topic="rounding with a number line"),
        [chapter, visual],
    )

    assert "ROUNDING TARGET SECTION" in context
    assert visual in context
    assert len(context) <= 3500 + len(visual) + 2


def test_visual_exercise_answer_detector_catches_calculated_solution():
    context = (
        "Visual evidence from source PDF page 8. Which number should the rabbit choose? "
        "______ is the nearest hundred."
    )
    assert service._visual_explanation_reveals_exercise_answer(
        context,
        "The nearest hundred is 2,300 because it is 46 units away.",
    )


def test_visual_exercise_answer_detector_allows_method_only_explanation():
    context = "Visual evidence from source PDF page 8. Fill in the ______ blank."
    assert not service._visual_explanation_reveals_exercise_answer(
        context,
        "Compare the highlighted position with each labelled endpoint.",
    )


def test_visual_quiz_detector_catches_copied_rounding_task():
    context = "Visual evidence from source PDF page 8. Fill in the ______ nearest hundred."
    assert service._visual_quiz_reuses_source_exercise(
        context,
        "What is the nearest hundred of 2,346?\nA) 2,300\nAnswer: A",
    )


def test_visual_quiz_detector_allows_observation_question():
    context = "Visual evidence from source PDF page 8. Fill in the ______ blank."
    assert not service._visual_quiz_reuses_source_exercise(
        context,
        "Visual question — use page 8: Which animal is visible beside the number line?",
    )


def test_generated_visual_precision_detects_unsupported_degrees_and_answers():
    visuals = [{"type": "angle_turns", "items": [{"degrees": 90}, {"degrees": 180}]}]
    issues = service._generated_visual_precision_issues(
        visuals,
        "Quarter turn 90°. Half turn 180°.",
        "Example: 225°. Self-check questions\n1. Try it. Answer: 225°",
    )
    assert "unsupported degree values: 225°" in issues
    assert "self-check answers were revealed" in issues


def test_fraction_visual_precision_rejects_invented_grid_facts_and_examples():
    visuals = [{"type": "fraction_wholes", "items": []}]
    issues = service._generated_visual_precision_issues(
        visuals,
        "The source contains blank Grids A, B, and C.",
        "Grid A is a shaded 5x7 grid. Imagine a pizza and a ribbon.",
    )
    assert "invented dimensions for source activity grids" in issues
    assert "described a blank source activity grid as shaded" in issues
    assert "introduced unsupported outside examples: pizza, ribbon" in issues


def test_fraction_fallback_is_precise_and_keeps_source_grids_blank():
    visual = {
        "items": [
            {"label": "Smaller chocolate", "rows": 2, "columns": 2, "highlighted_blocks": 2},
            {"label": "Larger chocolate", "rows": 3, "columns": 3, "highlighted_blocks": 3},
        ],
    }
    content = service._safe_fraction_visual_explanation(visual)
    assert "2 blocks < 3 blocks" in content
    assert "1/3 of the larger chocolate represents more" in content
    assert "grids labelled A, B, and C are blank activities" in content
    assert "pizza" not in content.casefold()


def test_citations_keep_only_visual_pages_used_in_focused_context():
    citations = [{
        "material_id": "material-1",
        "visual_pages": [{"page_number": 1}, {"page_number": 7}],
    }]
    result = service._citations_used_in_context(
        citations,
        "Visual evidence from source PDF page 1.",
    )
    assert result[0]["visual_pages"] == [{"page_number": 1}]


def test_balance_fallback_keeps_totals_out_of_groups_and_verifies_swaps():
    visual = {
        "problems": [
            {
                "label": "a", "left": [1, 2, 7, 9], "right": [3, 4, 5, 9],
                "left_total": 19, "right_total": 21, "gap": 2, "required_transfer": 1,
                "example_swaps": [[2, 3]], "minimum_moves": 1,
            },
            {
                "label": "d", "left": [77, 78, 79, 80], "right": [81, 82, 83, 84],
                "left_total": 314, "right_total": 330, "gap": 16, "required_transfer": 8,
                "example_swaps": [[77, 81], [78, 82]], "minimum_moves": 2,
            },
        ],
    }
    content = service._safe_balance_visual_explanation(visual)
    assert "Left operands: 1, 2, 7, 9; total = 19" in content
    assert "swap 2 ↔ 3 → totals 20 and 20" in content
    assert "swap 78 ↔ 82 → totals 322 and 322" in content
    assert "swapping 2 and 5 does **not** balance" in content


def test_verification_context_does_not_expand_curriculum_scope(make_request):
    _, user = service.build_prompt(
        make_request(subject="Mathematics", question="Calculate 12 / 3"),
        "context",
        "Restricted verifier checked `12 / 3` and obtained `4.0`.",
    )
    assert "does not expand the retrieved curriculum scope" in user


def test_homework_prompt_never_receives_verification_answer(make_request):
    _, user = service.build_prompt(
        make_request(mode="homework_help", subject="Mathematics", question="Calculate 12 / 3"),
        "context",
        "Restricted verifier checked `12 / 3` and obtained `4.0`.",
    )
    assert "obtained `4.0`" not in user


# --- retrieve_relevant_chunks routing ---


def test_school_requests_go_to_qdrant(monkeypatch, make_request):
    captured = {}

    def fake_qdrant(**kwargs):
        captured.update(kwargs)
        return ["qdrant chunk"]

    monkeypatch.setattr(service, "retrieve_from_qdrant", fake_qdrant)
    req = make_request(schoolId="school-1", classId="class-1", chapterTitle="Light")
    assert service.retrieve_relevant_chunks(req) == ["qdrant chunk"]
    assert captured["school_id"] == "school-1"
    assert captured["chapter_title"] == "Light"


def test_no_school_and_no_candidates_returns_nothing(make_request):
    assert service.retrieve_relevant_chunks(make_request()) == []


# --- in-memory fallback (no schoolId) ---


def test_in_memory_retrieval_filters_by_similarity(monkeypatch, make_request):
    def fake_embed(texts, *, kind="document"):
        if kind == "query":
            return [[1.0, 0.0]]
        return [[1.0, 0.0] if "photosynthesis" in t.lower() else [0.0, 1.0] for t in texts]

    monkeypatch.setattr(service, "embed_texts", fake_embed)
    req = make_request(
        candidates=[
            Candidate(id="1", text="Photosynthesis converts light into chemical energy."),
            Candidate(id="2", text="The French revolution began in 1789."),
        ],
    )
    assert service.retrieve_relevant_chunks(req) == [
        "Photosynthesis converts light into chemical energy."
    ]


def test_in_memory_caps_context_chunks(monkeypatch, make_request):
    def fake_embed(texts, *, kind="document"):
        return [[1.0, 0.0] for _ in texts]

    monkeypatch.setattr(service, "embed_texts", fake_embed)
    req = make_request(
        candidates=[Candidate(id=str(i), text=f"Photosynthesis fact {i}.") for i in range(10)],
    )
    chunks = service.retrieve_relevant_chunks(req)
    assert len(chunks) == settings.max_context_chunks


def test_in_memory_falls_back_to_lexical_match(monkeypatch, make_request):
    # All candidate embeddings orthogonal to the query: similarity path finds nothing.
    def fake_embed(texts, *, kind="document"):
        return [[1.0, 0.0]] if kind == "query" else [[0.0, 1.0] for _ in texts]

    monkeypatch.setattr(service, "embed_texts", fake_embed)
    req = make_request(
        topic="Photosynthesis",
        candidates=[
            Candidate(id="1", text="Photosynthesis needs sunlight and chlorophyll."),
            Candidate(id="2", text="Unrelated text about railway timetables."),
        ],
    )
    assert service.retrieve_relevant_chunks(req) == [
        "Photosynthesis needs sunlight and chlorophyll."
    ]
