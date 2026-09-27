import os
import shutil
import logging
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models import Repository, FileModel, CodeSymbol
from app.schemas import (
    RepositoryResponse,
    RepositoryDetailResponse,
    RepositoryCreateGithub,
    FileTreeItemResponse,
    FileContentResponse,
    CodeSymbolResponse,
    CodeChunkResponse,
)
from app.services.file_processor import safe_extract_zip, scan_repository, read_file_content
from app.services.github_loader import clone_github_repository, parse_github_url, _remove_readonly
from app.services.ast_parser import parse_python_code
from app.services.chunker import create_chunks_for_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories", tags=["Repositories"])

def _index_files_and_ast_symbols(db: Session, repo: Repository, discovered_files: List[dict]) -> Repository:
    """Helper that registers files and performs AST parsing to persist functions, classes, and methods."""
    total_symbols = 0

    for f in discovered_files:
        file_record = FileModel(
            repository_id=repo.id,
            path=f["path"],
            language=f["language"],
            line_count=f["line_count"],
            size_bytes=f["size_bytes"]
        )
        db.add(file_record)
        db.flush()  # Populates file_record.id for foreign key reference

        # Only Python files undergo AST symbol extraction
        if f["language"] == "python":
            try:
                content = read_file_content(Path(f["full_path"]))
                symbols = parse_python_code(content, file_path=f["path"])
                for sym in symbols:
                    sym_record = CodeSymbol(
                        file_id=file_record.id,
                        repository_id=repo.id,
                        name=sym["name"],
                        symbol_type=sym["symbol_type"],
                        parent_symbol=sym["parent_symbol"],
                        start_line=sym["start_line"],
                        end_line=sym["end_line"],
                        docstring=sym["docstring"],
                        args=sym["args"]
                    )
                    db.add(sym_record)
                total_symbols += len(symbols)
            except Exception as e:
                logger.warning(f"Error extracting AST symbols from {f['path']}: {str(e)}")

    # Extract and index code-aware chunks in ChromaDB vector store
    all_chunks = []
    for f in discovered_files:
        try:
            content = read_file_content(Path(f["full_path"]))
            file_chunks = create_chunks_for_file(
                content=content,
                file_path=f["path"],
                language=f["language"],
                repository_id=repo.id
            )
            all_chunks.extend(file_chunks)
        except Exception as e:
            logger.warning(f"Error creating chunks for {f['path']}: {e}")

    try:
        from app.services.vector_store import get_vector_store
        vector_store = get_vector_store()
        vector_store.add_chunks(all_chunks)
    except Exception as e:
        logger.error(f"Error indexing chunks in ChromaDB for repository {repo.id}: {e}")

    repo.total_files = len(discovered_files)
    repo.total_symbols = total_symbols
    repo.status = "ready"
    db.commit()
    db.refresh(repo)
    return repo

