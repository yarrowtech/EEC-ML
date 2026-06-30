import re

CHUNK_SIZE = 600
CHUNK_OVERLAP = 100
MIN_CHUNK_CHARS = 80


def _split_paragraphs(text: str) -> list[str]:
    paras = re.split(r"\n{2,}", text.strip())
    return [p.strip() for p in paras if p.strip()]


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks without breaking words."""
    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunk = text[start:].strip()
            if len(chunk) >= MIN_CHUNK_CHARS:
                chunks.append(chunk)
            break

        # Try to break at a paragraph boundary first, then sentence, then space
        for separator in ["\n\n", "\n", ". ", " "]:
            boundary = text.rfind(separator, start, end)
            if boundary > start:
                end = boundary + len(separator)
                break

        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_CHARS:
            chunks.append(chunk)

        start = max(start + 1, end - overlap)

    return chunks
