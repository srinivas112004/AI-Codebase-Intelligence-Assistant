import math
import logging
from typing import List, Dict, Any, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer

from app.config import settings
from app.schemas import AttentionResponse

logger = logging.getLogger(__name__)

class AttentionService:
    """
    Educational Self-Attention Service.
    Implements Scaled Dot-Product Attention from scratch using pure PyTorch tensors:
    
        Attention(Q, K, V) = softmax( (Q @ K^T) / sqrt(d_k) ) @ V

    Features:
    - Hugging Face tokenizer tokenization and subword ID extraction.
    - Token embedding lookup (seq_len x d_model).
    - Linear projections for Query (Q), Key (K), and Value (V).
    - Intermediate compatibility scores matrix computation.
    - Division by sqrt(d_k) to prevent vanishing gradients.
    - Softmax normalization yielding 2D Attention Weights (seq_len x seq_len).
    - Contextualized output vector synthesis.
    """

    _instance: Optional["AttentionService"] = None

    def __init__(self, d_model: int = 64, d_k: int = 64, seed: int = 42):
        self.d_model = d_model
        self.d_k = d_k
        self.seed = seed
        self.scale_factor = 1.0 / math.sqrt(self.d_k)

        # Lazy tokenizer
        self._tokenizer = None

        # Deterministic projection weights for reproducible educational demonstration
        torch.manual_seed(self.seed)
        self.embedding_layer = nn.Embedding(30522, self.d_model)
        self.w_q = nn.Linear(self.d_model, self.d_k, bias=False)
        self.w_k = nn.Linear(self.d_model, self.d_k, bias=False)
        self.w_v = nn.Linear(self.d_model, self.d_k, bias=False)

        # Initialize with Xavier uniform
        nn.init.xavier_uniform_(self.w_q.weight)
        nn.init.xavier_uniform_(self.w_k.weight)
        nn.init.xavier_uniform_(self.w_v.weight)

    @classmethod
    def get_instance(cls) -> "AttentionService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_tokenizer(self) -> AutoTokenizer:
        if self._tokenizer is None:
            model_target = getattr(settings, "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            logger.info(f"Loading AutoTokenizer for self-attention lab from: {model_target}")
            self._tokenizer = AutoTokenizer.from_pretrained(model_target)
        return self._tokenizer

    def compute_self_attention(self, text: str, max_tokens: int = 32) -> AttentionResponse:
        """
        Executes step-by-step PyTorch scaled dot-product attention calculation.
        """
        text = text.strip()
        if not text:
            raise ValueError("Input text cannot be empty.")

        tokenizer = self._get_tokenizer()

        # Tokenize without special [CLS]/[SEP] tokens to give direct word-level mapping
        token_ids_raw = tokenizer.encode(text, add_special_tokens=False)
        if len(token_ids_raw) > max_tokens:
            token_ids_raw = token_ids_raw[:max_tokens]

        tokens = tokenizer.convert_ids_to_tokens(token_ids_raw)
        seq_len = len(token_ids_raw)

        if seq_len == 0:
            raise ValueError("No valid tokens extracted from text.")

        input_tensor = torch.tensor(token_ids_raw, dtype=torch.long)

        # 1. Input Embeddings: X in R^(seq_len x d_model)
        with torch.no_grad():
            x = self.embedding_layer(input_tensor)  # (seq_len, d_model)

            # 2. Linear Projections: Q, K, V in R^(seq_len x d_k)
            q = self.w_q(x)  # (seq_len, d_k)
            k = self.w_k(x)  # (seq_len, d_k)
            v = self.w_v(x)  # (seq_len, d_k)

            # 3. Raw Dot-Product Compatibility Scores: Q @ K^T in R^(seq_len x seq_len)
            raw_scores = torch.matmul(q, k.transpose(-2, -1))

            # 4. Scaling: Scores / sqrt(d_k)
            scaled_scores = raw_scores * self.scale_factor

            # 5. Softmax Normalization: Softmax(Scaled, dim=-1) in R^(seq_len x seq_len)
            attention_weights = F.softmax(scaled_scores, dim=-1)

            # Round tensors for clean frontend JSON serialization
            weights_matrix = [[round(val.item(), 4) for val in row] for row in attention_weights]
            raw_scores_matrix = [[round(val.item(), 4) for val in row] for row in raw_scores]

            # Snippets of Q, K, V (first 6 dimensions) for interactive matrix preview
            dim_preview = min(6, self.d_k)
            q_snippet = [[round(val.item(), 4) for val in row[:dim_preview]] for row in q]
            k_snippet = [[round(val.item(), 4) for val in row[:dim_preview]] for row in k]
            v_snippet = [[round(val.item(), 4) for val in row[:dim_preview]] for row in v]

        return AttentionResponse(
            text=text,
            tokens=tokens,
            token_ids=token_ids_raw,
            attention_weights=weights_matrix,
            raw_scores=raw_scores_matrix,
            scale_factor=round(self.scale_factor, 4),
            q_snippet=q_snippet,
            k_snippet=k_snippet,
            v_snippet=v_snippet,
            d_k=self.d_k,
            d_model=self.d_model
        )

def get_attention_service() -> AttentionService:
    return AttentionService.get_instance()
