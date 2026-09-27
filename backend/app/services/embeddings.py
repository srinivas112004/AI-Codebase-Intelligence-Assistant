import logging
from typing import List, Optional, Dict
from functools import lru_cache
from app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    Embedding service using Sentence Transformers.
    Converts code chunks and natural language queries into 384-dimensional dense vectors.
    Implements singleton model caching and query-level memoization.
    """
    _instance: Optional["EmbeddingService"] = None
    _model = None

    def __new__(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
            cls._instance._model_name = settings.EMBEDDING_MODEL
            cls._instance._load_model()
        return cls._instance

    def _load_model(self) -> None:
        """Lazy load the SentenceTransformer model onto CPU."""
        if self._model is None:
            logger.info(f"Loading SentenceTransformer model: {self._model_name}")
            from sentence_transformers import SentenceTransformer
            # Load model onto CPU (or GPU if available, but default CPU for reproducibility)
            self._model = SentenceTransformer(self._model_name)
            logger.info("SentenceTransformer model successfully loaded.")

    @property
    def model_name(self) -> str:
        return self._model_name

    def get_embedding_dimension(self) -> int:
        if self._model is not None:
            if hasattr(self._model, "get_embedding_dimension"):
                return self._model.get_embedding_dimension()
            return self._model.get_sentence_embedding_dimension()
        return 384

    def embed_text(self, text: str) -> List[float]:
        """
        Embed a single text string into a normalized dense vector.
        Normalized vectors allow dot products to equal cosine similarities.
        """
        if not text or not text.strip():
            return [0.0] * self.get_embedding_dimension()

        self._load_model()
        embedding = self._model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return embedding.tolist()

    def embed_documents(self, documents: List[str], batch_size: int = 32) -> List[List[float]]:
        """
        Embed a batch of document texts efficiently.
        Handles empty batches and sanitizes empty strings.
        """
        if not documents:
            return []

        self._load_model()
        # Clean empty texts to avoid zero-length embedding errors
        sanitized_docs = [doc if doc and doc.strip() else " " for doc in documents]

        embeddings = self._model.encode(
            sanitized_docs,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a search query with caching for repeated queries.
        """
        query = query.strip()
        if not query:
            return [0.0] * self.get_embedding_dimension()

        return self.embed_text(query)

# Global singleton helper
_embedding_service: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    """Dependency helper to get the active EmbeddingService instance."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
