import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.schemas import SourceRef, ChatResponse, ExplainResponse
from app.models import ChatHistory
from app.services.retriever import Retriever
from app.services.llm import get_llm_service, LLMService

logger = logging.getLogger(__name__)

STRICT_RAG_SYSTEM_INSTRUCTION = """You are an expert AI codebase intelligence assistant.
Your goal is to answer the user's question using ONLY the provided repository context snippets.

Strict Grounding Rules:
1. Do not assume, invent, or extrapolate files, functions, classes, dependencies, or behavior not explicitly present in the context.
2. If the context does not contain enough information to answer the question, clearly state:
   "The supplied repository context does not contain sufficient information to answer this question."
3. Every factual claim must be backed by a reference to the exact file path and line numbers from the context.
4. Format citations clearly in this format: `[filename.py (lines X-Y)]`.
5. When referring to functions, classes, or variables, always cite the file and line range where they are defined.
6. Provide code snippets only if they directly illustrate or derive from the provided context.
"""

CODE_EXPLAIN_SYSTEM_INSTRUCTION = """You are an expert Python systems architect, code reviewer, and technical educator.
Analyze the provided code symbol thoroughly, accurately, and concisely.
Structure your response into clear markdown sections:
- ## Purpose
- ## Inputs & Parameters
- ## Outputs & Return Values
- ## Execution Logic
- ## Edge Cases & Robustness
- ## Time & Space Complexity
- ## Security & Best Practices
"""

