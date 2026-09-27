import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Repository
from app.schemas import SecurityScanRequest, SecurityScanResponse
from app.services.security import get_security_scanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/security", tags=["Security & SAST"])

@router.post("/scan", response_model=SecurityScanResponse)
def scan_repository_security(
    req: SecurityScanRequest,
    db: Session = Depends(get_db)
):
    """
    Run automated Static Application Security Testing (SAST) via Bandit on an indexed repository.
    Returns categorized security findings with CWE metadata, line numbers, and actionable remediation advice.
    """
    repo = db.query(Repository).filter(Repository.id == req.repository_id).first()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{req.repository_id}' not found."
        )

    repo_dir = Path(settings.REPOS_STORAGE_PATH) / req.repository_id
    if not repo_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository storage directory not found at {repo_dir}"
        )

    scanner = get_security_scanner()
    try:
        response = scanner.scan_repository(repo_dir=repo_dir, repository_id=req.repository_id)
        return response
    except Exception as e:
        logger.error(f"Error running security scan on repo '{req.repository_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security scan failed: {str(e)}"
        )
