import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, CheckCircle2, Clock, Loader2, Users, X } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export default function LiveExamMonitor() {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [monitoring, setMonitoring] = useState(false);
  const [takers, setTakers] = useState({}); // { studentId: { name, event, at } }
  const [loadingExams, setLoadingExams] = useState(true);
  const socketRef = useRef(null);

  // Load ongoing / scheduled exams the teacher manages
  useEffect(() => {
    fetch(`${API_BASE}/api/exam/teacher/manage`, { headers: authH() })
      .then((r) => r.json())
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload?.data || [];
        setExams(list.filter((e) => ['scheduled', 'ongoing'].includes(String(e.status || '').toLowerCase())));
      })
      .catch(() => {})
      .finally(() => setLoadingExams(false));
  }, []);

  const startMonitoring = () => {
    if (!selectedExam) return;
    setTakers({});
    setMonitoring(true);

    const socket = io(API_BASE, {
      auth: { token: localStorage.getItem('token') || '' },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('join-exam-monitor', { examId: selectedExam });
    });

    socket.on('exam-taker-update', ({ studentId, studentName, event, at }) => {
      setTakers((prev) => ({
        ...prev,
        [studentId]: { name: studentName, event, at },
      }));
    });

    socketRef.current = socket;
  };

  const stopMonitoring = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-exam-monitor', { examId: selectedExam });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setMonitoring(false);
  };

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  const takerList = Object.entries(takers).map(([id, info]) => ({ id, ...info }));
  const activeCount = takerList.filter((t) => t.event === 'started').length;
  const submittedCount = takerList.filter((t) => t.event === 'submitted').length;

  const selectedExamDoc = exams.find((e) => String(e._id) === selectedExam);

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Activity className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Live Exam Monitor</h1>
          <p className="text-xs text-gray-500">Real-time view of students taking active exams</p>
        </div>
      </div>

      {/* Exam picker */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-gray-700">Select Exam to Monitor</label>
        {loadingExams ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading exams…</div>
        ) : !exams.length ? (
          <p className="text-sm text-gray-400">No scheduled or ongoing exams found.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              disabled={monitoring}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">— choose exam —</option>
              {exams.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.title} ({e.subject || '—'}) · {e.status}
                </option>
              ))}
            </select>
            {!monitoring ? (
              <button
                type="button"
                onClick={startMonitoring}
                disabled={!selectedExam}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <Activity className="h-4 w-4" /> Start Monitoring
              </button>
            ) : (
              <button
                type="button"
                onClick={stopMonitoring}
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <X className="h-4 w-4" /> Stop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Live stats */}
      {monitoring && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Seen', value: takerList.length, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
              { label: 'In Progress', value: activeCount, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'Submitted', value: submittedCount, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
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

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
              </span>
              <p className="text-sm font-semibold text-gray-700">
                Live — {selectedExamDoc?.title || 'Exam'}
              </p>
            </div>

            {!takerList.length ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Activity className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">Waiting for students to connect…</p>
                <p className="text-xs text-gray-300">Students appear here as they start or submit the exam.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {takerList.sort((a, b) => new Date(b.at) - new Date(a.at)).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{new Date(t.at).toLocaleTimeString()}</span>
                      {t.event === 'started' ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">IN PROGRESS</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">SUBMITTED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
