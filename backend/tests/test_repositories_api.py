import io
import zipfile
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

def create_sample_python_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("calc.py", "def add(a: int, b: int) -> int:\n    return a + b\n\ndef multiply(a, b):\n    return a * b\n")
        zf.writestr("README.md", "# Calculator Service\nSimple math library.\n")
    return buffer.getvalue()

def test_upload_and_manage_repository():
    """End-to-end test of ZIP upload, listing, file inspection, content fetching, and deletion."""
    init_db()
    zip_bytes = create_sample_python_zip()

    with TestClient(app) as client:
        # 1. Upload ZIP repository
        response = client.post(
            "/api/repositories/upload",
            files={"file": ("calculator_repo.zip", zip_bytes, "application/zip")}
        )
        assert response.status_code == 201
        data = response.json()
        repo_id = data["id"]
        assert data["name"] == "calculator_repo"
        assert data["source"] == "zip"
        assert data["status"] == "ready"
        assert data["total_files"] == 2
        assert data["total_symbols"] == 2  # add and multiply

        # 2. List repositories
        list_res = client.get("/api/repositories")
        assert list_res.status_code == 200
        repos = list_res.json()
        assert any(r["id"] == repo_id for r in repos)

        # 3. Get repository detail
        detail_res = client.get(f"/api/repositories/{repo_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert len(detail["files"]) == 2
        assert detail["total_symbols"] == 2
        paths = [f["path"] for f in detail["files"]]
        assert "calc.py" in paths
        assert "README.md" in paths

        # 4. Fetch AST symbols for repository
        symbols_res = client.get(f"/api/repositories/{repo_id}/symbols")
        assert symbols_res.status_code == 200
        symbols_data = symbols_res.json()
        assert len(symbols_data) == 2
        sym_names = [s["name"] for s in symbols_data]
        assert "add" in sym_names
        assert "multiply" in sym_names

        # 5. Fetch code-aware chunks
        chunks_res = client.get(f"/api/repositories/{repo_id}/chunks")
        assert chunks_res.status_code == 200
        chunks_data = chunks_res.json()
        assert len(chunks_data) >= 2
        chunk_symbols = [c["symbol_name"] for c in chunks_data]
        assert "add" in chunk_symbols
        assert "multiply" in chunk_symbols

        # 6. Fetch file content
        content_res = client.get(f"/api/repositories/{repo_id}/files/content?path=calc.py")
        assert content_res.status_code == 200
        content_data = content_res.json()
        assert "def add(a: int, b: int)" in content_data["content"]
        assert content_data["line_count"] == 5

        # 7. Delete repository
        del_res = client.delete(f"/api/repositories/{repo_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

        # 6. Verify deletion
        not_found_res = client.get(f"/api/repositories/{repo_id}")
        assert not_found_res.status_code == 404

def test_upload_non_zip_rejected():
    """Verify that uploading non-zip files returns HTTP 400."""
    with TestClient(app) as client:
        response = client.post(
            "/api/repositories/upload",
            files={"file": ("invalid.txt", b"plain text content", "text/plain")}
        )
        assert response.status_code == 400
        assert "Invalid file format" in response.json()["detail"]
