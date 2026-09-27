import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas import AttentionRequest, AttentionResponse
from app.services.transformer.attention import get_attention_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transformer", tags=["Transformer Educational Lab"])

@router.post("/attention", response_model=AttentionResponse)
def calculate_self_attention(req: AttentionRequest):
    """
    Compute step-by-step PyTorch Scaled Dot-Product Self-Attention:
    Returns tokens, token IDs, Q/K/V matrix slices, raw scores, scaling factor,
    and the full 2D attention weights matrix.
    """
    try:
        service = get_attention_service()
        response = service.compute_self_attention(text=req.text)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error computing self-attention: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Self-attention computation failed: {str(e)}"
        )
