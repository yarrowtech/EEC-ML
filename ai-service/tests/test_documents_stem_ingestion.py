from app.modules.documents import service


def test_ingestion_embeds_enrichment_but_stores_original_chunks(monkeypatch, tmp_path):
    source_path = tmp_path / "physics.pdf"
    source_path.write_bytes(b"placeholder")
    raw_text = "Newton's second law is F = ma. Acceleration uses m/s². " * 15
    captured = {}

    monkeypatch.setattr(service, "download_to_temp", lambda *_: source_path)
    monkeypatch.setattr(service, "parse_document", lambda *_: (raw_text, "text_pdf"))
    monkeypatch.setattr(service, "extract_pdf_visual_chunks", lambda *_: [])

    def fake_embed(texts, *, kind):
        captured["embedding_texts"] = texts
        return [[0.1, 0.2] for _ in texts]

    def fake_upsert(**kwargs):
        captured["upsert"] = kwargs
        return len(kwargs["chunks"])

    monkeypatch.setattr(service, "embed_texts", fake_embed)
    monkeypatch.setattr(service, "upsert_chunks", fake_upsert)

    indexed, document_type, bloom_level, learning_outcomes, detected_topic = service.ingest_material(
        url="https://example.test/physics.pdf",
        material_id="material-1",
        source_id="source-1",
        file_name="physics.pdf",
        content_type="application/pdf",
        replace_existing=False,
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
        academic_year_id="year-1",
        subject_id="physics-1",
        subject_name="Physics",
        curriculum_code="PHY-8-FORCE",
        chapter_id="chapter-1",
        chapter_title="Force",
        topic_title="Newton's Laws",
    )

    assert document_type == "text_pdf"
    assert indexed == len(captured["upsert"]["chunks"])
    assert captured["upsert"]["chunks"][0] in raw_text
    assert captured["embedding_texts"][0].startswith("Subject: Physics")
    assert "Formulas:" in captured["embedding_texts"][0]
    assert captured["upsert"]["academic_year_id"] == "year-1"
    assert captured["upsert"]["subject_id"] == "physics-1"


def test_ingestion_stores_visual_page_chunks_with_page_metadata(monkeypatch, tmp_path):
    source_path = tmp_path / "mathematics.pdf"
    source_path.write_bytes(b"placeholder")
    captured = {}

    monkeypatch.setattr(service, "download_to_temp", lambda *_: source_path)
    monkeypatch.setattr(service, "parse_document", lambda *_: ("Place value uses thousands and hundreds. " * 10, "text_pdf"))
    monkeypatch.setattr(
        service,
        "extract_pdf_visual_chunks",
        lambda *_: [(3, "Visual evidence from source PDF page 3.\nDiagram labels: number line")],
    )
    monkeypatch.setattr(service, "embed_texts", lambda texts, *, kind: [[0.1, 0.2] for _ in texts])

    def fake_upsert(**kwargs):
        captured.update(kwargs)
        return len(kwargs["chunks"])

    monkeypatch.setattr(service, "upsert_chunks", fake_upsert)

    indexed, *_ = service.ingest_material(
        url="https://example.test/mathematics.pdf",
        material_id="material-1",
        source_id="source-1",
        file_name="mathematics.pdf",
        content_type="application/pdf",
        replace_existing=False,
        school_id="school-1",
        class_id="class-1",
        section_id="section-1",
        subject_id="math-1",
        subject_name="Mathematics",
        chapter_id="chapter-1",
        chapter_title="Place Value",
        topic_title="Large Numbers",
    )

    assert indexed == len(captured["chunks"])
    assert captured["chunk_types"][-1] == "visual"
    assert captured["page_numbers"][-1] == 3
    assert captured["start_chars"][-1] is None
    assert "number line" in captured["chunks"][-1]
