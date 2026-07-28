import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { AlertCircle, BookOpen, RefreshCw, TrendingDown, Brain } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const ErrorAnalysisView = ({ onAskMisconception }) => {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_BASE}/api/practice/error-analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setClusters(data.data || []);
    } catch {
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Error Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">Topics where you make the most mistakes — click to review</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-200 animate-pulse" />)}
        </div>
      ) : clusters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
            <Brain className="size-8 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-slate-700">No errors yet — great start!</p>
          <p className="mt-1 text-sm text-slate-500 max-w-xs">Complete some practice questions and your mistake patterns will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster, i) => {
            const isOpen = expanded === i;
            const barWidth = Math.min(100, (cluster.errorCount / (clusters[0]?.errorCount || 1)) * 100);
            return (
              <Motion.div
                key={`${cluster.subject}-${cluster.topicTitle}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                    <TrendingDown className="size-5 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{cluster.topicTitle}</p>
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                        {cluster.errorCount} mistake{cluster.errorCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{cluster.subject}{cluster.chapterTitle ? ` · ${cluster.chapterTitle}` : ''}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <Motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-full bg-rose-400"
                      />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <Motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 px-5 pb-4 pt-3 space-y-3"
                  >
                    {cluster.questions.map((q, qi) => (
                      <div key={qi} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-xs font-semibold text-slate-700">{q.question}</p>
                        <p className="text-xs text-emerald-700 mt-1 font-semibold">✓ {q.correctAnswer}</p>
                        {onAskMisconception && (
                          <button
                            type="button"
                            onClick={() => onAskMisconception(q.question, '', q.correctAnswer)}
                            className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                          >
                            Explain why I got this wrong
                          </button>
                        )}
                      </div>
                    ))}
                  </Motion.div>
                )}
              </Motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ErrorAnalysisView;
