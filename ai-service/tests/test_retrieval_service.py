import pytest

from app.core.config import settings
from app.modules.retrieval import service


def _hit(text: str, score: float, index: int = 0) -> dict:
    return {
        "id": str(index),
        "score": score,
        "text": text,
        "chunk_index": index,
        "chapter_title": "",
        "topic_title": "",
    }


def _retrieve(**overrides) -> list[str]:
    kwargs = {
        "school_id": "school-1",
        "class_id": "class-1",
        "section_id": None,
        "subject": "Science",
        "chapter_title": "Light",
        "topic": "Reflection",
        "sub_topic": None,
        "question": None,
    }
    kwargs.update(overrides)
    return service.retrieve_from_qdrant(**kwargs)


@pytest.fixture(autouse=True)
def fake_embeddings(monkeypatch):
    monkeypatch.setattr(service, "embed_texts", lambda texts, *, kind="query": [[0.1] * 4 for _ in texts])


def test_chapter_scroll_returns_single_merged_string(monkeypatch):
    # Scroll returns unordered chunks; they should be merged into one clean string.
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit("second part", 1.0, 5), _hit("first part", 1.0, 1)],
    )
    result = _retrieve()
    assert len(result) == 1
    # Document order: first part before second part
    assert result[0].index("first part") < result[0].index("second part")


def test_chapter_scroll_never_calls_search_chunks(monkeypatch):
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit("poem text", 1.0, 0)],
    )

    def forbidden(**kwargs):
        raise AssertionError("search_chunks must not be called when chapter scroll succeeds")

    monkeypatch.setattr(service, "search_chunks", forbidden)
    result = _retrieve()
    assert "poem text" in result[0]


def test_chapter_returns_visual_evidence_and_page_citation(monkeypatch):
    text_hit = {
        **_hit("Place value explanation", 1.0, 0),
        "material_id": "material-1",
        "source_name": "math.pdf",
        "source_url": "https://example.test/math.pdf",
        "chunk_type": "text",
    }
    visual_hit = {
        **_hit("Visual evidence from source PDF page 4. Number line from 0 to 100.", 1.0, 1),
        "material_id": "material-1",
        "source_name": "math.pdf",
        "source_url": "https://example.test/math.pdf",
        "chunk_type": "visual",
        "page_number": 4,
    }
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kwargs: [visual_hit, text_hit])

    chunks, citations = service.retrieve_from_qdrant_with_meta(
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
        subject="Mathematics",
        chapter_title="Place Value",
        topic="Number lines",
        sub_topic=None,
        question=None,
    )

    assert chunks == ["Place value explanation", visual_hit["text"]]
    assert citations[0]["source_url"] == "https://example.test/math.pdf"
    assert citations[0]["visual_pages"][0]["page_number"] == 4


def test_citations_dedupe_legacy_and_current_ids_by_source_url():
    shared = {
        "source_name": "eemm102.pdf",
        "source_url": "https://example.test/eemm102.pdf",
        "chapter_title": "Fractions",
        "chunk_type": "visual",
        "page_number": 1,
        "text": "Visual evidence from page 1.",
    }
    citations = service._dedupe_citations([
        {**shared, "material_id": "smart_learning_materials/file_old"},
        {**shared, "material_id": "6a7c446a7c70d4508e96f370"},
    ])

    assert len(citations) == 1
    assert citations[0]["material_id"] == "6a7c446a7c70d4508e96f370"
    assert [page["page_number"] for page in citations[0]["visual_pages"]] == [1]


def test_chapter_visual_pages_are_ranked_by_query_terms(monkeypatch):
    visual_pages = [
        {
            **_hit("Visual evidence showing travel distances.", 1.0, 0),
            "material_id": "material-1",
            "source_name": "math.pdf",
            "source_url": "https://example.test/math.pdf",
            "chunk_type": "visual",
            "page_number": 1,
        },
        {
            **_hit("Visual evidence showing rounding on a number line.", 1.0, 1),
            "material_id": "material-1",
            "source_name": "math.pdf",
            "source_url": "https://example.test/math.pdf",
            "chunk_type": "visual",
            "page_number": 8,
        },
    ]
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kwargs: visual_pages)
    monkeypatch.setattr(settings, "max_context_chunks", 1)

    chunks, citations = service.retrieve_from_qdrant_with_meta(
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
        subject="Mathematics",
        chapter_title="Place Value",
        topic="rounding",
        sub_topic="number line",
        question="Explain the rounding diagram",
    )

    assert "number line" in chunks[0]
    assert citations[0]["visual_pages"][0]["page_number"] == 8


def test_chapter_visual_ranking_drops_unrelated_pages(monkeypatch):
    visual_pages = [
        {
            **_hit("Visual evidence showing rounding on a labelled number line.", 1.0, 0),
            "material_id": "material-1",
            "source_name": "math.pdf",
            "chunk_type": "visual",
            "page_number": 8,
        },
        {
            **_hit("Visual evidence showing a river crossing puzzle and pebbles.", 1.0, 1),
            "material_id": "material-1",
            "source_name": "math.pdf",
            "chunk_type": "visual",
            "page_number": 12,
        },
    ]
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kwargs: visual_pages)

    chunks, citations = service.retrieve_from_qdrant_with_meta(
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
        subject="Mathematics",
        chapter_title="Place Value",
        topic="rounding",
        sub_topic="number line",
        question="Explain rounding visually",
    )

    assert len(chunks) == 1
    assert citations[0]["visual_pages"] == [{
        "page_number": 8,
        "description": visual_pages[0]["text"][:500],
    }]


