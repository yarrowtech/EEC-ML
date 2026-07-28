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

export default function TeacherAnalyticsDashboard() {
  const [trends, setTrends] = useState(null);
  const [atRisk, setAtRisk] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [loadingRisk, setLoadingRisk] = useState(true);
  const [activeSubject, setActiveSubject] = useState(null);

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

  useEffect(() => {
    fetchTrends();
    fetchAtRisk();
  }, []);

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
    </div>
  );
}
