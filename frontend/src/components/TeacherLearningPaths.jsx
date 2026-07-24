import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Brain, CheckCircle, Lock, Play, RefreshCw, Trophy } from 'lucide-react';
import { parseJwtPayload } from '../utils/authSession';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const tierColors = {
  blue: { bar: '#60a5fa', badge: 'bg-blue-100 text-blue-700' },
  orange: { bar: '#f97316', badge: 'bg-orange-100 text-orange-700' },
  purple: { bar: '#a855f7', badge: 'bg-purple-100 text-purple-700' },
  green: { bar: '#22c55e', badge: 'bg-green-100 text-green-700' },
};

const tierLabel = { blue: 'Foundation', orange: 'Intermediate', purple: 'Advanced', green: 'Final' };

const TeacherLearningPaths = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [expandedPath, setExpandedPath] = useState(null);

  const getStudentId = () => {
    const token = localStorage.getItem('token');
    const payload = parseJwtPayload(token);
    return payload?.id || payload?.userId || null;
  };

  const fetchPaths = async () => {
    const studentId = getStudentId();
    if (!studentId) { setLoading(false); return; }
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/learning-paths/student`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPaths(data.paths || []);
        if (data.paths?.length) setExpandedPath(data.paths[0].subject);
      } else {
        setError('Could not load your learning paths.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPaths(); }, []);

  const completeNode = async (pathId, subject, nodeIdx) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setCompleting(`${pathId}-${nodeIdx}`);
    try {
      const res = await fetch(`${API_BASE}/api/learning-paths/student/${pathId}/node`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ nodeIdx }),
      });
      if (res.ok) {
        const data = await res.json();
        setPaths((prev) =>
          prev.map((p) => {
            if (String(p._id) !== String(pathId)) return p;
            const nodes = p.nodes.map((n, i) => {
              if (i === nodeIdx) return { ...n, status: 'done' };
              if (i === nodeIdx + 1 && n.status === 'locked') return { ...n, status: 'active' };
              return n;
            });
            return { ...p, nodes, progress: data.progress ?? p.progress };
          })
        );
      }
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Brain className="size-10 animate-pulse text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={fetchPaths} className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  if (!paths.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E7E3D9] bg-[#FBF9F4] px-6 py-14 text-center">
        <Brain className="mx-auto mb-3 size-12 text-[#C4BFAF]" />
        <p className="text-lg font-bold text-[#26332E]">No learning paths yet</p>
        <p className="mt-1 text-sm text-[#78827B]">Your teacher hasn't published a personalised learning path for you yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paths.map((path) => {
        const isOpen = expandedPath === path.subject;
        const done = (path.nodes || []).filter((n) => n.status === 'done').length;
        const total = (path.nodes || []).length;
        const pct = total ? Math.round((done / total) * 100) : 0;

        return (
          <Motion.div
            key={path.subject}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-[#E7E3D9] bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setExpandedPath(isOpen ? null : path.subject)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <Brain className="size-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#26332E]">{path.subject}{path.focus && path.focus !== path.subject ? ` · ${path.focus}` : ''}</p>
                <p className="text-xs text-[#78827B]">
                  From {path.teacherName || 'your teacher'} · {path.pace || ''}
                  {path.cls ? ` · Class ${path.cls}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#26332E]">{pct}%</p>
                  <p className="text-xs text-[#78827B]">{done}/{total} done</p>
                </div>
                <div className="relative size-10">
                  <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#F5F0E8" strokeWidth="4" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke="#F59E0B" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${pct * 0.879} 87.9`}
                    />
                  </svg>
                  {pct === 100 && (
                    <Trophy className="absolute inset-0 m-auto size-4 text-amber-500" />
                  )}
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <Motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[#F0EBE0] px-5 pb-5 pt-4">
                    {path.notes && (
                      <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <span className="font-semibold">Teacher note: </span>{path.notes}
                      </div>
                    )}
                    <div className="space-y-3">
                      {(path.nodes || []).map((node, idx) => {
                        const isDone = node.status === 'done';
                        const isActive = node.status === 'active';
                        const isLocked = node.status === 'locked';
                        const key = `${path._id}-${idx}`;
                        const colors = tierColors[node.tier] || tierColors.blue;

                        return (
                          <Motion.div
                            key={node.title}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`flex gap-3 rounded-xl border p-4 transition ${
                              isDone
                                ? 'border-green-100 bg-green-50'
                                : isActive
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-[#F0EBE0] bg-[#FAFAF8] opacity-60'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <Motion.div
                                animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                                transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                                  isDone
                                    ? 'bg-green-500 text-white'
                                    : isActive
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-[#E7E3D9] text-[#78827B]'
                                }`}
                              >
                                {isDone ? <CheckCircle className="size-4" /> : isLocked ? <Lock className="size-3.5" /> : node.idx + 1}
                              </Motion.div>
                              {idx < (path.nodes.length - 1) && (
                                <div className={`w-0.5 flex-1 rounded-full ${isDone ? 'bg-green-300' : 'bg-[#E7E3D9]'}`} style={{ minHeight: 16 }} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-bold text-[#26332E]">{node.title}</p>
                                {node.tier && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.badge}`}>
                                    {tierLabel[node.tier] || node.tier}
                                  </span>
                                )}
                                {node.bloom && (
                                  <span className="rounded-full bg-[#F0EBE0] px-2 py-0.5 text-[10px] font-semibold text-[#5c655f]">
                                    Bloom: {node.bloom}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-[#78827B]">
                                {isDone
                                  ? 'Mastered ✓'
                                  : isActive
                                    ? 'In progress — work through this step now'
                                    : `Unlocks after step ${idx}`}
                              </p>
                              {isActive && (
                                <Motion.button
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  type="button"
                                  onClick={() => completeNode(path._id, path.subject, idx)}
                                  disabled={completing === key}
                                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                                >
                                  {completing === key ? (
                                    <RefreshCw className="size-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="size-4" />
                                  )}
                                  Mark as complete
                                </Motion.button>
                              )}
                            </div>
                          </Motion.div>
                        );
                      })}
                    </div>
                    {pct === 100 && (
                      <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <Trophy className="size-6 text-amber-500" />
                        <div>
                          <p className="font-bold text-amber-800">Path complete!</p>
                          <p className="text-xs text-amber-700">You've finished the entire learning path. Great work!</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>
          </Motion.div>
        );
      })}
    </div>
  );
};

export default TeacherLearningPaths;
