from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_summary_model: str = "qwen2.5:14b"

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "teacher_documents"
    qdrant_vector_size: int = 768

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_database: str = "eec_ai"
    rag_relevance_threshold: float = 0.30
    max_context_chunks: int = 4
    download_timeout: int = 30

    log_level: str = "INFO"


settings = Settings()
