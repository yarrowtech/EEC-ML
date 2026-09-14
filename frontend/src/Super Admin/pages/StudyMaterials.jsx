import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const PAGE_SIZE = 20;

const authHeaders = () => ({
  authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const statusClass = {
  published: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-sky-100 text-sky-700',
  archived: 'bg-slate-200 text-slate-600',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[status] || statusClass.draft}`}>
    {status || 'draft'}
  </span>
);

const Stat = ({ label, value, accent }) => (
  <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{Number(value || 0).toLocaleString()}</p>
  </div>
);

export default function StudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [schools, setSchools] = useState([]);
  const [stats, setStats] = useState({ total: 0, published: 0, drafts: 0, schoolsWithMaterials: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (search.trim()) params.set('q', search.trim());
    if (schoolId) params.set('schoolId', schoolId);
    if (status) params.set('status', status);

    try {
      const response = await fetch(`${API_BASE}/api/super-admin/study-materials?${params}`, { headers: authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load study materials');
      setMaterials(payload.materials || []);
      setSchools(payload.schools || []);
      setStats(payload.stats || {});
      setPagination(payload.pagination || { page, pages: 0, total: 0 });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [page, schoolId, search, status]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  const openMaterial = async (material) => {
    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/super-admin/study-materials/${material.id}`, { headers: authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to open study material');
      setSelectedMaterial(payload.material);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const schoolOptions = schools;

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Platform content</p>
          <h2 className="text-2xl font-bold text-slate-900">Study Materials</h2>
          <p className="mt-1 text-sm text-slate-500">Browse learning material collected from every school.</p>
        </div>
        <button type="button" onClick={loadMaterials} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total materials" value={stats.total} accent="border-violet-100" />
        <Stat label="Published" value={stats.published} accent="border-emerald-100" />
        <Stat label="Drafts" value={stats.drafts} accent="border-amber-100" />
        <Stat label="Schools contributing" value={stats.schoolsWithMaterials} accent="border-sky-100" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
        <label className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input value={search} onChange={updateFilter(setSearch)} placeholder="Search title, teacher, class, subject, or topic" className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </label>
        <select value={schoolId} onChange={updateFilter(setSchoolId)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400">
          <option value="">All schools</option>
          {schoolOptions.map((school) => <option key={school.id} value={school.id}>{school.name} ({school.materialCount})</option>)}
        </select>
        <select value={status} onChange={updateFilter(setStatus)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && <p className="border-l-4 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2"><BookOpen size={18} className="text-violet-600" /><h3 className="font-semibold text-slate-900">Collected material</h3></div>
          <span className="text-xs text-slate-500">{pagination.total || 0} result{pagination.total === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Material</th><th className="px-5 py-3">School</th><th className="px-5 py-3">Class / subject</th><th className="px-5 py-3">Teacher</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Added</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Loading study materials...</td></tr>}
              {!loading && materials.map((material) => (
                <tr key={material.id} onClick={() => openMaterial(material)} className="cursor-pointer hover:bg-violet-50/40">
                  <td className="max-w-[300px] px-5 py-4"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-violet-100 p-2 text-violet-700"><FileText size={16} /></span><div><p className="font-semibold text-slate-900">{material.title}</p><p className="mt-1 text-xs text-slate-500">{material.typeLabel} · {material.attachmentCount} file{material.attachmentCount === 1 ? '' : 's'}</p></div></div></td>
                  <td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-700"><Building2 size={15} className="text-slate-400" />{material.schoolName}</div></td>
                  <td className="px-5 py-4 text-slate-600">{[material.className, material.sectionName].filter(Boolean).join(' · ') || '—'}<br /><span className="text-xs text-slate-400">{material.subjectName || 'No subject'}</span></td>
                  <td className="px-5 py-4 text-slate-600">{material.teacherName}</td>
                  <td className="px-5 py-4"><StatusBadge status={material.status} />{material.publishedForStudentPortal && <span className="ml-2 text-xs text-emerald-600">Portal</span>}</td>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-500">{formatDate(material.createdAt)}</td>
                </tr>
              ))}
              {!loading && materials.length === 0 && <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">No study materials match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm"><span className="text-slate-500">Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>}
      </div>

      {(selectedMaterial || detailLoading) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMaterial(null); }}>
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          {detailLoading && !selectedMaterial ? <div className="p-12 text-center text-slate-500">Opening material...</div> : <>
            <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">{selectedMaterial.schoolName}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{selectedMaterial.title}</h3><p className="mt-1 text-sm text-slate-500">{[selectedMaterial.className, selectedMaterial.sectionName, selectedMaterial.subjectName].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={() => setSelectedMaterial(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close material preview"><X size={20} /></button></div>
            <div className="space-y-5 p-5"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={selectedMaterial.status} />{selectedMaterial.isEnabled && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} />Enabled</span>}<span className="text-xs text-slate-500">Teacher: {selectedMaterial.teacherName}</span></div><div><h4 className="mb-2 text-sm font-semibold text-slate-800">Content</h4><div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedMaterial.plainTextContent || 'No text content was added.'}</div></div><div><h4 className="mb-2 text-sm font-semibold text-slate-800">Attachments ({selectedMaterial.attachments?.length || 0})</h4>{selectedMaterial.attachments?.length ? <div className="space-y-2">{selectedMaterial.attachments.map((attachment, index) => <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50"><span className="truncate">{attachment.name}</span><span className="ml-3 shrink-0 text-xs text-slate-400">{formatBytes(attachment.size) || 'Open'}</span></a>)}</div> : <p className="text-sm text-slate-500">No attachments.</p>}</div></div>
          </>}
        </div>
      </div>}
    </section>
  );
}
