import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Bot,
  User,
  Layers,
  Sparkles,
  RefreshCw,
  FolderGit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Copy,
  Check,
  Code2,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import {
  Repository,
  SourceRef,
  RetrievalSteps,
} from '../types';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRef[];
  retrieval_steps?: RetrievalSteps;
  timestamp?: string;
}

// Simple lightweight markdown parser for clean interview-ready UI
const MarkdownView: React.FC<{ content: string; onCitationClick?: (citation: string) => void }> = ({ content }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <div key={`code-${i}`} className="my-2 rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-xs overflow-x-auto border border-slate-800">
            {codeBlockLang && (
              <div className="text-[10px] uppercase text-slate-400 font-semibold mb-1 pb-1 border-b border-slate-800">
                {codeBlockLang}
              </div>
            )}
            <pre className="whitespace-pre">{codeBlockLines.join('\n')}</pre>
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-xs font-bold text-slate-900 mt-3 mb-1 uppercase tracking-wider">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5">{line.slice(3)}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-base font-bold text-slate-900 mt-4 mb-2">{line.slice(2)}</h2>);
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1 pl-2 text-xs leading-relaxed text-slate-700">
          <span className="text-sky-500 font-bold">•</span>
          <span>{renderFormattedText(line.trim().slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(
        <p key={i} className="text-xs leading-relaxed text-slate-800 my-1">
          {renderFormattedText(line)}
        </p>
      );
    }
  }

  return <div>{elements}</div>;
};

// Formats inline bold (**text**), inline backticks (`code`), and citation references
function renderFormattedText(text: string): React.ReactNode {
  // Regex to split by inline code or bold
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\(lines\s*\d+-\d+\)\])/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-slate-100 text-sky-700 font-mono text-[11px] border border-slate-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('[') && part.includes('(lines')) {
      return (
        <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 font-medium ml-0.5">
          {part}
        </span>
      );
    }
    return part;
  });
}

