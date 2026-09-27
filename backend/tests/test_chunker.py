from app.services.chunker import chunk_python_code, chunk_markdown, create_chunks_for_file

SAMPLE_CODE = """# Authentication Module
import hashlib
from typing import Optional

class AuthManager:
    \"\"\"Handles token creation and password hashing.\"\"\"

    def hash_password(self, password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def verify_password(self, password: str, hashed: str) -> bool:
        return self.hash_password(password) == hashed

def generate_session_token(user_id: str) -> str:
    \"\"\"Generate secure random session token.\"\"\"
    return f"token_{user_id}_xyz"
"""

def test_chunk_python_code_symbols():
    chunks = chunk_python_code(SAMPLE_CODE, "app/auth.py", "repo-123")

    chunk_types = [c.chunk_type for c in chunks]
    assert "module" in chunk_types
    assert "class" in chunk_types
    assert "method" in chunk_types
    assert "function" in chunk_types

    # Preamble chunk
    preamble = next(c for c in chunks if c.chunk_type == "module")
    assert preamble.symbol_name == "module_preamble"
    assert "import hashlib" in preamble.content

    # Class chunk
    auth_class = next(c for c in chunks if c.chunk_type == "class")
    assert auth_class.symbol_name == "AuthManager"
    assert auth_class.start_line == 5

    # Method chunks
    methods = [c for c in chunks if c.chunk_type == "method"]
    assert len(methods) == 2
    method_names = [m.symbol_name for m in methods]
    assert "AuthManager.hash_password" in method_names
    assert "AuthManager.verify_password" in method_names

    # Standalone function chunk
    func = next(c for c in chunks if c.chunk_type == "function")
    assert func.symbol_name == "generate_session_token"
    assert "def generate_session_token" in func.content
    assert func.start_line == 14

def test_searchable_text_and_metadata():
    chunks = chunk_python_code(SAMPLE_CODE, "app/auth.py", "repo-123")
    func = next(c for c in chunks if c.symbol_name == "generate_session_token")

    searchable = func.to_searchable_text()
    assert "# File: app/auth.py" in searchable
    assert "# Symbol: generate_session_token (function)" in searchable
    assert "def generate_session_token" in searchable

    metadata = func.to_metadata()
    assert metadata["repository_id"] == "repo-123"
    assert metadata["file"] == "app/auth.py"
    assert metadata["symbol"] == "generate_session_token"
    assert metadata["type"] == "function"
    assert metadata["start_line"] == 14

def test_oversized_function_fallback_chunking():
    # Construct a function longer than MAX_CHUNK_CHARS (1800 chars)
    long_body = "\n".join([f"    x_{i} = {i} * 2  # processing step number {i}" for i in range(100)])
    oversized_code = f"def massive_function():\n{long_body}\n    return True\n"

    chunks = chunk_python_code(oversized_code, "large.py", "repo-test")

    # Should have split into multiple parts
    part_chunks = [c for c in chunks if "massive_function" in c.symbol_name]
    assert len(part_chunks) > 1
    assert "part 1" in part_chunks[0].symbol_name
    assert "part 2" in part_chunks[1].symbol_name

def test_markdown_chunking():
    markdown = """# Architecture
High level system overview.

## Data Layer
SQLite and ChromaDB manage state and vectors.

## API Layer
FastAPI routes user queries.
"""
    chunks = chunk_markdown(markdown, "README.md", "repo-docs")
    assert len(chunks) == 3

    symbols = [c.symbol_name for c in chunks]
    assert "Architecture" in symbols
    assert "Data Layer" in symbols
    assert "API Layer" in symbols

    for c in chunks:
        assert c.chunk_type == "documentation"
