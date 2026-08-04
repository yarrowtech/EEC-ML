from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_summary_model: str = "qwen2.5:14b"
    ollama_clean_model: str = "llama3.2:3b"  # lightweight model for ingestion-time cleaning

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "teacher_documents"
    qdrant_vector_size: int = 768

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_database: str = "eec_ai"
    rag_relevance_threshold: float = 0.55
    max_context_chunks: int = 4
    max_chapter_context_chunks: int = 20
    ollama_num_ctx: int = 8192
    ollama_num_predict: int = 1500
    ollama_num_predict_extended: int = 3000  # for mind_map, notes, flashcards, summarize
    download_timeout: int = 30

    ollama_assess_model: str = "qwen3:8b"  # dedicated model for reading/writing evaluation
    whisper_model_size: str = "large-v3-turbo"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"

    # Qdrant collection for adaptive language memory
    qdrant_language_collection: str = "student_language_memory"
    qdrant_language_vector_size: int = 768

    log_level: str = "INFO"

    # OpenRouter (production) — set OPENROUTER_API_KEY in .env to enable.
    # When set, all /generate/* endpoints use OpenRouter instead of Ollama.
    # Recommended model: "google/gemini-flash-1.5" or "meta-llama/llama-3.3-70b-instruct"
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-flash-1.5"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Context window for OpenRouter models (most support 128k+)
    openrouter_num_ctx: int = 32768


settings = Settings()
