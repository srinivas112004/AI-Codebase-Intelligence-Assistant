import io
import zipfile
import pytest
from pathlib import Path
from app.services.file_processor import safe_extract_zip, scan_repository, is_binary_file

def test_safe_extract_valid_zip(tmp_path):
    """Test extracting a standard ZIP file with nested folders."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("src/main.py", "def main():\n    print('Hello world')\n")
        zf.writestr("README.md", "# Test Project\n")

    dest = tmp_path / "extracted"
    extracted_root = safe_extract_zip(zip_buffer.getvalue(), dest)

    assert (dest / "src" / "main.py").exists()
    assert (dest / "README.md").exists()

def test_zip_slip_prevention(tmp_path):
    """Test that malicious ZIP archives attempting directory traversal are blocked."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        # Create a malicious entry pointing outside destination
        zf.writestr("../../etc/passwd", "root:x:0:0:::")

    dest = tmp_path / "extracted_slip"
    with pytest.raises(ValueError, match="Security error"):
        safe_extract_zip(zip_buffer.getvalue(), dest)

def test_scan_repository_filters_and_metadata(tmp_path):
    """Test that scan_repository respects ignored files/directories and calculates line counts."""
    repo_dir = tmp_path / "sample_repo"
    repo_dir.mkdir()

    # Valid files
    (repo_dir / "app.py").write_text("import os\nprint('hello')\n", encoding="utf-8")
    (repo_dir / "README.md").write_text("# Doc\nLine 2\nLine 3\n", encoding="utf-8")

    # Ignored directories and files
    git_dir = repo_dir / ".git"
    git_dir.mkdir()
    (git_dir / "config").write_text("git config", encoding="utf-8")

    venv_dir = repo_dir / "venv" / "lib"
    venv_dir.mkdir(parents=True)
    (venv_dir / "site.py").write_text("library code", encoding="utf-8")

    (repo_dir / ".env").write_text("SECRET=12345", encoding="utf-8")

    files = scan_repository(repo_dir)

    paths = [f["path"] for f in files]
    assert "app.py" in paths
    assert "README.md" in paths
    assert not any(".git" in p for p in paths)
    assert not any("venv" in p for p in paths)
    assert not any(".env" in p for p in paths)

    # Check line counts
    app_info = next(f for f in files if f["path"] == "app.py")
    assert app_info["language"] == "python"
    assert app_info["line_count"] == 2

    readme_info = next(f for f in files if f["path"] == "README.md")
    assert readme_info["language"] == "markdown"
    assert readme_info["line_count"] == 3

def test_scan_repository_rejects_non_python_repo(tmp_path):
    """Test that repositories without Python files are rejected with a helpful error."""
    repo_dir = tmp_path / "non_python"
    repo_dir.mkdir()
    (repo_dir / "README.md").write_text("# Only docs here", encoding="utf-8")

    with pytest.raises(ValueError, match="No Python .* source files found"):
        scan_repository(repo_dir)
