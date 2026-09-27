import logging
from typing import List, Dict, Any, Optional
from app.schemas import SourceRef
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

class Retriever:
    """
    Retrieval component for RAG.
    Executes semantic similarity search via ChromaDB, extracts source attributions,
    and formats context windows for grounded LLM consumption.
    """
    def __init__(self, vector_store=None):
        self.vector_store = vector_store or get_vector_store()

    def retrieve(
        self,
        query: str,
        repository_id: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Execute similarity search and construct formatted context and source references.
        """
        results = self.vector_store.similarity_search(
            query=query,
            repository_id=repository_id,
            top_k=top_k
        )

        sources: List[SourceRef] = []
        context_snippets: List[str] = []

        for item in results:
            meta = item["metadata"]
            file_path = meta.get("file", "unknown")
            symbol = meta.get("symbol", "module")
            symbol_type = meta.get("type", "code")
            start_line = meta.get("start_line", 1)
            end_line = meta.get("end_line", 1)
            similarity = item.get("similarity", 0.0)
            doc_content = item.get("document", "")

            # Build verified source reference
            source_ref = SourceRef(
                file=file_path,
                symbol=symbol,
                symbol_type=symbol_type,
                start_line=start_line,
                end_line=end_line,
                similarity=similarity,
                content_snippet=doc_content[:200]
            )
            sources.append(source_ref)

            # Format for LLM grounded prompt
            snippet_header = f"--- [File: {file_path} | Symbol: {symbol} ({symbol_type}) | Lines: {start_line}-{end_line}] ---"
            context_snippets.append(f"{snippet_header}\n{doc_content}\n")

        context_str = "\n".join(context_snippets) if context_snippets else "No relevant code chunks found."

        return {
            "query": query,
            "repository_id": repository_id,
            "top_k": top_k,
            "total_retrieved": len(results),
            "context_str": context_str,
            "sources": sources,
            "raw_chunks": results,
        }

    def retrieve_context(
        self,
        query: str,
        repository_id: str,
        top_k: int = 5
    ) -> tuple[str, List[SourceRef]]:
        """
        Convenience method returning (context_str, sources) tuple for prompt assembly.
        """
        data = self.retrieve(query=query, repository_id=repository_id, top_k=top_k)
        return data["context_str"], data["sources"]

_retriever: Optional[Retriever] = None

def get_retriever() -> Retriever:
    """Dependency helper to get active Retriever instance."""
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
