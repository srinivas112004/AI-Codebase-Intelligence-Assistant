import axios from 'axios';
import {
  HealthResponse,
  Repository,
  RepositoryDetail,
  FileTreeItem,
  FileContent,
  CodeSymbol,
  CodeChunk,
  ChatRequest,
  ChatResponse,
  ChatHistoryItem,
  ExplainRequest,
  ExplainResponse,
  AttentionRequest,
  AttentionResponse,
  SecurityScanResponse
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // System Health
  getHealth: async (): Promise<HealthResponse> => {
    const res = await apiClient.get<HealthResponse>('/health');
    return res.data;
  },

  // Repositories
  getRepositories: async (): Promise<Repository[]> => {
    const res = await apiClient.get<Repository[]>('/repositories');
    return res.data;
  },

  getRepository: async (id: string): Promise<RepositoryDetail> => {
    const res = await apiClient.get<RepositoryDetail>(`/repositories/${id}`);
    return res.data;
  },

  deleteRepository: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiClient.delete<{ success: boolean }>(`/repositories/${id}`);
    return res.data;
  },

  uploadZip: async (file: File): Promise<Repository> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<Repository>('/repositories/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  cloneGithub: async (url: string, name?: string): Promise<Repository> => {
    const res = await apiClient.post<Repository>('/repositories/github', { url, name });
    return res.data;
  },

  getRepositoryFiles: async (id: string): Promise<FileTreeItem[]> => {
    const res = await apiClient.get<FileTreeItem[]>(`/repositories/${id}/files`);
    return res.data;
  },

  getFileContent: async (id: string, path: string): Promise<FileContent> => {
    const res = await apiClient.get<FileContent>(`/repositories/${id}/files/content`, {
      params: { path },
    });
    return res.data;
  },

  getRepositorySymbols: async (id: string, symbolType?: string, q?: string): Promise<CodeSymbol[]> => {
    const res = await apiClient.get<CodeSymbol[]>(`/repositories/${id}/symbols`, {
      params: { symbol_type: symbolType, q },
    });
    return res.data;
  },

  getFileSymbols: async (id: string, fileId: string): Promise<CodeSymbol[]> => {
    const res = await apiClient.get<CodeSymbol[]>(`/repositories/${id}/files/${fileId}/symbols`);
    return res.data;
  },

  getRepositoryChunks: async (id: string, path?: string, chunkType?: string): Promise<CodeChunk[]> => {
    const res = await apiClient.get<CodeChunk[]>(`/repositories/${id}/chunks`, {
      params: { path, chunk_type: chunkType }
    });
    return res.data;
  },

  // RAG & Chat
  askQuestion: async (data: ChatRequest): Promise<ChatResponse> => {
    const res = await apiClient.post<ChatResponse>('/chat', data);
    return res.data;
  },

  getChatHistory: async (repositoryId: string): Promise<ChatHistoryItem[]> => {
    const res = await apiClient.get<ChatHistoryItem[]>(`/chat/${repositoryId}/history`);
    return res.data;
  },

  clearChatHistory: async (repositoryId: string): Promise<{ repository_id: string; deleted_count: number; message: string }> => {
    const res = await apiClient.delete<{ repository_id: string; deleted_count: number; message: string }>(`/chat/${repositoryId}/history`);
    return res.data;
  },

  explainCode: async (data: ExplainRequest): Promise<ExplainResponse> => {
    const res = await apiClient.post<ExplainResponse>('/explain', data);
    return res.data;
  },

  // Transformer Lab
  computeAttention: async (data: AttentionRequest): Promise<AttentionResponse> => {
    const res = await apiClient.post<AttentionResponse>('/transformer/attention', data);
    return res.data;
  },

  // Security Scan
  scanSecurity: async (repositoryId: string): Promise<SecurityScanResponse> => {
    const res = await apiClient.post<SecurityScanResponse>('/security/scan', { repository_id: repositoryId });
    return res.data;
  },
};

export default api;
