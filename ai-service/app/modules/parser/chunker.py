from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 600
CHUNK_OVERLAP = 100
MIN_CHUNK_CHARS = 80


def chunk_text_with_offsets(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[tuple[str, int]]:
    """Split text into overlapping chunks, each paired with its start-char offset.

    The offset is stored in Qdrant so retrieval can reconstruct the original text
    without string-matching heuristics.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [(text, 0)]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        add_start_index=True,
    )
    docs = splitter.create_documents([text])
    return [
        (doc.page_content, doc.metadata["start_index"])
        for doc in docs
        if len(doc.page_content) >= MIN_CHUNK_CHARS
    ]


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Return plain chunk strings (drops offsets). Used by tests and legacy callers."""
    return [chunk for chunk, _ in chunk_text_with_offsets(text, chunk_size, overlap)]
