import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen,
  FileText,
  File,
  Image as ImageIcon,
  Paperclip,
  Loader,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  X,
  AlertCircle,
  GraduationCap,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';

const StudyMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  // Focus once the box has started sliding open.
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null); // null = subject list
  const [expandedChapter, setExpandedChapter] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);
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

  const trackMaterialActivity = async (materialId, action, details) => {
    try {
      await fetch(`${STUDY_MATERIALS_ENDPOINT}/${materialId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(details)
      });
    } catch (err) {
      console.error(`Error tracking material ${action}:`, err);
    }
  };
  const trackMaterialView = (materialId) => trackMaterialActivity(materialId, 'view', { timeSpent: 0 });


  const chapters = useMemo(() => {
    const groups = new Map();
    materials.forEach((material) => {
      const subject = String(material.subjectName || 'Other subjects').trim();
      const lessonTitle = String(material.chapterTitle || '').trim();
      const topicTitle = String(material.topicTitle || '').trim();
      const unitTitle = String(material.unitTitle || '').trim();
      const unitNumber = material.unitNumber;
      const unit = unitTitle || (unitNumber ? `Chapter ${unitNumber}` : '');
      const chapter = unit || lessonTitle || 'General materials';
      const topic = topicTitle && topicTitle.toLowerCase() !== chapter.toLowerCase()
        ? topicTitle
        : (lessonTitle && lessonTitle.toLowerCase() !== chapter.toLowerCase() ? lessonTitle : 'Chapter materials');
      const key = `${subject.toLowerCase()}::${chapter.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { key, subject, chapter, unitNumber, topics: new Map(), fileCount: 0, teachers: new Set(), date: null });
      const group = groups.get(key);
      const teacher = material.teacherName || material.createdByName || 'Your teacher';
      const date = material.publishedAt || material.createdAt;
      if (!group.date || new Date(date) > new Date(group.date)) group.date = date;
      group.teachers.add(teacher);
      (material.attachments || []).forEach((attachment) => {
        const attachmentKey = String(attachment.url || attachment._id || '').split(/[?#]/)[0];
        if (!attachmentKey) return;
        const topicKey = topic.toLowerCase();
        if (!group.topics.has(topicKey)) group.topics.set(topicKey, { title: topic, attachments: [], seen: new Set() });
        const topicGroup = group.topics.get(topicKey);
        if (topicGroup.seen.has(attachmentKey)) return;
        topicGroup.seen.add(attachmentKey);
        topicGroup.attachments.push({ ...attachment, materialId: material._id, teacher, date });
        group.fileCount += 1;
      });
    });
    return Array.from(groups.values()).filter((group) => group.fileCount > 0);
  }, [materials]);

  // One card per subject: chapter + file count and latest upload.
  const subjects = useMemo(() => {
    const map = new Map();
    chapters.forEach((c) => {
      const s = map.get(c.subject) || { name: c.subject, chapters: 0, files: 0, date: null };
      s.chapters += 1; s.files += c.fileCount;
      if (!s.date || new Date(c.date) > new Date(s.date)) s.date = c.date;
      map.set(c.subject, s);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [chapters]);

  const filteredSubjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subjects.filter((s) => !query || s.name.toLowerCase().includes(query));
  }, [subjects, searchQuery]);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); };

  const openSubject = (name) => {
    setSelectedSubject(name);
    closeSearch();
    setExpandedChapter(null);
    setExpandedTopic(null);
  };
  const backToSubjects = () => openSubject(null);

  const toneFor = (subject) => {
    const palette = [
      { strip: 'from-violet-500 to-indigo-500', tile: 'bg-violet-50 text-violet-600', badge: 'bg-violet-700' },
      { strip: 'from-emerald-500 to-teal-500', tile: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-700' },
      { strip: 'from-sky-500 to-blue-500', tile: 'bg-sky-50 text-sky-700', badge: 'bg-sky-700' },
      { strip: 'from-amber-400 to-orange-500', tile: 'bg-amber-50 text-amber-700', badge: 'bg-amber-700' },
    ];
    return palette[Array.from(subject).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % palette.length];
  };

  const filteredChapters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const chapterNumber = (chapter) => chapter.unitNumber ?? Number(chapter.chapter.match(/^chapter\s+(\d+)/i)?.[1] || 0);
    let lastNumber = 0;
    return chapters.filter((chapter) => chapter.subject === selectedSubject)
      .sort((a, b) => (chapterNumber(a) || Infinity) - (chapterNumber(b) || Infinity)
        || a.chapter.localeCompare(b.chapter, undefined, { numeric: true }))
      .map((chapter) => {
        const number = chapterNumber(chapter) || lastNumber + 1;
        lastNumber = number;
        return { ...chapter, number };
      })
      .filter((chapter) => !query || [chapter.chapter, chapter.subject, ...chapter.topics.keys(), ...chapter.teachers]
        .join(' ').toLowerCase().includes(query));
  }, [chapters, searchQuery, selectedSubject]);

  const attachmentLabel = (attachment) => {
    const hint = `${attachment.type || ''} ${attachment.name || ''} ${String(attachment.url || '').split('?')[0]}`;
    if (/image|\.(jpe?g|jfif|png|webp|gif)/i.test(hint)) return 'Image';
    if (/video|\.(mp4|webm|mov)/i.test(hint)) return 'Video';
    if (/presentation|powerpoint|\.pptx?/i.test(hint)) return 'Slides';
    if (/pdf/i.test(hint)) return 'PDF';
    return 'Document';
  };

  return (
    <main className="m-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f8f9fd] p-4 text-slate-900 shadow-sm sm:rounded-3xl sm:px-5">
      <div className="mb-5 flex shrink-0 items-center gap-3">
        {selectedSubject && (
          <button type="button" onClick={backToSubjects} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft size={14} /> All subjects
          </button>
        )}
        <div className={`min-w-0 flex-1 ${searchOpen ? 'hidden sm:block' : ''}`}>
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{selectedSubject || 'Study Materials'}</h1>
          {!selectedSubject && <p className="mt-0.5 text-sm text-slate-500">Choose a subject to see the materials your teachers shared.</p>}
        </div>
        <div className={`ml-auto flex items-center gap-2 ${searchOpen ? 'flex-1 sm:flex-none' : ''}`}>
          <label aria-hidden={!searchOpen} className={`relative block overflow-hidden p-0.5 transition-all duration-300 ease-out ${searchOpen ? 'w-full max-w-72 opacity-100 sm:w-72' : 'w-0 max-w-0 opacity-0'}`}>
              <span className="sr-only">{selectedSubject ? 'Search chapters, topics, or teachers' : 'Search subjects'}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input ref={searchInputRef} tabIndex={searchOpen ? 0 : -1} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') closeSearch(); }} placeholder={selectedSubject ? 'Search chapters or topics' : 'Search subject'} className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </label>
          <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))} aria-label={searchOpen ? 'Close search' : 'Open search'} title={searchOpen ? 'Close search' : 'Search'} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900">
            <Motion.span key={searchOpen ? 'x' : 's'} initial={{ rotate: -90, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.2 }} className="flex">{searchOpen ? <X size={16} /> : <Search size={16} />}</Motion.span>
          </button>
        </div>
      </div>
      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}<button type="button" onClick={fetchMaterials} className="ml-auto shrink-0 font-semibold underline">Try again</button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-2 custom-scrollbar" role="region" aria-label="Chapter materials" tabIndex={0}>
      {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader className="h-5 w-5 animate-spin" />Loading your materials...</div> : !selectedSubject ? (
        filteredSubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-violet-400" />
            <h2 className="font-semibold">{subjects.length ? 'No subjects match your search' : 'No materials shared yet'}</h2>
            <p className="mt-1 text-sm text-slate-500">{subjects.length ? 'Try another subject name.' : 'Files from your teacher will appear here when they are shared.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSubjects.map((subject) => {
              const tone = toneFor(subject.name);
              return (
                <button key={subject.name} type="button" onClick={() => openSubject(subject.name)} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                  <div className={`h-1 bg-gradient-to-r ${tone.strip}`} />
                  <div className="flex items-center gap-3 p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone.badge} text-white shadow-sm`}><GraduationCap size={22} /></div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-bold">{subject.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{subject.chapters} chapter{subject.chapters === 1 ? '' : 's'} · {subject.files} file{subject.files === 1 ? '' : 's'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Last updated {formatDate(subject.date)}</p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : filteredChapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-violet-400" />
          <h2 className="font-semibold">No chapters match your search</h2>
          <p className="mt-1 text-sm text-slate-500">Try another chapter, topic, or teacher name.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs font-medium text-slate-500">{filteredChapters.length} chapter{filteredChapters.length === 1 ? '' : 's'}</p>
          <div className="grid grid-cols-1 items-start gap-4">
            {filteredChapters.map((chapter) => {
              const expanded = expandedChapter === chapter.key;
              const tone = toneFor(chapter.subject);
              const chapterPanelId = `chapter-materials-${encodeURIComponent(chapter.key)}`;
              return (
                <article key={chapter.key} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/5">
                  <div className={`h-1 bg-gradient-to-r ${tone.strip}`} />
                  <h2>
                    <button type="button" aria-expanded={expanded} aria-controls={expanded ? chapterPanelId : undefined} onClick={() => { setExpandedChapter(expanded ? null : chapter.key); setExpandedTopic(null); }} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-indigo-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.badge} text-sm font-bold text-white shadow-sm`} aria-label={`Chapter ${chapter.number}`}>{chapter.number}</span>
                      <span className="min-w-0 flex-1 break-words text-sm font-bold">{chapter.chapter}</span>
                      <span className="text-xs font-medium text-slate-500">{chapter.topics.size} {chapter.topics.size === 1 ? 'topic' : 'topics'}</span>
                      <ChevronDown size={16} aria-hidden="true" className={`text-indigo-700 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </h2>
                  {expanded && <div id={chapterPanelId} className="space-y-2 border-t border-indigo-100 bg-indigo-50/30 p-3">
                    {Array.from(chapter.topics.values()).map((topic, topicIndex) => {
                      const topicOpen = expandedTopic === topic.title;
                      const topicPanelId = `${chapterPanelId}-topic-${topicIndex + 1}`;
                      return (
                        <section key={topic.title} className="overflow-hidden rounded-xl border border-indigo-100 bg-white">
                          <h3>
                            <button
                              type="button"
                              aria-expanded={topicOpen}
                              aria-controls={topicOpen ? topicPanelId : undefined}
                              onClick={() => {
                                setExpandedTopic(topicOpen ? null : topic.title);
                                if (!topicOpen) new Set(topic.attachments.map((item) => item.materialId)).forEach(trackMaterialView);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-bold hover:bg-indigo-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600"
                            >
                              <span className="min-w-0 flex-1 break-words">{chapter.number}.{topicIndex + 1} {topic.title}</span>
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500"><Paperclip size={14} />{topic.attachments.length} {topic.attachments.length === 1 ? 'file' : 'files'}</span>
                              <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-indigo-700 ${topicOpen ? 'rotate-180' : ''}`} />
                            </button>
                          </h3>
                          {topicOpen && <div id={topicPanelId} className="space-y-2 border-t border-indigo-100 bg-slate-50 p-3">
                            {topic.attachments.map((attachment, index) => {
                              const label = attachmentLabel(attachment);
                              const Icon = getFileIcon(attachment.type);
                              const url = getAttachmentOpenUrl(attachment);
                              const downloadUrl = getSafeAttachmentUrl(attachment.downloadUrl) || getSafeAttachmentUrl(attachment.url);
                              return (
                                <div key={attachment.url || index} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={20} /></span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold">{label} {index + 1}</p>
                                    <p className="mt-0.5 text-xs text-slate-600">Posted by: {attachment.teacher} &middot; {formatDate(attachment.date)}{attachment.size ? ` / ${formatFileSize(attachment.size)}` : ''}</p>
                                  </div>
                                  {url ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => trackMaterialView(attachment.materialId)} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Open<ArrowUpRight size={13} /></a> : <span className="text-xs text-slate-500">Unavailable</span>}
                                  {downloadUrl && (
                                    <a href={downloadUrl} download={attachment.name || true} target="_blank" rel="noopener noreferrer" onClick={() => trackMaterialActivity(attachment.materialId, 'download', { attachmentName: attachment.name || label })} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                                      <Download size={13} /> Download
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>}
                        </section>
                      );
                    })}
                  </div>}
                </article>
              );
            })}
          </div>
        </>
      )}
      </div>
    </main>
  );
};

export default StudyMaterials;
