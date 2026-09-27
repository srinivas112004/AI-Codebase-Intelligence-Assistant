import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  BotMessageSquare,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { HealthResponse } from '../types';

export const Navbar: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealth(data);
        setError(false);
      } catch {
        setError(true);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/repository', label: 'Repositories & AST', icon: FolderGit2 },
    { to: '/assistant', label: 'AI Assistant', icon: BotMessageSquare },
    { to: '/transformer-lab', label: 'Attention Lab', icon: Cpu },
    { to: '/security', label: 'Security SAST', icon: ShieldCheck },
  ];

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <NavLink to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-base">Codebase</span>
                <span className="text-gradient font-bold text-base">Intel</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider">
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block -mt-0.5">
                AST-Guided RAG &bull; PyTorch Self-Attention
              </p>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Mobile / Compact Nav for smaller screens */}
          <nav className="flex lg:hidden items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  title={link.label}
                  className={({ isActive }) =>
                    `p-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                </NavLink>
              );
            })}
          </nav>

          {/* Right Action Cluster: Health Badge & Swagger Doc Link */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* System Health Status */}
            <div className="flex items-center">
              {error ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="hidden md:inline">Backend Offline</span>
                </span>
              ) : health ? (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                  title={`FastAPI Online • Model: ${health.embedding_model} • Database: ${health.database}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline font-mono text-[11px]">API Online</span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                  <span className="hidden sm:inline">Connecting...</span>
                </span>
              )}
            </div>

            {/* Quick Ask Shortcut */}
            <NavLink
              to="/assistant"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xs hover:from-sky-600 hover:to-indigo-700 transition-all hover:shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </NavLink>

            {/* API Docs Link */}
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              title="Open FastAPI Swagger Documentation"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors hidden md:block"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};
