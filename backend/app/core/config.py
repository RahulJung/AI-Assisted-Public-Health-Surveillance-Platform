from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI/ML Public Health Surveillance Assistant"
    database_url: str = "sqlite:///./surveillance.db"
    chroma_path: str = "./chroma_store"
    knowledge_base_path: str = "./knowledge_base"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    rag_provider: str = "local"
    openai_api_key: str | None = None
    openai_embedding_model: str = "text-embedding-3-small"
    openai_rag_model: str = "gpt-4o-mini"
    openai_fine_tuned_model: str | None = None

    class Config:
        env_file = ".env"


settings = Settings()
