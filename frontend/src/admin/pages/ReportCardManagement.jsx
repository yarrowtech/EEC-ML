import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, BookOpen, CheckCircle, ChevronDown, ChevronUp,
  Download, FileSpreadsheet, Loader2, RefreshCw,
  Save, Settings, Upload, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadBulkReportCardsPdf, downloadSingleReportCardPdf } from '../../utils/reportCardPdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400';
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const initialTemplate = {
  title: 'Report Card',
  subtitle: 'Academic Performance Report',
  schoolNameOverride: '',
  logoUrlOverride: '',
  schoolAddressLine: '',
  schoolContactLine: '',
  accentColor: '#4f46e5',
  showPageBorder: true,
  watermarkText: '',
  footerNote: 'This is a computer-generated report card.',
  signatureLabel: 'Class Teacher',
  principalLabel: 'Principal',
};

/* ── inline report card preview ── */
const GRADE_COLOR = { 'A+': 'bg-emerald-100 text-emerald-700', A: 'bg-green-100 text-green-700', B: 'bg-blue-100 text-blue-700', C: 'bg-yellow-100 text-yellow-700', D: 'bg-orange-100 text-orange-700', F: 'bg-red-100 text-red-700' };

const ReportCardPreview = ({ card, template, onDownload, downloading }) => {
  const promoted = card.totals?.promoted;
  const noResults  = !card.subjects?.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* school header */}
      <div className="flex items-center gap-4 px-5 py-4 text-white" style={{ backgroundColor: template?.accentColor || '#4f46e5' }}>
        {(template?.logoUrl || template?.logoUrlOverride) && (
          <img src={template.logoUrl || template.logoUrlOverride} alt="logo"
            className="h-12 w-12 object-contain bg-white rounded-xl p-1 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate">{template?.schoolName || template?.schoolNameOverride || 'School'}</p>
          {template?.schoolAddressLine && <p className="text-xs opacity-80 truncate">{template.schoolAddressLine}</p>}
          {template?.schoolContactLine && <p className="text-xs opacity-70 truncate">{template.schoolContactLine}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-sm">{template?.title || 'Report Card'}</p>
          {card.term && <p className="text-xs opacity-80">{card.term}</p>}
          <p className="text-xs opacity-70">{card.academicYear}</p>
        </div>
      </div>

      {/* student info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50">
        {[['Student', card.studentName], ['Roll No.', card.roll || '—'], ['Class', card.grade || '—'], ['Section', card.section || '—']].map(([label, val]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="font-semibold text-slate-800 text-sm mt-0.5 truncate">{val}</p>
          </div>
        ))}
      </div>

      {noResults ? (
        <div className="px-6 py-10 text-center text-slate-400 text-sm">
          <FileSpreadsheet size={28} className="mx-auto mb-2 text-slate-300" />
          No published results for this filter
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {/* subjects table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: template?.accentColor || '#4f46e5' }}>
                  {['Subject', 'Obtained', 'Max Marks', '%', 'Grade'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-white uppercase tracking-wide first:rounded-tl-xl last:rounded-tr-xl">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {card.subjects.map((s, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{s.name}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-800">{s.obtainedMarks}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{s.totalMarks}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{s.percentage}%</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${GRADE_COLOR[s.grade] || 'bg-slate-100 text-slate-600'}`}>{s.grade || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td className="px-3 py-2.5 font-bold rounded-bl-xl">TOTAL</td>
                  <td className="px-3 py-2.5 text-center font-bold">{card.totals.obtainedMarks}</td>
                  <td className="px-3 py-2.5 text-center font-bold">{card.totals.totalMarks}</td>
                  <td className="px-3 py-2.5 text-center font-bold">{card.totals.percentage}%</td>
                  <td className="px-3 py-2.5 text-center font-bold rounded-br-xl">
                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${GRADE_COLOR[card.totals.grade] || 'bg-slate-100 text-slate-600'}`}>{card.totals.grade || '—'}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* promotion status */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${promoted ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div>
              <p className={`font-bold text-sm ${promoted ? 'text-emerald-700' : 'text-red-700'}`}>
                {promoted ? 'Promoted to Next Class' : 'Not Promoted'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Overall: {card.totals.percentage}% &nbsp;·&nbsp; Passing: 50%</p>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white ${promoted ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {promoted ? 'PROMOTED' : 'NOT PROMOTED'}
            </span>
          </div>
        </div>
      )}

      {/* download row */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
        <button onClick={() => onDownload(card)} disabled={downloading || noResults}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-50 transition-colors">
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Download PDF
        </button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════ */
const ReportCardManagement = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const token = localStorage.getItem('token');
  const authH = () => ({ 'Content-Type': 'application/json', authorization: `Bearer ${token}` });

  const [template, setTemplate]           = useState(initialTemplate);
  const [showSettings, setShowSettings]   = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [classes, setClasses]             = useState([]);
  const [sections, setSections]           = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [examGroups, setExamGroups]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [generating, setGenerating]       = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [reportCards, setReportCards]     = useState([]);
  const [generatedTemplate, setGeneratedTemplate] = useState(null);
  const [signatories, setSignatories] = useState({ classTeacherName: '', principalName: '', loading: false });
  const logoInputRef = useRef(null);

  const [filters, setFilters] = useState({ examGroupId: '', classId: '', sectionId: '', academicYearId: '', includeUnpublished: false });

  const isYearActive = (year) => {
    const status = String(year?.status || '').trim().toLowerCase();
    if (status) return status === 'active';
    if (typeof year?.isActive === 'boolean') return year.isActive;
    return false;
  };

  /* ── initial load ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers = { authorization: `Bearer ${token}` };
        const [tRes, cRes, sRes, yRes, gRes] = await Promise.all([
          fetch(`${API_BASE}/api/reports/report-cards/template`, { headers }),
          fetch(`${API_BASE}/api/academic/classes`, { headers }),
          fetch(`${API_BASE}/api/academic/sections`, { headers }),
          fetch(`${API_BASE}/api/academic/years`, { headers }),
          fetch(`${API_BASE}/api/exam/groups`, { headers }),
        ]);
        const [tData, cData, sData, yData, gData] = await Promise.all([tRes.json().catch(() => ({})), cRes.json().catch(() => []), sRes.json().catch(() => []), yRes.json().catch(() => []), gRes.json().catch(() => [])]);
        if (tRes.ok) setTemplate({ ...initialTemplate, ...tData });
        setClasses(Array.isArray(cData) ? cData : []);
        setSections(Array.isArray(sData) ? sData : []);
        setAcademicYears(Array.isArray(yData) ? yData : []);
        setExamGroups(Array.isArray(gData) ? gData : []);
      } catch { toast.error('Failed to load data'); }
      finally { setLoading(false); }
    };
    load();
  }, [token]);

  const filteredClasses = useMemo(() => {
    if (!filters.academicYearId) return [];
    return classes.filter((cls) => String(cls?.academicYearId || '') === String(filters.academicYearId));
  }, [classes, filters.academicYearId]);

  const activeAcademicYears = useMemo(
    () => academicYears.filter((year) => isYearActive(year)),
    [academicYears]
  );

  const filteredSections = useMemo(() => {
    if (!filters.classId) return [];
    return sections.filter(s => String(s.classId) === String(filters.classId) || String(s.classId?._id) === String(filters.classId));
  }, [sections, filters.classId]);

  const completedExamGroupOptions = useMemo(() => {
    const selectedClass = classes.find((item) => String(item?._id) === String(filters.classId));
    const selectedSection = sections.find((item) => String(item?._id) === String(filters.sectionId));
    const selectedClassName = String(selectedClass?.name || '').trim();
    const selectedSectionName = String(selectedSection?.name || '').trim();

    return examGroups
      .filter((group) => ['completed', 'published'].includes(String(group?.status || '').toLowerCase()))
      .filter((group) => {
        if (!filters.classId) return true;
        const byId = String(group?.classId?._id || group?.classId || '') === String(filters.classId);
        const byName = selectedClassName && normalizeText(group?.grade) === normalizeText(selectedClassName);
        return byId || byName;
      })
      .filter((group) => {
        if (!filters.sectionId) return true;
        const byId = String(group?.sectionId?._id || group?.sectionId || '') === String(filters.sectionId);
        const byName = selectedSectionName && normalizeText(group?.section) === normalizeText(selectedSectionName);
        return byId || byName;
      })
      .sort((a, b) => {
        const d1 = a?.startDate ? new Date(a.startDate).getTime() : 0;
        const d2 = b?.startDate ? new Date(b.startDate).getTime() : 0;
        return d2 - d1;
      });
  }, [examGroups, filters.classId, filters.sectionId, classes, sections]);

  useEffect(() => {
    if (!filters.academicYearId) return;
    const existsInActiveList = activeAcademicYears.some((year) => String(year?._id) === String(filters.academicYearId));
    if (!existsInActiveList) {
      setFilters((prev) => ({ ...prev, academicYearId: '', classId: '', sectionId: '', examGroupId: '' }));
    }
  }, [filters.academicYearId, activeAcademicYears]);

  /* ── auto-fetch class teacher & principal ── */
  useEffect(() => {
    const fetchSignatories = async () => {
      if (!filters.classId || !filters.sectionId) {
        setSignatories({ classTeacherName: '', principalName: '', loading: false });
        return;
      }
      setSignatories(prev => ({ ...prev, loading: true }));
      try {
        const qs = new URLSearchParams({
          classId: String(filters.classId || ''),
          sectionId: String(filters.sectionId || ''),
        });
        if (filters.academicYearId) qs.set('academicYearId', String(filters.academicYearId));
        const res = await fetch(`${API_BASE}/api/reports/report-cards/signatories?${qs.toString()}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Unable to fetch class teacher/principal');
        setSignatories({
          classTeacherName: String(data?.classTeacherName || ''),
          principalName: String(data?.principalName || ''),
          loading: false,
        });
      } catch {
        setSignatories({ classTeacherName: '', principalName: '', loading: false });
      }
    };
    fetchSignatories();
  }, [filters.classId, filters.sectionId, filters.academicYearId, token]);

  /* ── template save ── */
  const handleTemplateSave = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch(`${API_BASE}/api/reports/report-cards/template`, { method: 'PUT', headers: authH(), body: JSON.stringify(template) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setTemplate(prev => ({ ...prev, ...(data?.template || {}) }));
      toast.success('Template saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingTemplate(false); }
  };

  /* ── logo upload ── */
  const handleLogoUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Upload an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Logo must be < 5 MB'); return; }
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('folder', 'report-card-logos');
      const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      const url = data?.secure_url || data?.url || '';
      if (url) { setTemplate(prev => ({ ...prev, logoUrlOverride: url })); toast.success('Logo uploaded'); }
    } catch (err) { toast.error(err.message); }
  };

  /* ── generate ── */
  const handleGenerate = async () => {
    if (!filters.academicYearId) { toast.error('Select an academic year'); return; }
    if (!filters.classId) { toast.error('Select a class'); return; }
    if (!filters.sectionId) { toast.error('Select a section'); return; }
    if (!filters.examGroupId) { toast.error('Select a completed examination'); return; }
    setGenerating(true);
    setReportCards([]);
    try {
      const res = await fetch(`${API_BASE}/api/reports/report-cards/bulk`, { method: 'POST', headers: authH(), body: JSON.stringify(filters) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate');
      const cards = Array.isArray(data?.reportCards) ? data.reportCards : [];
      if (!cards.length) {
        toast.error(
          filters.includeUnpublished
            ? 'No results found for the selected filters'
            : 'No published results found. Enable "Include unpublished results" or publish results first.'
        );
        return;
      }
      const selectedExamGroup = completedExamGroupOptions.find(ex => String(ex._id) === String(filters.examGroupId));
      const examLabel = data?.filters?.examGroupTitle || selectedExamGroup?.title || '';
      setReportCards(cards.map(c => ({ ...c, term: examLabel })));
      const resolvedTemplate = {
        ...(data?.template || template),
        signatureLabel: signatories.classTeacherName || 'Class Teacher',
        principalLabel: signatories.principalName || 'Principal',
      };
      setGeneratedTemplate(resolvedTemplate);
      toast.success(`${cards.length} report card${cards.length !== 1 ? 's' : ''} generated`);
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setGenerating(false); }
  };

  /* ── download single ── */
  const handleDownloadSingle = async (card) => {
    const id = card.studentId || card.studentName;
    setDownloadingId(String(id));
    try {
      await downloadSingleReportCardPdf({ template: generatedTemplate || template, reportCard: card, fileName: `report_${card.studentName}_${card.term || 'card'}.pdf`.replace(/\s+/g, '_').toLowerCase() });
    } catch { toast.error('Download failed'); }
    finally { setDownloadingId(null); }
  };

  /* ── download all ── */
  const handleDownloadAll = async () => {
    if (!reportCards.length) return;
    setGenerating(true);
    try {
      const cls   = classes.find(c => c._id === filters.classId)?.name || 'class';
      const sec   = filteredSections.find(s => s._id === filters.sectionId)?.name || '';
      const selectedExamGroup = completedExamGroupOptions.find(ex => String(ex._id) === String(filters.examGroupId));
      const examName = (selectedExamGroup?.title || 'exam').replace(/\s+/g, '_').toLowerCase();
      await downloadBulkReportCardsPdf({ template: generatedTemplate || template, reportCards, fileName: `report_cards_${cls}${sec ? '_' + sec : ''}_${examName}.pdf`.replace(/\s+/g, '_').toLowerCase() });
      toast.success('Bulk PDF downloaded');
    } catch { toast.error('Download failed'); }
    finally { setGenerating(false); }
  };

  /* ── stats ── */
  const promoted   = reportCards.filter(c => c.totals?.promoted === true).length;
  const notPromoted = reportCards.filter(c => c.totals?.promoted === false).length;
  const withResults = reportCards.filter(c => c.subjects?.length > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <Loader2 size={28} className="animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── sticky header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Report Card Generator</h1>
              <p className="text-xs text-slate-500">Generate exam-wise report cards with promotion status</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowSettings(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${showSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Settings size={13} /> Settings {showSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {reportCards.length > 0 && (
              <button onClick={handleDownloadAll} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60">
                {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Download All ({reportCards.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── template settings (collapsible) ── */}
        {showSettings && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-4 text-sm">Report Card Template</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input className={inp} placeholder="Report Card Title" value={template.title} onChange={e => setTemplate(p => ({ ...p, title: e.target.value }))} />
              <input className={inp} placeholder="School Name Override" value={template.schoolNameOverride} onChange={e => setTemplate(p => ({ ...p, schoolNameOverride: e.target.value }))} />
              <input className={inp} placeholder="Address line" value={template.schoolAddressLine} onChange={e => setTemplate(p => ({ ...p, schoolAddressLine: e.target.value }))} />
              <input className={inp} placeholder="Contact line (phone / email)" value={template.schoolContactLine} onChange={e => setTemplate(p => ({ ...p, schoolContactLine: e.target.value }))} />
              <div className="flex gap-2">
                <input className={inp} placeholder="Logo URL" value={template.logoUrlOverride} onChange={e => setTemplate(p => ({ ...p, logoUrlOverride: e.target.value }))} />
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { handleLogoUpload(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="shrink-0 flex items-center gap-1 px-3 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
                  <Upload size={13} />
                </button>
              </div>
              <input className={inp} placeholder="Footer note" value={template.footerNote} onChange={e => setTemplate(p => ({ ...p, footerNote: e.target.value }))} />
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-600 font-medium">Accent colour</label>
                <input type="color" className="h-9 w-20 rounded-xl border border-slate-200 cursor-pointer" value={template.accentColor || '#4f46e5'} onChange={e => setTemplate(p => ({ ...p, accentColor: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={Boolean(template.showPageBorder)} onChange={e => setTemplate(p => ({ ...p, showPageBorder: e.target.checked }))} className="rounded" />
                Show page border
              </label>
            </div>
            <button onClick={handleTemplateSave} disabled={savingTemplate}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-sm">
              {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Template
            </button>
          </div>
        )}

        {/* ── filter & generate panel ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-3 text-sm">Generate Report Cards</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Academic Year</label>
              <select value={filters.academicYearId} onChange={e => setFilters(p => ({ ...p, academicYearId: e.target.value, classId: '', sectionId: '', examGroupId: '' }))} className={inp}>
                <option value="">Select year</option>
                {activeAcademicYears.map(y => <option key={y._id} value={y._id}>{y.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Class</label>
              <select value={filters.classId} onChange={e => setFilters(p => ({ ...p, classId: e.target.value, sectionId: '', examGroupId: '' }))} className={inp} disabled={!filters.academicYearId}>
                <option value="">{filters.academicYearId ? 'Select class' : 'Select year first'}</option>
                {filteredClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Section</label>
              <select value={filters.sectionId} onChange={e => setFilters(p => ({ ...p, sectionId: e.target.value, examGroupId: '' }))} className={inp} disabled={!filters.classId}>
                <option value="">{filters.classId ? 'Select section' : 'Select class first'}</option>
                {filteredSections.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Completed Examination</label>
              <select value={filters.examGroupId} onChange={e => setFilters(p => ({ ...p, examGroupId: e.target.value }))} className={inp} disabled={!filters.sectionId}>
                <option value="">{filters.sectionId ? 'Select completed examination' : 'Select section first'}</option>
                {completedExamGroupOptions.map(ex => (
                  <option key={ex._id} value={ex._id}>
                    {ex.title || 'Examination'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-between">
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide invisible">Generate</label>
              <button onClick={handleGenerate} disabled={generating || !filters.academicYearId || !filters.classId || !filters.sectionId || !filters.examGroupId}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-60 transition-colors">
                {generating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.includeUnpublished} onChange={e => setFilters(p => ({ ...p, includeUnpublished: e.target.checked }))} className="rounded" />
            Include unpublished results
          </label>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Class Teacher (Auto)</label>
              <input
                className={inp}
                value={signatories.loading ? 'Fetching…' : (signatories.classTeacherName || 'Not assigned')}
                readOnly
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Principal (Auto)</label>
              <input
                className={inp}
                value={signatories.loading ? 'Fetching…' : (signatories.principalName || 'Not assigned')}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* ── stats ── */}
        {reportCards.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Students', value: reportCards.length, icon: FileSpreadsheet, bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-700' },
              { label: 'Promoted', value: promoted, icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600' },
              { label: 'Not Promoted', value: notPromoted, icon: XCircle, bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600' },
              { label: 'With Results', value: withResults, icon: Award, bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600' },
            ].map(({ label, value, icon: Icon, bg, border, text }) => (
              <div key={label} className={`rounded-2xl border p-4 ${bg} ${border}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${text}`}>{value}</p>
                  </div>
                  {React.createElement(Icon, { size: 28, className: `${text} opacity-60` })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── report cards ── */}
        {reportCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">{reportCards.length} Report Card{reportCards.length !== 1 ? 's' : ''}</h2>
              <button onClick={handleDownloadAll} disabled={generating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-60">
                <Download size={13} /> Download All PDF
              </button>
            </div>
            {reportCards.map((card) => (
              <ReportCardPreview
                key={String(card.studentId)}
                card={card}
                template={generatedTemplate || template}
                onDownload={handleDownloadSingle}
                downloading={downloadingId === String(card.studentId)}
              />
            ))}
          </div>
        )}

        {reportCards.length === 0 && !generating && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <BookOpen size={22} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No report cards yet</p>
            <p className="text-xs text-slate-400">Select class, section, year and completed exam, then click Generate</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportCardManagement;
