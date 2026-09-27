// System & Health
export interface HealthResponse {
  status: string;
  version: string;
  embedding_model: string;
  database: string;
}

// Code Symbols
export interface CodeSymbol {
  id: string;
  file_id: string;
  repository_id: string;
  name: string;
  symbol_type: 'class' | 'function' | 'method' | 'import';
  parent_symbol?: string | null;
  start_line: number;
  end_line: number;
  docstring?: string | null;
  args?: string | null;
}

// Files
export interface FileTreeItem {
  id: string;
  path: string;
  language: string;
  line_count: number;
  size_bytes: number;
  symbols_count: number;
}

export interface FileContent {
  path: string;
  content: string;
  line_count: number;
}

// Code Chunks
export interface CodeChunk {
  chunk_id: string;
  repository_id: string;
  file_path: string;
  symbol_name: string;
  chunk_type: string;
  start_line: number;
  end_line: number;
  content: string;
  token_estimate: number;
  searchable_text: string;
}

// Repositories
export interface Repository {
  id: string;
  name: string;
  source: 'github' | 'zip';
  url?: string | null;
  status: 'pending' | 'indexing' | 'ready' | 'error';
  error_message?: string | null;
  total_files: number;
  total_symbols: number;
  created_at: string;
}

export interface RepositoryDetail extends Repository {
  files: FileTreeItem[];
}

// RAG & Chat
export interface SourceRef {
  file: string;
  symbol?: string | null;
  symbol_type?: string | null;
  start_line: number;
  end_line: number;
  similarity?: number | null;
  content_snippet?: string | null;
}

export interface ChatRequest {
  repository_id: string;
  question: string;
  top_k?: number;
}

export interface RetrievalChunkTrace {
  file: string;
  symbol?: string | null;
  symbol_type?: string | null;
  lines: string;
  similarity: number;
  preview?: string | null;
}

export interface RetrievalSteps {
  query: string;
  embedding_dimension?: number;
  top_k_requested?: number;
  chunks_retrieved_count?: number;
  chunks?: RetrievalChunkTrace[];
  llm_model?: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceRef[];
  retrieval_steps?: RetrievalSteps;
}

export interface ChatHistoryItem {
  id: string;
  repository_id: string;
  question: string;
  answer: string;
  sources: SourceRef[];
  created_at: string;
}

// Code Explanation
export interface ExplainRequest {
  code: string;
  name?: string;
  symbol_type?: string;
  context?: string;
}

export interface ExplainResponse {
  purpose: string;
  inputs: string;
  outputs: string;
  logic: string;
  edge_cases: string;
  complexity?: string | null;
  security?: string | null;
  full_markdown?: string | null;
}

// Transformer Self-Attention
export interface AttentionRequest {
  text: string;
}

export interface AttentionResponse {
  text: string;
  tokens: string[];
  token_ids: number[];
  attention_weights: number[][];
  q_snippet?: number[][];
  k_snippet?: number[][];
  v_snippet?: number[][];
  raw_scores?: number[][];
  scale_factor?: number;
  d_k: number;
  d_model: number;
}

// Security / Bandit
export interface BanditFinding {
  file: string;
  line: number;
  test_id: string;
  issue_severity: 'LOW' | 'MEDIUM' | 'HIGH';
  issue_confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  issue_text: string;
  code_snippet?: string | null;
  remediation_title?: string | null;
  remediation_risk?: string | null;
  remediation_fix?: string | null;
}

export interface SecurityScanResponse {
  repository_id: string;
  total_findings: number;
  findings: BanditFinding[];
}
