import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Repository } from './pages/Repository';
import { Assistant } from './pages/Assistant';
import { TransformerLab } from './pages/TransformerLab';
import { Security } from './pages/Security';
import { Terminal, Shield, Cpu, Binary, Layers } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/repository" element={<Repository />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/transformer-lab" element={<TransformerLab />} />
            <Route path="/security" element={<Security />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {/* Modern Enterprise Footer */}
        <footer className="bg-white/90 backdrop-blur-md border-t border-slate-200/80 py-6 text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white">
                <Terminal className="w-3 h-3" />
              </div>
              <span className="font-bold text-slate-800">AI Codebase Intelligence Assistant</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-500">Full-Stack AST &amp; RAG Architecture</span>
            </div>

            {/* Architecture Tech Pills */}
            <div className="flex items-center flex-wrap gap-2 text-[11px] font-mono">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                <Binary className="w-3 h-3 text-sky-600" />
                Python AST
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                <Layers className="w-3 h-3 text-violet-600" />
                ChromaDB
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                <Cpu className="w-3 h-3 text-indigo-600" />
                PyTorch Attention
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                <Shield className="w-3 h-3 text-rose-600" />
                Bandit SAST
              </span>
            </div>

            <div className="text-xs text-slate-400">
              Interactive Interview Demo &bull; Fast Local CPU Inference
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
