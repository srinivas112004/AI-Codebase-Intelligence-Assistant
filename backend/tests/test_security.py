import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models import Repository
from app.config import settings
from app.services.security import get_security_scanner

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

@pytest.fixture
def test_db():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_security_scan_detects_flaws(tmp_path: Path):
    """Verify Bandit scanner flags hardcoded passwords, insecure hashes, and shell injections."""
    insecure_code = '''
import hashlib
import subprocess

# 1. Hardcoded password (B105)
DATABASE_PASSWORD = "super_secret_admin_password_123"

def weak_hash(data: bytes):
    # 2. Insecure MD5 hash (B303)
    return hashlib.md5(data).hexdigest()

def execute_cmd(user_cmd: str):
    # 3. Subprocess with shell=True (B602)
    return subprocess.Popen(user_cmd, shell=True)
'''
    test_file = tmp_path / "vulnerable_service.py"
    test_file.write_text(insecure_code, encoding="utf-8")

    scanner = get_security_scanner()
    scan_result = scanner.scan_repository(repo_dir=tmp_path, repository_id="test-sec-repo")

    assert scan_result.total_findings >= 2
    test_ids = [f.test_id for f in scan_result.findings]
    assert any(t in test_ids for t in ["B105", "B303", "B602"])

    # Verify remediation enrichment
    for f in scan_result.findings:
        assert f.file == "vulnerable_service.py"
        assert f.issue_severity in ["LOW", "MEDIUM", "HIGH"]
        if f.test_id in ["B105", "B303", "B602"]:
            assert f.remediation_title is not None
            assert f.remediation_fix is not None


def test_security_scan_missing_dir_raises():
    """Verify scanner cleanly raises FileNotFoundError when path does not exist."""
    scanner = get_security_scanner()
    with pytest.raises(FileNotFoundError):
        scanner.scan_repository(repo_dir=Path("/non/existent/path/999"), repository_id="invalid")


def test_security_api_endpoint(test_db, tmp_path: Path, monkeypatch):
    """Verify POST /api/security/scan HTTP endpoint."""
    client = TestClient(app)

    # Monkeypatch REPOS_STORAGE_PATH to tmp_path
    monkeypatch.setattr(settings, "REPOS_STORAGE_PATH", str(tmp_path))

    repo_id = "sec-repo-123"
    repo_dir = tmp_path / repo_id
    repo_dir.mkdir(parents=True, exist_ok=True)

    dummy_file = repo_dir / "app.py"
    dummy_file.write_text("API_KEY = 'hardcoded_secret_token_123'\n", encoding="utf-8")

    # Add repo to test database
    db = TestingSessionLocal()
    repo = Repository(
        id=repo_id,
        name="Security Test Repo",
        source="zip",
        status="ready"
    )
    db.add(repo)
    db.commit()
    db.close()

    # Call POST /api/security/scan
    response = client.post("/api/security/scan", json={"repository_id": repo_id})
    assert response.status_code == 200

    data = response.json()
    assert data["repository_id"] == repo_id
    assert "total_findings" in data
    assert "findings" in data
    assert isinstance(data["findings"], list)

    # Call with non-existent repo ID -> 404
    missing_res = client.post("/api/security/scan", json={"repository_id": "non-existent-id"})
    assert missing_res.status_code == 404
