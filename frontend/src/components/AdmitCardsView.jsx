import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck2, Download, FileBadge, Loader2, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/authSession';
import { generateAdmitCardPdf } from '../utils/examRoutinePdf';
import ChildSwitcher, { useSharedChildSelection } from '../parents/ChildSwitcher';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AdmitCardsView = ({ mode = 'student' }) => {
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to view admit cards.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const endpoint = mode === 'parent' ? '/api/exam/groups/parent-admit-cards' : '/api/exam/groups/student-admit-cards';
        const res = await apiFetch(`${API_BASE}${endpoint}`, {
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        }, navigate);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Unable to load admit cards');
        setPayload(data);
      } catch (err) {
        setError(err.message || 'Unable to load admit cards');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mode, navigate]);

  const children = useMemo(() => {
    if (mode === 'parent') return Array.isArray(payload?.children) ? payload.children : [];
    if (payload?.student) return [{ ...payload.student, groups: Array.isArray(payload?.groups) ? payload.groups : [] }];
    return [];
  }, [mode, payload]);

  const childOptions = useMemo(
    () => children.map((child) => ({ id: String(child.studentId || ''), name: child.studentName || 'Student' })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedChild = children.find((child) => String(child.studentId || '') === String(selectedOption?.id || '')) || children[0] || null;
  const groups = Array.isArray(selectedChild?.groups) ? selectedChild.groups : [];
  const pdfHeader = {
    schoolName: payload?.school?.name || '',
    schoolAddressLine: payload?.school?.address || '',
    logoUrl: payload?.school?.logo || '',
    principalName: payload?.principalName || '',
  };

  const download = async (group) => {
    try {
      setDownloadingId(String(group?._id || ''));
      await generateAdmitCardPdf({ student: selectedChild, group, pdfHeader });
      toast.success('Admit card downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download admit card');
    } finally {
      setDownloadingId('');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white p-6 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading admit cards...</div>;
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedChild?.profilePic ? (
              <img src={selectedChild.profilePic} alt={selectedChild.studentName || 'Student'} className="h-12 w-12 rounded-full border border-violet-100 object-cover" />
            ) : <UserCircle2 className="h-12 w-12 text-violet-300" strokeWidth={1.2} />}
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admit Cards</h1>
              <p className="text-sm text-slate-500">
                {selectedChild?.studentName || 'Student'}{selectedChild?.grade ? ` | Class ${selectedChild.grade}` : ''}{selectedChild?.section ? ` | Section ${selectedChild.section}` : ''}
              </p>
              {mode === 'parent' && childOptions.length > 1 && <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} className="mt-2" />}
            </div>
          </div>
          <FileBadge className="h-10 w-10 text-violet-300" strokeWidth={1.4} />
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle size={16} /> {error}</div>}

      {!error && groups.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-white/70 p-10 text-center">
          <CalendarCheck2 className="mx-auto h-10 w-10 text-violet-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800">No admit card available yet</p>
          <p className="mt-1 text-xs text-slate-500">Admit cards appear after the school publishes the subject-wise exam routine.</p>
        </div>
      )}

      {!error && groups.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group._id} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Generated</span>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">{group.title || 'Examination'}</h2>
                  <p className="text-sm text-slate-500">{group.academicYearName || 'Academic session'} | {group.subjects?.length || 0} subjects</p>
                </div>
                <button
                  type="button"
                  onClick={() => download(group)}
                  disabled={downloadingId === String(group._id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {downloadingId === String(group._id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download
                </button>
              </div>
              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60">
                {(group.subjects || []).slice(0, 4).map((exam) => (
                  <div key={exam._id || exam.subject} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{exam.subjectId?.name || exam.subject || 'Subject'}</span>
                    <span className="text-xs text-slate-500">{exam.date ? new Date(exam.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'} | {exam.time || '-'}</span>
                  </div>
                ))}
                {(group.subjects || []).length > 4 && <p className="px-3 py-2 text-xs text-slate-500">+{group.subjects.length - 4} more subjects</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdmitCardsView;