@router.post("/upload", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def upload_repository_zip(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload and extract a Python repository ZIP archive with AST symbol parsing."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a standard .zip archive."
        )

    repo_name = Path(file.filename).stem

    repo = Repository(
        name=repo_name,
        source="zip",
        url=file.filename,
        status="indexing"
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    target_dir = Path(settings.REPOS_STORAGE_PATH) / repo.id

    try:
        content = await file.read()
        extracted_root = safe_extract_zip(content, target_dir)
        discovered_files = scan_repository(extracted_root)

        return _index_files_and_ast_symbols(db, repo, discovered_files)

    except Exception as e:
        db.rollback()
        repo.status = "error"
        repo.error_message = str(e)
        db.commit()
        if target_dir.exists():
            shutil.rmtree(target_dir, onerror=_remove_readonly)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process ZIP repository: {str(e)}"
        )

@router.post("/github", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
def clone_github_repo(
    payload: RepositoryCreateGithub,
    db: Session = Depends(get_db)
):
    """Clone a public GitHub repository with shallow clone and extract AST symbols."""
    try:
        parsed = parse_github_url(payload.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    repo_name = payload.name.strip() if payload.name else parsed["repo"]

    repo = Repository(
        name=repo_name,
        source="github",
        url=payload.url,
        status="indexing"
    )
    db.add(repo)
    db.commit()
    db.refresh(repo)

    target_dir = Path(settings.REPOS_STORAGE_PATH) / repo.id

    try:
        cloned_dir = clone_github_repository(payload.url, target_dir)
        discovered_files = scan_repository(cloned_dir)

        return _index_files_and_ast_symbols(db, repo, discovered_files)

    except Exception as e:
        db.rollback()
        repo.status = "error"
        repo.error_message = str(e)
        db.commit()
        if target_dir.exists():
            shutil.rmtree(target_dir, onerror=_remove_readonly)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process GitHub repository: {str(e)}"
        )

@router.get("", response_model=List[RepositoryResponse])
def list_repositories(db: Session = Depends(get_db)):
    """List all ingested repositories ordered by newest first."""
    return db.query(Repository).order_by(Repository.created_at.desc()).all()

@router.get("/{id}", response_model=RepositoryDetailResponse)
def get_repository(id: str, db: Session = Depends(get_db)):
    """Get single repository details and its parsed file tree."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    files = db.query(FileModel).filter(FileModel.repository_id == id).order_by(FileModel.path.asc()).all()
    file_items = [
        FileTreeItemResponse(
            id=f.id,
            path=f.path,
            language=f.language,
            line_count=f.line_count,
            size_bytes=f.size_bytes,
            symbols_count=len(f.symbols) if f.symbols else 0
        )
        for f in files
    ]

    return RepositoryDetailResponse(
        id=repo.id,
        name=repo.name,
        source=repo.source,
        url=repo.url,
        status=repo.status,
        error_message=repo.error_message,
        total_files=repo.total_files,
        total_symbols=repo.total_symbols,
        created_at=repo.created_at,
        files=file_items
    )

@router.delete("/{id}")
def delete_repository(id: str, db: Session = Depends(get_db)):
    """Delete repository record from database and purge its files from storage."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    target_dir = Path(settings.REPOS_STORAGE_PATH) / id
    if target_dir.exists():
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    # Purge vectors from ChromaDB
    try:
        from app.services.vector_store import get_vector_store
        vector_store = get_vector_store()
        vector_store.delete_repository_chunks(id)
    except Exception as e:
        logger.warning(f"Error deleting ChromaDB chunks for repository {id}: {e}")

    db.delete(repo)
    db.commit()
    return {"success": True, "message": f"Repository '{repo.name}' deleted successfully."}

@router.get("/{id}/files", response_model=List[FileTreeItemResponse])
def get_repository_files(id: str, db: Session = Depends(get_db)):
    """Get list of files belonging to the repository."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    files = db.query(FileModel).filter(FileModel.repository_id == id).order_by(FileModel.path.asc()).all()
    return [
        FileTreeItemResponse(
            id=f.id,
            path=f.path,
            language=f.language,
            line_count=f.line_count,
            size_bytes=f.size_bytes,
            symbols_count=len(f.symbols) if f.symbols else 0
        )
        for f in files
    ]

@router.get("/{id}/files/content", response_model=FileContentResponse)
def get_file_content(id: str, path: str, db: Session = Depends(get_db)):
    """Read the text content of a file within an ingested repository."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    repo_dir = (Path(settings.REPOS_STORAGE_PATH) / id).resolve()
    extracted_items = [p for p in repo_dir.iterdir() if p.is_dir() and not p.name.startswith(".")] if repo_dir.exists() else []
    base_dir = extracted_items[0] if len(extracted_items) == 1 and not (repo_dir / path).exists() else repo_dir

    target_file = (base_dir / path).resolve()

    if not str(target_file).startswith(str(repo_dir)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: invalid file path.")

    if not target_file.exists() or not target_file.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found: {path}")

    try:
        content = read_file_content(target_file)
        lines = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
        return FileContentResponse(path=path, content=content, line_count=lines)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error reading file: {str(e)}")

@router.get("/{id}/symbols", response_model=List[CodeSymbolResponse])
def get_repository_symbols(
    id: str,
    symbol_type: Optional[str] = Query(None, description="Filter by class, function, method, or import"),
    q: Optional[str] = Query(None, description="Search symbol name"),
    db: Session = Depends(get_db)
):
    """Retrieve extracted AST code symbols for a repository with optional type and name filtering."""
    query = db.query(CodeSymbol).filter(CodeSymbol.repository_id == id)
    if symbol_type:
        query = query.filter(CodeSymbol.symbol_type == symbol_type.lower())
    if q:
        query = query.filter(CodeSymbol.name.ilike(f"%{q}%"))
    return query.order_by(CodeSymbol.start_line.asc()).all()

@router.get("/{id}/files/{file_id}/symbols", response_model=List[CodeSymbolResponse])
def get_file_symbols(id: str, file_id: str, db: Session = Depends(get_db)):
    """Retrieve all AST symbols (classes, functions, methods) belonging to a specific file."""
    return (
        db.query(CodeSymbol)
        .filter(CodeSymbol.repository_id == id, CodeSymbol.file_id == file_id)
        .order_by(CodeSymbol.start_line.asc())
        .all()
    )

@router.get("/{id}/chunks", response_model=List[CodeChunkResponse])
def get_repository_chunks(
    id: str,
    path: Optional[str] = Query(None, description="Filter chunks by relative file path"),
    chunk_type: Optional[str] = Query(None, description="Filter by chunk type (function, method, class, module)"),
    db: Session = Depends(get_db)
):
    """Generate and inspect code-aware chunks for files within a repository."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    files_query = db.query(FileModel).filter(FileModel.repository_id == id)
    if path:
        files_query = files_query.filter(FileModel.path == path)

    files = files_query.all()
    repo_dir = (Path(settings.REPOS_STORAGE_PATH) / id).resolve()

    extracted_items = [p for p in repo_dir.iterdir() if p.is_dir() and not p.name.startswith(".")] if repo_dir.exists() else []
    base_dir = extracted_items[0] if len(extracted_items) == 1 else repo_dir

    all_chunks: List[CodeChunkResponse] = []

    for f in files:
        target_file = (base_dir / f.path).resolve()
        if not target_file.exists():
            continue

        try:
            content = read_file_content(target_file)
            file_chunks = create_chunks_for_file(
                content=content,
                file_path=f.path,
                language=f.language,
                repository_id=id
            )
            for c in file_chunks:
                if chunk_type and c.chunk_type.lower() != chunk_type.lower():
                    continue
                all_chunks.append(
                    CodeChunkResponse(
                        chunk_id=c.chunk_id,
                        repository_id=c.repository_id,
                        file_path=c.file_path,
                        symbol_name=c.symbol_name,
                        chunk_type=c.chunk_type,
                        start_line=c.start_line,
                        end_line=c.end_line,
                        content=c.content,
                        token_estimate=c.token_estimate,
                        searchable_text=c.to_searchable_text(),
                    )
                )
        except Exception as e:
            logger.warning(f"Error chunking {f.path}: {e}")

    return all_chunks

@router.get("/{id}/search")
def search_repository_vectors(
    id: str,
    query: str = Query(..., min_length=1, description="Search query string"),
    top_k: int = Query(5, ge=1, le=20, description="Number of top chunks to retrieve"),
    db: Session = Depends(get_db)
):
    """Direct semantic similarity search against indexed repository code chunks in ChromaDB."""
    repo = db.query(Repository).filter(Repository.id == id).first()
    if not repo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found.")

    from app.services.retriever import get_retriever
    retriever = get_retriever()
    return retriever.retrieve(query=query, repository_id=id, top_k=top_k)
