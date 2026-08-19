import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Heart,
  BookOpen,
  X,
  ChevronRight,
  Loader2,
  BarChart2,
  Activity,
  Star,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Smile,
  Frown,
  Meh,
  Brain,
  Award,
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
  Legend,
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

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

const trendIcon = (arr, key) => {
  if (!arr || arr.length < 2) return <Minus size={12} className="text-slate-400" />;
  const last = arr[arr.length - 1][key];
  const prev = arr[arr.length - 2][key];
  if (last == null || prev == null) return <Minus size={12} className="text-slate-400" />;
  if (last > prev) return <ArrowUp size={12} className="text-emerald-500" />;
  if (last < prev) return <ArrowDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-slate-400" />;
};

const PIE_COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4'];

// ── Student selector ──────────────────────────────────────────────────────────
const StudentPill = ({ students, selectedId, onSelect }) => (
  <div className="flex flex-wrap gap-2">
    {students.map((s) => (
      <button
        key={s._id}
        onClick={() => onSelect(s._id)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
          selectedId === s._id
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
        }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${selectedId === s._id ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>
          {s.name?.[0]?.toUpperCase() || 'S'}
        </div>
        {s.name}
        {s.grade && <span className="opacity-70">· Gr {s.grade}</span>}
      </button>
    ))}
  </div>
);

// ── Score ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ score, size = 80, stroke = 7, color }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(Math.max(score, 0), 100) : 0;
  const offset = circ - (pct / 100) * circ;
  const c = color || scoreColor(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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
const MiniBar = ({ value, max = 100, color }) => (
  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
    <div
      className="h-1.5 rounded-full transition-all duration-700"
      style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color || scoreColor(value) }}
    />
  </div>
);

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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={moodTrend} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 11, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    formatter={(v, n, p) => [v, 'Mood Rating']}
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
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={concernPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3}>
                      {concernPieData.map((entry) => (
                        <Cell key={entry.name} fill={CONCERN_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
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
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
    fetch(`${API_BASE}/api/parent/auth/profile`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        const kids = Array.isArray(d?.childrenIds)
          ? d.childrenIds.map((c) => (typeof c === 'object' ? c : { _id: c, name: 'Student' }))
          : [];
        // Also try children array with names
        const childrenNames = Array.isArray(d?.children) ? d.children : [];

        // Fetch student details
        return fetch(`${API_BASE}/api/attendance/parent/children`, { headers: authHeader() })
          .then((r) => r.json())
          .then((att) => {
            const list = (att.children || []).map((c) => c.student).filter(Boolean);
            if (list.length > 0) {
              setStudents(list);
              setSelectedId(list[0]._id);
            } else if (kids.length > 0) {
              setStudents(kids);
              setSelectedId(String(kids[0]._id));
            }
          });
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  const fetchAcademic = useCallback((sid) => {
    if (!sid) return;
    setLoadingAcademic(true);
    setAcademicData(null);
    fetch(`${API_BASE}/api/parent-dashboard/analytics/academic/${sid}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setAcademicData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingAcademic(false));
  }, []);

  const fetchWellbeing = useCallback((sid) => {
    if (!sid) return;
    setLoadingWellbeing(true);
    setWellbeingData(null);
    fetch(`${API_BASE}/api/parent-dashboard/analytics/wellbeing/${sid}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setWellbeingData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingWellbeing(false));
  }, []);

  const fetchSkills = useCallback((sid) => {
    if (!sid) return;
    setLoadingSkills(true);
    setSkillsData(null);
    fetch(`${API_BASE}/api/parent-dashboard/analytics/skills/${sid}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => setSkillsData(d.data || null))
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, []);

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-indigo-400" />
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

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 relative">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-200">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Child Growth Analytics</h1>
            <p className="text-xs text-slate-400 font-medium">Academic performance & emotional wellbeing at a glance</p>
          </div>
        </div>
      </div>

      {/* Student selector */}
      {students.length > 1 && (
        <div className="mb-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Child</p>
          <StudentPill students={students} selectedId={String(selectedId)} onSelect={handleSelectStudent} />
        </div>
      )}

      {/* Student banner */}
      {selectedStudent && (
        <div className="mb-5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl px-5 py-4 flex items-center gap-4 text-white shadow-lg">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-lg font-black shadow">
            {selectedStudent.name?.[0]?.toUpperCase() || 'S'}
          </div>
          <div>
            <p className="font-black text-base leading-tight">{selectedStudent.name}</p>
            <p className="text-slate-400 text-xs font-semibold">
              {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : ''}
              {selectedStudent.section ? ` · Section ${selectedStudent.section}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-white/10 rounded-full px-3 py-1.5 text-xs font-bold text-slate-300">
            <Eye size={12} />
            Tracking growth
          </div>
        </div>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Overall Mastery', value: overallMastery != null ? `${overallMastery}%` : '–', icon: Brain, color: 'indigo', loading: loadingAcademic },
          { label: 'Attendance', value: attendancePct != null ? `${attendancePct}%` : '–', icon: Calendar, color: 'emerald', loading: loadingAcademic },
          { label: 'Avg Mood', value: avgMood != null ? `${avgMood}/5` : '–', icon: Smile, color: 'rose', loading: loadingWellbeing },
          { label: 'Skill Score', value: overallSkillScore != null ? `${overallSkillScore}%` : '–', icon: Sparkles, color: 'amber', loading: loadingSkills },
        ].map((stat) => {
          const Icon = stat.icon;
          const colors = {
            indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            rose: 'bg-rose-50 text-rose-600 border-rose-100',
            amber: 'bg-amber-50 text-amber-600 border-amber-100',
            orange: 'bg-orange-50 text-orange-600 border-orange-100',
            slate: 'bg-slate-50 text-slate-500 border-slate-100',
          };
          return (
            <div key={stat.label} className={`rounded-2xl border px-4 py-3 ${colors[stat.color]}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} />
                <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{stat.label}</p>
              </div>
              {stat.loading ? (
                <Loader2 size={16} className="animate-spin opacity-50" />
              ) : (
                <p className="text-xl font-black">{stat.value}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Three main analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">

        {/* Academic Growth Card */}
        <button
          onClick={() => setActiveSidebar(activeSidebar === 'academic' ? null : 'academic')}
          className={`group text-left rounded-3xl border-2 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${
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
          className={`group text-left rounded-3xl border-2 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${
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
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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
          className={`group text-left rounded-3xl border-2 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 ${
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
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
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

      </div>

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
    </div>
  );
};

export default ChildGrowthAnalytics;
