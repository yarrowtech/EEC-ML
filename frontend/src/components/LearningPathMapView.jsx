import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Lock, Play, BookOpen, ChevronDown, ChevronUp, Loader2, Map } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const TIER_STYLES = {
  blue:   { ring: 'ring-blue-400',   bg: 'bg-blue-500',   light: 'bg-blue-50  border-blue-200',  label: 'Foundation',   text: 'text-blue-700' },
  orange: { ring: 'ring-orange-400', bg: 'bg-orange-500', light: 'bg-orange-50 border-orange-200', label: 'Intermediate', text: 'text-orange-700' },
  purple: { ring: 'ring-purple-400', bg: 'bg-purple-500', light: 'bg-purple-50 border-purple-200', label: 'Advanced',      text: 'text-purple-700' },
  green:  { ring: 'ring-green-400',  bg: 'bg-green-500',  light: 'bg-green-50  border-green-200',  label: 'Final',        text: 'text-green-700' },
};

const StatusIcon = ({ status }) => {
  if (status === 'done')   return <CheckCircle2 className="size-5 text-white" />;
  if (status === 'active') return <Play className="size-4 text-white" />;
  return <Lock className="size-4 text-white/60" />;
};

const PathNode = ({ node, pathId, onComplete, completing }) => {
  const tier = TIER_STYLES[node.tier] || TIER_STYLES.blue;
  const isActive = node.status === 'active';
  const isDone = node.status === 'done';
  const isLocked = node.status === 'locked';
  const isCompleting = completing === `${pathId}-${node.idx}`;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: node.idx * 0.05 }}
      className="flex flex-col items-center"
    >
      {/* Connector line above (skip for first node) */}
      {node.idx > 0 && (
        <div className={`w-0.5 h-6 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
      )}

      {/* Node card */}
      <div className={`relative w-full max-w-xs rounded-2xl border p-4 shadow-sm transition-all ${
        isDone ? 'border-emerald-200 bg-emerald-50' :
        isActive ? `${tier.light} ring-2 ${tier.ring} shadow-md` :
        'border-slate-100 bg-slate-50 opacity-60'
      }`}>
        {/* Step badge */}
        <div className={`absolute -top-3 left-4 flex h-7 w-7 items-center justify-center rounded-full shadow-sm text-xs font-black text-white ${
          isDone ? 'bg-emerald-500' : isActive ? tier.bg : 'bg-slate-300'
        }`}>
          <StatusIcon status={node.status} />
        </div>

        <div className="pl-5 mt-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${isDone ? 'text-emerald-600' : isActive ? tier.text : 'text-slate-400'}`}>
                {tier.label}{node.bloom ? ` · ${node.bloom}` : ''}
              </p>
              <p className={`text-sm font-semibold ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>{node.title}</p>
            </div>
            {isDone && (
              <span className="shrink-0 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Done</span>
            )}
          </div>

          {isActive && (
            <Motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onComplete(pathId, node.idx)}
              disabled={isCompleting}
              className={`mt-3 flex items-center gap-1.5 rounded-xl ${tier.bg} px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-60 transition-opacity`}
            >
              {isCompleting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {isCompleting ? 'Marking…' : 'Mark Complete'}
            </Motion.button>
          )}
        </div>
      </div>
    </Motion.div>
  );
};

const PathCard = ({ path, onComplete, completing }) => {
  const [expanded, setExpanded] = useState(true);
  const doneCount = path.nodes.filter((n) => n.status === 'done').length;
  const pct = path.nodes.length ? Math.round((doneCount / path.nodes.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <BookOpen className="size-5 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black text-slate-900 truncate">{path.subject}</p>
            <p className="text-xs text-slate-500">{doneCount}/{path.nodes.length} topics · {pct}% complete</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {expanded ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
        </div>
      </button>

      {/* Node map */}
      <AnimatePresence>
        {expanded && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 flex flex-col items-center gap-0 pt-2">
              {path.nodes.map((node) => (
                <PathNode
                  key={node.idx}
                  node={node}
                  pathId={path._id}
                  onComplete={onComplete}
                  completing={completing}
                />
              ))}
              {path.nodes.length === 0 && (
                <p className="text-xs text-slate-400 py-4">No topics in this path yet.</p>
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LearningPathMapView = () => {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE}/api/learning-paths/student`, {
      headers: { authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setPaths(data?.paths || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleComplete = async (pathId, nodeIdx) => {
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
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="size-6 animate-spin mr-2" />
        <span className="text-sm">Loading your learning paths…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-10 sm:p-6 space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-5 shadow-lg shadow-indigo-200/60">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Map className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Learning Path Map</h1>
            <p className="text-sm text-white/80">
              {paths.length > 0 ? `${paths.length} active subject path${paths.length !== 1 ? 's' : ''}` : 'No paths assigned yet'}
            </p>
          </div>
        </div>
      </div>

      {paths.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <Map className="mx-auto mb-3 size-12 text-slate-200" />
          <p className="font-semibold text-slate-500 text-sm">No learning paths yet</p>
          <p className="text-xs text-slate-400 mt-1">Your teacher will assign personalised learning paths for your subjects.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paths.map((path) => (
            <PathCard
              key={path._id}
              path={path}
              onComplete={handleComplete}
              completing={completing}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LearningPathMapView;
