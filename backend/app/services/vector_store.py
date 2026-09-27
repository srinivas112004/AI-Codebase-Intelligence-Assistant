import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from app.config import settings
from app.services.chunker import CodeChunk
from app.services.embeddings import get_embedding_service

logger = logging.getLogger(__name__)

COLLECTION_NAME = "codebase_chunks"

class VectorStore:
    """
    ChromaDB vector store service.
    Manages persistent vector collections, chunk ingestion, metadata filtering,
    and cosine similarity retrieval.
    """
    _instance: Optional["VectorStore"] = None
    _client = None
    _collection = None

    def __new__(cls) -> "VectorStore":
        if cls._instance is None:
            cls._instance = super(VectorStore, cls).__new__(cls)
            cls._instance._init_chroma()
        return cls._instance

    def _init_chroma(self) -> None:
        """Initialize ChromaDB PersistentClient with cosine distance metric."""
        if self._client is None:
            import chromadb
            from chromadb.config import Settings as ChromaSettings

            chroma_path = str(Path(settings.CHROMA_PATH).resolve())
            logger.info(f"Initializing persistent ChromaDB client at: {chroma_path}")

            self._client = chromadb.PersistentClient(
                path=chroma_path,
                settings=ChromaSettings(anonymized_telemetry=False)
            )

            # hnsw:space = "cosine" enables cosine distance index
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}
            )
            logger.info(f"ChromaDB collection '{COLLECTION_NAME}' ready.")

    def add_chunks(self, chunks: List[CodeChunk], batch_size: int = 50) -> int:
        """
        Embed and upsert code chunks into ChromaDB with metadata.
        Uses batching to prevent memory spikes on large repositories.
        """
        if not chunks:
            return 0

        self._init_chroma()
        embedding_service = get_embedding_service()
        total_added = 0

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            ids = [c.chunk_id for c in batch]
            documents = [c.to_searchable_text() for c in batch]
            metadatas = [c.to_metadata() for c in batch]

            # Generate normalized dense embeddings for the batch
            embeddings = embedding_service.embed_documents(documents)

            self._collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            total_added += len(batch)

        logger.info(f"Successfully upserted {total_added} chunks into ChromaDB.")
        return total_added

    def similarity_search(
        self,
        query: str,
        repository_id: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic similarity search for a query against a specific repository.
        Returns top-K results with cosine similarity scores and metadata.
        """
        self._init_chroma()
        query = query.strip()
        if not query:
            return []

        # Check if repository has any chunks
        count = self.get_repository_chunk_count(repository_id)
        if count == 0:
            return []

        embedding_service = get_embedding_service()
        query_vector = embedding_service.embed_query(query)

        actual_k = min(top_k, count)
        results = self._collection.query(
            query_embeddings=[query_vector],
            n_results=actual_k,
            where={"repository_id": repository_id},
            include=["documents", "metadatas", "distances"]
        )

        formatted_results: List[Dict[str, Any]] = []

        if not results or not results["ids"] or not results["ids"][0]:
            return []

        ids = results["ids"][0]
        documents = results["documents"][0] if results.get("documents") else [""] * len(ids)
        metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(ids)
        distances = results["distances"][0] if results.get("distances") else [1.0] * len(ids)

        for chunk_id, doc, meta, dist in zip(ids, documents, metadatas, distances):
            # ChromaDB cosine distance D = 1 - cosine_similarity
            # Therefore similarity = 1 - D
            similarity = max(0.0, min(1.0, 1.0 - dist))

            formatted_results.append({
                "chunk_id": chunk_id,
                "document": doc,
                "metadata": meta,
                "distance": round(dist, 4),
                "similarity": round(similarity, 4),
            })

        return formatted_results

    def delete_repository_chunks(self, repository_id: str) -> None:
        """Purge all chunks associated with a deleted repository."""
        self._init_chroma()
        try:
            self._collection.delete(where={"repository_id": repository_id})
            logger.info(f"Purged ChromaDB vectors for repository: {repository_id}")
        except Exception as e:
            logger.warning(f"Error purging ChromaDB chunks for {repository_id}: {e}")

    def get_repository_chunk_count(self, repository_id: str) -> int:
        """Count total vectors indexed for a repository."""
        self._init_chroma()
        try:
            results = self._collection.get(where={"repository_id": repository_id})
            return len(results["ids"]) if results and results.get("ids") else 0
        except Exception:
            return 0

_vector_store: Optional[VectorStore] = None

def get_vector_store() -> VectorStore:
    """Dependency helper to get the active VectorStore instance."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