export const Assistant: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId') || searchParams.get('id');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active retrieval trace for Explorer drawer
  const [activeTrace, setActiveTrace] = useState<RetrievalSteps | null>(null);
  const [expandedChunkIdx, setExpandedChunkIdx] = useState<number | null>(null);

  // Source preview modal state
  const [selectedSource, setSelectedSource] = useState<SourceRef | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAsking]);

  // Load repositories on mount
  useEffect(() => {
    const loadRepos = async () => {
      try {
        const repos = await api.getRepositories();
        setRepositories(repos);
        if (repos.length > 0) {
          if (repoIdParam && repos.some((r) => r.id === repoIdParam)) {
            setSelectedRepoId(repoIdParam);
          } else {
            setSelectedRepoId(repos[0].id);
          }
        }
      } catch (err: unknown) {
        setErrorMessage('Failed to load repositories. Is the backend server running?');
      }
    };
    loadRepos();
  }, [repoIdParam]);

  // When repository changes, load its chat history
  useEffect(() => {
    if (!selectedRepoId) return;

    const loadHistory = async () => {
      try {
        setErrorMessage(null);
        const historyItems = await api.getChatHistory(selectedRepoId);
        if (historyItems.length > 0) {
          const formatted: MessageItem[] = [];
          historyItems.forEach((item) => {
            formatted.push({
              id: `${item.id}-user`,
              role: 'user',
              content: item.question,
              timestamp: item.created_at,
            });
            formatted.push({
              id: `${item.id}-assistant`,
              role: 'assistant',
              content: item.answer,
              sources: item.sources,
              timestamp: item.created_at,
            });
          });
          setMessages(formatted);
          // Set active trace from last assistant message if available
          const lastAssistant = formatted[formatted.length - 1];
          if (lastAssistant && lastAssistant.sources) {
            setActiveTrace({
              query: formatted[formatted.length - 2]?.content || '',
              chunks_retrieved_count: lastAssistant.sources.length,
              chunks: lastAssistant.sources.map((s) => ({
                file: s.file,
                symbol: s.symbol,
                symbol_type: s.symbol_type,
                lines: `${s.start_line}-${s.end_line}`,
                similarity: s.similarity || 0,
                preview: s.content_snippet,
              })),
            });
          }
        } else {
          // Welcome message
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content:
                '👋 **Welcome to the AI Codebase Intelligence Assistant!**\n\n' +
                'This assistant uses **Grounded Retrieval-Augmented Generation (RAG)**:\n' +
                '- Your question is embedded into 384-dimensional vector space via `all-MiniLM-L6-v2`.\n' +
                '- ChromaDB retrieves the top most relevant AST-parsed code chunks.\n' +
                '- Google Gemini synthesizes an answer strictly based on the retrieved snippets, with verified source citations.\n\n' +
                'Try asking questions like:\n' +
                '- *"Where is authentication or authorization implemented?"*\n' +
                '- *"Explain the database models and relationships."*\n' +
                '- *"How does file extraction and ZIP sanitization work?"*',
            },
          ]);
          setActiveTrace(null);
        }
      } catch (err: unknown) {
        console.error('Failed to load history', err);
      }
    };

    loadHistory();
  }, [selectedRepoId]);

  const handleSendMessage = async (customQuestion?: string) => {
    const questionText = (customQuestion || input).trim();
    if (!questionText || isAsking) return;

    if (!selectedRepoId) {
      setErrorMessage('Please select or upload a repository first.');
      return;
    }

    setErrorMessage(null);
    setInput('');

    // Append user message immediately
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: questionText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const res = await api.askQuestion({
        repository_id: selectedRepoId,
        question: questionText,
        top_k: 5,
      });

      const assistantMsg: MessageItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        retrieval_steps: res.retrieval_steps,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Update RAG Explorer drawer with the latest execution trace
      if (res.retrieval_steps) {
        setActiveTrace(res.retrieval_steps);
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'An error occurred while querying the assistant.';
      setErrorMessage(errorMsg);

      // Append error message from assistant
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Unable to complete request:**\n\n${errorMsg}\n\n*Note: If GEMINI_API_KEY is not configured in your .env file, please configure it to enable live Gemini LLM generation.*`,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedRepoId) return;
    if (!confirm('Are you sure you want to clear conversation history for this repository?')) return;

    try {
      await api.clearChatHistory(selectedRepoId);
      setMessages([
        {
          id: 'welcome-reset',
          role: 'assistant',
          content: 'Conversation history cleared. Ask a new question to start fresh!',
        },
      ]);
      setActiveTrace(null);
    } catch (err: unknown) {
      setErrorMessage('Failed to clear chat history.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-10rem)]">
      {/* Left 3 Columns: Main Chat Area */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col overflow-hidden min-h-[620px]">
        {/* Chat Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  RAG Codebase Assistant
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Grounded
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Grounded answers with verified source line references
              </p>
            </div>
          </div>

          {/* Repository Selector Dropdown & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {repositories.length === 0 ? (
                  <option value="">No Repositories</option>
                ) : (
                  repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.total_files} files)
                    </option>
                  ))
                )}
              </select>
            </div>

            {selectedRepo && (
              <button
                onClick={handleClearHistory}
                title="Clear Chat History"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Error Notification Banner if any */}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-700 font-bold hover:text-amber-900 ml-4"
            >
              &times;
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-5 bg-slate-50/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-xl p-4 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs'
                }`}
              >
                {/* Assistant Message Header / Actions */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      AI Response
                    </span>
                    <button
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}

                {/* Message Content */}
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                ) : (
                  <MarkdownView content={msg.content} />
                )}

                {/* Verified Source Citations Drawer */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Verified Source Attributions ({msg.sources.length}):
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.sources.map((s, idx) => {
                        const simPercent = s.similarity ? Math.round(s.similarity * 100) : null;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSource(s)}
                            className="group flex flex-col justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer transition-all"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-medium text-slate-800 text-[11px] truncate group-hover:text-sky-700">
                                {s.file}
                              </span>
                              {simPercent !== null && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800">
                                  {simPercent}%
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                              <span className="font-mono text-purple-700">
                                {s.symbol || 'module'} {s.symbol_type ? `(${s.symbol_type})` : ''}
                              </span>
                              <span className="font-mono text-slate-400">
                                L{s.start_line}-{s.end_line}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isAsking && (
            <div className="flex gap-3.5 justify-start">
              <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <div className="text-xs text-slate-600 font-medium">
                  Retrieving chunks & generating grounded response...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions Chips */}
        {messages.length <= 1 && repositories.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-100/70 border-t border-slate-200 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-500 font-semibold flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-3 h-3 text-amber-500" /> Try:
            </span>
            <button
              onClick={() => handleSendMessage('Where is authentication or authorization handled?')}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-sky-400 hover:text-sky-700 whitespace-nowrap transition-colors"
            >
              Where is authentication handled?
            </button>
            <button
              onClick={() => handleSendMessage('List the main functions and classes in this repository.')}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-sky-400 hover:text-sky-700 whitespace-nowrap transition-colors"
            >
              List main functions & classes
            </button>
            <button
              onClick={() => handleSendMessage('How are database errors or exceptions handled?')}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-sky-400 hover:text-sky-700 whitespace-nowrap transition-colors"
            >
              How are errors handled?
            </button>
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedRepoId
                  ? 'Ask a question about the indexed codebase...'
                  : 'Please upload or select a repository above first...'
              }
              disabled={isAsking || !selectedRepoId}
              className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isAsking || !selectedRepoId}
              className="px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isAsking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="text-xs font-semibold">Ask</span>
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: RAG Execution Pipeline Explorer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col space-y-4 max-h-[750px] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              RAG Execution Trace
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Live Telemetry
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Inspect how each query travels through dense vectorization, ChromaDB similarity search, context assembly, and Gemini grounding.
        </p>

        {activeTrace ? (
          <div className="space-y-3 pt-1">
            {/* Step 1: User Query */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Query Input
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activeTrace.query.length} chars
                </span>
              </div>
              <p className="text-xs text-slate-800 font-mono mt-1 bg-white p-1.5 rounded border border-slate-200 truncate">
                &quot;{activeTrace.query}&quot;
              </p>
            </div>

            {/* Step 2: Dense Embedding */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Vector Embedding
                </span>
                <span className="text-[10px] font-mono text-emerald-600 font-bold">
                  {activeTrace.embedding_dimension || 384}-dim
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Embedded using <span className="font-mono text-slate-700">all-MiniLM-L6-v2</span> into unit-normalized dense space.
              </p>
            </div>

            {/* Step 3: ChromaDB Retrieval & Chunks */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  ChromaDB Top-K Chunks
                </span>
                <span className="text-[10px] font-bold text-sky-700">
                  {activeTrace.chunks_retrieved_count || 0} Retrieved
                </span>
              </div>

              {activeTrace.chunks && activeTrace.chunks.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  {activeTrace.chunks.map((chk, idx) => {
                    const isExpanded = expandedChunkIdx === idx;
                    const simPercent = Math.round(chk.similarity * 100);

                    return (
                      <div
                        key={idx}
                        className="p-2 bg-white rounded border border-slate-200 text-xs transition-colors"
                      >
                        <div
                          onClick={() => setExpandedChunkIdx(isExpanded ? null : idx)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="truncate pr-1">
                            <span className="font-mono font-medium text-slate-800 text-[11px]">
                              {chk.file}
                            </span>
                            <span className="text-[10px] text-purple-700 ml-1.5 font-mono">
                              {chk.symbol || 'chunk'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                              {simPercent}%
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Similarity Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-1 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, simPercent))}%` }}
                          />
                        </div>

                        {isExpanded && chk.preview && (
                          <div className="mt-2 pt-2 border-t border-slate-100 font-mono text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded overflow-x-auto whitespace-pre-wrap">
                            {chk.preview}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  No chunks matched this query.
                </p>
              )}
            </div>

            {/* Step 4: Grounded Prompt & Gemini Synthesis */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                  Gemini Grounding
                </span>
                <span className="text-[10px] font-mono text-purple-700 font-semibold">
                  {activeTrace.llm_model || 'gemini-2.5-flash'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Prompt assembled with strict zero-extrapolation instructions. Citations enforced.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs my-auto border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            Ask a question to view the live RAG retrieval trace, similarity scores, and execution steps.
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 mt-auto">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span>Strict zero-hallucination prompt active</span>
          </div>
        </div>
      </div>

      {/* Source Preview Modal / Drawer */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-5 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900 font-mono truncate">
                  {selectedSource.file}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="py-2 flex items-center gap-3 text-xs text-slate-600 border-b border-slate-100">
              <span>
                Symbol: <strong className="font-mono text-purple-700">{selectedSource.symbol || 'module'}</strong>
              </span>
              <span>
                Lines: <strong className="font-mono text-slate-700">L{selectedSource.start_line}-L{selectedSource.end_line}</strong>
              </span>
              {selectedSource.similarity && (
                <span>
                  Match: <strong className="text-emerald-700">{Math.round(selectedSource.similarity * 100)}%</strong>
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto my-3 bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap">{selectedSource.content_snippet || 'No snippet preview available.'}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
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
