import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  RefreshCw,
  Info,
  HelpCircle,
  Binary,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { AttentionResponse } from '../types';

export const TransformerLab: React.FC = () => {
  const [inputText, setInputText] = useState('The cat sat on the mat');
  const [attentionData, setAttentionData] = useState<AttentionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hover state for interactive heatmap cell
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
    queryToken: string;
    keyToken: string;
    weight: number;
    rawScore?: number;
  } | null>(null);

  // Selected tab for matrix inspection
  const [matrixTab, setMatrixTab] = useState<'weights' | 'raw' | 'qkv'>('weights');

  const handleCompute = async (overrideText?: string) => {
    const textToRun = (overrideText || inputText).trim();
    if (!textToRun || loading) return;

    setLoading(true);
    setErrorMessage(null);
    setHoveredCell(null);

    try {
      const res = await api.computeAttention({ text: textToRun });
      setAttentionData(res);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error).message ||
        'Failed to compute self-attention.';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Run initial calculation on mount
  useEffect(() => {
    handleCompute();
  }, []);

  const tokens = attentionData?.tokens || [];
  const weights = attentionData?.attention_weights || [];
  const rawScores = attentionData?.raw_scores || [];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Transformer Self-Attention Laboratory
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Pure PyTorch Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Educational deep dive into Tokenization, Linear Projections ($Q, K, V$), Scaled Dot-Products, and 2D Softmax Attention Weights.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Projection Dimensions
            </span>
            <span className="font-mono text-xs font-semibold text-slate-700">
              d_model = 64 &bull; d_k = 64
            </span>
          </div>
        </div>

        {/* Theoretical Equation Card */}
        <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Core Scaled Dot-Product Formulation:
            </span>
            <div className="text-base font-mono font-bold text-indigo-700 mt-1">
              Attention(Q, K, V) = softmax( (Q &middot; Kᵀ) / &radic;d_k ) &middot; V
            </div>
          </div>
          <div className="text-xs text-slate-600 max-w-md leading-relaxed">
            Calculates pairwise compatibility between all tokens in a sequence. Scaling by <span className="font-mono font-medium text-slate-800">1/&radic;64 = 0.125</span> prevents inner products from growing excessively large, avoiding vanishing gradients in softmax.
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Input Sentence or Code Statement
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCompute();
            }}
            placeholder="Enter a sentence or code snippet..."
            className="flex-1 px-4 py-2.5 text-xs font-medium border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          <button
            onClick={() => handleCompute()}
            disabled={!inputText.trim() || loading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Compute Attention</span>
          </button>
        </div>

        {/* Quick Example Chips */}
        <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto pt-1">
          <span className="font-semibold text-slate-700 flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Presets:
          </span>
          {[
            'The cat sat on the mat',
            'def authenticate(user, password):',
            'Bank of the river bank',
            'return jwt.encode(payload, secret)',
          ].map((sample) => (
            <button
              key={sample}
              onClick={() => {
                setInputText(sample);
                handleCompute(sample);
              }}
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 rounded-md border border-slate-200 font-mono text-[11px] whitespace-nowrap transition-colors"
            >
              {sample}
            </button>
          ))}
        </div>

        {/* Error notification if any */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Main Educational Visualizer */}
      {attentionData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Heatmap & Tokens */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col space-y-6">
            {/* Tokens Ribbon */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5 text-indigo-600" />
                  Tokenized Sequence ({tokens.length} tokens):
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Vocabulary: 30,522 (WordPiece)
                </span>
              </div>

              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {tokens.map((tok, idx) => {
                  const isQueryActive = hoveredCell?.row === idx;
                  const isKeyActive = hoveredCell?.col === idx;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-all ${
                        isQueryActive && isKeyActive
                          ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold shadow-2xs'
                          : isQueryActive
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-900 font-bold'
                          : isKeyActive
                          ? 'bg-sky-100 border-sky-400 text-sky-900 font-bold'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-sans">#{idx}</span>
                      <span>{tok}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        {attentionData.token_ids[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matrix View Switcher & 2D Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMatrixTab('weights')}
                    className={`text-xs font-bold pb-1 border-b-2 transition-colors ${
                      matrixTab === 'weights'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Attention Weights Matrix A &isin; ℝ^(N&times;N)
                  </button>
                  <button
                    onClick={() => setMatrixTab('raw')}
                    className={`text-xs font-bold pb-1 border-b-2 transition-colors ${
                      matrixTab === 'raw'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Raw Dot-Products (Q &middot; Kᵀ)
                  </button>
                  <button
                    onClick={() => setMatrixTab('qkv')}
                    className={`text-xs font-bold pb-1 border-b-2 transition-colors ${
                      matrixTab === 'qkv'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Q, K, V Tensor Projections
                  </button>
                </div>
              </div>

              {/* Heatmap Matrix Display */}
              {matrixTab === 'weights' || matrixTab === 'raw' ? (
                <div className="overflow-x-auto p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="inline-block min-w-full">
                    {/* Top Column Key Labels */}
                    <div className="flex">
                      <div className="w-24 flex-shrink-0 text-right pr-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider self-end pb-2">
                        Query \ Key &rarr;
                      </div>
                      <div className="flex gap-1.5 pb-2">
                        {tokens.map((tok, cIdx) => (
                          <div
                            key={cIdx}
                            className={`w-14 text-center font-mono text-[10px] truncate ${
                              hoveredCell?.col === cIdx
                                ? 'text-sky-700 font-bold'
                                : 'text-slate-600'
                            }`}
                            title={tok}
                          >
                            {tok}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Matrix Rows */}
                    <div className="space-y-1.5">
                      {weights.map((rowWeights, rIdx) => {
                        const queryToken = tokens[rIdx];
                        const rowSum = rowWeights.reduce((a, b) => a + b, 0);

                        return (
                          <div key={rIdx} className="flex items-center">
                            {/* Left Row Query Label */}
                            <div
                              className={`w-24 flex-shrink-0 text-right pr-3 font-mono text-[11px] truncate ${
                                hoveredCell?.row === rIdx
                                  ? 'text-indigo-700 font-bold'
                                  : 'text-slate-700'
                              }`}
                              title={queryToken}
                            >
                              {queryToken}
                            </div>

                            {/* Cells in Row */}
                            <div className="flex gap-1.5">
                              {rowWeights.map((w, cIdx) => {
                                const keyToken = tokens[cIdx];
                                const rawScore = rawScores[rIdx]?.[cIdx];
                                const isCurrent =
                                  hoveredCell?.row === rIdx && hoveredCell?.col === cIdx;

                                // Background color intensity
                                const bgStyle =
                                  matrixTab === 'weights'
                                    ? {
                                        backgroundColor: `rgba(79, 70, 229, ${Math.max(
                                          0.06,
                                          w
                                        )})`,
                                        color: w > 0.4 ? '#ffffff' : '#1e1b4b',
                                      }
                                    : {
                                        backgroundColor: '#ffffff',
                                      };

                                return (
                                  <div
                                    key={cIdx}
                                    onMouseEnter={() =>
                                      setHoveredCell({
                                        row: rIdx,
                                        col: cIdx,
                                        queryToken,
                                        keyToken,
                                        weight: w,
                                        rawScore,
                                      })
                                    }
                                    onMouseLeave={() => setHoveredCell(null)}
                                    style={bgStyle}
                                    className={`w-14 h-11 flex items-center justify-center font-mono text-[10px] rounded border transition-all cursor-pointer select-none ${
                                      isCurrent
                                        ? 'ring-2 ring-amber-400 border-amber-500 scale-105 z-10 font-bold'
                                        : 'border-slate-200/80 hover:border-indigo-400'
                                    }`}
                                  >
                                    {matrixTab === 'weights' ? (
                                      <span>{(w * 100).toFixed(1)}%</span>
                                    ) : (
                                      <span className="text-slate-700 text-[10px]">
                                        {rawScore?.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Row Sum Verification */}
                            {matrixTab === 'weights' && (
                              <div
                                className="ml-3 text-[10px] font-mono text-slate-400"
                                title="Softmax guarantee: Every row sums to 1.0"
                              >
                                &Sigma;={rowSum.toFixed(2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Q, K, V Tensor Projections Tab */
                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs overflow-x-auto">
                  <p className="text-xs text-slate-600 font-sans leading-relaxed mb-3">
                    Each token vector is projected into Query (Q), Key (K), and Value (V) representations in ℝ^(d_k) via learned linear layers (W_q, W_k, W_v). Below are the first 6 dimensions of each vector:
                  </p>

                  <div className="space-y-2">
                    {tokens.map((tok, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded border border-slate-200">
                        <div className="font-bold text-slate-800 text-[11px] mb-1">
                          Token #{idx}: &quot;{tok}&quot;
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                          <div className="p-1.5 rounded bg-indigo-50/70 border border-indigo-100 text-indigo-900">
                            <span className="font-bold">Q[{idx}]: </span>
                            [{attentionData.q_snippet?.[idx]?.join(', ')}...]
                          </div>
                          <div className="p-1.5 rounded bg-sky-50/70 border border-sky-100 text-sky-900">
                            <span className="font-bold">K[{idx}]: </span>
                            [{attentionData.k_snippet?.[idx]?.join(', ')}...]
                          </div>
                          <div className="p-1.5 rounded bg-purple-50/70 border border-purple-100 text-purple-900">
                            <span className="font-bold">V[{idx}]: </span>
                            [{attentionData.v_snippet?.[idx]?.join(', ')}...]
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Cell Inspector Card */}
            <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                  Interactive Attention Pair Inspector
                </h4>
              </div>

              {hoveredCell ? (
                <div className="space-y-1 text-xs text-slate-700 leading-relaxed mt-2">
                  <p>
                    Query Token: <strong className="font-mono text-indigo-700">&quot;{hoveredCell.queryToken}&quot;</strong> (row #{hoveredCell.row})
                  </p>
                  <p>
                    Key Token: <strong className="font-mono text-sky-700">&quot;{hoveredCell.keyToken}&quot;</strong> (column #{hoveredCell.col})
                  </p>
                  <div className="flex items-center gap-4 pt-1">
                    <span className="font-mono text-xs">
                      Weight: <strong className="text-indigo-800">{(hoveredCell.weight * 100).toFixed(2)}%</strong> ({hoveredCell.weight.toFixed(4)})
                    </span>
                    {hoveredCell.rawScore !== undefined && (
                      <span className="font-mono text-xs text-slate-500">
                        Raw Dot-Product Score: <strong>{hoveredCell.rawScore.toFixed(3)}</strong>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    When contextualizing &quot;{hoveredCell.queryToken}&quot;, the model allocates {(hoveredCell.weight * 100).toFixed(1)}% of its attention capacity to &quot;{hoveredCell.keyToken}&quot;.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic mt-1">
                  Hover over any cell in the heatmap matrix above to inspect its exact mathematical attention weight and dot-product compatibility score.
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Mathematical Steps & Interview Guide */}
          <div className="space-y-5">
            {/* Step-by-Step Educational Cards */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Step-by-Step Mechanism
                </h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                {/* Step 1 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Token Embedding X
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Each token ID is mapped into dense vector space X &isin; ℝ^(N &times; d_model).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Linear Projections: Q, K, V
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Q = X &middot; W_q, K = X &middot; W_k, V = X &middot; W_v. Each token gains independent query, key, and value vectors in ℝ^(d_k).
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                    Scaled Dot-Product
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Scores = (Q &middot; Kᵀ) / &radic;d_k. Compares all token pairs and divides by &radic;64 = 8 to scale variance to 1.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">4</span>
                    Softmax Normalization
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    A = softmax(Scores, dim=-1). Every row sums to 1.0, creating probability distributions across keys.
                  </p>
                </div>
              </div>
            </div>

            {/* Interview Talking Points Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                Key Interview Talking Points
              </div>

              <div className="space-y-2.5 text-xs text-slate-700">
                <details className="group border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 cursor-pointer">
                  <summary className="font-semibold text-slate-900 list-none flex items-center justify-between text-[11px]">
                    Why divide by &radic;d_k in self-attention?
                    <span className="text-indigo-600 group-open:rotate-180 transition-transform">&darr;</span>
                  </summary>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2">
                    Under the assumption that components of q and k are independent random variables with mean 0 and variance 1, their dot product has variance d_k. For large dimensions, dot products grow huge in magnitude, pushing softmax into flat regions with tiny gradients (&approx; 0). Dividing by &radic;d_k normalizes the variance back to 1.
                  </p>
                </details>

                <details className="group border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 cursor-pointer">
                  <summary className="font-semibold text-slate-900 list-none flex items-center justify-between text-[11px]">
                    Why does self-attention scale with O(N²)?
                    <span className="text-indigo-600 group-open:rotate-180 transition-transform">&darr;</span>
                  </summary>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2">
                    Multiplying the Query matrix (N &times; d_k) by the transpose of the Key matrix (d_k &times; N) computes pairwise compatibility between every token and every other token, producing an N &times; N matrix requiring O(N² &middot; d_k) floating-point operations.
                  </p>
                </details>

                <details className="group border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 cursor-pointer">
                  <summary className="font-semibold text-slate-900 list-none flex items-center justify-between text-[11px]">
                    Self-Attention vs. Cross-Attention?
                    <span className="text-indigo-600 group-open:rotate-180 transition-transform">&darr;</span>
                  </summary>
                  <p className="mt-2 text-[11px] text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2">
                    In <strong>Self-Attention</strong>, Q, K, V all originate from the same input sequence. In <strong>Cross-Attention</strong>, Q comes from the decoder sequence, while K and V come from the encoder sequence (e.g. machine translation or multimodal models).
                  </p>
                </details>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