class RAGPipeline:
    """
    Orchestrates Vector Retrieval, Grounded Prompt Assembly,
    LLM Querying, Execution Step Tracking, and Code Explanation.
    """

    def __init__(self, retriever: Optional[Retriever] = None, llm_service: Optional[LLMService] = None):
        self.retriever = retriever or Retriever()
        self.llm_service = llm_service

    def _get_llm(self) -> LLMService:
        if self.llm_service is not None:
            return self.llm_service
        return get_llm_service()

    def chat(
        self,
        repository_id: str,
        question: str,
        top_k: int = 5,
        db: Optional[Session] = None
    ) -> ChatResponse:
        """
        Execute grounded RAG workflow for a codebase question.
        """
        question = question.strip()
        if not question:
            return ChatResponse(
                answer="Please provide a valid question about the codebase.",
                sources=[],
                retrieval_steps=None
            )

        # 1. Retrieve top-K relevant chunks & formatted context
        context_text, sources = self.retriever.retrieve_context(
            query=question,
            repository_id=repository_id,
            top_k=top_k
        )

        llm = self._get_llm()
        llm_model = getattr(llm, "model_name", "gemini-2.5-flash")

        # 2. Record retrieval execution steps for RAG Explorer UI
        retrieval_steps: Dict[str, Any] = {
            "query": question,
            "embedding_dimension": 384,
            "top_k_requested": top_k,
            "chunks_retrieved_count": len(sources),
            "chunks": [
                {
                    "file": s.file,
                    "symbol": s.symbol,
                    "symbol_type": s.symbol_type,
                    "lines": f"{s.start_line}-{s.end_line}",
                    "similarity": round(s.similarity or 0.0, 4),
                    "preview": (s.content_snippet or "")[:150] + ("..." if s.content_snippet and len(s.content_snippet) > 150 else "")
                }
                for s in sources
            ],
            "llm_model": llm_model
        }

        # 3. Handle zero-chunk retrieval case
        if not sources:
            answer = (
                "The supplied repository context does not contain sufficient information "
                "to answer this question. No matching code or documentation symbols were found in the indexed repository."
            )
            # Persist to chat history if db session is present
            if db:
                self._save_chat_history(db, repository_id, question, answer, sources)

            return ChatResponse(
                answer=answer,
                sources=[],
                retrieval_steps=retrieval_steps
            )

        # 4. Construct Grounded Prompt
        prompt = (
            f"### User Question:\n{question}\n\n"
            f"### Retrieved Codebase Context:\n{context_text}\n\n"
            f"### Grounded Response:\n"
            f"Answer the user question based strictly on the context above. "
            f"Cite file paths and line ranges for all references."
        )

        # 5. Query LLM Service
        try:
            answer = llm.generate(
                prompt=prompt,
                system_instruction=STRICT_RAG_SYSTEM_INSTRUCTION,
                temperature=0.2
            )
            if not answer:
                answer = "The model generated an empty response. Please try refining your query."
        except Exception as e:
            logger.error(f"Error during LLM generation in RAG pipeline: {e}", exc_info=True)
            answer = f"Error generating answer: {str(e)}"

        # 6. Save Chat History in SQLite if session available
        if db:
            self._save_chat_history(db, repository_id, question, answer, sources)

        return ChatResponse(
            answer=answer,
            sources=sources,
            retrieval_steps=retrieval_steps
        )

    def explain_code(
        self,
        code: str,
        name: Optional[str] = "",
        symbol_type: Optional[str] = "function",
        context: Optional[str] = ""
    ) -> ExplainResponse:
        """
        Generate deep structural and algorithmic explanation of a specific code snippet/symbol.
        """
        code = code.strip()
        if not code:
            return ExplainResponse(
                purpose="No code provided.",
                inputs="N/A",
                outputs="N/A",
                logic="N/A",
                edge_cases="N/A",
                complexity="N/A",
                security="N/A",
                full_markdown="Please provide a valid code snippet to explain."
            )

        name_str = f" named `{name}`" if name else ""
        type_str = symbol_type or "symbol"
        context_str = f"\nEnclosing context/file:\n{context}\n" if context else ""

        prompt = (
            f"Explain the following Python {type_str}{name_str} in detail.{context_str}\n"
            f"```python\n{code}\n```\n\n"
            f"Please structure your explanation with the following clear markdown headers:\n"
            f"## Purpose\n"
            f"## Inputs & Parameters\n"
            f"## Outputs & Return Values\n"
            f"## Execution Logic\n"
            f"## Edge Cases & Robustness\n"
            f"## Time & Space Complexity\n"
            f"## Security & Best Practices\n"
        )

        llm = self._get_llm()
        try:
            full_markdown = llm.generate(
                prompt=prompt,
                system_instruction=CODE_EXPLAIN_SYSTEM_INSTRUCTION,
                temperature=0.2
            )
        except Exception as e:
            logger.error(f"Error generating code explanation: {e}", exc_info=True)
            full_markdown = f"Error generating explanation: {str(e)}"

        # Parse sections from markdown
        sections = self._parse_explanation_sections(full_markdown)

        return ExplainResponse(
            purpose=sections.get("purpose", "High-level purpose not specified."),
            inputs=sections.get("inputs", "Inputs not specified."),
            outputs=sections.get("outputs", "Outputs not specified."),
            logic=sections.get("logic", "Execution logic not specified."),
            edge_cases=sections.get("edge_cases", "Edge cases not specified."),
            complexity=sections.get("complexity", "Complexity not specified."),
            security=sections.get("security", "Security considerations not specified."),
            full_markdown=full_markdown
        )

    def _parse_explanation_sections(self, markdown_text: str) -> Dict[str, str]:
        """Parse structured sections from generated markdown response."""
        result: Dict[str, str] = {}
        current_section = None
        current_lines: List[str] = []

        header_mapping = {
            "purpose": "purpose",
            "inputs & parameters": "inputs",
            "inputs and parameters": "inputs",
            "inputs": "inputs",
            "parameters": "inputs",
            "outputs & return values": "outputs",
            "outputs and return values": "outputs",
            "outputs": "outputs",
            "return values": "outputs",
            "execution logic": "logic",
            "logic": "logic",
            "edge cases & robustness": "edge_cases",
            "edge cases and robustness": "edge_cases",
            "edge cases": "edge_cases",
            "time & space complexity": "complexity",
            "time and space complexity": "complexity",
            "complexity": "complexity",
            "security & best practices": "security",
            "security and best practices": "security",
            "security": "security",
        }

        for line in markdown_text.splitlines():
            line_stripped = line.strip()
            if line_stripped.startswith("## ") or line_stripped.startswith("### "):
                # Save previous section
                if current_section:
                    result[current_section] = "\n".join(current_lines).strip()
                    current_lines = []

                header_title = line_stripped.lstrip("#").strip().lower()
                matched_key = None
                for key, val in header_mapping.items():
                    if key in header_title:
                        matched_key = val
                        break
                current_section = matched_key
            else:
                if current_section:
                    current_lines.append(line)

        if current_section and current_lines:
            result[current_section] = "\n".join(current_lines).strip()

        # If parsing could not detect standard headers, fallback gracefully
        if not result:
            result["purpose"] = markdown_text[:300]
            result["logic"] = markdown_text

        return result

    def _save_chat_history(
        self,
        db: Session,
        repository_id: str,
        question: str,
        answer: str,
        sources: List[SourceRef]
    ) -> None:
        """Persist conversation exchange to SQLite database."""
        try:
            sources_json = json.dumps([s.model_dump() for s in sources])
            history_record = ChatHistory(
                repository_id=repository_id,
                question=question,
                answer=answer,
                sources=sources_json
            )
            db.add(history_record)
            db.commit()
            db.refresh(history_record)
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist chat history to database: {e}", exc_info=True)


# Singleton instance
_rag_pipeline_instance: Optional[RAGPipeline] = None

def get_rag_pipeline() -> RAGPipeline:
    global _rag_pipeline_instance
    if _rag_pipeline_instance is None:
        _rag_pipeline_instance = RAGPipeline()
    return _rag_pipeline_instance
