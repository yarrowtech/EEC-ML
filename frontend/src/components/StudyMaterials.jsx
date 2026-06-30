import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  File,
  Image as ImageIcon,
  Paperclip,
  Loader,
  Search,
  Filter,
  Calendar,
  User,
  ChevronDown,
  AlertCircle,
  Sparkles,
  GraduationCap,
  NotebookPen,
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
  const STUDY_MATERIALS_CACHE_TTL_MS = 2 * 60 * 1000;

  const token = localStorage.getItem('token');

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchMaterials();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [fetchMaterials]);

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (selectedSubject !== 'all') params.append('subject', selectedSubject);
      if (searchQuery) params.append('search', searchQuery);

      const url = `${STUDY_MATERIALS_ENDPOINT}?${params}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch materials');

      const data = await response.json();
      setMaterials(data.materials || []);
    } catch (err) {
      console.error('Failed to fetch materials:', err);
      setError(err.message);
      toast.error('Failed to load study materials');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSubject, token, STUDY_MATERIALS_ENDPOINT]);

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

  const getInlineDocumentUrl = (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    if (url.includes('docs.google.com/gview')) return url;
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
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

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((material) => {
      const matchesSearch =
        !searchQuery ||
        material.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.message?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject =
        selectedSubject === 'all' || material.subjectName === selectedSubject;

      return matchesSearch && matchesSubject;
    });
  }, [materials, searchQuery, selectedSubject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm text-slate-500">Loading study materials...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.10),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_26%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.14),_transparent_24%)]" />
          <div className="relative px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-col gap-5">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Student Resource Desk
                </div>
                <h2 className="mt-4 flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  <BookOpen className="h-8 w-8 text-sky-600" />
                  Study Materials
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  Notes, handouts, and classroom resources shared by your teachers. Use the filters below to quickly find the exact material you need.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search materials by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div className="relative lg:w-72">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject === 'all' ? 'All Subjects' : subject}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {(searchQuery || selectedSubject !== 'all') && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="font-medium">
                  Showing {filteredMaterials.length} of {materials.length} materials
                </span>
                {searchQuery && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    Search: {searchQuery}
                  </span>
                )}
                {selectedSubject !== 'all' && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Subject: {selectedSubject}
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          <div className="p-4 sm:p-6">
            {filteredMaterials.length === 0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center">
                <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                  <BookOpen className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No Materials Found</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  {searchQuery || selectedSubject !== 'all'
                    ? 'No materials match your current filters. Try adjusting your search or subject selection.'
                    : 'Your teachers have not uploaded any study materials yet. Check back later.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {filteredMaterials.map((material) => {
                  const attachments = Array.isArray(material.attachments)
                    ? material.attachments
                    : [];
                  const isExpanded = expandedMaterial === material._id;

                  return (
                    <article
                      key={material._id}
                      className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_20px_45px_-35px_rgba(14,165,233,0.45)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {material.subjectName && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                <GraduationCap className="h-3 w-3" />
                                {material.subjectName}
                              </span>
                            )}
                            {material.typeLabel && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                                <NotebookPen className="h-3 w-3" />
                                {material.typeLabel}
                              </span>
                            )}
                            {material.priority && (
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  material.priority === 'high'
                                    ? 'border border-red-200 bg-red-50 text-red-700'
                                    : material.priority === 'medium'
                                      ? 'border border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {material.priority}
                              </span>
                            )}
                          </div>

                          <h3 className="flex items-start gap-3 text-lg font-semibold leading-tight text-slate-900">
                            <span className="mt-0.5 rounded-xl bg-slate-100 p-2 text-sky-600">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">{material.title}</span>
                          </h3>
                        </div>

                        <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                          <p className="text-lg font-bold text-slate-900">{attachments.length}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Files</p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        {material.message || 'No description added by the teacher.'}
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-3 text-xs text-slate-500 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            Teacher
                          </div>
                          <p className="mt-1 truncate">{material.createdByName || 'Teacher'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            Shared On
                          </div>
                          <p className="mt-1">{formatDate(material.createdAt)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            Class
                          </div>
                          <p className="mt-1">
                            {material.className || 'Class'}
                            {material.sectionName ? ` - ${material.sectionName}` : ''}
                          </p>
                        </div>
                      </div>

                      {attachments.length > 0 && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                          <button
                            onClick={() => {
                              if (!isExpanded) {
                                trackMaterialView(material._id);
                              }
                              setExpandedMaterial(isExpanded ? null : material._id);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            <Paperclip className="h-4 w-4" />
                            {isExpanded ? 'Hide Attachments' : 'Open Attachments'}
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-sky-700">
                              {attachments.length}
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="mt-4 grid grid-cols-1 gap-3">
                              {attachments.map((attachment, idx) => {
                                const FileIcon = getFileIcon(attachment?.type);
                                return (
                                  <a
                                    key={idx}
                                    href={getInlineDocumentUrl(attachment?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackMaterialView(material._id)}
                                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-sky-200 hover:bg-sky-50"
                                  >
                                    <div className="rounded-xl bg-white p-2 shadow-sm">
                                      <FileIcon className="h-5 w-5 text-sky-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {attachment?.name || `File ${idx + 1}`}
                                      </p>
                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {formatFileSize(attachment?.size) || 'Open attachment'}
                                      </p>
                                    </div>
                                    <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                                      Open
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {filteredMaterials.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {filteredMaterials.length} material{filteredMaterials.length !== 1 ? 's' : ''} from {materials.length} total
                </span>
                <button
                  onClick={() => fetchMaterials({ forceRefresh: true })}
                  className="font-semibold text-sky-700 transition hover:text-sky-800"
                >
                  Refresh materials
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudyMaterials;
