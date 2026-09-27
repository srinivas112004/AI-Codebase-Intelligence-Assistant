import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    source = Column(String(50), nullable=False)  # "github" or "zip"
    url = Column(String(500), nullable=True)     # GitHub URL or original archive name
    status = Column(String(50), default="pending", nullable=False)  # "pending", "indexing", "ready", "error"
    error_message = Column(Text, nullable=True)
    total_files = Column(Integer, default=0, nullable=False)
    total_symbols = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Relationships
    files = relationship("FileModel", back_populates="repository", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="repository", cascade="all, delete-orphan")

class FileModel(Base):
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    path = Column(String(500), nullable=False)  # Relative path in repo e.g., "app/services/auth.py"
    language = Column(String(50), default="python", nullable=False)
    line_count = Column(Integer, default=0, nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)

    # Relationships
    repository = relationship("Repository", back_populates="files")
    symbols = relationship("CodeSymbol", back_populates="file", cascade="all, delete-orphan")

class CodeSymbol(Base):
    __tablename__ = "code_symbols"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)           # Function or class name
    symbol_type = Column(String(50), nullable=False)      # "class", "function", "method", "import"
    parent_symbol = Column(String(255), nullable=True)    # Enclosing class name if method
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    docstring = Column(Text, nullable=True)
    args = Column(Text, nullable=True)                   # JSON string of argument names

    # Relationships
    file = relationship("FileModel", back_populates="symbols")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    repository_id = Column(String(36), ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)                # JSON string list of retrieved sources
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Relationships
    repository = relationship("Repository", back_populates="chat_history")
