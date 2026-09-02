import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Heart,
  BookOpen,
  X,
  ChevronRight,
  Loader2,
  BarChart2,
  Activity,
  AlertTriangle,
  Calendar,
  Smile,
  Frown,
  Meh,
  Brain,
  Target,
  Users,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  MessageSquare,
  Zap,
  Info,
} from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { parentApiJson } from './parentApi';
import AnalyticsPureWhiteDashboard from './AnalyticsPureWhiteDashboard';

// ── helpers ──────────────────────────────────────────────────────────────────
const moodIcon = (rating) => {
  if (!rating) return <Meh size={14} className="text-slate-400" />;
  if (rating >= 4) return <Smile size={14} className="text-emerald-500" />;
  if (rating <= 2) return <Frown size={14} className="text-red-500" />;
  return <Meh size={14} className="text-amber-500" />;
};

const concernColor = {
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-600' },
};

const scoreColor = (s) => {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
};

const scoreLabel = (s) => {
  if (s == null) return '–';
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Average';
  return 'Needs Work';
};

const PIE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ── Student selector ──────────────────────────────────────────────────────────
const StudentPill = ({ students, selectedId, onSelect }) => (
  <div className="flex flex-wrap gap-2">
    {students.map((s) => (
      <button
        key={s._id}
        onClick={() => onSelect(s._id)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
          selectedId === s._id
            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200'
            : 'bg-white/70 text-slate-600 border-white/80 hover:border-purple-300 hover:text-purple-600 backdrop-blur-sm'
        }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${selectedId === s._id ? 'bg-white/20' : 'bg-purple-100 text-purple-700'}`}>
          {s.name?.[0]?.toUpperCase() || 'S'}
        </div>
        {s.name}
        {s.grade && <span className="opacity-70">· Gr {s.grade}</span>}
      </button>
    ))}
  </div>
);

// ── Score ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 80, stroke = 7, color, label = 'Score' }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(Math.max(score, 0), 100) : 0;
  const offset = circ - (pct / 100) * circ;
  const c = color || scoreColor(score);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={score != null ? Math.round(pct) : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={score != null ? `${label}: ${Math.round(pct)}%` : `${label}: no data`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={c} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-black text-slate-800">{score != null ? `${score}%` : '–'}</span>
    </div>
  );
};

// ── MiniBar ───────────────────────────────────────────────────────────────────
const MiniBar = ({ value, max = 100, color, label = 'Progress' }) => {
  const pct = Math.min((Number(value || 0) / max) * 100, 100);
  return (
    <div
      className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
      role="progressbar"
      aria-valuenow={Math.round(Number(value || 0))}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color || scoreColor(value) }}
      />
    </div>
  );
};

// ── Academic Detail Sidebar ───────────────────────────────────────────────────
const AcademicSidebar = ({ data, onClose }) => {
  if (!data) return null;
  const { subjectBreakdown = [], examTrend = [], monthlyAttendance = [], overallMastery, attendanceSummary } = data;

  const radarData = subjectBreakdown.slice(0, 7).map((s) => ({ subject: s.subject.slice(0, 10), score: s.avg }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <BookOpen size={16} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Growth Analytics</p>
              <h2 className="text-base font-black">Academic Performance</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{overallMastery != null ? `${overallMastery}%` : '–'}</p>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Overall Mastery</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{attendanceSummary?.attendancePct != null ? `${attendanceSummary.attendancePct}%` : '–'}</p>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Attendance</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{examTrend.length}</p>
            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Exams Taken</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Subject Radar */}
        {radarData.length > 1 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Subject Radar</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Subject radar chart comparing average scores across ${radarData.map((s) => `${s.subject} ${s.score}%`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Subject Breakdown */}
        {subjectBreakdown.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Subject Breakdown</h3>
            <div className="space-y-2">
              {subjectBreakdown.map((s) => (
                <div key={s.subject} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{s.subject}</p>
                      <p className="text-[10px] text-slate-400">{s.topicCount} topic{s.topicCount !== 1 ? 's' : ''} tracked</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color: scoreColor(s.avg) }}>{s.avg}%</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: scoreColor(s.avg) + '20', color: scoreColor(s.avg) }}>
                        {scoreLabel(s.avg)}
                      </span>
                    </div>
                  </div>
                  <MiniBar value={s.avg} />
                  {/* Weakest topics */}
                  {s.topics.slice(0, 2).map((t, i) => (
                    t.score < 60 && (
                      <div key={i} className="mt-1.5 flex items-center gap-1.5">
                        <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />
                        <p className="text-[10px] text-amber-700 truncate">{t.title} · {t.score}%</p>
                      </div>
                    )
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Exam Trend Chart */}
        {examTrend.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Exam Score Trend</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Line chart of exam scores over time: ${examTrend.map((e) => `${e.subject} ${e.percentage}%`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={examTrend} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(v, n, p) => [`${p.payload.marks}/${p.payload.total || 100} (${v}%)`, p.payload.title]}
                  />
                  <Line type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Exam list */}
            <div className="space-y-1.5 mt-3">
              {examTrend.slice(-5).reverse().map((e, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{e.title}</p>
                    <p className="text-[10px] text-slate-400">{e.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-black" style={{ color: scoreColor(e.percentage) }}>
                      {e.marks}/{e.total || 100}
                    </span>
                    {e.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">{e.grade}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Attendance Trend */}
        {monthlyAttendance.some((m) => m.total > 0) && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Monthly Attendance</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Bar chart of monthly attendance percentage: ${monthlyAttendance.filter((m) => m.total > 0).map((m) => `${m.label} ${m.pct}%`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={monthlyAttendance} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(v) => [`${v}%`, 'Attendance']} />
                  <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                    {monthlyAttendance.map((m, i) => (
                      <Cell key={i} fill={scoreColor(m.pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// ── Wellbeing Detail Sidebar ──────────────────────────────────────────────────
const WellbeingSidebar = ({ data, onClose }) => {
  if (!data) return null;
  const { concernCounts = {}, categoryBreakdown = [], moodTrend = [], monthlyObservations = [], recentObservations = [], totalObservations, avgMood } = data;

  const concernPieData = Object.entries(concernCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const CONCERN_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#f97316', Urgent: '#ef4444' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-br from-rose-500 to-pink-600 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Heart size={16} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-rose-200">Growth Analytics</p>
              <h2 className="text-base font-black">Emotional Wellbeing</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{totalObservations || 0}</p>
            <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider">Observations</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{avgMood != null ? avgMood : '–'}<span className="text-sm">/5</span></p>
            <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider">Avg Mood</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{concernCounts.high + concernCounts.urgent || 0}</p>
            <p className="text-[10px] font-bold text-rose-200 uppercase tracking-wider">High Concern</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Mood Trend Line */}
        {moodTrend.length > 1 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Mood Over Time</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Line chart of mood rating (1 to 5) over ${moodTrend.length} recent check-ins`}
            >
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={moodTrend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    formatter={(v) => [v, 'Mood Rating']}
                  />
                  <Line type="monotone" dataKey="mood" stroke="#f43f5e" strokeWidth={2.5}
                    dot={({ cx, cy, payload }) => (
                      <circle key={cx} cx={cx} cy={cy} r={4}
                        fill={payload.mood >= 4 ? '#10b981' : payload.mood <= 2 ? '#ef4444' : '#f59e0b'}
                        stroke="#fff" strokeWidth={2} />
                    )}
                    activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2">
                {[{ label: 'Happy', color: '#10b981' }, { label: 'Neutral', color: '#f59e0b' }, { label: 'Upset', color: '#ef4444' }].map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px] text-slate-500 font-semibold">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Concern Level Distribution */}
        {concernPieData.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Concern Level Distribution</h3>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div
                  className="shrink-0"
                  role="img"
                  aria-label={`Pie chart of concern levels: ${concernPieData.map((e) => `${e.name} ${e.value}`).join(', ')}`}
                >
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={concernPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3}>
                      {concernPieData.map((entry) => (
                        <Cell key={entry.name} fill={CONCERN_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {concernPieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: CONCERN_COLORS[entry.name] || '#94a3b8' }} />
                        <span className="text-xs font-semibold text-slate-600">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Observation Categories</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Bar chart of observation counts by category: ${categoryBreakdown.map((c) => `${c.name} ${c.count}`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={Math.min(categoryBreakdown.length * 32, 180)}>
                <BarChart layout="vertical" data={categoryBreakdown} margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Monthly Activity */}
        {monthlyObservations.some((m) => m.count > 0) && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Monthly Activity</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Monthly observation activity: ${monthlyObservations.map((m) => `${m.label} ${m.count}`).join(', ')}`}
            >
              <div className="flex items-end gap-2 h-20">
                {monthlyObservations.map((m, i) => {
                  const max = Math.max(...monthlyObservations.map((x) => x.count), 1);
                  const h = Math.max((m.count / max) * 100, 4);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-500 font-bold">{m.count || ''}</span>
                      <div className="w-full rounded-t-lg transition-all duration-700" style={{ height: `${h}%`, background: '#f43f5e', opacity: 0.7 + i * 0.05 }} />
                      <span className="text-[9px] text-slate-400 font-semibold">{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Recent Observations Feed */}
        {recentObservations.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Recent Observations</h3>
            <div className="space-y-2">
              {recentObservations.map((o, i) => {
                const lvl = String(o.concernLevel || 'low').toLowerCase();
                const c = concernColor[lvl] || concernColor.low;
                return (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {moodIcon(o.moodRating)}
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {new Date(o.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {o.category && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{o.category}</span>
                        )}
                        {o.concernLevel && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                            {o.concernLevel}
                          </span>
                        )}
                        {o.followUpRequired && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Follow-up</span>
                        )}
                      </div>
                    </div>
                    {o.text && <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{o.text}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {totalObservations === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Heart size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No observations recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Skills Sidebar ────────────────────────────────────────────────────────────
const DOMAIN_ICONS = {
  Brain: Brain,
  Target: Target,
  MessageSquare: MessageSquare,
  Users: Users,
  Activity: Activity,
};

const SkillsSidebar = ({ data, onClose }) => {
  const [expandedDomain, setExpandedDomain] = useState(null);

  if (!data) return null;
  const { domains = [], overallSkillScore, dataPoints = {} } = data;

  const radarData = domains.map((d) => ({
    domain: d.name.split(' ')[0], // first word for brevity
    score: d.score ?? 0,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-br from-amber-500 to-orange-500 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-100">Growth Analytics</p>
              <h2 className="text-base font-black">Skill Development</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{overallSkillScore != null ? `${overallSkillScore}%` : '–'}</p>
            <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Overall Score</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">22</p>
            <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Skills Tracked</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xl font-black">{domains.length}</p>
            <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">Domains</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Data source note */}
        <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
          <Info size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
            Skill scores are analytically derived from academic mastery ({dataPoints.masteryAvg != null ? `${dataPoints.masteryAvg}%` : 'N/A'}), exam performance ({dataPoints.examAvg != null ? `${dataPoints.examAvg}%` : 'N/A'}), attendance ({dataPoints.attendancePct != null ? `${dataPoints.attendancePct}%` : 'N/A'}) and teacher observations.
          </p>
        </div>

        {/* Domain Radar */}
        {radarData.length > 0 && (
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Domain Overview</h3>
            <div
              className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              role="img"
              aria-label={`Radar chart of skill-domain scores: ${radarData.map((d) => `${d.domain} ${d.score}%`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={210}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#fde68a" />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 10, fill: '#92400e', fontWeight: 700 }} />
                  <Radar name="Score" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} strokeWidth={2.5} dot={{ r: 4, fill: '#f59e0b' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Domain scores overview bar chart */}
        <section>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Domain Scores</h3>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="space-y-3">
              {domains.map((d) => {
                const DomainIcon = DOMAIN_ICONS[d.icon] || Brain;
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: d.color + '20' }}>
                          <DomainIcon size={11} style={{ color: d.color }} />
                        </div>
                        <p className="text-xs font-bold text-slate-700">{d.name}</p>
                      </div>
                      <span className="text-xs font-black" style={{ color: d.score != null ? d.color : '#94a3b8' }}>
                        {d.score != null ? `${d.score}%` : '–'}
                      </span>
                    </div>
                    <div
                      className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={d.score ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${d.name} score`}
                    >
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${d.score ?? 0}%`, background: d.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Skill breakdown per domain */}
        <section>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">All 22 Skills</h3>
          <div className="space-y-3">
            {domains.map((d) => {
              const DomainIcon = DOMAIN_ICONS[d.icon] || Brain;
              const isOpen = expandedDomain === d.name;
              return (
                <div key={d.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Domain header — tap to expand */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedDomain(isOpen ? null : d.name)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: d.color + '18' }}>
                        <DomainIcon size={13} style={{ color: d.color }} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-slate-800">{d.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{d.skills.length} skill{d.skills.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black" style={{ color: d.color }}>{d.score != null ? `${d.score}%` : '–'}</span>
                      <ChevronRight size={14} className="text-slate-300 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    </div>
                  </button>

                  {/* Skills list (expanded) */}
                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {d.skills.map((skill) => (
                        <div key={skill.id} className="px-4 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-300 w-4 text-right">{skill.id}.</span>
                              <p className="text-[11px] font-semibold text-slate-700">{skill.label}</p>
                            </div>
                            <span className="text-[11px] font-black flex-shrink-0 ml-2" style={{ color: skill.score != null ? scoreColor(skill.score) : '#94a3b8' }}>
                              {skill.score != null ? `${skill.score}%` : '–'}
                            </span>
                          </div>
                          <div className="ml-6">
                            <div
                              className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
                              role="progressbar"
                              aria-valuenow={skill.score ?? 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${skill.label} score`}
                            >
                              <div
                                className="h-1.5 rounded-full transition-all duration-700"
                                style={{ width: `${skill.score ?? 0}%`, background: d.color }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[9px] text-slate-400 font-semibold">{scoreLabel(skill.score)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {overallSkillScore == null && (
          <div className="text-center py-10 text-slate-400">
            <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No data to compute skill scores yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const ChildGrowthAnalytics = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [academicData, setAcademicData] = useState(null);
  const [wellbeingData, setWellbeingData] = useState(null);
  const [skillsData, setSkillsData] = useState(null);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [loadingWellbeing, setLoadingWellbeing] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const [activeSidebar, setActiveSidebar] = useState(null); // 'academic' | 'wellbeing' | 'skills' | null

  // Fetch student list from parent profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await parentApiJson('/api/parent/auth/profile', {}, navigate);
        const kids = Array.isArray(profile?.childrenIds)
          ? profile.childrenIds.map((c) => (typeof c === 'object' ? c : { _id: c, name: 'Student' }))
          : [];

        const att = await parentApiJson('/api/attendance/parent/children', {}, navigate);
        if (cancelled) return;
        const list = (att.children || []).map((c) => c.student).filter(Boolean);
        if (list.length > 0) {
          setStudents(list);
          setSelectedId(list[0]._id);
        } else if (kids.length > 0) {
          setStudents(kids);
          setSelectedId(String(kids[0]._id));
        }
      } catch {
        /* empty state handles a failed load */
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const fetchAcademic = useCallback((sid) => {
    if (!sid) return;
    setLoadingAcademic(true);
    setAcademicData(null);
    parentApiJson(`/api/parent-dashboard/analytics/academic/${sid}`, {}, navigate)
      .then((d) => setAcademicData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingAcademic(false));
  }, [navigate]);

  const fetchWellbeing = useCallback((sid) => {
    if (!sid) return;
    setLoadingWellbeing(true);
    setWellbeingData(null);
    parentApiJson(`/api/parent-dashboard/analytics/wellbeing/${sid}`, {}, navigate)
      .then((d) => setWellbeingData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingWellbeing(false));
  }, [navigate]);

  const fetchSkills = useCallback((sid) => {
    if (!sid) return;
    setLoadingSkills(true);
    setSkillsData(null);
    parentApiJson(`/api/parent-dashboard/analytics/skills/${sid}`, {}, navigate)
      .then((d) => setSkillsData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, [navigate]);

  useEffect(() => {
    if (selectedId) {
      fetchAcademic(selectedId);
      fetchWellbeing(selectedId);
      fetchSkills(selectedId);
    }
  }, [selectedId, fetchAcademic, fetchWellbeing, fetchSkills]);

  const handleSelectStudent = (id) => {
    setSelectedId(id);
    setActiveSidebar(null);
  };

  const selectedStudent = students.find((s) => String(s._id) === String(selectedId));

  if (loadingStudents) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3" aria-busy="true" aria-live="polite">
        <Loader2 size={36} className="animate-spin text-indigo-400" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading analytics...</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Users size={40} className="opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">No children found</p>
      </div>
    );
  }

  const overallMastery = academicData?.overallMastery;
  const attendancePct = academicData?.attendanceSummary?.attendancePct;
  const avgMood = wellbeingData?.avgMood;
  const highConcern = wellbeingData ? (wellbeingData.concernCounts?.high || 0) + (wellbeingData.concernCounts?.urgent || 0) : 0;
  const subjectCount = academicData?.subjectBreakdown?.length || 0;
  const examCount = academicData?.examTrend?.length || 0;
  const overallSkillScore = skillsData?.overallSkillScore;
  const holistic = skillsData?.holistic || null;

  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-white">
        <AnalyticsPureWhiteDashboard
          students={students}
          selectedId={selectedId}
          selectedStudent={selectedStudent}
          onSelectStudent={handleSelectStudent}
          academicData={academicData}
          wellbeingData={wellbeingData}
          skillsData={skillsData}
          loadingAcademic={loadingAcademic}
          loadingWellbeing={loadingWellbeing}
          loadingSkills={loadingSkills}
          onOpen={setActiveSidebar}
        />

        {activeSidebar && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setActiveSidebar(null)}
            />
            <div
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl"
              style={{ animation: 'analyticsSlideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              {activeSidebar === 'academic' ? (
                <AcademicSidebar data={academicData} onClose={() => setActiveSidebar(null)} />
              ) : activeSidebar === 'wellbeing' ? (
                <WellbeingSidebar data={wellbeingData} onClose={() => setActiveSidebar(null)} />
              ) : (
                <SkillsSidebar data={skillsData} onClose={() => setActiveSidebar(null)} />
              )}
            </div>
          </>
        )}

        <style>{`
          @keyframes analyticsSlideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <motion.div
      className="relative mx-auto min-h-screen max-w-7xl space-y-6 overflow-hidden rounded-[2rem] bg-slate-50/50 p-4 sm:p-6 lg:p-8"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-purple-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>
      {/* Page header */}
      <motion.header
        variants={itemVariants}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-300 shadow-md shadow-purple-200">
            <BarChart2 size={19} className="text-white" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 to-purple-700 bg-clip-text text-2xl font-extrabold text-transparent">Child Growth Analytics</h1>
            <p className="text-sm text-slate-500">Academic performance &amp; emotional wellbeing at a glance</p>
          </div>
        </div>

        {selectedStudent && (
          <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 py-1 pl-1 pr-4 shadow-sm backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-300 text-sm font-semibold text-white shadow-md">
              {selectedStudent.name?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-800">{selectedStudent.name}</p>
              <p className="text-xs text-slate-500">
                {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : 'Student'}
                {selectedStudent.section ? ` · Section ${selectedStudent.section}` : ''}
              </p>
            </div>
          </div>
        )}
      </motion.header>

      {/* Student selector */}
      {students.length > 1 && (
        <motion.div variants={itemVariants}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Child</p>
          <StudentPill students={students} selectedId={String(selectedId)} onSelect={handleSelectStudent} />
        </motion.div>
      )}

      {/* Student banner */}
      {selectedStudent && (
        <motion.div variants={itemVariants} className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/60 px-5 py-4 text-slate-800 shadow-sm backdrop-blur-xl">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-300 flex items-center justify-center text-lg font-black text-white shadow">
            {selectedStudent.name?.[0]?.toUpperCase() || 'S'}
          </div>
          <div>
            <p className="font-black text-base leading-tight">{selectedStudent.name}</p>
            <p className="text-slate-500 text-xs font-semibold">
              {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : ''}
              {selectedStudent.section ? ` · Section ${selectedStudent.section}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <Eye size={12} />
            Tracking growth
          </div>
        </motion.div>
      )}

      {/* Quick stats row */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Overall Mastery', value: overallMastery != null ? `${overallMastery}%` : '–', icon: Brain, color: 'indigo', loading: loadingAcademic },
          { label: 'Attendance', value: attendancePct != null ? `${attendancePct}%` : '–', icon: Calendar, color: 'emerald', loading: loadingAcademic },
          { label: 'Avg Mood', value: avgMood != null ? `${avgMood}/5` : '–', icon: Smile, color: 'rose', loading: loadingWellbeing },
          { label: 'Skill Score', value: overallSkillScore != null ? `${overallSkillScore}%` : '–', icon: Sparkles, color: 'amber', loading: loadingSkills },
        ].map((stat) => {
          const Icon = stat.icon;
          const colors = {
            indigo: 'bg-purple-50 text-purple-600 border-purple-200',
            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
            rose: 'bg-rose-50 text-rose-600 border-rose-200',
            amber: 'bg-amber-50 text-amber-600 border-amber-200',
            orange: 'bg-orange-50 text-orange-600 border-orange-100',
            slate: 'bg-slate-50 text-slate-500 border-slate-100',
          };
          return (
            <motion.div key={stat.label} variants={itemVariants} className={`flex items-center gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-1 hover:shadow-md ${colors[stat.color]}`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/60 text-xl font-medium">
                <Icon size={20} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{stat.label}</p>
                {stat.loading ? <Loader2 size={18} className="mt-1 animate-spin opacity-50" /> : <p className="text-2xl font-bold text-slate-800">{stat.value}</p>}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Holistic Development Summary — 3 sections */}
      {!loadingSkills && (
        <motion.section variants={itemVariants} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Holistic Development Overview
            </p>
            <span className="rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600">Live overview</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Section 1 — Academic Growth */}
            <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 transition hover:bg-purple-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center">
                  <Brain size={15} className="text-white" />
                </div>
                <p className="text-xs font-black text-purple-700 uppercase tracking-wide">Academic Growth</p>
              </div>
              <p className="text-3xl font-black text-slate-800 mb-1">
                {holistic?.academicGrowth?.score != null ? `${holistic.academicGrowth.score}%` : '–'}
              </p>
              <p className="text-[10px] text-purple-500 font-semibold mb-3">Cognitive · Memory · Creative · Language</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Cognitive', key: 'cognitive', color: 'bg-indigo-400' },
                  { label: 'Memory', key: 'memory', color: 'bg-violet-400' },
                  { label: 'Creative', key: 'creative', color: 'bg-purple-400' },
                  { label: 'Language', key: 'language', color: 'bg-blue-400' },
                ].map(({ label, key, color }) => {
                  const cat = holistic?.academicGrowth?.breakdown?.[key];
                  const score = cat?.score;
                  const trend = cat?.trend;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 font-semibold">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: score != null ? `${score}%` : '0%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{score != null ? `${score}%` : '–'}</span>
                      {trend === 'improving' && <ArrowUp size={10} className="text-emerald-500" />}
                      {trend === 'declining' && <ArrowDown size={10} className="text-red-500" />}
                      {trend === 'stable' && <Minus size={10} className="text-slate-400" />}
                    </div>
                  );
                })}
              </div>
              {!holistic?.hasRealData && (
                <p className="text-[9px] text-indigo-300 mt-2 italic">Estimated from academic data</p>
              )}
            </div>

            {/* Section 2 — Emotional Wellbeing */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 transition hover:bg-emerald-50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Heart size={15} className="text-white" />
                </div>
                <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Emotional Wellbeing</p>
              </div>
              <p className="text-3xl font-black text-slate-800 mb-1">
                {holistic?.emotionalWellbeing?.score != null ? `${holistic.emotionalWellbeing.score}%` : '–'}
              </p>
              <p className="text-[10px] text-emerald-500 font-semibold mb-3">Social-Emotional · Physical Development</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Social', key: 'socialEmotional', color: 'bg-rose-400' },
                  { label: 'Physical', key: 'physical', color: 'bg-pink-400' },
                ].map(({ label, key, color }) => {
                  const cat = holistic?.emotionalWellbeing?.breakdown?.[key];
                  const score = cat?.score;
                  const trend = cat?.trend;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 w-16 font-semibold">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: score != null ? `${score}%` : '0%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{score != null ? `${score}%` : '–'}</span>
                      {trend === 'improving' && <ArrowUp size={10} className="text-emerald-500" />}
                      {trend === 'declining' && <ArrowDown size={10} className="text-red-500" />}
                      {trend === 'stable' && <Minus size={10} className="text-slate-400" />}
                    </div>
                  );
                })}
              </div>
              {!holistic?.hasRealData && (
                <p className="text-[9px] text-rose-300 mt-2 italic">Estimated from wellbeing data</p>
              )}
            </div>

            {/* Section 3 — Overall Mastery Score */}
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 flex flex-col items-center justify-center text-center transition hover:bg-amber-50">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center mb-3">
                <Sparkles size={15} className="text-white" />
              </div>
              <p className="text-xs font-black text-amber-700 uppercase tracking-wide mb-2">Overall Mastery</p>
              {overallSkillScore != null ? (
                <>
                  <div className="relative w-28 h-28 mb-3">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#fde68a" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke="#f59e0b" strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallSkillScore / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-amber-700">{overallSkillScore}%</span>
                      <span className="text-[9px] font-bold text-amber-400 uppercase">of 22 goals</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-amber-600">
                    {overallSkillScore >= 85 ? 'Excellent holistic growth' :
                     overallSkillScore >= 65 ? 'Good overall development' :
                     overallSkillScore >= 45 ? 'Progressing steadily' : 'Needs more support'}
                  </p>
                </>
              ) : (
                <div className="text-amber-300 py-4">
                  <Sparkles size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No data yet</p>
                </div>
              )}
            </div>

          </div>
        </motion.section>
      )}

      {/* Three main analytics cards */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Academic Growth Card */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === 'academic' ? null : 'academic')}
          className={`group text-left rounded-2xl border overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ${
            activeSidebar === 'academic' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-indigo-200'
          }`}
        >
          {/* Card top gradient */}
          <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 px-6 py-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <BookOpen size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Growth</p>
                  <p className="text-sm font-black">Academic Performance</p>
                </div>
              </div>
              <ChevronRight size={18} className={`text-white/60 transition-transform duration-300 ${activeSidebar === 'academic' ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
            </div>
            <div className="flex items-center gap-6">
              {loadingAcademic ? (
                <Loader2 size={24} className="animate-spin text-white/60" />
              ) : (
                <ScoreRing score={overallMastery} size={72} stroke={6} color="#fff" />
              )}
              <div className="space-y-2 flex-1">
                <div>
                  <p className="text-[10px] font-bold text-indigo-200 uppercase">Subjects Tracked</p>
                  <p className="text-lg font-black">{loadingAcademic ? '–' : subjectCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-200 uppercase">Exams Taken</p>
                  <p className="text-lg font-black">{loadingAcademic ? '–' : examCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card bottom */}
          <div className="bg-white px-6 py-4">
            {loadingAcademic ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-slate-100 rounded-full animate-pulse" />)}
              </div>
            ) : academicData?.subjectBreakdown?.length > 0 ? (
              <div className="space-y-2.5">
                {academicData.subjectBreakdown.slice(0, 4).map((s) => (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{s.subject}</p>
                      <span className="text-xs font-black flex-shrink-0 ml-2" style={{ color: scoreColor(s.avg) }}>{s.avg}%</span>
                    </div>
                    <MiniBar value={s.avg} />
                  </div>
                ))}
                {academicData.subjectBreakdown.length > 4 && (
                  <p className="text-[10px] text-indigo-500 font-bold mt-1">+{academicData.subjectBreakdown.length - 4} more subjects · tap to explore</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">No mastery data yet</p>
            )}
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
              <TrendingUp size={12} className="text-indigo-500" />
              <p className="text-[11px] font-bold text-indigo-600">Tap to see full academic breakdown →</p>
            </div>
          </div>
        </button>

        {/* Emotional Wellbeing Card */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === 'wellbeing' ? null : 'wellbeing')}
          className={`group text-left rounded-2xl border overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ${
            activeSidebar === 'wellbeing' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-slate-100 hover:border-rose-200'
          }`}
        >
          <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 px-6 py-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Heart size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-200">Growth</p>
                  <p className="text-sm font-black">Emotional Wellbeing</p>
                </div>
              </div>
              <ChevronRight size={18} className={`text-white/60 transition-transform duration-300 ${activeSidebar === 'wellbeing' ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
            </div>

            {loadingWellbeing ? (
              <Loader2 size={24} className="animate-spin text-white/60" />
            ) : (
              <div className="flex items-center gap-6">
                {/* Mood visual */}
                <div className="relative">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-white/20 flex flex-col items-center justify-center gap-1">
                    <p className="text-2xl font-black">{avgMood != null ? avgMood : '–'}</p>
                    <p className="text-[9px] font-bold text-white/70 uppercase tracking-wider">/ 5 mood</p>
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <div>
                    <p className="text-[10px] font-bold text-rose-200 uppercase">Observations</p>
                    <p className="text-lg font-black">{wellbeingData?.totalObservations || 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-rose-200 uppercase">High Concern</p>
                    <p className="text-lg font-black">{highConcern}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white px-6 py-4">
            {loadingWellbeing ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-slate-100 rounded-full animate-pulse" />)}
              </div>
            ) : wellbeingData ? (
              <div className="space-y-2">
                {/* Concern level bars */}
                {Object.entries(wellbeingData.concernCounts).map(([lvl, count]) => {
                  if (count === 0) return null;
                  const c = concernColor[lvl] || concernColor.low;
                  const total = wellbeingData.totalObservations || 1;
                  return (
                    <div key={lvl}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <p className="text-xs font-bold text-slate-700 capitalize">{lvl}</p>
                        </div>
                        <span className="text-xs font-black text-slate-600">{count}</span>
                      </div>
                      <div
                        className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={count}
                        aria-valuemin={0}
                        aria-valuemax={total}
                        aria-label={`${lvl} concern observations`}
                      >
                        <div className={`h-1.5 rounded-full ${c.dot} transition-all duration-700`} style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                {wellbeingData.totalObservations === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No observations recorded yet</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">No wellbeing data yet</p>
            )}
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
              <Activity size={12} className="text-rose-500" />
              <p className="text-[11px] font-bold text-rose-600">Tap to see full wellbeing breakdown →</p>
            </div>
          </div>
        </button>

        {/* Skill Development Card */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === 'skills' ? null : 'skills')}
          className={`group text-left rounded-2xl border overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 lg:col-span-2 ${
            activeSidebar === 'skills' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-100 hover:border-amber-200'
          }`}
        >
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-6 py-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Growth</p>
                  <p className="text-sm font-black">Skill Development</p>
                </div>
              </div>
              <ChevronRight size={18} className={`text-white/60 transition-transform duration-300 ${activeSidebar === 'skills' ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
            </div>

            {loadingSkills ? (
              <Loader2 size={24} className="animate-spin text-white/60" />
            ) : (
              <div className="flex items-center gap-6">
                <ScoreRing score={overallSkillScore} size={72} stroke={6} color="#fff" />
                <div className="space-y-2 flex-1">
                  <div>
                    <p className="text-[10px] font-bold text-amber-100 uppercase">Skills Tracked</p>
                    <p className="text-lg font-black">22</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-100 uppercase">Domains</p>
                    <p className="text-lg font-black">{skillsData?.domains?.length || 5}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white px-6 py-4">
            {loadingSkills ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-3 bg-slate-100 rounded-full animate-pulse" />)}
              </div>
            ) : skillsData?.domains?.length > 0 ? (
              <div className="space-y-2.5">
                {skillsData.domains.map((d) => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{d.name}</p>
                      <span className="text-xs font-black flex-shrink-0 ml-2" style={{ color: d.score != null ? scoreColor(d.score) : '#94a3b8' }}>
                        {d.score != null ? `${d.score}%` : '–'}
                      </span>
                    </div>
                    <div
                      className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={d.score ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${d.name} score`}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${d.score ?? 0}%`, background: d.color || '#f59e0b' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">No skill data yet</p>
            )}
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
              <Zap size={12} className="text-amber-500" />
              <p className="text-[11px] font-bold text-amber-600">Tap to see all 22 skill scores →</p>
            </div>
          </div>
        </button>

      </motion.div>

      {/* Bottom hint when no sidebar is open */}
      {!activeSidebar && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
          <Eye size={14} />
          <p className="text-xs font-semibold">Tap either card above to open the detailed analytics panel</p>
        </div>
      )}

      {/* Slide-out sidebar overlay */}
      {activeSidebar && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setActiveSidebar(null)}
          />
          {/* Sidebar panel */}
          <div
            className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-50 flex flex-col"
            style={{ animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            {activeSidebar === 'academic' ? (
              <AcademicSidebar data={academicData} onClose={() => setActiveSidebar(null)} />
            ) : activeSidebar === 'wellbeing' ? (
              <WellbeingSidebar data={wellbeingData} onClose={() => setActiveSidebar(null)} />
            ) : (
              <SkillsSidebar data={skillsData} onClose={() => setActiveSidebar(null)} />
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
};

export default ChildGrowthAnalytics;
