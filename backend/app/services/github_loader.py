import re
import os
import stat
import shutil
import subprocess
from pathlib import Path

# Regex matching standard public GitHub repository URLs
GITHUB_URL_PATTERN = re.compile(
    r"^https?://(www\.)?github\.com/(?P<owner>[a-zA-Z0-9_\-\.]+)/(?P<repo>[a-zA-Z0-9_\-\.]+?)(/|\.git)?$"
)

def _remove_readonly(func, path, exc_info):
    """Clear the readonly bit and re-attempt file removal (crucial on Windows for .git cleanup)."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def parse_github_url(url: str) -> dict:
    """Parse and validate GitHub URL, extracting repository owner and name."""
    url = url.strip()
    match = GITHUB_URL_PATTERN.match(url)
    if not match:
        raise ValueError(
            f"Invalid GitHub URL: '{url}'. Please provide a valid URL like 'https://github.com/owner/repository'."
        )
    return {
        "owner": match.group("owner"),
        "repo": match.group("repo"),
        "clean_url": f"https://github.com/{match.group('owner')}/{match.group('repo')}.git"
    }

def clone_github_repository(url: str, destination: Path, timeout_seconds: int = 90) -> Path:
    """
    Shallow clone a public GitHub repository with `--depth 1`.
    Removes the internal .git folder after clone to prevent git metadata indexing.
    """
    parsed = parse_github_url(url)
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)

    cmd = [
        "git",
        "clone",
        "--depth",
        "1",
        parsed["clean_url"],
        str(destination)
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
            check=False
        )
    except subprocess.TimeoutExpired:
        if destination.exists():
            shutil.rmtree(destination, onerror=_remove_readonly)
        raise TimeoutError(f"Cloning '{url}' timed out after {timeout_seconds} seconds. Repository might be too large.")
    except Exception as e:
        if destination.exists():
            shutil.rmtree(destination, onerror=_remove_readonly)
        raise RuntimeError(f"Git execution failed: {str(e)}")

    if result.returncode != 0:
        if destination.exists():
            shutil.rmtree(destination, onerror=_remove_readonly)
        stderr_msg = result.stderr.strip()
        if "Repository not found" in stderr_msg or "Authentication failed" in stderr_msg:
            raise ValueError(f"Repository not found or private: '{url}'. Please ensure the repository is public.")
        raise RuntimeError(f"Failed to clone repository: {stderr_msg}")

    # Remove .git folder to save space and avoid indexing git internal data
    git_dir = destination / ".git"
    if git_dir.exists():
        shutil.rmtree(git_dir, onerror=_remove_readonly)

    return destination
