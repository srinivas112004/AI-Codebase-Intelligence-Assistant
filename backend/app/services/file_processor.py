import os
import zipfile
import io
from pathlib import Path
from typing import List, Dict, Any

# Directories to ignore across indexing and scanning
IGNORED_DIRS = {
    ".git",
    "venv",
    ".venv",
    "env",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".pytest_cache",
    ".idea",
    ".vscode",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
}

# Files to ignore (sensitive or non-code artifacts)
IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".gitignore",
    ".gitattributes",
    ".DS_Store",
    "Thumbs.db",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

# Accepted source code extensions mapped to language labels
ACCEPTED_EXTENSIONS = {
    ".py": "python",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
}

def safe_extract_zip(zip_data: bytes, destination: Path) -> Path:
    """
    Safely extract a ZIP archive in memory to the destination directory.
    Includes Zip Slip protection against directory traversal attacks.
    """
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_data)) as archive:
        for member in archive.infolist():
            # Resolve the target path for each member
            target_path = (destination / member.filename).resolve()

            # Prevent Zip Slip: ensure target is strictly inside destination
            if not str(target_path).startswith(str(destination)):
                raise ValueError(f"Security error: ZIP member '{member.filename}' escapes destination directory.")

            if member.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, open(target_path, "wb") as target:
                    target.write(source.read())

    # If the ZIP extracted a single top-level folder (e.g. repo-main/), identify it
    extracted_items = [p for p in destination.iterdir() if not p.name.startswith(".")]
    if len(extracted_items) == 1 and extracted_items[0].is_dir():
        return extracted_items[0]

    return destination

def is_binary_file(file_path: Path) -> bool:
    """Check if a file appears to be binary by scanning the initial 1024 bytes for null bytes."""
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            return b"\0" in chunk
    except Exception:
        return True

def scan_repository(repo_dir: Path) -> List[Dict[str, Any]]:
    """
    Recursively scan the repository folder, filtering out ignored folders and files.
    Collects metadata: relative path, language, line count, and byte size.
    Validates that at least one Python (.py) file exists.
    """
    repo_dir = repo_dir.resolve()
    if not repo_dir.exists() or not repo_dir.is_dir():
        raise FileNotFoundError(f"Repository directory does not exist: {repo_dir}")

    discovered_files: List[Dict[str, Any]] = []
    has_python_file = False

    for root, dirs, files in os.walk(repo_dir):
        # Modify dirs in-place to avoid descending into ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.endswith(".egg-info")]

        for filename in files:
            # Check ignored files
            if filename in IGNORED_FILES or filename.startswith("."):
                continue

            file_path = Path(root) / filename
            ext = file_path.suffix.lower()

            # Only accept supported extensions
            if ext not in ACCEPTED_EXTENSIONS:
                continue

            # Skip binary files
            if is_binary_file(file_path):
                continue

            rel_path = file_path.relative_to(repo_dir).as_posix()
            language = ACCEPTED_EXTENSIONS[ext]

            if language == "python":
                has_python_file = True

            # Calculate line count safely with UTF-8 fallback
            line_count = 0
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    for _ in f:
                        line_count += 1
            except Exception:
                continue

            size_bytes = file_path.stat().st_size

            discovered_files.append({
                "path": rel_path,
                "language": language,
                "line_count": line_count,
                "size_bytes": size_bytes,
                "full_path": str(file_path),
            })

    if not has_python_file:
        raise ValueError("No Python (.py) source files found in the repository. Please provide a Python repository.")

    # Sort files by relative path for consistent indexing order
    discovered_files.sort(key=lambda x: x["path"])
    return discovered_files

def read_file_content(file_path: Path) -> str:
    """Read file content with UTF-8 encoding and fallback replacement."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()
