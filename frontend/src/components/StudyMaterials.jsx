import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  File,
  Image as ImageIcon,
  Paperclip,
  Loader,
  Search,
  Calendar,
  User,
  ChevronDown,
  AlertCircle,
  GraduationCap,
  ArrowUpRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

const StudyMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/$/, '')
    .replace(/\/api$/, '');
  const STUDY_MATERIALS_ENDPOINT = `${API_BASE}/api/student/materials`;


  const token = localStorage.getItem('token');

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        setLoading(false);
        return;
      }

      const collected = [];
      let page = 1;
      let pages = 1;
      do {
        const response = await fetch(`${STUDY_MATERIALS_ENDPOINT}?page=${page}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || 'Could not load your materials');
        collected.push(...(Array.isArray(data.materials) ? data.materials : []));
        pages = Number(data.pages) || 1;
        page += 1;
      } while (page <= pages);
      setMaterials(collected);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
      setError(err.message);
      toast.error('Failed to load study materials');
    } finally {
      setLoading(false);
    }
  }, [token, STUDY_MATERIALS_ENDPOINT]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchMaterials();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [fetchMaterials]);

  const getFileIcon = (type) => {
    if (type?.startsWith('image/')) return ImageIcon;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSafeAttachmentUrl = (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';

    try {
      const resolved = new URL(url, `${API_BASE}/`);
      return ['http:', 'https:'].includes(resolved.protocol) ? resolved.href : '';
    } catch {
      return '';
    }
  };

  const getAttachmentOpenUrl = (attachment = {}) => {
    const url = getSafeAttachmentUrl(attachment?.url);
    if (!url || url.includes('docs.google.com/gview')) return url;

    const fileName = String(attachment?.name || '').toLowerCase();
    const mimeType = String(attachment?.type || '').toLowerCase();
    const needsDocumentViewer = /\.(docx?|pptx?|xlsx?)(?:$|[?#])/i.test(url)
      || /\.(docx?|pptx?|xlsx?)$/i.test(fileName)
      || /(word|powerpoint|presentation|excel|spreadsheet)/i.test(mimeType);

    return needsDocumentViewer
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
      : url;
  };

  // Track when a student views a material
  const trackMaterialView = async (materialId) => {
    try {
      await fetch(`${API_BASE}/api/student/materials/${materialId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeSpent: 0 })
      });
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  };

  // Get unique subjects for filter
  const subjects = useMemo(() => {
    const subjectSet = new Set();
    materials.forEach((material) => {
      if (material.subjectName) {
        subjectSet.add(material.subjectName);
      }
    });
    return ['all', ...Array.from(subjectSet).sort()];
  }, [materials]);

  const chapters = useMemo(() => {
    const groups = new Map();
    materials.forEach((material) => {
      const subject = String(material.subjectName || 'Other subjects').trim();
      const chapter = String(material.chapterTitle || material.topicTitle || 'General materials').trim();
      const key = `${subject.toLowerCase()}::${chapter.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { key, subject, chapter, attachments: [], teachers: new Set(), date: null, seen: new Set() });
      const group = groups.get(key);
      const teacher = material.teacherName || material.createdByName || 'Your teacher';
      const date = material.publishedAt || material.createdAt;
      if (!group.date || new Date(date) > new Date(group.date)) group.date = date;
      group.teachers.add(teacher);
      (material.attachments || []).forEach((attachment) => {
        const attachmentKey = String(attachment.url || attachment._id || '').split(/[?#]/)[0];
        if (!attachmentKey || group.seen.has(attachmentKey)) return;
        group.seen.add(attachmentKey);
        group.attachments.push({ ...attachment, materialId: material._id, teacher, date });
      });
    });
    return Array.from(groups.values()).filter((group) => group.attachments.length > 0);
  }, [materials]);

  const filteredChapters = useMemo(() => chapters.filter((chapter) => {
    const query = searchQuery.trim().toLowerCase();
    return (selectedSubject === 'all' || chapter.subject === selectedSubject)
      && (!query || [chapter.chapter, chapter.subject, ...chapter.teachers].join(' ').toLowerCase().includes(query));
  }), [chapters, searchQuery, selectedSubject]);

  const attachmentLabel = (attachment) => {
    const hint = `${attachment.type || ''} ${attachment.name || ''} ${String(attachment.url || '').split('?')[0]}`;
    if (/image|\.(jpe?g|jfif|png|webp|gif)/i.test(hint)) return 'Image';
    if (/video|\.(mp4|webm|mov)/i.test(hint)) return 'Video';
    if (/presentation|powerpoint|\.pptx?/i.test(hint)) return 'Slides';
    if (/pdf/i.test(hint)) return 'PDF';
    return 'Document';
  };

  return (
    <main className="min-h-full bg-[#f5f6fb] p-4 text-slate-900 sm:p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight sm:text-2xl">Study Materials</h1>

      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <span className="sr-only">Search chapters, subjects or teachers</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search chapter, subject or teacher" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
        </label>
        <label>
          <span className="sr-only">Filter by subject</span>
          <select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
            {subjects.map((subject) => <option key={subject} value={subject}>{subject === 'all' ? 'All subjects' : subject}</option>)}
          </select>
        </label>
      </div>
      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}<button type="button" onClick={fetchMaterials} className="ml-auto shrink-0 font-semibold underline">Try again</button></div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader className="h-5 w-5 animate-spin" />Loading your materials...</div> : filteredChapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-violet-400" />
          <h2 className="font-semibold">{chapters.length ? 'No chapters match your search' : 'No materials shared yet'}</h2>
          <p className="mt-1 text-sm text-slate-500">{chapters.length ? 'Try another chapter name or choose All subjects.' : 'Files from your teacher will appear here when they are shared.'}</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs font-medium text-slate-500">{filteredChapters.length} chapter{filteredChapters.length === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-1 items-start gap-4">
            {filteredChapters.map((chapter) => {
              const expanded = expandedMaterial === chapter.key;
              const palette = [
                { strip: 'from-violet-500 to-indigo-500', tile: 'bg-violet-50 text-violet-600' },
                { strip: 'from-emerald-500 to-teal-500', tile: 'bg-emerald-50 text-emerald-700' },
                { strip: 'from-sky-500 to-blue-500', tile: 'bg-sky-50 text-sky-700' },
                { strip: 'from-amber-400 to-orange-500', tile: 'bg-amber-50 text-amber-700' },
              ];
              const tone = palette[Array.from(chapter.subject).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % palette.length];
              return (
                <article key={chapter.key} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5">
                  <div className={`h-1 bg-gradient-to-r ${tone.strip}`} />
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.tile}`}><BookOpen size={19} /></div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700"><GraduationCap size={14} />{chapter.subject}</span>
                      <h2 className="min-w-0 break-words text-sm font-bold leading-snug">{chapter.chapter}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><User size={13} />Uploaded by {Array.from(chapter.teachers).join(', ')}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={13} />{formatDate(chapter.date)}</span>
                    </div>
                    <button type="button" aria-expanded={expanded} aria-controls={`chapter-materials-${encodeURIComponent(chapter.key)}`} onClick={() => { setExpandedMaterial(expanded ? null : chapter.key); if (!expanded) [...new Set(chapter.attachments.map((item) => item.materialId))].forEach(trackMaterialView); }} className="ml-auto flex shrink-0 items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                      <span className="inline-flex items-center gap-2"><Paperclip size={15} />{chapter.attachments.length} attachment{chapter.attachments.length === 1 ? '' : 's'}</span>
                      <span className="inline-flex items-center gap-1 text-xs">{expanded ? 'Hide' : 'View materials'}<ChevronDown size={15} className={expanded ? 'rotate-180' : ''} /></span>
                    </button>
                  </div>
                  {expanded && <div id={`chapter-materials-${encodeURIComponent(chapter.key)}`} className="space-y-2 border-t border-indigo-100 bg-indigo-50/30 p-3">
                    {chapter.attachments.map((attachment, index) => {
                      const label = attachmentLabel(attachment);
                      const Icon = getFileIcon(attachment.type);
                      const url = getAttachmentOpenUrl(attachment);
                      return <div key={attachment.url || index} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={20} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{label} {index + 1}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{attachment.teacher} &middot; {formatDate(attachment.date)}{attachment.size ? ` / ${formatFileSize(attachment.size)}` : ''}</p>
                        </div>
                        {url ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => trackMaterialView(attachment.materialId)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Open<ArrowUpRight size={13} /></a> : <span className="text-xs text-slate-500">Unavailable</span>}
                      </div>;
                    })}
                  </div>}
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
};

export default StudyMaterials;
