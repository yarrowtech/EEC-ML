import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, RefreshCw, Brain, BookOpen, Repeat2, Zap, Leaf } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const TYPE_META = {
  spaced_repetition: { icon: Repeat2,  color: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  weak_topic:        { icon: Brain,     color: 'bg-rose-100 text-rose-700',     border: 'border-rose-200'   },
  level_up:          { icon: Zap,       color: 'bg-amber-100 text-amber-700',   border: 'border-amber-200'  },
  new_topic:         { icon: Leaf,      color: 'bg-emerald-100 text-emerald-700',border: 'border-emerald-200'},
};

const RecommendationWidget = ({ onStartTutor }) => {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_BASE}/api/recommendations/student`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setItems(data.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-4 text-indigo-400" />
        <p className="text-sm font-bold text-slate-700">Recommended for You</p>
      </div>
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
      </div>
    </div>
  );

  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
            <Sparkles className="size-4 text-indigo-500" />
          </div>
          <p className="text-sm font-bold text-slate-800">Recommended for You</p>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-slate-600 transition-colors">
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {items.map((item, i) => {
            const meta = TYPE_META[item.type] || TYPE_META.new_topic;
            const Icon = meta.icon;
            return (
              <Motion.button
                key={`${item.subject}-${item.topicId}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => onStartTutor?.({
                  subject: item.subject,
                  topic:   item.topicTitle,
                  mode:    item.action,
                  difficulty: item.difficulty,
                })}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${meta.border} ${meta.color.replace('text-', 'hover:bg-').replace('-700','-50')} bg-white`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{item.label} — {item.topicTitle || item.subject}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.reason}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RecommendationWidget;