def test_chapter_overlap_is_merged_not_duplicated(monkeypatch):
    # Simulate two chunks sharing a 30-char overlap at their boundary.
    shared = "shared overlap text here okay "  # 30 chars
    chunk0 = "start of chapter. " + shared
    chunk1 = shared + "rest of chapter."
    monkeypatch.setattr(
        service, "get_chapter_chunks",
        lambda **kw: [_hit(chunk0, 1.0, 0), _hit(chunk1, 1.0, 1)],
    )
    result = _retrieve()
    assert len(result) == 1
    merged = result[0]
    # The shared text must appear exactly once
    assert merged.count(shared.strip()) == 1
    assert merged == "start of chapter. " + shared + "rest of chapter."


def test_falls_back_to_subject_search_when_chapter_has_no_chunks(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        return [_hit("relevant", settings.rag_relevance_threshold + 0.1, 0)]

    monkeypatch.setattr(service, "search_chunks", fake_search)
    result = _retrieve()
    assert result == ["relevant"]
    assert len(calls) == 1
    assert calls[0]["chapter_title"] is None
    assert calls[0]["subject_name"] == "science"


def test_chapter_retries_legacy_subject_name_when_subject_id_has_no_chunks(monkeypatch):
    calls = []

    def fake_chapter(**kwargs):
        calls.append(kwargs)
        return [] if kwargs["subject_id"] else [_hit("legacy mathematics", 1.0, 0)]

    monkeypatch.setattr(service, "get_chapter_chunks", fake_chapter)

    assert _retrieve(subject="Mathematics", subject_id="subject-1") == ["legacy mathematics"]
    assert [call["subject_id"] for call in calls] == ["subject-1", None]
    assert calls[1]["subject_name"] == "mathematics"


def test_chapter_retries_mathematic_singular_title_variant(monkeypatch):
    calls = []

    def fake_chapter(**kwargs):
        calls.append(kwargs["chapter_title"])
        if kwargs["chapter_title"] == "Mathematic Chapter 004":
            return [_hit("Making Sums Equal", 1.0, 0)]
        return []

    monkeypatch.setattr(service, "get_chapter_chunks", fake_chapter)
    result = _retrieve(
        subject="Mathematics",
        subject_id="subject-1",
        chapter_title="Mathematics Chapter 004",
        topic="Making Sums Equal",
    )
    assert result == ["Making Sums Equal"]
    assert calls[:2] == ["Mathematics Chapter 004", "Mathematic Chapter 004"]


def test_subject_search_retries_legacy_subject_name_when_subject_id_has_no_hits(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kwargs: [])
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        if kwargs["subject_id"]:
            return []
        return [_hit("legacy algebra", settings.rag_relevance_threshold + 0.1, 0)]

    monkeypatch.setattr(service, "search_chunks", fake_search)

    assert _retrieve(
        subject="Mathematics",
        subject_id="subject-1",
        chapter_title=None,
    ) == ["legacy algebra"]
    assert [call["subject_id"] for call in calls] == ["subject-1", None]
    assert calls[1]["subject_name"] == "mathematics"


def test_subject_fallback_applies_relevance_threshold(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])

    def fake_search(**kwargs):
        return [
            _hit("relevant", settings.rag_relevance_threshold + 0.1, 0),
            _hit("irrelevant", settings.rag_relevance_threshold - 0.1, 1),
        ]

    monkeypatch.setattr(service, "search_chunks", fake_search)
    assert _retrieve() == ["relevant"]


def test_returns_empty_when_nothing_relevant(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    monkeypatch.setattr(service, "search_chunks", lambda **kw: [])
    assert _retrieve() == []


def test_subject_filter_is_normalized(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    calls = []

    def fake_search(**kwargs):
        calls.append(kwargs)
        return []

    monkeypatch.setattr(service, "search_chunks", fake_search)
    _retrieve(subject="  Social   Science ")
    assert calls[0]["subject_name"] == "social science"


def test_chapter_capped_at_max_chapter_context_chunks(monkeypatch):
    cap = settings.max_chapter_context_chunks
    hits = [_hit(f"chunk{i}", 1.0, i) for i in range(cap + 5)]
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: hits)
    result = _retrieve()
    assert len(result) == 1
    # Content beyond the cap must not appear in the merged text
    assert f"chunk{cap}" not in result[0]
    assert f"chunk{cap - 1}" in result[0]


def test_subject_results_capped_at_max_context_chunks(monkeypatch):
    hits = [_hit(f"chunk {i}", 0.9, i) for i in range(10)]
    monkeypatch.setattr(service, "search_chunks", lambda **kw: hits)
    assert len(_retrieve(chapter_title=None)) == settings.max_context_chunks


def test_hybrid_search_prefers_exact_formula_match(monkeypatch):
    monkeypatch.setattr(service, "get_chapter_chunks", lambda **kw: [])
    threshold = settings.rag_relevance_threshold
    formula_hit = {
        **_hit("Newton's second law is F = ma.", threshold - 0.04, 1),
        "formulas": ["F = ma"],
    }
    generic_hit = _hit("A general discussion of force.", threshold + 0.01, 0)
    monkeypatch.setattr(service, "search_chunks", lambda **kw: [generic_hit, formula_hit])

    result = _retrieve(chapter_title=None, question="Explain F = ma")

    assert result[0] == formula_hit["text"]
