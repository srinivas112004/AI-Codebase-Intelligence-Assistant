import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  FileCode2,
  Binary,
  ArrowUpRight,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
  Search,
  LayoutGrid,
  List,
  Github,
  Archive,
  Cpu,
  ShieldCheck,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  Zap,
  BotMessageSquare,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { Repository, HealthResponse } from '../types';

export const Dashboard: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ready' | 'indexing' | 'error'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [reposData, healthData] = await Promise.allSettled([
        api.getRepositories(),
        api.getHealth(),
      ]);

      if (reposData.status === 'fulfilled') {
        setRepositories(reposData.value);
      } else {
        throw new Error('Failed to load repositories');
      }

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }
    } catch {
      setError('Unable to connect to backend API. Please make sure the FastAPI server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete repository '${name}' and its vector embeddings?`)) return;
    try {
      setDeletingId(id);
      await api.deleteRepository(id);
      setRepositories((prev) => prev.filter((r) => r.id !== id));
    } catch {
      alert(`Failed to delete repository '${name}'.`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Aggregated KPIs
  const totalFiles = repositories.reduce((sum, r) => sum + (r.total_files || 0), 0);
  const totalSymbols = repositories.reduce((sum, r) => sum + (r.total_symbols || 0), 0);
  const githubCount = repositories.filter((r) => r.source === 'github').length;
  const zipCount = repositories.filter((r) => r.source === 'zip').length;
  const readyCount = repositories.filter((r) => r.status === 'ready').length;

  // Filtered repositories
  const filteredRepos = repositories.filter((repo) => {
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.url && repo.url.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || repo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Hero & Command Header */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-indigo-600 to-violet-600" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                AST-Guided RAG Platform
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Gemini 2.5 Flash Grounded
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200">
                all-MiniLM-L6-v2 &bull; 384-dim
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Codebase Intelligence <span className="text-gradient">Command Center</span>
            </h1>

            <p className="text-slate-600 text-sm leading-relaxed">
              Explore codebase architecture with Python AST parsing, symbol-boundary chunking, dense vector search in ChromaDB, educational PyTorch self-attention visualization, and automated Bandit SAST security scans.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center flex-wrap gap-2.5 sm:self-start lg:self-center">
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300/80 rounded-xl hover:bg-slate-50 transition-all shadow-2xs hover:border-slate-400"
              title="Refresh repository statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
              <span>Refresh</span>
            </button>

            <Link
              to="/assistant"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-xl hover:bg-indigo-100 transition-all shadow-2xs"
            >
              <BotMessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Ask Assistant</span>
            </Link>

            <Link
              to="/repository"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 rounded-xl hover:from-sky-700 hover:to-indigo-700 transition-all shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Repository</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Backend Alert (if offline) */}
      {error && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-4 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold text-amber-950">Backend Connection Alert: </span>
            {error}
            <span className="block mt-1 text-amber-800">
              Run <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-[11px]">.\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000</code> in your backend folder.
            </span>
          </div>
        </div>
      )}

      {/* 2. Key Metric Cards (KPI Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Repositories */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Repositories</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-110 transition-transform">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{repositories.length}</h3>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{githubCount}</span> GitHub &bull;{' '}
              <span className="font-semibold text-slate-700">{zipCount}</span> ZIP
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Multi-tenant</span>
            <span className="text-emerald-600 font-semibold">{readyCount} Ready</span>
          </div>
        </div>

        {/* Card 2: Files */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Indexed Files</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-110 transition-transform">
              <FileCode2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{totalFiles}</h3>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span>Python modules</span>
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Parser</span>
            <span className="text-indigo-600 font-semibold">100% AST Extracted</span>
          </div>
        </div>

        {/* Card 3: AST Symbols */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AST Symbols</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
              <Binary className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{totalSymbols}</h3>
            <p className="text-[11px] text-slate-500 mt-1">Classes, methods & funcs</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Accuracy</span>
            <span className="text-emerald-600 font-semibold">Zero Hallucination</span>
          </div>
        </div>

        {/* Card 4: Vector Embeddings */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vector DB</span>
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">ChromaDB</h3>
            <p className="text-[11px] text-slate-500 mt-1">384-dim Dense Vectors</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Metric</span>
            <span className="text-violet-600 font-semibold font-mono">Cosine HNSW</span>
          </div>
        </div>

        {/* Card 5: Security SAST */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Security Posture</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bandit SAST</h3>
            <p className="text-[11px] text-slate-500 mt-1">CWE Vulnerability Audit</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Engine</span>
            <span className="text-rose-600 font-semibold">AI Remediation</span>
          </div>
        </div>
      </div>

      {/* 3. System Architecture Pipeline Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                End-to-End System Intelligence Pipeline
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic code ingestion workflow powering grounded answers with exact source lines.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-sky-300 border border-slate-700 font-mono text-[11px]">
              Engine: {health?.embedding_model || 'all-MiniLM-L6-v2'}
            </span>
          </div>
        </div>

        {/* 5-Stage Interactive Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-sky-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-sky-400 uppercase">Stage 01</span>
              <Archive className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-slate-100">Ingestion & Security</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Zip Slip defense &amp; shallow Git cloning.
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-indigo-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">Stage 02</span>
              <Binary className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-slate-100">Python AST Visitor</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Extracts classes, methods, docstrings &amp; line bounds.
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-violet-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-violet-400 uppercase">Stage 03</span>
              <Layers className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-slate-100">Code-Aware Chunks</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Symbol-boundary chunking preserving module context.
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Stage 04</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-slate-100">ChromaDB Vectors</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Normalized embeddings with HNSW cosine search.
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/60 hover:border-pink-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-pink-400 uppercase">Stage 05</span>
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-slate-100">Grounded RAG</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Google Gemini synthesis with strict source attribution.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Deep Dive Launchpad (4 Feature Shortcuts) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Quick Exploration Launchpad
          </h2>
          <span className="text-xs text-slate-500 font-medium">Click any module to inspect</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/assistant"
            className="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-sky-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 mb-3 group-hover:scale-105 transition-transform">
                <BotMessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                AI Grounded Assistant
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ask natural language questions with live source citations, exact line ranges, and the RAG Execution Explorer.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-sky-600 group-hover:translate-x-1 transition-transform">
              <span>Start Chatting</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            to="/repository"
            className="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 mb-3 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                AST Symbol &amp; Chunk Browser
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Inspect file trees, parsed functions, classes, docstrings, chunk boundaries, and trigger on-demand AI code explanations.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
              <span>Browse Symbols</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            to="/transformer-lab"
            className="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-violet-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 mb-3 group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
                PyTorch Attention Lab
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Visualize pure PyTorch linear projections ($Q, K, V$), scaled dot-products, and interactive 2D softmax attention heatmaps.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-violet-600 group-hover:translate-x-1 transition-transform">
              <span>Launch Lab</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>

          <Link
            to="/security"
            className="group bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-rose-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 mb-3 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                Bandit SAST Security Scanner
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Scan repositories for security vulnerabilities, CWE mappings, severity ratings, and automated AI remediation guides.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-semibold text-rose-600 group-hover:translate-x-1 transition-transform">
              <span>Audit Security</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </Link>
        </div>
      </div>

      {/* 5. Tracked Repositories Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Search, Filter & View Controls Toolbar */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tracked Repositories</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Codebases indexed for AST symbol mapping, vector search, and LLM grounded synthesis.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search repository..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 w-44 sm:w-56"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              {(['ALL', 'ready', 'indexing', 'error'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* View Switcher (Grid vs Table) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Dense Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content State: Loading, Empty, or List */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
            <span>Loading tracked repositories and vector stores...</span>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="p-12 sm:p-16 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-2xs">
              <FolderGit2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No matching repositories found'
                : 'No repositories indexed yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter above.'
                : 'Upload a Python repository ZIP or clone a public GitHub repository to start AST parsing and vector retrieval.'}
            </p>
            <div className="mt-5">
              <Link
                to="/repository"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-indigo-600 rounded-xl hover:from-sky-700 hover:to-indigo-700 shadow-xs hover:shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Index Your First Repository</span>
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* CARD GRID VIEW */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Subtle top indicator based on status */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    repo.status === 'ready'
                      ? 'bg-emerald-500'
                      : repo.status === 'indexing'
                      ? 'bg-sky-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />

                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200/80">
                        {repo.source === 'github' ? (
                          <Github className="w-5 h-5 text-slate-800" />
                        ) : (
                          <Archive className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                          {repo.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 capitalize">
                          {repo.source === 'github' ? 'GitHub Repository' : 'ZIP Archive'}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        repo.status === 'ready'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : repo.status === 'indexing'
                          ? 'bg-sky-50 text-sky-700 border-sky-200/80 animate-pulse'
                          : 'bg-amber-50 text-amber-700 border-amber-200/80'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          repo.status === 'ready'
                            ? 'bg-emerald-500'
                            : repo.status === 'indexing'
                            ? 'bg-sky-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {repo.status}
                    </span>
                  </div>

                  {/* URL if available */}
                  {repo.url && (
                    <div className="mt-2.5">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-500 hover:text-sky-600 truncate block font-mono"
                        title={repo.url}
                      >
                        {repo.url}
                      </a>
                    </div>
                  )}

                  {/* Metrics Pills */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Files</span>
                      <span className="text-sm font-extrabold text-slate-800">{repo.total_files}</span>
                    </div>
                    <div className="bg-slate-50/80 rounded-lg p-2 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">AST Symbols</span>
                      <span className="text-sm font-extrabold text-slate-800">{repo.total_symbols}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/assistant?repoId=${repo.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/70 hover:bg-sky-100 transition-colors"
                      title="Ask AI questions about this codebase"
                    >
                      <Zap className="w-3.5 h-3.5 text-sky-600" />
                      <span>Chat</span>
                    </Link>

                    <Link
                      to={`/repository?id=${repo.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors"
                      title="Explore AST file tree and symbols"
                    >
                      <span>AST</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-500" />
                    </Link>

                    <Link
                      to={`/security?repoId=${repo.id}`}
                      className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Run Bandit security scan"
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </Link>
                  </div>

                  <button
                    onClick={() => handleDelete(repo.id, repo.name)}
                    disabled={deletingId === repo.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* DENSE TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Repository</th>
                  <th className="px-6 py-3.5">Source</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-center">Files</th>
                  <th className="px-6 py-3.5 text-center">Symbols</th>
                  <th className="px-6 py-3.5">Indexed Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRepos.map((repo) => (
                  <tr key={repo.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200/80">
                          {repo.source === 'github' ? (
                            <Github className="w-4 h-4 text-slate-800" />
                          ) : (
                            <Archive className="w-4 h-4 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {repo.name}
                          </div>
                          {repo.url && (
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{repo.url}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {repo.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          repo.status === 'ready'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : repo.status === 'indexing'
                            ? 'bg-sky-50 text-sky-700 border-sky-200/80 animate-pulse'
                            : 'bg-amber-50 text-amber-700 border-amber-200/80'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            repo.status === 'ready'
                              ? 'bg-emerald-500'
                              : repo.status === 'indexing'
                              ? 'bg-sky-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        {repo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-800">{repo.total_files}</td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-800">{repo.total_symbols}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                      {new Date(repo.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/assistant?repoId=${repo.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 rounded-md hover:bg-sky-100"
                          title="Ask AI questions"
                        >
                          <Zap className="w-3 h-3 text-sky-600" />
                          <span>Chat</span>
                        </Link>
                        <Link
                          to={`/repository?id=${repo.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                        >
                          <span>AST</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                        <button
                          onClick={() => handleDelete(repo.id, repo.name)}
                          disabled={deletingId === repo.id}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                          title="Delete repository"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
