import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  HelpCircle,
  RefreshCw,
  FolderGit2,
  AlertCircle,
  Code2,
  Sparkles,
  CheckCircle2,
  Bug
} from 'lucide-react';
import { api } from '../services/api';
import { Repository, BanditFinding, SecurityScanResponse, ExplainResponse } from '../types';

export const Security: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId') || searchParams.get('id');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [scanResult, setScanResult] = useState<SecurityScanResponse | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state for findings table
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  // Remediation Modal State
  const [selectedFinding, setSelectedFinding] = useState<BanditFinding | null>(null);
  const [aiExplanation, setAiExplanation] = useState<ExplainResponse | null>(null);
  const [loadingAiExplain, setLoadingAiExplain] = useState(false);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  // Load repositories on mount
  useEffect(() => {
    const fetchRepos = async () => {
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
        setErrorMessage('Failed to load repositories.');
      }
    };
    fetchRepos();
  }, [repoIdParam]);

  const handleRunScan = async () => {
    if (!selectedRepoId || scanning) return;

    setScanning(true);
    setErrorMessage(null);
    setSelectedFinding(null);
    setAiExplanation(null);

    try {
      const res = await api.scanSecurity(selectedRepoId);
      setScanResult(res);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'Security scan failed.';
      setErrorMessage(errorMsg);
    } finally {
      setScanning(false);
    }
  };

  const handleInspectFinding = (finding: BanditFinding) => {
    setSelectedFinding(finding);
    setAiExplanation(null);
    setAiExplainError(null);
  };

  const handleAskAiRemediation = async () => {
    if (!selectedFinding) return;

    setLoadingAiExplain(true);
    setAiExplainError(null);

    try {
      const res = await api.explainCode({
        code: selectedFinding.code_snippet || `# ${selectedFinding.file}:${selectedFinding.line}\n# Issue: ${selectedFinding.issue_text}`,
        name: selectedFinding.test_id,
        symbol_type: 'security_vulnerability',
        context: `${selectedFinding.file} (line ${selectedFinding.line}) - ${selectedFinding.issue_text}`
      });
      setAiExplanation(res);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'Failed to query AI remediation advice.';
      setAiExplainError(errorMsg);
    } finally {
      setLoadingAiExplain(false);
    }
  };

  const findings = scanResult?.findings || [];
  const highCount = findings.filter((f) => f.issue_severity === 'HIGH').length;
  const mediumCount = findings.filter((f) => f.issue_severity === 'MEDIUM').length;
  const lowCount = findings.filter((f) => f.issue_severity === 'LOW').length;

  const filteredFindings = findings.filter((f) => {
    if (severityFilter === 'ALL') return true;
    return f.issue_severity === severityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Codebase Security Scanner</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Bandit SAST
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Static Application Security Testing for Python codebases: SQL injection, hardcoded secrets, shell injections, and insecure deserialization.
            </p>
          </div>
        </div>

        {/* Repository Selector & Scan Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
            <FolderGit2 className="w-4 h-4 text-slate-500" />
            <select
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setScanResult(null);
                setSelectedFinding(null);
              }}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {repositories.length === 0 ? (
                <option value="">No Repositories</option>
              ) : (
                repositories.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            onClick={handleRunScan}
            disabled={!selectedRepoId || scanning}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
          >
            {scanning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{scanning ? 'Scanning...' : 'Run Bandit Scan'}</span>
          </button>
        </div>
      </div>

      {/* Error notification if any */}
      {errorMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="font-bold text-amber-900 hover:text-amber-700 text-sm ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Total Findings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Findings</p>
            <h3 className="text-xl font-bold text-slate-900">{findings.length}</h3>
          </div>
        </div>

        {/* High Severity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">High Severity</p>
            <h3 className="text-xl font-bold text-slate-900">{highCount}</h3>
          </div>
        </div>

        {/* Medium Severity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Medium Severity</p>
            <h3 className="text-xl font-bold text-slate-900">{mediumCount}</h3>
          </div>
        </div>

        {/* Low Severity */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Low Severity</p>
            <h3 className="text-xl font-bold text-slate-900">{lowCount}</h3>
          </div>
        </div>
      </div>

      {/* Findings Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table Header & Filter Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Security Findings & SAST Audit</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review flagged CWE vulnerabilities, line locations, and remediation procedures.
            </p>
          </div>

          {/* Severity Filter Chips */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  severityFilter === sev
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        {scanning ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
            <p className="font-semibold text-slate-800">Executing Bandit SAST Static Analysis...</p>
            <p className="text-slate-400 mt-1">Inspecting AST nodes for injection vectors and insecure patterns.</p>
          </div>
        ) : !scanResult ? (
          <div className="p-14 text-center text-slate-400 text-xs">
            <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700">No active security scan results</p>
            <p className="text-slate-400 mt-1">Select an indexed repository and click &quot;Run Bandit Scan&quot; above.</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="p-14 text-center text-emerald-700 text-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-bold text-slate-900 text-sm">Clean Audit: No findings matching filter</p>
            <p className="text-slate-500 mt-1">No security issues of severity {severityFilter} detected by Bandit rules.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Test ID</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Vulnerability Summary</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredFindings.map((finding, idx) => {
                  let badge = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (finding.issue_severity === 'HIGH') badge = 'bg-red-50 text-red-700 border-red-200 font-bold';
                  else if (finding.issue_severity === 'MEDIUM') badge = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';

                  return (
                    <tr
                      key={idx}
                      onClick={() => handleInspectFinding(finding)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${badge}`}>
                          {finding.issue_severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {finding.test_id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{finding.file}</span>
                          <span className="text-slate-400 font-normal">:{finding.line}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-md truncate">
                        {finding.issue_text}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectFinding(finding);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                        >
                          Remediation
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Security Remediation Drawer / Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedFinding.remediation_title || `Security Finding: ${selectedFinding.test_id}`}
                    </h3>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
                      {selectedFinding.issue_severity}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {selectedFinding.file} (line {selectedFinding.line})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs leading-relaxed">
              {/* Finding Description */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Issue Summary:
                </span>
                <p className="text-slate-800 font-medium">{selectedFinding.issue_text}</p>
              </div>

              {/* Code Snippet */}
              {selectedFinding.code_snippet && (
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Flagged Code Snippet:
                  </span>
                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto border border-slate-800">
                    <pre className="whitespace-pre">{selectedFinding.code_snippet}</pre>
                  </div>
                </div>
              )}

              {/* Security Risk & Mitigation */}
              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Security Risk Analysis
                </div>
                <p className="text-slate-700">
                  {selectedFinding.remediation_risk ||
                    'This pattern represents an insecure coding practice that could allow unauthorized execution, credential leakage, or data tampering.'}
                </p>
              </div>

              {/* Recommended Fix */}
              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Recommended Fix
                </div>
                <p className="text-slate-700 font-mono text-[11px]">
                  {selectedFinding.remediation_fix ||
                    'Refactor this code to use parameterized inputs, secure cryptographic algorithms, or environment-based configuration.'}
                </p>
              </div>

              {/* AI Deep Remediation Walkthrough */}
              {aiExplanation ? (
                <div className="p-3.5 rounded-lg border border-purple-200 bg-purple-50/40 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-purple-900">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    AI Architectural Remediation Advice
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {aiExplanation.logic || aiExplanation.full_markdown}
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={handleAskAiRemediation}
                    disabled={loadingAiExplain}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition-colors"
                  >
                    {loadingAiExplain ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Ask Gemini for In-Depth Fix Walkthrough</span>
                  </button>
                  {aiExplainError && (
                    <p className="text-[11px] text-amber-700 mt-1 italic">{aiExplainError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedFinding(null)}
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
