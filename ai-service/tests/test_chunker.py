from app.modules.parser.chunker import CHUNK_SIZE, MIN_CHUNK_CHARS, chunk_text
from app.modules.parser.pdf import strip_repeated_lines


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   \n  ") == []


def test_short_text_is_single_chunk():
    text = "A short paragraph about glass bangles."
    assert chunk_text(text) == [text]


def test_chunks_cover_text_without_duplication():
    text = " ".join(f"word{i}" for i in range(1000))
    chunks = chunk_text(text)
    assert all(len(c) <= CHUNK_SIZE for c in chunks)
    assert all(len(c) >= MIN_CHUNK_CHARS for c in chunks)
    # Every chunk must start where the text actually continues (allowing overlap).
    cursor = 0
    for chunk in chunks:
        position = text.find(chunk, cursor)
        assert position != -1
        cursor = position + 1
    assert chunks[-1].endswith("word999")


def test_page_footer_pattern_does_not_degenerate():
    # Regression: pages ~750 chars long joined by "\n\n" used to stall the
    # cursor into 1-char steps, emitting hundreds of near-duplicate chunks.
    def page(n: int) -> str:
        return " ".join(f"Sentence {n}-{i} about the glass artisans of Firozabad." for i in range(14))

    text = "\n\n".join(f"{page(n)}\nReprint 2026-27" for n in range(20))
    chunks = chunk_text(text)
    expected_max = len(text) // (CHUNK_SIZE // 2) + 2
    assert len(chunks) <= expected_max
    assert len(set(chunks)) == len(chunks), "chunker emitted duplicate chunks"


def test_strip_repeated_lines_removes_footers_and_page_numbers():
    pages = [f"Content of page {i} with unique words.\nReprint 2026-27\n{i}" for i in range(10)]
    cleaned = strip_repeated_lines(pages)
    assert all("Reprint 2026-27" not in page for page in cleaned)
    assert cleaned[3].strip() == "Content of page 3 with unique words."


def test_strip_repeated_lines_keeps_short_docs_intact():
    pages = ["Page one.\nReprint 2026-27", "Page two.\nReprint 2026-27"]
    assert strip_repeated_lines(pages) == pages
