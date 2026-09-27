from fastapi.testclient import TestClient
from sqlalchemy import inspect
from app.main import app
from app.database import engine, init_db

def test_health_check():
    """Verify that the health check endpoint returns 200 OK and expected config metadata."""
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "1.0.0"
        assert "sentence-transformers" in data["embedding_model"]
        assert data["database"] == "sqlite"

def test_database_tables_exist():
    """Verify that SQLAlchemy tables (repositories, files, code_symbols, chat_history) are created."""
    init_db()
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    assert "repositories" in table_names
    assert "files" in table_names
    assert "code_symbols" in table_names
    assert "chat_history" in table_names
