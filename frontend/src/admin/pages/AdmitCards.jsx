import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, FileBadge, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../utils/authSession';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AdmitCards = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openExamKey, setOpenExamKey] = useState('');

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);
  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(`${API_BASE}/api/exam/groups`, {
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        }, navigate);
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Unable to load exams');
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Unable to load admit card status');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const rows = useMemo(() => groups.map((group) => {
    const published = group.status === 'Published' || Boolean(group.publishedAt);
    const subjects = Array.isArray(group.subjects) ? group.subjects : [];
    return {
      ...group,
      published,
      generated: published && subjects.length > 0,
      subjectsCount: subjects.length,
      examName: String(group.title || group.term || 'Exam').trim(),
    };
  }), [groups]);

  const examGroups = useMemo(() => {
    const byName = new Map();
    rows.forEach((row) => {
      const key = row.examName.toLowerCase();
      if (!byName.has(key)) byName.set(key, { key, name: row.examName, rows: [] });
      byName.get(key).rows.push(row);
    });

    return Array.from(byName.values()).map((exam) => {
      const total = exam.rows.length;
      const generated = exam.rows.filter((row) => row.generated).length;
      const waitingRoutine = exam.rows.filter((row) => !row.published).length;
      const noSubjects = exam.rows.filter((row) => row.published && row.subjectsCount === 0).length;
      return {
        ...exam,
        total,
        generated,
        waitingRoutine,
        noSubjects,
        allGenerated: total > 0 && generated === total,
      };
    });
  }, [rows]);

  const generatedCount = rows.filter((row) => row.generated).length;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><FileBadge size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Admit Cards</h1>
            <p className="text-sm text-slate-500">Click an exam name to check whether all admit cards are generated.</p>
          </div>
        </div>
      </div>

      {loading ? <div className="flex items-center gap-2 rounded-2xl bg-white p-5 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading admit card status...</div> : null}
      {error ? <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={16} /> {error}</div> : null}

      {!loading && !error && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-400">Exam Names</p><p className="mt-1 text-2xl font-bold text-slate-900">{examGroups.length}</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-400">Generated Sections</p><p className="mt-1 text-2xl font-bold text-emerald-600">{generatedCount}</p></div>
            <div className="rounded-2xl border border-amber-100 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-400">Not Generated</p><p className="mt-1 text-2xl font-bold text-amber-600">{rows.length - generatedCount}</p></div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {examGroups.length === 0 ? <p className="p-6 text-sm text-slate-500">No exams scheduled yet.</p> : examGroups.map((exam) => {
              const isOpen = openExamKey === exam.key;
              return (
                <div key={exam.key} className="border-b border-slate-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenExamKey(isOpen ? '' : exam.key)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition hover:bg-slate-50"
                    aria-expanded={isOpen}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{exam.name}</p>
                      <p className="text-sm text-slate-500">{exam.total} class/section group{exam.total === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${exam.allGenerated ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {exam.allGenerated && <CheckCircle2 size={13} />}
                        {exam.allGenerated ? 'All admit cards generated' : 'Not generated'}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-3">
                      <div className="mb-3 grid gap-2 text-xs md:grid-cols-3">
                        <div className="rounded-xl bg-white p-3 font-semibold text-slate-600">Generated: <span className="text-emerald-600">{exam.generated}</span></div>
                        <div className="rounded-xl bg-white p-3 font-semibold text-slate-600">Routine not published: <span className="text-amber-600">{exam.waitingRoutine}</span></div>
                        <div className="rounded-xl bg-white p-3 font-semibold text-slate-600">No subjects: <span className="text-rose-600">{exam.noSubjects}</span></div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                        {exam.rows.map((row) => (
                          <div key={row._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-b-0">
                            <div>
                              <p className="text-sm font-bold text-slate-800">Class {row.classId?.name || '-'} | Section {row.sectionId?.name || '-'}</p>
                              <p className="text-xs text-slate-500">{row.subjectsCount} subject{row.subjectsCount === 1 ? '' : 's'} | Status: {row.status || 'Scheduled'}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${row.generated ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                              {row.generated && <CheckCircle2 size={13} />}
                              {row.generated ? 'Generated' : row.published ? 'No subjects added' : 'Routine not published'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default AdmitCards;
