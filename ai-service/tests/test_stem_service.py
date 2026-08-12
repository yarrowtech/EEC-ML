from app.modules.stem.service import (
    build_embedding_text,
    build_stem_metadata,
    rerank_stem_hits,
)


def test_extracts_physics_formula_and_units_without_changing_source():
    source = "Newton's second law is F = ma. Acceleration is measured in m/s²."
    metadata = build_stem_metadata(source, subject_name="Physics")
    enriched = build_embedding_text(
        source,
        subject_name="Physics",
        discipline=str(metadata["discipline"]),
        chapter_title="Force and Motion",
        topic_title="Newton's laws",
        concepts=list(metadata["concepts"]),
        formulas=list(metadata["formulas"]),
        units=list(metadata["units"]),
    )

    assert metadata["discipline"] == "physics"
    assert any("F = ma" in formula for formula in metadata["formulas"])
    assert "m/s²" in metadata["units"]
    assert enriched.endswith(source)


def test_formula_overlap_reranks_a_close_dense_candidate():
    hits = [
        {"text": "General force notes", "score": 0.80, "formulas": [], "units": []},
        {"text": "Newton's law: F = ma", "score": 0.76, "formulas": ["F = ma"], "units": []},
    ]
    reranked = rerank_stem_hits("Explain F = ma", hits)
    assert reranked[0]["text"] == "Newton's law: F = ma"
    assert reranked[0]["exact_stem_matches"] >= 1
