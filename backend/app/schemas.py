from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

# Health
class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    embedding_model: str
    database: str

# Code Symbols
class CodeSymbolBase(BaseModel):
    name: str
    symbol_type: str
    parent_symbol: Optional[str] = None
    start_line: int
    end_line: int
    docstring: Optional[str] = None
    args: Optional[str] = None

class CodeSymbolResponse(CodeSymbolBase):
    id: str
    file_id: str
    repository_id: str

    model_config = ConfigDict(from_attributes=True)

# Files
class FileResponse(BaseModel):
    id: str
    path: str
    language: str
    line_count: int
    size_bytes: int
    symbols: List[CodeSymbolResponse] = []

    model_config = ConfigDict(from_attributes=True)

class FileTreeItemResponse(BaseModel):
    id: str
    path: str
    language: str
    line_count: int
    size_bytes: int
    symbols_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class FileContentResponse(BaseModel):
    path: str
    content: str
    line_count: int

# Code-Aware Chunks
class CodeChunkResponse(BaseModel):
    chunk_id: str
    repository_id: str
    file_path: str
    symbol_name: str
    chunk_type: str
    start_line: int
    end_line: int
    content: str
    token_estimate: int
    searchable_text: str

# Repositories
class RepositoryCreateGithub(BaseModel):
    url: str = Field(..., description="Public GitHub repository URL")
    name: Optional[str] = Field(None, description="Optional custom display name")

class RepositoryResponse(BaseModel):
    id: str
    name: str
    source: str
    url: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    total_files: int = 0
    total_symbols: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RepositoryDetailResponse(RepositoryResponse):
    files: List[FileTreeItemResponse] = []

# Chat & RAG
class SourceRef(BaseModel):
    file: str
    symbol: Optional[str] = None
    symbol_type: Optional[str] = None
    start_line: int
    end_line: int
    similarity: Optional[float] = None
    content_snippet: Optional[str] = None

class ChatRequest(BaseModel):
    repository_id: str
    question: str
    top_k: Optional[int] = 5

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceRef] = []
    retrieval_steps: Optional[Dict[str, Any]] = None

class ChatHistoryItemResponse(BaseModel):
    id: str
    repository_id: str
    question: str
    answer: str
    sources: List[SourceRef] = []
    created_at: datetime

# Code Explanation
class ExplainRequest(BaseModel):
    code: str
    name: Optional[str] = ""
    symbol_type: Optional[str] = "function"
    context: Optional[str] = ""

class ExplainResponse(BaseModel):
    purpose: str
    inputs: str
    outputs: str
    logic: str
    edge_cases: str
    complexity: Optional[str] = None
    security: Optional[str] = None
    full_markdown: Optional[str] = None

# Transformer Attention
class AttentionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=200, description="Sentence for self-attention calculation")

class AttentionResponse(BaseModel):
    text: str
    tokens: List[str]
    token_ids: List[int]
    attention_weights: List[List[float]]
    q_snippet: Optional[List[List[float]]] = None
    k_snippet: Optional[List[List[float]]] = None
    v_snippet: Optional[List[List[float]]] = None
    raw_scores: Optional[List[List[float]]] = None
    scale_factor: float = 0.125
    d_k: int = 64
    d_model: int = 64

# Security / Bandit
class SecurityScanRequest(BaseModel):
    repository_id: str

class BanditFinding(BaseModel):
    file: str
    line: int
    test_id: str
    issue_severity: str
    issue_confidence: str
    issue_text: str
    code_snippet: Optional[str] = None
    remediation_title: Optional[str] = None
    remediation_risk: Optional[str] = None
    remediation_fix: Optional[str] = None

class SecurityScanResponse(BaseModel):
    repository_id: str
    total_findings: int
    findings: List[BanditFinding] = []
