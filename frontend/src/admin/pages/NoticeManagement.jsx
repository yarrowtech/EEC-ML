import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell, Plus, Trash2,
  Send, Eye, Clock, FileText, X, Search, Users, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

const API_BASE = import.meta.env.VITE_API_URL || '';

const DEFAULT_FORM = {
  title: '',
  message: '',
  type: 'notice',
  typeLabel: '',
  audience: 'All',
  classId: '',
  sectionId: '',
  priority: 'medium',
  category: 'general',
};

const PRIORITY_STYLES = {
  high:   { bar: 'bg-red-500',   badge: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-500' },
  medium: { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  low:    { bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-300' },
};

const AUDIENCE_STYLES = {
  All:     'bg-slate-100 text-slate-700 border-slate-200',
  Student: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Parent:  'bg-purple-50 text-purple-700 border-purple-200',
  Teacher: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const NoticeManagement = ({ setShowAdminHeader, viewMode = 'view' }) => {
  const [loading, setLoading]           = useState(false);
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses]           = useState([]);
  const [sections, setSections]         = useState([]);
  const [notices, setNotices]           = useState([]);
  const [attachments, setAttachments]   = useState([]);
  const [isUploading, setIsUploading]   = useState(false);
  const [form, setForm]                 = useState(DEFAULT_FORM);
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState('');
  const isPostView = viewMode === 'post';
  const isViewPage = viewMode === 'view';

  const currentAdminId = useMemo(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return '';
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded));
      return String(decoded?.id || decoded?._id || '');
    } catch {
      return '';
    }
  }, []);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      authorization: token ? `Bearer ${token}` : '',
    };
  }, []);

  const apiRequest = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [yearData, classData, sectionData, noticeData] = await Promise.all([
        apiRequest('/api/academic/years'),
        apiRequest('/api/academic/classes'),
        apiRequest('/api/academic/sections'),
        apiRequest('/api/notifications'),
      ]);
      setAcademicYears(Array.isArray(yearData) ? yearData : []);
      setClasses(Array.isArray(classData) ? classData : []);
      setSections(Array.isArray(sectionData) ? sectionData : []);
      setNotices(Array.isArray(noticeData) ? noticeData : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setShowAdminHeader?.(false);
    loadData();
  }, [setShowAdminHeader]);

  useEffect(() => {
    if (!academicYears.length) return;
    const activeYear = academicYears.find((year) => Boolean(year?.isActive));
    const preferredYearId = activeYear?._id || academicYears[0]?._id || '';
    setSelectedAcademicYearId((current) => current || String(preferredYearId));
  }, [academicYears]);

  const selectedAcademicYear = useMemo(
    () => academicYears.find((year) => String(year._id) === String(selectedAcademicYearId)) || null,
    [academicYears, selectedAcademicYearId]
  );

  const classOptions = useMemo(() => {
    const source = selectedAcademicYearId
      ? classes.filter((cls) => String(cls.academicYearId || '') === String(selectedAcademicYearId))
      : classes;
    return source.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { numeric: true }));
  }, [classes, selectedAcademicYearId]);

  const sectionOptions = useMemo(() => {
    if (!form.classId) return [];
    return sections.filter((sec) => String(sec.classId) === String(form.classId));
  }, [sections, form.classId]);

  useEffect(() => {
    if (!selectedAcademicYearId) return;
    if (!classOptions.some((cls) => String(cls._id) === String(form.classId))) {
      setForm((current) => ({ ...current, classId: '', sectionId: '' }));
    }
  }, [classOptions, form.classId, selectedAcademicYearId]);

  useEffect(() => {
    if (!form.classId) return;
    if (!sectionOptions.some((sec) => String(sec._id) === String(form.sectionId))) {
      setForm((current) => ({ ...current, sectionId: '' }));
    }
  }, [form.classId, form.sectionId, sectionOptions]);

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (n.type === 'class_note') return false;
      const title = String(n?.title || '').toLowerCase();
      const typeLabel = String(n?.typeLabel || '').toLowerCase();
      const isLeaveRequestNotice = typeLabel.includes('leave request') || title.includes('leave request');
      if (isLeaveRequestNotice) return false;
      // Hide system-generated support/issue resolution alerts from notices page
      const isSupportAlert =
        String(n?.createdByType || '').toLowerCase() === 'super_admin' &&
        String(n?.audience || '').toLowerCase() === 'admin' &&
        (title.includes('resolved') || title.includes('support request'));
      if (isSupportAlert) return false;
      return true;
    });
  }, [notices]);

  const searchedNotices = useMemo(() => {
    if (!searchQuery.trim()) return filteredNotices;
    const q = searchQuery.toLowerCase();
    return filteredNotices.filter(
      (n) =>
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q)
    );
  }, [filteredNotices, searchQuery]);

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM, type: 'notice', audience: 'All' });
    setAttachments([]);
  };

  const uploadAttachment = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are allowed'); return; }
    const token = localStorage.getItem('token');
    if (!token) { toast.error('Unauthorized'); return; }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'notices');
      formData.append('tags', 'notice,pdf');
      const res = await fetch(`${API_BASE}/api/uploads/cloudinary/single`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      const uploaded = data?.files?.[0];
      if (uploaded?.secure_url) {
        setAttachments((prev) => [
          ...prev,
          {
            name: uploaded.originalName || file.name,
            url: uploaded.secure_url,
            size: uploaded.bytes || file.size,
            type: uploaded.format || 'pdf',
          },
        ]);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const submitNotice = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { toast.error('Title and message are required'); return; }
    try {
      await apiRequest('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          typeLabel: form.typeLabel,
          classId: form.classId || undefined,
          sectionId: form.sectionId || undefined,
          attachments,
        }),
      });
      toast.success('Notice published');
      resetForm();
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Unable to publish notice');
    }
  };

  const deleteNotice = async (id) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete notice?',
      text: 'This notice will be removed for recipients.',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      await apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
      toast.success('Notice deleted');
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Unable to delete notice');
    }
  };

  const resolveClassName   = (id) => classes.find((c) => String(c._id) === String(id))?.name || '—';
  const resolveSectionName = (id) => sections.find((s) => String(s._id) === String(id))?.name || '—';

  const formatDate = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Gradient Header ── */}
      <div className="relative overflow-hidden bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 px-6 py-6 shadow-lg">
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-400/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-500/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isPostView ? 'New Notice' : 'Published Notices'}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {isPostView ? 'Create and publish a new notice' : 'Review notices already published'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {isPostView ? (
          <div className="mx-auto max-w-4xl">
            <form onSubmit={submitNotice}>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

              {/* Form header */}
              <div className="px-5 py-4 bg-linear-to-r from-indigo-600 to-indigo-500 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">New Notice</h2>
                  <p className="text-xs text-indigo-200">Fill details and publish</p>
                </div>
              </div>

              <div className="px-5 py-5 space-y-4">

                {/* Session */}
                <div>
                  <label className={labelCls}>Session</label>
                  <select
                    className={inputCls}
                    value={selectedAcademicYearId}
                    onChange={(e) => {
                      setSelectedAcademicYearId(e.target.value);
                      setForm((current) => ({ ...current, classId: '', sectionId: '' }));
                    }}
                  >
                    {academicYears.length === 0 ? (
                      <option value="">No sessions found</option>
                    ) : (
                      academicYears.map((year) => (
                        <option key={year._id} value={year._id}>
                          {year.name}{year.isActive ? ' (active)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedAcademicYear && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Showing classes from {selectedAcademicYear.name}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className={labelCls}>Title <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <input
                    className={inputCls}
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Enter notice title…"
                    required
                  />
                </div>

                {/* Message */}
                <div>
                  <label className={labelCls}>Message <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <textarea
                    rows={4}
                    className={`${inputCls} resize-none`}
                    value={form.message}
                    onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Write your message here…"
                    required
                  />
                </div>

                <div className="border-t border-slate-100" />

                {/* Category + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select className={inputCls} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="events">Events</option>
                      <option value="transport">Transport</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                      <option value="notice">Notice</option>
                      <option value="announcement">Announcement</option>
                      <option value="assignment">Assignment</option>
                      <option value="exam">Exam</option>
                      <option value="result">Result</option>
                      <option value="fee">Fee</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Class + Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Class</label>
                    <select
                      className={inputCls}
                      value={form.classId}
                      onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, sectionId: '' }))}
                      disabled={!selectedAcademicYearId}
                    >
                      <option value="">{selectedAcademicYearId ? 'All classes' : 'Select session first'}</option>
                      {classOptions.map((cls) => (
                        <option key={cls._id} value={cls._id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Section</label>
                    <select
                      className={inputCls}
                      value={form.sectionId}
                      onChange={(e) => setForm((p) => ({ ...p, sectionId: e.target.value }))}
                      disabled={!form.classId}
                    >
                      <option value="">{form.classId ? 'All sections' : 'Select class first'}</option>
                      {sectionOptions.map((sec) => (
                        <option key={sec._id} value={sec._id}>{sec.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority + Audience */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Priority</label>
                    <select className={inputCls} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Audience</label>
                    <select className={inputCls} value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}>
                      <option value="All">All</option>
                      <option value="Student">Students</option>
                      <option value="Parent">Parents</option>
                      <option value="Teacher">Teachers</option>
                    </select>
                  </div>
                </div>

                {/* Custom label */}
                {form.type === 'other' && (
                  <div>
                    <label className={labelCls}>Custom Label</label>
                    <input
                      className={inputCls}
                      value={form.typeLabel}
                      onChange={(e) => setForm((p) => ({ ...p, typeLabel: e.target.value }))}
                      placeholder="e.g., Holiday"
                    />
                  </div>
                )}

                <div className="border-t border-slate-100" />

                {/* PDF Upload */}
                <div>
                  <label className={labelCls}>PDF Attachment <span className="normal-case tracking-normal font-normal text-slate-400">(optional)</span></label>
                  <label className={`flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition ${isUploading ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed' : 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-400 hover:bg-indigo-50'}`}>
                    <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center shadow-sm">
                      <FileText className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">{isUploading ? 'Uploading…' : 'Click to upload PDF'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF files only</p>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); }}
                      disabled={isUploading}
                    />
                  </label>

                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {attachments.map((att, idx) => (
                        <div key={`${att.url}-${idx}`} className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                          <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span className="text-xs text-slate-700 truncate flex-1">{att.name || `Attachment ${idx + 1}`}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-500 transition shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Form footer */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-slate-400 hover:text-slate-600 transition"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md shadow-indigo-200"
                >
                  <Send className="h-4 w-4" />
                  {loading ? 'Publishing…' : 'Publish Notice'}
                </button>
              </div>
            </div>
            </form>
          </div>
        ) : null}

        {isViewPage ? (
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

              {/* List header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Published Notices</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {searchedNotices.length} {searchedNotices.length === 1 ? 'notice' : 'notices'}
                    {searchQuery && ` matching "${searchQuery}"`}
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search notices…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 w-48 transition"
                  />
                </div>
              </div>

              {/* List body */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-100 border-t-indigo-600" />
                </div>
              ) : searchedNotices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Bell className="h-7 w-7 text-indigo-200" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">No notices found</p>
                  <p className="text-xs text-slate-300">Publish a new notice using the form</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[72vh] overflow-y-auto">
                  {searchedNotices.map((notice) => {
                    const priority = notice.priority || 'medium';
                    const ps = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
                    const audienceStyle = AUDIENCE_STYLES[notice.audience] || AUDIENCE_STYLES.All;
                    const isSuperAdminNotice =
                      String(notice?.createdByType || '').toLowerCase() === 'super_admin' ||
                      String(notice?.typeLabel || '').toLowerCase() === 'super admin broadcast';
                    const createdById = String(notice?.createdBy || '');
                    const byYou = currentAdminId && createdById && currentAdminId === createdById;
                    const creatorMeta = byYou
                      ? 'By You'
                      : notice?.createdByName
                        ? `By ${notice.createdByName}`
                        : notice?.schoolId
                          ? `School ${String(notice.schoolId).slice(-6)}`
                          : '';
                    return (
                      <div key={notice._id} className="flex group hover:bg-slate-50/80 transition-colors">
                        {/* Priority accent bar */}
                        <div className={`w-1 shrink-0 ${ps.bar}`} />

                        <div className="flex-1 px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              {/* Icon */}
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 border border-indigo-100">
                                <Bell className="h-4 w-4 text-indigo-500" />
                              </div>

                              <div className="min-w-0 flex-1">
                                {/* Title */}
                                <p className="text-sm font-semibold text-slate-900 leading-tight">{notice.title}</p>

                                {/* Message */}
                                <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{notice.message}</p>

                                {/* Badges */}
                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ps.badge}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${ps.dot}`} />
                                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                  </span>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${audienceStyle}`}>
                                    <Users className="h-3 w-3" />
                                    {notice.audience || 'All'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                    <Tag className="h-3 w-3" />
                                    {notice.typeLabel || notice.type}
                                  </span>
                                </div>

                                {/* Meta */}
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                  {(notice.classId || notice.sectionId) && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {notice.classId ? resolveClassName(notice.classId) : 'All classes'}
                                      {notice.sectionId ? ` · ${resolveSectionName(notice.sectionId)}` : ' · All sections'}
                                    </span>
                                  )}
                                  {creatorMeta && (
                                    <span>{creatorMeta}</span>
                                  )}
                                  {!isSuperAdminNotice && (
                                    <span className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      {Number(notice.views) || 0} views
                                    </span>
                                  )}
                                  {notice.createdAt && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(notice.createdAt)}
                                    </span>
                                  )}
                                  {Array.isArray(notice.attachments) && notice.attachments.length > 0 && (
                                    <span className="flex items-center gap-1 text-indigo-400">
                                      <FileText className="h-3 w-3" />
                                      {notice.attachments.length} file{notice.attachments.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Delete */}
                            {!isSuperAdminNotice && (
                              <button
                                type="button"
                                onClick={() => deleteNotice(notice._id)}
                                className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition shrink-0 opacity-0 group-hover:opacity-100"
                                title="Delete notice"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default NoticeManagement;
