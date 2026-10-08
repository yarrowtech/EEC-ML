import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Loader, Plus, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PracticePaperBuilder from './PracticePaperBuilder';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const getId = (value) => String(value?._id || value?.id || value || '');
const slugify = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const PracticePapersPortal = () => {
  const { classId = 'current' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [allocations, setAllocations] = useState([]);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [papersLoading, setPapersLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [publishingId, setPublishingId] = useState('');

  const classInfo = useMemo(() => {
    const state = location.state || {};
    const matching = allocations.find((allocation) => {
      const allocationClassId = getId(allocation?.classId);
      const allocationSectionId = getId(allocation?.sectionId);
      if (state.classMongoId && state.sectionMongoId) {
        return allocationClassId === String(state.classMongoId) && allocationSectionId === String(state.sectionMongoId);
      }
      const nameSlug = `${allocation?.classId?.name || allocation?.className || ''}-${allocation?.sectionId?.name || allocation?.sectionName || ''}`;
      return slugify(nameSlug) === String(classId).toLowerCase();
    }) || allocations[0];

    return {
      classId: String(state.classMongoId || getId(matching?.classId) || ''),
      sectionId: String(state.sectionMongoId || getId(matching?.sectionId) || ''),
      className: String(state.className || matching?.classId?.name || matching?.className || ''),
      sectionName: String(state.sectionName || matching?.sectionId?.name || matching?.sectionName || ''),
      subjectName: String(state.subjectName || matching?.subjectId?.name || matching?.subjectName || ''),
    };
  }, [allocations, classId, location.state]);

  const subjectOptions = useMemo(() => {
    const unique = new Map();
    allocations
      .filter((allocation) => !classInfo.classId || getId(allocation?.classId) === classInfo.classId)
      .filter((allocation) => !classInfo.sectionId || getId(allocation?.sectionId) === classInfo.sectionId)
      .forEach((allocation) => {
        const id = getId(allocation?.subjectId);
        const name = String(allocation?.subjectId?.name || allocation?.subjectName || allocation?.subject || '').trim();
        if (name && !unique.has(id || name)) unique.set(id || name, { id, name });
      });
    if (classInfo.subjectName && !Array.from(unique.values()).some((item) => item.name === classInfo.subjectName)) {
      unique.set(classInfo.subjectName, { id: '', name: classInfo.subjectName });
    }
    return Array.from(unique.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [allocations, classInfo]);

  const loadPapers = useCallback(async () => {
    if (!classInfo.classId) return;
    setPapersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/teacher?classId=${encodeURIComponent(classInfo.classId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Unable to load practice papers');
      setPapers(Array.isArray(data?.papers) ? data.papers : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load practice papers');
    } finally {
      setPapersLoading(false);
    }
  }, [classInfo.classId, token]);

  useEffect(() => {
    let cancelled = false;
    const loadAllocations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/teacher/dashboard/allocations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => []);
        if (!response.ok) throw new Error(data?.error || 'Unable to load class allocations');
        if (!cancelled) setAllocations(Array.isArray(data) ? data : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load class allocations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAllocations();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => { loadPapers(); }, [loadPapers]);

  const publishPaper = async (paper) => {
    const id = getId(paper);
    if (!id || publishingId) return;
    setPublishingId(id);
    try {
      const response = await fetch(`${API_BASE}/api/practice-papers/${id}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Unable to publish paper');
      toast.success('Practice paper published to students');
      await loadPapers();
    } catch (publishError) {
      toast.error(publishError.message || 'Unable to publish paper');
    } finally {
      setPublishingId('');
    }
  };

  const classLabel = [classInfo.className && `Class ${classInfo.className}`, classInfo.sectionName && `Section ${classInfo.sectionName}`].filter(Boolean).join(' · ');

  if (loading) return <div className="flex items-center justify-center rounded-2xl bg-white p-12"><Loader className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="mx-auto max-w-[1240px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate(`/teacher/classes/${encodeURIComponent(classId)}/teaching`)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-700">
            <ArrowLeft size={14} /> Teaching Workspace
          </button>
          <h1 className="text-2xl font-bold text-slate-950">Practice Papers</h1>
          <p className="mt-1 text-sm text-slate-500">{classLabel || 'Selected class'} · Create papers linked to Smart Learning.</p>
        </div>
        <button type="button" onClick={() => setShowBuilder((visible) => !visible)} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          {showBuilder ? <X size={16} /> : <Plus size={16} />}
          {showBuilder ? 'Close Builder' : 'Create Practice Paper'}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {showBuilder && classInfo.classId && classInfo.sectionId && (
        <PracticePaperBuilder
          classId={classInfo.classId}
          sectionId={classInfo.sectionId}
          subjectOptions={subjectOptions}
          initialSubjectName={classInfo.subjectName}
          onCancel={() => setShowBuilder(false)}
          onSave={async () => { setShowBuilder(false); await loadPapers(); }}
        />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your practice papers</h2>
            <p className="mt-1 text-xs text-slate-500">Draft papers stay private until you use the existing Publish action.</p>
          </div>
          <FileText className="text-indigo-500" size={20} />
        </div>
        {papersLoading ? <div className="flex justify-center p-8"><Loader className="animate-spin text-indigo-600" /></div> : papers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No practice papers created for this class yet.</div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => {
              const published = paper.status === 'published';
              return (
                <div key={getId(paper)} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{paper.title}</h3><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{published ? 'Published' : 'Draft'}</span></div>
                    <p className="mt-1 text-xs text-slate-500">{[paper.subjectName, paper.chapterTitle || paper.chapter, paper.topicTitle].filter(Boolean).join(' · ') || 'Not linked to a lesson yet'}</p>
                  </div>
                  {!published && <button type="button" onClick={() => publishPaper(paper)} disabled={publishingId === getId(paper)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-indigo-200 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"><Send size={14} /> {publishingId === getId(paper) ? 'Publishing…' : 'Publish'}</button>}
                  {published && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15} /> Available to students</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PracticePapersPortal;
