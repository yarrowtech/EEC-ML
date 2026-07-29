import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, AlertTriangle,
  BarChart3, Activity, Loader2, RefreshCcw,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

const RISK_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value}%</strong></p>
      ))}
    </div>
  );
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'term', label: 'Term Comparison' },
  { key: 'cohort', label: 'My Classes' },
];

export default function TeacherAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [trends, setTrends] = useState(null);
  const [atRisk, setAtRisk] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingRisk, setLoadingRisk] = useState(true);
  const [activeSubject, setActiveSubject] = useState(null);

  // Term comparison state
  const [termData, setTermData] = useState(null);
  const [loadingTerm, setLoadingTerm] = useState(false);
  const [termSubject, setTermSubject] = useState('');

  // Cohort state
  const [cohortData, setCohortData] = useState([]);
  const [loadingCohort, setLoadingCohort] = useState(false);

  const fetchTrends = async () => {
    setLoadingTrends(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher-analytics/class-trends`, { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        setTrends(payload.data);
        setActiveSubject(payload.data?.subjectTrends?.[0]?.subject || null);
      }
    } catch { /* silent */ } finally {
      setLoadingTrends(false);
    }
  };

  const fetchAtRisk = async () => {
    setLoadingRisk(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher-analytics/at-risk`, { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        setAtRisk(payload.data || []);
      }
    } catch { /* silent */ } finally {
      setLoadingRisk(false);
    }
  };

  const fetchTermComparison = async () => {
    setLoadingTerm(true);
    try {
      const params = new URLSearchParams();
      if (termSubject) params.set('subject', termSubject);
      const res = await fetch(`${API_BASE}/api/teacher-analytics/term-comparison?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        setTermData(payload.data);
      }
    } catch { /* silent */ } finally {
      setLoadingTerm(false);
    }
  };

  const fetchCohort = async () => {
    setLoadingCohort(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher-analytics/cohort`, { headers: authHeaders() });
      if (res.ok) {
        const payload = await res.json();
        setCohortData(payload.data || []);
      }
    } catch { /* silent */ } finally {
      setLoadingCohort(false);
    }
  };

  useEffect(() => {
    fetchTrends();
    fetchAtRisk();
  }, []);

  useEffect(() => {
    if (activeTab === 'term' && !termData) fetchTermComparison();
    if (activeTab === 'cohort' && !cohortData.length) fetchCohort();
  }, [activeTab]);

  const subjectTrends = trends?.subjectTrends || [];
  const attendanceTrend = trends?.attendanceTrend || [];

  const subjectBarData = subjectTrends.map((s) => ({
    subject: s.subject.length > 10 ? s.subject.slice(0, 10) + '…' : s.subject,
    avg: s.avgScore ?? 0,
  }));

  const selectedSubjectTrend = subjectTrends.find((s) => s.subject === activeSubject);
  const lineData = (selectedSubjectTrend?.weeklyAverages || attendanceTrend).map((pt, i) => ({
    week: pt.week || `Week ${i + 1}`,
    value: pt.avg ?? pt,
  }));

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Class Analytics</h1>
            <p className="text-xs text-gray-500">Performance trends and at-risk students</p>
          </div>
        </div>
        <button
          onClick={() => { fetchTrends(); fetchAtRisk(); }}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (<>
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Students', value: trends?.totalStudents ?? '—', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Avg Attendance', value: trends?.avgAttPct != null ? `${trends.avgAttPct}%` : '—', icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Subjects Tracked', value: subjectTrends.length || '—', icon: BarChart3, color: 'text-amber-600 bg-amber-50' },
          { label: 'At Risk', value: atRisk.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xl font-black text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subject avg bar chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-4">Subject Averages</h2>
          {loadingTrends ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : subjectBarData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No exam data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectBarData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg" name="Avg Score" fill="#6366f1" radius={[6, 6, 0, 0]}
                  onClick={(d) => setActiveSubject(subjectTrends[subjectBarData.indexOf(d)]?.subject || null)} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {subjectTrends.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjectTrends.map((s) => (
                <button key={s.subject} type="button"
                  onClick={() => setActiveSubject(s.subject)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeSubject === s.subject
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s.subject}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trend line */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-1">
            {activeSubject ? `${activeSubject} — Weekly Trend` : 'Attendance Trend'}
          </h2>
          <p className="text-xs text-gray-400 mb-4">Weekly average %</p>
          {loadingTrends ? (
            <div className="flex h-48 items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : lineData.length < 2 ? (
            <p className="text-sm text-gray-400 text-center py-10">Not enough data points yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" name="Average" stroke="#6366f1" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* At-risk panel */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-800">At-Risk Students</h2>
            <span className="text-xs text-gray-400">— composite score (attendance + exam avg + trend)</span>
          </div>
          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">{atRisk.length} flagged</span>
        </div>

        {loadingRisk ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : atRisk.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-sm text-gray-400">No at-risk students detected</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {atRisk.map((student, i) => {
              const trend = student.scoreTrend;
              return (
                <Motion.div
                  key={student.studentId || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{student.studentName}</p>
                    <p className="text-xs text-gray-500">
                      {student.grade ? `Grade ${student.grade}` : ''}
                      {student.section ? ` · ${student.section}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {student.attPct != null && (
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-gray-400">Attend.</p>
                        <p className="text-sm font-bold text-gray-700">{student.attPct}%</p>
                      </div>
                    )}
                    {student.avgScore != null && (
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-gray-400">Avg Score</p>
                        <p className="text-sm font-bold text-gray-700">{student.avgScore}%</p>
                      </div>
                    )}
                    {trend != null && (
                      <div className="flex items-center gap-1">
                        {trend > 0
                          ? <TrendingUp className="w-4 h-4 text-emerald-500" />
                          : <TrendingDown className="w-4 h-4 text-red-500" />}
                        <span className={`text-xs font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {trend > 0 ? `+${trend}` : trend}
                        </span>
                      </div>
                    )}
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${RISK_COLORS[student.riskLevel] || 'bg-gray-100 text-gray-600'}`}>
                      {student.riskLevel}
                    </span>
                  </div>
                </Motion.div>
              );
            })}
          </div>
        )}
      </div>
      </>)}

      {/* ── Term Comparison Tab ─────────────────────────────────────────────── */}
      {activeTab === 'term' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={termSubject}
              onChange={(e) => setTermSubject(e.target.value)}
              placeholder="Filter by subject (optional)"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={fetchTermComparison}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Load
            </button>
          </div>

          {loadingTerm ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : !termData || !termData.subjects?.length ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">
              No term data. Enter a subject and click Load, or wait for published results.
            </div>
          ) : termData.subjects.map((subj) => (
            <div key={subj.subject} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-800">{subj.subject}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subj.terms.filter((t) => t.avg !== null)} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="term" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Avg Score']} />
                  <Bar dataKey="avg" name="Avg Score" fill="#6366f1" radius={[6, 6, 0, 0]}
                    label={{ position: 'top', fontSize: 10, formatter: (v) => `${v}%` }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-3">
                {subj.terms.filter((t) => t.avg !== null).map((t) => (
                  <div key={t.term} className="rounded-xl bg-gray-50 px-3 py-2 text-center">
                    <p className="text-[10px] text-gray-400">{t.term}</p>
                    <p className="text-base font-black text-indigo-700">{t.avg}%</p>
                    <p className="text-[10px] text-gray-400">{t.count} results</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── My Classes (Cohort) Tab ─────────────────────────────────────────── */}
      {activeTab === 'cohort' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Performance across all your allocated classes and subjects.</p>
            <button type="button" onClick={fetchCohort}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingCohort ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
          ) : !cohortData.length ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">
              No class data found. Ensure you have active allocations.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={cohortData.map((c) => ({
                    label: `${c.className}-${c.sectionName} ${c.subjectName}`.trim(),
                    avgScore: c.avgScore ?? 0,
                    avgAtt: c.avgAtt ?? 0,
                  }))}
                  barSize={24}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="avgScore" name="Avg Exam Score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgAtt" name="Avg Attendance" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cohortData.map((c, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-bold text-gray-900">
                      {c.className}{c.sectionName ? ` - ${c.sectionName}` : ''}
                    </p>
                    <p className="text-xs text-indigo-600 font-medium mb-3">{c.subjectName || 'All Subjects'}</p>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400">Avg Score</p>
                        <p className="text-xl font-black text-gray-900">{c.avgScore != null ? `${c.avgScore}%` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Attendance</p>
                        <p className="text-xl font-black text-gray-900">{c.avgAtt != null ? `${c.avgAtt}%` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Students</p>
                        <p className="text-xl font-black text-gray-900">{c.studentCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
