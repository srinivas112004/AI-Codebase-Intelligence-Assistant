import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Repository, ChatHistory
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ChatHistoryItemResponse,
    ExplainRequest,
    ExplainResponse,
    SourceRef,
)
from app.services.rag import get_rag_pipeline
from app.services.llm import LLMConfigurationError, LLMGenerationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Chat & Intelligence"])

@router.post("/chat", response_model=ChatResponse)
def chat_with_codebase(
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Execute grounded RAG Q&A against an indexed codebase.
    Returns the grounded answer, verified source citations, and pipeline execution trace.
    """
    repo = db.query(Repository).filter(Repository.id == req.repository_id).first()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{req.repository_id}' not found."
        )

    if repo.status not in ["ready", "indexing"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Repository is not ready for querying (current status: '{repo.status}')."
        )

    pipeline = get_rag_pipeline()
    try:
        response = pipeline.chat(
            repository_id=req.repository_id,
            question=req.question,
            top_k=req.top_k or 5,
            db=db
        )
        return response
    except LLMConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except LLMGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer from LLM: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal chat error: {str(e)}"
        )


@router.get("/chat/{repository_id}/history", response_model=List[ChatHistoryItemResponse])
def get_chat_history(
    repository_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve stored question/answer history for a specific repository.
    """
    repo = db.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repository_id}' not found."
        )

    records = (
        db.query(ChatHistory)
        .filter(ChatHistory.repository_id == repository_id)
        .order_by(ChatHistory.created_at.asc())
        .all()
    )

    history_items: List[ChatHistoryItemResponse] = []
    for r in records:
        sources_list: List[SourceRef] = []
        if r.sources:
            try:
                raw_sources = json.loads(r.sources)
                sources_list = [SourceRef(**s) for s in raw_sources]
            except Exception:
                sources_list = []

        history_items.append(
            ChatHistoryItemResponse(
                id=r.id,
                repository_id=r.repository_id,
                question=r.question,
                answer=r.answer,
                sources=sources_list,
                created_at=r.created_at
            )
        )

    return history_items


@router.delete("/chat/{repository_id}/history")
def clear_chat_history(
    repository_id: str,
    db: Session = Depends(get_db)
):
    """
    Clear all chat history associated with a specific repository.
    """
    repo = db.query(Repository).filter(Repository.id == repository_id).first()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repository_id}' not found."
        )

    deleted_count = (
        db.query(ChatHistory)
        .filter(ChatHistory.repository_id == repository_id)
        .delete()
    )
    db.commit()

    return {
        "repository_id": repository_id,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} chat history records."
    }


@router.post("/explain", response_model=ExplainResponse)
def explain_code_symbol(
    req: ExplainRequest
):
    """
    Generate structured, architectural explanation for a code snippet or AST symbol.
    """
    pipeline = get_rag_pipeline()
    try:
        response = pipeline.explain_code(
            code=req.code,
            name=req.name or "",
            symbol_type=req.symbol_type or "function",
            context=req.context or ""
        )
        return response
    except LLMConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except LLMGenerationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate explanation from LLM: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in explain endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal explain error: {str(e)}"
        )
