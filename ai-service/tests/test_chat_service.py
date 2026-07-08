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
    assert service.MODE_INSTRUCTIONS[mode] in user


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
