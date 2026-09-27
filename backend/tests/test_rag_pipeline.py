import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Repository, ChatHistory
from app.schemas import SourceRef
from app.services.llm import (
    LLMConfigurationError,
    GeminiService,
    MockLLMService,
    set_llm_service,
    get_llm_service,
)
from app.services.rag import RAGPipeline

# In-memory SQLite engine for fast, isolated testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)

class MockRetriever:
    def __init__(self, sources=None, context_text=""):
        self.sources = sources if sources is not None else [
            SourceRef(
                file="auth/service.py",
                symbol="authenticate_user",
                symbol_type="function",
                start_line=12,
                end_line=28,
                similarity=0.88,
                content_snippet="def authenticate_user(username, password):\n    return verify_hash(password)"
            )
        ]
        self.context_text = context_text or (
            "--- Source: auth/service.py (lines 12-28) [Similarity: 0.88] ---\n"
            "```python\ndef authenticate_user(username, password):\n    return verify_hash(password)\n```"
        )

    def retrieve_context(self, query: str, repository_id: str, top_k: int = 5):
        return self.context_text, self.sources


def test_gemini_service_configuration_check():
    """Verify GeminiService detects missing/placeholder credentials properly."""
    svc_empty = GeminiService(api_key="")
    assert svc_empty.is_configured() is False
    with pytest.raises(LLMConfigurationError):
        svc_empty.generate("Hello")

    svc_placeholder = GeminiService(api_key="your_gemini_api_key_here")
    assert svc_placeholder.is_configured() is False

    svc_valid = GeminiService(api_key="AIzaSy_valid_mock_key_12345")
    assert svc_valid.is_configured() is True


def test_mock_llm_service():
    """Verify MockLLMService records prompts and returns deterministic responses."""
    mock = MockLLMService(canned_response="This is a canned answer.")
    assert mock.is_configured() is True

    answer = mock.generate(
        prompt="Where is authentication?",
        system_instruction="Grounding rule.",
        temperature=0.1
    )
    assert answer == "This is a canned answer."
    assert mock.last_prompt == "Where is authentication?"
    assert mock.last_system_instruction == "Grounding rule."


def test_rag_pipeline_grounded_prompt_and_steps():
    """Verify RAGPipeline formats grounded context and captures execution trace."""
    mock_retriever = MockRetriever()
    mock_llm = MockLLMService(canned_response="Authentication is handled in `[auth/service.py (lines 12-28)]`.")
    pipeline = RAGPipeline(retriever=mock_retriever, llm_service=mock_llm)

    response = pipeline.chat(
        repository_id="repo-123",
        question="Where is authentication handled?",
        top_k=3
    )

    assert "Authentication is handled" in response.answer
    assert len(response.sources) == 1
    assert response.sources[0].file == "auth/service.py"
    assert response.sources[0].symbol == "authenticate_user"

    # Verify retrieval trace
    steps = response.retrieval_steps
    assert steps is not None
    assert steps["query"] == "Where is authentication handled?"
    assert steps["embedding_dimension"] == 384
    assert steps["chunks_retrieved_count"] == 1
    assert steps["chunks"][0]["file"] == "auth/service.py"
    assert steps["chunks"][0]["similarity"] == 0.88

    # Verify prompt received by LLM contains exact context and instructions
    assert "### Retrieved Codebase Context:" in mock_llm.last_prompt
    assert "auth/service.py" in mock_llm.last_prompt
    assert "Strict Grounding Rules:" in mock_llm.last_system_instruction


def test_rag_pipeline_zero_chunks_unanswerable():
    """Verify strict zero-hallucination when no relevant chunks are found."""
    mock_retriever = MockRetriever(sources=[], context_text="")
    mock_llm = MockLLMService(canned_response="Should not be called")
    pipeline = RAGPipeline(retriever=mock_retriever, llm_service=mock_llm)

    response = pipeline.chat(
        repository_id="repo-123",
        question="What is the quantum encryption protocol?",
        top_k=5
    )

    assert "does not contain sufficient information" in response.answer
    assert response.sources == []
    # Assert LLM was never asked to hallucinate
    assert mock_llm.last_prompt is None


def test_rag_pipeline_code_explanation():
    """Verify code explanation decomposes symbols into structured sections."""
    canned_explanation = (
        "## Purpose\nValidates incoming JWT tokens and extracts user claims.\n\n"
        "## Inputs & Parameters\n- `token`: str - Encoded JWT token.\n\n"
        "## Outputs & Return Values\n- `dict` with user metadata or raises HTTPException.\n\n"
        "## Execution Logic\n1. Decodes JWT header.\n2. Verifies HMAC-SHA256 signature.\n\n"
        "## Edge Cases & Robustness\nExpired tokens or malformed payload.\n\n"
        "## Time & Space Complexity\nO(1) time and space.\n\n"
        "## Security & Best Practices\nEnsure SECRET_KEY is kept confidential in environment variables."
    )
    mock_llm = MockLLMService(canned_response=canned_explanation)
    pipeline = RAGPipeline(llm_service=mock_llm)

    explanation = pipeline.explain_code(
        code="def verify_jwt(token: str):\n    return jwt.decode(token)",
        name="verify_jwt",
        symbol_type="function"
    )

    assert "Validates incoming JWT tokens" in explanation.purpose
    assert "`token`: str" in explanation.inputs
    assert "`dict` with user metadata" in explanation.outputs
    assert "Decodes JWT header" in explanation.logic
    assert "Expired tokens" in explanation.edge_cases
    assert "O(1)" in explanation.complexity
    assert "SECRET_KEY" in explanation.security


def test_chat_api_endpoints_and_history():
    """Verify /api/chat, /api/chat/history, and /api/explain HTTP endpoints."""
    client = TestClient(app)

    # Use mock LLM during endpoint testing
    mock_llm = MockLLMService(canned_response="The function calculates factorial in `[math.py (lines 1-5)]`.")
    set_llm_service(mock_llm)

    # Create dummy repository in DB
    db = TestingSessionLocal()
    repo = Repository(
        id="test-repo-id",
        name="test-repo",
        source="zip",
        status="ready"
    )
    db.add(repo)
    db.commit()
    db.close()

    # 1. Test POST /api/chat
    chat_payload = {
        "repository_id": "test-repo-id",
        "question": "How does factorial work?",
        "top_k": 3
    }
    response = client.post("/api/chat", json=chat_payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "retrieval_steps" in data

    # 2. Test GET /api/chat/{id}/history
    hist_response = client.get("/api/chat/test-repo-id/history")
    assert hist_response.status_code == 200
    history = hist_response.json()
    assert len(history) == 1
    assert history[0]["question"] == "How does factorial work?"
    assert history[0]["repository_id"] == "test-repo-id"

    # 3. Test POST /api/explain
    explain_payload = {
        "code": "def add(a, b):\n    return a + b",
        "name": "add",
        "symbol_type": "function"
    }
    explain_res = client.post("/api/explain", json=explain_payload)
    assert explain_res.status_code == 200
    exp_data = explain_res.json()
    assert "purpose" in exp_data
    assert "full_markdown" in exp_data

    # 4. Test DELETE /api/chat/{id}/history
    del_res = client.delete("/api/chat/test-repo-id/history")
    assert del_res.status_code == 200
    assert del_res.json()["deleted_count"] == 1

    # Verify history is now empty
    hist_after = client.get("/api/chat/test-repo-id/history").json()
    assert len(hist_after) == 0
