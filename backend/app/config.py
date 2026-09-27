import os
from pathlib import Path
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory for the monorepo root
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    # API Keys & LLM Models
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Relational Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"

    # Vector Database
    CHROMA_PATH: str = str(BASE_DIR / "data" / "chroma")

    # Embeddings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Repositories Storage
    REPOS_STORAGE_PATH: str = str(BASE_DIR / "data" / "repos")

    # Server & Networking
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @model_validator(mode="after")
    def resolve_paths(self) -> "Settings":
        # Resolve SQLite database path relative to BASE_DIR if relative
        if self.DATABASE_URL.startswith("sqlite:///./") or self.DATABASE_URL.startswith("sqlite:///data/"):
            rel_part = self.DATABASE_URL.replace("sqlite:///", "").lstrip("./")
            self.DATABASE_URL = f"sqlite:///{BASE_DIR / rel_part}"

        # Resolve CHROMA_PATH if relative
        chroma_p = Path(self.CHROMA_PATH)
        if not chroma_p.is_absolute():
            self.CHROMA_PATH = str(BASE_DIR / chroma_p)

        # Resolve REPOS_STORAGE_PATH if relative
        repos_p = Path(self.REPOS_STORAGE_PATH)
        if not repos_p.is_absolute():
            self.REPOS_STORAGE_PATH = str(BASE_DIR / repos_p)

        return self

settings = Settings()

# Ensure necessary data directories exist
db_file_path = settings.DATABASE_URL.replace("sqlite:///", "")
if db_file_path:
    os.makedirs(Path(db_file_path).parent, exist_ok=True)

os.makedirs(settings.CHROMA_PATH, exist_ok=True)
os.makedirs(settings.REPOS_STORAGE_PATH, exist_ok=True)
