import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UploadCloud,
  Github,
  FileCode,
  FileText,
  Play,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderGit2,
  Sparkles,
  RefreshCw,
  Binary,
  Layers,
  Boxes,
  Code2,
  Clock,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Repository as RepoType,
  RepositoryDetail,
  FileTreeItem,
  FileContent,
  CodeSymbol,
  CodeChunk,
  ExplainResponse,
} from '../types';

export const Repository: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const repoIdParam = searchParams.get('id');

  const [repositories, setRepositories] = useState<RepoType[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(repoIdParam || '');
  const [selectedRepo, setSelectedRepo] = useState<RepositoryDetail | null>(null);

  // Ingestion form state
  const [tab, setTab] = useState<'github' | 'upload'>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);

  // File explorer & code viewer state
  const [selectedFile, setSelectedFile] = useState<FileTreeItem | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // AST Symbols & Code Chunks state
  const [rightTab, setRightTab] = useState<'symbols' | 'chunks'>('symbols');
  const [symbols, setSymbols] = useState<CodeSymbol[]>([]);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [chunks, setChunks] = useState<CodeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [highlightedRange, setHighlightedRange] = useState<{ start: number; end: number } | null>(null);

  // Explain with AI state
  const [explainTarget, setExplainTarget] = useState<{
    name: string;
    type: string;
    code: string;
    lines: string;
  } | null>(null);
  const [explainResult, setExplainResult] = useState<ExplainResponse | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeViewerRef = useRef<HTMLDivElement>(null);

  const handleExplainSymbol = async (sym: CodeSymbol) => {
    if (!fileContent) return;
    const fileLines = fileContent.content.split('\n');
    const symbolCode = fileLines.slice(sym.start_line - 1, sym.end_line).join('\n');

    setExplainTarget({
      name: sym.name,
      type: sym.symbol_type,
      code: symbolCode,
      lines: `L${sym.start_line} - L${sym.end_line}`,
    });
    setExplainResult(null);
    setExplainError(null);
    setLoadingExplain(true);

    try {
      const res = await api.explainCode({
        code: symbolCode,
        name: sym.name,
        symbol_type: sym.symbol_type,
        context: selectedFile?.path,
      });
      setExplainResult(res);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'Failed to generate code explanation.';
      setExplainError(errorMsg);
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleExplainChunk = async (chunk: CodeChunk) => {
    setExplainTarget({
      name: chunk.symbol_name,
      type: chunk.chunk_type,
      code: chunk.content,
      lines: `L${chunk.start_line} - L${chunk.end_line}`,
    });
    setExplainResult(null);
    setExplainError(null);
    setLoadingExplain(true);

    try {
      const res = await api.explainCode({
        code: chunk.content,
        name: chunk.symbol_name,
        symbol_type: chunk.chunk_type,
        context: chunk.file_path,
      });
      setExplainResult(res);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'Failed to generate code explanation.';
      setExplainError(errorMsg);
    } finally {
      setLoadingExplain(false);
    }
  };

  // Load all repositories on mount
  const fetchRepositories = async () => {
    try {
      const data = await api.getRepositories();
      setRepositories(data);
      if (data.length > 0 && !selectedRepoId) {
        setSelectedRepoId(data[0].id);
        setSearchParams({ id: data[0].id });
      }
    } catch {
      // Ignored if initial load fails
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  // When selected repository changes, load its details and files
  useEffect(() => {
    if (!selectedRepoId) {
      setSelectedRepo(null);
      setSelectedFile(null);
      setFileContent(null);
      setSymbols([]);
      return;
    }

    const loadRepoDetail = async () => {
      try {
        const detail = await api.getRepository(selectedRepoId);
        setSelectedRepo(detail);
        if (detail.files && detail.files.length > 0) {
          const firstPy = detail.files.find((f) => f.language === 'python') || detail.files[0];
          setSelectedFile(firstPy);
        } else {
          setSelectedFile(null);
          setFileContent(null);
          setSymbols([]);
        }
      } catch {
        setSelectedRepo(null);
      }
    };

    loadRepoDetail();
  }, [selectedRepoId]);

  // When selected file changes, fetch content and AST symbols
  useEffect(() => {
    if (!selectedRepoId || !selectedFile) {
      setFileContent(null);
      setSymbols([]);
      setHighlightedRange(null);
      return;
    }

    setHighlightedRange(null);

    const loadContentAndSymbols = async () => {
      try {
        setLoadingContent(true);
        setContentError(null);
        const data = await api.getFileContent(selectedRepoId, selectedFile.path);
        setFileContent(data);
      } catch (err: unknown) {
        const errorMsg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Error loading file content.';
        setContentError(errorMsg || 'Failed to load file content.');
      } finally {
        setLoadingContent(false);
      }

      // If python, fetch AST symbols
      if (selectedFile.language === 'python') {
        try {
          setLoadingSymbols(true);
          const syms = await api.getFileSymbols(selectedRepoId, selectedFile.id);
          setSymbols(syms);
        } catch {
          setSymbols([]);
        } finally {
          setLoadingSymbols(false);
        }
      } else {
        setSymbols([]);
      }

      // Fetch code chunks for file
      try {
        setLoadingChunks(true);
        const fileChunks = await api.getRepositoryChunks(selectedRepoId, selectedFile.path);
        setChunks(fileChunks);
      } catch {
        setChunks([]);
      } finally {
        setLoadingChunks(false);
      }
    };

    loadContentAndSymbols();
  }, [selectedRepoId, selectedFile]);

  // Scroll to symbol lines when clicked
  const handleSelectSymbol = (sym: CodeSymbol) => {
    setHighlightedRange({ start: sym.start_line, end: sym.end_line });
    const targetElement = document.getElementById(`line-${sym.start_line}`);
    if (targetElement && codeViewerRef.current) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Scroll to chunk lines when clicked
  const handleSelectChunk = (chunk: CodeChunk) => {
    setHighlightedRange({ start: chunk.start_line, end: chunk.end_line });
    const targetElement = document.getElementById(`line-${chunk.start_line}`);
    if (targetElement && codeViewerRef.current) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle GitHub Clone Ingestion
  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    try {
      setIsSubmitting(true);
      setIngestError(null);
      setIngestSuccess(null);
      const newRepo = await api.cloneGithub(githubUrl.trim(), customName.trim() || undefined);
      setIngestSuccess(`Repository '${newRepo.name}' cloned and indexed successfully (${newRepo.total_files} files, ${newRepo.total_symbols} symbols).`);
      setGithubUrl('');
      setCustomName('');
      await fetchRepositories();
      setSelectedRepoId(newRepo.id);
      setSearchParams({ id: newRepo.id });
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'Failed to clone GitHub repository.';
      setIngestError(errorMsg || 'Failed to clone repository.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle ZIP File Upload Ingestion
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setIngestError('Please select a valid .zip file archive.');
      return;
    }

    try {
      setIsSubmitting(true);
      setIngestError(null);
      setIngestSuccess(null);
      const newRepo = await api.uploadZip(file);
      setIngestSuccess(`ZIP '${newRepo.name}' extracted and indexed (${newRepo.total_files} files, ${newRepo.total_symbols} symbols).`);
      await fetchRepositories();
      setSelectedRepoId(newRepo.id);
      setSearchParams({ id: newRepo.id });
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'Failed to process ZIP upload.';
      setIngestError(errorMsg || 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Repository & Python AST Visualizer</h1>
          <p className="text-xs text-slate-500 mt-1">
            Ingest Python codebases via GitHub URL or ZIP archive. Parse syntax trees into classes, methods, docstrings, and line bounds.
          </p>
        </div>
        {repositories.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setSearchParams({ id: e.target.value });
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.total_files} files, {r.total_symbols} symbols)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Ingestion Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setTab('github');
                setIngestError(null);
                setIngestSuccess(null);
              }}
              className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'github'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Github className="w-4 h-4" />
              GitHub Repository
            </button>
            <button
              onClick={() => {
                setTab('upload');
                setIngestError(null);
                setIngestSuccess(null);
              }}
              className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'upload'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload ZIP Archive
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {ingestError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">{ingestError}</div>
          </div>
        )}

        {ingestSuccess && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800">{ingestSuccess}</div>
          </div>
        )}

        {tab === 'github' ? (
          <form onSubmit={handleGithubSubmit} className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Public GitHub Repository URL
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/pallets/click"
                  disabled={isSubmitting}
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !githubUrl.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Clone & Index
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              ⚡ Performs a safe shallow clone (<code className="font-mono text-sky-700">--depth 1</code>), ignores binary/virtualenv files, parses AST symbols, and stores functions/classes.
            </p>
          </form>
        ) : (
          <div className="max-w-2xl">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div
              onClick={() => !isSubmitting && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isSubmitting
                  ? 'border-slate-300 bg-slate-100 cursor-not-allowed'
                  : 'border-slate-300 hover:border-sky-500 bg-slate-50'
              }`}
            >
              {isSubmitting ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
                  <p className="text-sm font-medium text-slate-700">Extracting & parsing AST symbols...</p>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">Click or drag & drop repository ZIP file here</p>
                  <p className="text-xs text-slate-500 mt-1">Supports standard ZIP archives containing Python files</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Explorer: File Tree & Code Viewer & AST Symbols */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Column 1: File Tree */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col max-h-[650px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-sky-600" />
              Files
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {selectedRepo?.files.length || 0}
            </span>
          </div>

          {!selectedRepo ? (
            <div className="p-6 text-center text-slate-400 text-xs my-auto">
              No repository selected.
            </div>
          ) : selectedRepo.files.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs my-auto">
              No files indexed.
            </div>
          ) : (
            <div className="overflow-y-auto space-y-1 flex-1 pr-1">
              {selectedRepo.files.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-sky-50 text-sky-900 border border-sky-200 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      {file.language === 'python' ? (
                        <FileCode className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{file.path}</span>
                    </div>
                    {file.symbols_count > 0 && (
                      <span className="text-[10px] text-sky-700 bg-sky-100/70 font-sans px-1.5 py-0.2 rounded flex-shrink-0">
                        {file.symbols_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2: Code Viewer */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col min-h-[500px] max-h-[650px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <div className="flex items-center gap-2 truncate">
              <FileCode className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <h3 className="text-xs font-semibold text-slate-800 font-mono truncate">
                {selectedFile ? selectedFile.path : 'Select a file'}
              </h3>
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {selectedFile.language}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {selectedFile.line_count}L &bull; {(selectedFile.size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
          </div>

          {loadingContent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-600 mb-2" />
              Loading file content...
            </div>
          ) : contentError ? (
            <div className="flex-1 flex flex-col items-center justify-center text-red-500 text-xs p-6 text-center">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p>{contentError}</p>
            </div>
          ) : fileContent ? (
            <div
              ref={codeViewerRef}
              className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs p-3 leading-relaxed"
            >
              <table className="w-full border-collapse">
                <tbody>
                  {fileContent.content.split('\n').map((line, idx) => {
                    const lineNum = idx + 1;
                    const isHighlighted =
                      highlightedRange &&
                      lineNum >= highlightedRange.start &&
                      lineNum <= highlightedRange.end;

                    return (
                      <tr
                        key={idx}
                        id={`line-${lineNum}`}
                        className={`transition-colors ${
                          isHighlighted
                            ? 'bg-amber-100/70 border-l-2 border-amber-500'
                            : 'hover:bg-slate-200/50'
                        }`}
                      >
                        <td className="w-10 select-none text-right pr-3 text-slate-400 text-[11px] border-r border-slate-200 font-mono align-top">
                          {lineNum}
                        </td>
                        <td className="pl-3 whitespace-pre text-slate-800 font-mono">
                          {line || ' '}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border border-slate-100 rounded-lg bg-slate-50">
              <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Select a file from the repository file tree</p>
            </div>
          )}
        </div>

        {/* Column 3: AST Symbols & Code Chunks Inspector */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col max-h-[650px]">
          {/* Header Switcher */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRightTab('symbols')}
                className={`text-xs font-semibold pb-1 border-b-2 flex items-center gap-1 transition-colors ${
                  rightTab === 'symbols'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Binary className="w-3.5 h-3.5" />
                AST ({symbols.length})
              </button>
              <button
                onClick={() => setRightTab('chunks')}
                className={`text-xs font-semibold pb-1 border-b-2 flex items-center gap-1 transition-colors ${
                  rightTab === 'chunks'
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                Chunks ({chunks.length})
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {rightTab === 'symbols' ? 'Symbol Units' : 'Vector Units'}
            </span>
          </div>

          {rightTab === 'symbols' ? (
            loadingSymbols ? (
              <div className="p-6 text-center text-slate-400 text-xs my-auto">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
                Parsing AST symbols...
              </div>
            ) : symbols.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs my-auto">
                <Layers className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                {selectedFile?.language === 'python'
                  ? 'No classes or functions defined in this file.'
                  : 'AST parsing is active for Python (.py) files.'}
              </div>
            ) : (
              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                {symbols.map((sym) => {
                  const isSelected =
                    highlightedRange &&
                    highlightedRange.start === sym.start_line &&
                    highlightedRange.end === sym.end_line;

                  let badgeColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (sym.symbol_type === 'class') badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                  else if (sym.symbol_type === 'function') badgeColor = 'bg-sky-100 text-sky-800 border-sky-200';
                  else if (sym.symbol_type === 'method') badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';

                  let parsedArgs: string[] = [];
                  try {
                    if (sym.args) parsedArgs = JSON.parse(sym.args);
                  } catch {
                    // ignore
                  }

                  return (
                    <div
                      key={sym.id}
                      onClick={() => handleSelectSymbol(sym)}
                      className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'border-purple-400 bg-purple-50/70 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${badgeColor}`}>
                          {sym.symbol_type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          L{sym.start_line} - L{sym.end_line}
                        </span>
                      </div>

                      <div className="font-mono font-medium text-slate-900 mt-1 truncate">
                        {sym.parent_symbol ? (
                          <span className="text-slate-400">{sym.parent_symbol}.</span>
                        ) : null}
                        {sym.name}
                        {sym.symbol_type !== 'class' && (
                          <span className="text-slate-400 font-normal">
                            ({parsedArgs.slice(0, 3).join(', ')}{parsedArgs.length > 3 ? '...' : ''})
                          </span>
                        )}
                      </div>

                      {sym.docstring && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 italic">
                          &quot;{sym.docstring}&quot;
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExplainSymbol(sym);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          Explain with AI
                        </button>
                        <span className="text-[10px] text-slate-400">
                          {sym.end_line - sym.start_line + 1} lines
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Code Chunks Tab */
            loadingChunks ? (
              <div className="p-6 text-center text-slate-400 text-xs my-auto">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-sky-600 mb-2" />
                Generating code chunks...
              </div>
            ) : chunks.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs my-auto">
                <Boxes className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                No code chunks generated for this file.
              </div>
            ) : (
              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                {chunks.map((chunk) => {
                  const isSelected =
                    highlightedRange &&
                    highlightedRange.start === chunk.start_line &&
                    highlightedRange.end === chunk.end_line;

                  let typeBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (chunk.chunk_type === 'function') typeBadge = 'bg-sky-50 text-sky-700 border-sky-200';
                  else if (chunk.chunk_type === 'method') typeBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (chunk.chunk_type === 'class') typeBadge = 'bg-purple-50 text-purple-700 border-purple-200';
                  else if (chunk.chunk_type === 'module') typeBadge = 'bg-amber-50 text-amber-700 border-amber-200';

                  return (
                    <div
                      key={chunk.chunk_id}
                      onClick={() => handleSelectChunk(chunk)}
                      className={`p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${typeBadge}`}>
                          {chunk.chunk_type}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            ~{chunk.token_estimate} tokens
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-medium">
                            L{chunk.start_line}-{chunk.end_line}
                          </span>
                        </div>
                      </div>

                      <div className="font-mono font-medium text-slate-900 mt-1 truncate">
                        {chunk.symbol_name}
                      </div>

                      <div className="mt-1.5 p-1.5 rounded bg-slate-50 border border-slate-100 font-mono text-[11px] text-slate-600 line-clamp-3 whitespace-pre">
                        {chunk.content}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExplainChunk(chunk);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded border border-sky-200 transition-colors"
                        >
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          Explain with AI
                        </button>
                        <span className="text-[10px] text-slate-400">
                          ~{chunk.token_estimate} tokens
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

      {/* Explain Code Modal / Drawer */}
      {explainTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    AI Architectural Code Explanation
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {explainTarget.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                      {explainTarget.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {explainTarget.lines}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setExplainTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {loadingExplain ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-sky-600 mb-3" />
                  <p className="font-medium text-slate-700">Deconstructing symbol architecture via Gemini...</p>
                  <p className="text-[11px] text-slate-400 mt-1">Analyzing inputs, outputs, execution logic, and Big-O complexity.</p>
                </div>
              ) : explainError ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Failed to explain code</p>
                    <p className="text-[11px] text-amber-700">{explainError}</p>
                    <p className="text-[10px] text-amber-600 italic">
                      Verify that GEMINI_API_KEY is configured in your .env file.
                    </p>
                  </div>
                </div>
              ) : explainResult ? (
                <div className="space-y-3.5">
                  {/* High-Level Purpose */}
                  <div className="p-3 rounded-lg border border-sky-100 bg-sky-50/50">
                    <div className="flex items-center gap-1.5 font-bold text-sky-900 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      High-Level Purpose
                    </div>
                    <p className="text-slate-700 leading-relaxed">{explainResult.purpose}</p>
                  </div>

                  {/* Inputs & Outputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-sky-600" />
                        Inputs & Parameters
                      </div>
                      <div className="text-slate-700 whitespace-pre-line font-mono text-[11px]">
                        {explainResult.inputs}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Outputs & Returns
                      </div>
                      <div className="text-slate-700 whitespace-pre-line font-mono text-[11px]">
                        {explainResult.outputs}
                      </div>
                    </div>
                  </div>

                  {/* Execution Logic */}
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                      <Binary className="w-3.5 h-3.5 text-purple-600" />
                      Execution Logic
                    </div>
                    <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                      {explainResult.logic}
                    </div>
                  </div>

                  {/* Edge Cases & Failure Modes */}
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                    <div className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                      Edge Cases & Robustness
                    </div>
                    <p className="text-slate-700 leading-relaxed">{explainResult.edge_cases}</p>
                  </div>

                  {/* Complexity & Security Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        Algorithmic Complexity
                      </div>
                      <p className="text-slate-700 font-mono text-[11px]">{explainResult.complexity || 'N/A'}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                        Security & Best Practices
                      </div>
                      <p className="text-slate-700 text-[11px]">{explainResult.security || 'None noted'}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setExplainTarget(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
