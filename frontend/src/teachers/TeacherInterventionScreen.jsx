import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Loader2, RefreshCw, TrendingDown, Users } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export default function TeacherInterventionScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lowMastery, setLowMastery] = useState([]);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/lesson-plans/teacher/intervention`, { headers: authH() }).then((r) => r.json()),
      fetch(`${API_BASE}/api/teacher-analytics/low-mastery`, { headers: authH() }).then((r) => r.json()),
    ])
      .then(([intResp, lmResp]) => {
        setData(intResp.data || {});
        setLowMastery(Array.isArray(lmResp.data) ? lmResp.data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const flaggedStudents = data?.flaggedStudents || [];
  const reteachPlans   = data?.reteachPlans    || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Intervention Dashboard</h1>
            <p className="text-xs text-gray-500">Students and lessons flagged for follow-up action</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Flagged Students', value: flaggedStudents.length, icon: Users, color: 'text-red-600 bg-red-50' },
          { label: 'Re-teach Lessons', value: reteachPlans.length, icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
          { label: 'Low Mastery Subjects', value: lowMastery.length, icon: TrendingDown, color: 'text-orange-600 bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="text-xl font-black text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Flagged students */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-bold text-gray-800">Students Needing Intervention</p>
          <p className="text-xs text-gray-400">Score &lt;40% after 3+ attempts on any AI-assessed topic</p>
        </div>
        {!flaggedStudents.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">No students flagged right now. Great work!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {flaggedStudents.map((f, i) => {
              const student = f.studentId || {};
              return (
                <div key={i} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <p className="font-semibold text-gray-900">{student.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">
                      {student.grade} {student.section} · {f.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{f.attemptCount} attempts</span>
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                      {f.score}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Re-teach lesson plans */}
      {reteachPlans.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
            <p className="text-sm font-bold text-amber-800">Lessons Flagged for Re-teaching</p>
            <p className="text-xs text-amber-600">Exit quiz class average fell below threshold</p>
          </div>
          <div className="divide-y divide-gray-100">
            {reteachPlans.map((plan) => (
              <div key={plan._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="font-semibold text-gray-900">{plan.title}</p>
                  <p className="text-xs text-gray-400">{plan.subject} · threshold {plan.exitQuizThreshold}%</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  Re-teach
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low mastery subjects */}
      {lowMastery.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-orange-100 bg-orange-50 px-5 py-3">
            <p className="text-sm font-bold text-orange-800">Low Class Mastery</p>
            <p className="text-xs text-orange-600">Subjects where class average is below 50%</p>
          </div>
          <div className="divide-y divide-gray-100">
            {lowMastery.map((lm) => (
              <div key={lm._id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="font-semibold text-gray-900">{lm._id}</p>
                  <p className="text-xs text-gray-400">{lm.studentCount} students assessed</p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                  {Math.round(lm.avgScore)}% avg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
