import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Brain, Loader2, RefreshCw, Sparkles, TrendingDown, Users } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export default function TeacherInterventionScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lowMastery, setLowMastery] = useState([]);
  const [aiPlan, setAiPlan] = useState('');
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanError, setAiPlanError] = useState('');

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

  const generatePlan = async () => {
    setAiPlanLoading(true);
    setAiPlanError('');
    setAiPlan('');
    try {
      const res = await fetch(`${API_BASE}/api/ai-teacher/intervention-plan`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ flaggedStudents, reteachPlans, lowMastery }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'AI request failed');
      setAiPlan(payload.data?.content || '');
    } catch (err) {
      setAiPlanError(err.message || 'Failed to generate plan');
    } finally {
      setAiPlanLoading(false);
    }
  };

  const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    return (
      <div className="space-y-1 text-sm text-gray-700 leading-relaxed">
        {text.split('\n').map((line, i) => {
          if (/^##\s/.test(line)) return <p key={i} className="font-bold text-gray-900 mt-3 first:mt-0">{line.replace(/^##\s/, '')}</p>;
          if (/^\*\*(.+)\*\*$/.test(line)) return <p key={i} className="font-semibold text-gray-800">{line.replace(/\*\*/g, '')}</p>;
          if (/^[-•]\s/.test(line)) return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-indigo-400">{line.replace(/^[-•]\s/, '').replace(/\*\*/g, '')}</p>;
          if (/^\d+\.\s/.test(line)) return <p key={i} className="pl-3">{line.replace(/\*\*/g, '')}</p>;
          if (!line.trim()) return <div key={i} className="h-1" />;
          return <p key={i}>{line.replace(/\*\*/g, '')}</p>;
        })}
      </div>
    );
  };

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

      {/* AI Intervention Plan */}
      <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-600" />
            <p className="text-sm font-bold text-indigo-900">AI Intervention Plan</p>
          </div>
          <button
            onClick={generatePlan}
            disabled={aiPlanLoading || (!flaggedStudents.length && !reteachPlans.length && !lowMastery.length)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg disabled:opacity-50 transition-all"
          >
            {aiPlanLoading
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
              : <><Sparkles className="h-3 w-3" /> Generate Plan</>}
          </button>
        </div>
        <div className="px-5 py-4">
          {!aiPlan && !aiPlanLoading && !aiPlanError && (
            <p className="text-sm text-gray-400 text-center py-4">
              Click "Generate Plan" to get an AI-powered week-by-week intervention strategy based on your flagged data.
            </p>
          )}
          {aiPlanLoading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-500">Analysing intervention data with AI…</p>
            </div>
          )}
          {aiPlanError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-4 py-2">{aiPlanError}</p>
          )}
          {aiPlan && <SimpleMarkdown text={aiPlan} />}
        </div>
      </div>
    </div>
  );
}
