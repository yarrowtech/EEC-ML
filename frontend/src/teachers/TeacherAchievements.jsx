import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import GeneratedCertificate from '../parents/GeneratedCertificate';
import { useTenant } from '../context/TenantContext';
import { Award, ChevronLeft, ChevronRight, Edit3, Settings2, Eye, FileText, Info, Loader2, Paperclip, Plus, RefreshCw, Search, Trophy, Trash2, Upload, Users, X, Edit } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';
const norm = (v = '') => String(v || '').trim().toLowerCase();

/* ─── Certificate upload constraints (mirrors the backend) ───────────── */
const CERTIFICATE_MAX_BYTES = 2 * 1024 * 1024;
const CERTIFICATE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';
const CERTIFICATE_TYPES = new Set(CERTIFICATE_ACCEPT.split(','));
/** Validates a picked File; returns it if OK, otherwise toasts and returns null. */
const validateCertificate = (file) => {
  if (!file) return null;
  const type = String(file.type || '').toLowerCase();
  if (type && !CERTIFICATE_TYPES.has(type)) {
    toast.error('Certificate must be a photo (JPG/PNG/WebP) or a PDF.');
    return null;
  }
  if (file.size > CERTIFICATE_MAX_BYTES) {
    toast.error('Certificate must be 2MB or smaller.');
    return null;
  }
  return file;
};
const isImageFile = (file) => String(file?.type || '').startsWith('image/');

/* ─── Client cache (stale-while-revalidate) ─────────────────
 * Cached responses render instantly on revisit; a background request then
 * refreshes them. Stored in memory + sessionStorage, keyed per auth token so
 * accounts never share data; entries older than CACHE_MAX_AGE are ignored. */
const CACHE_PREFIX = 'eec:teacher-achievements:';
const CACHE_MAX_AGE = 30 * 60 * 1000;
const memCache = new Map();
const tokenTag = (headers) => {
  const t = String(headers?.Authorization || '');
  let h = 0;
  for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) | 0;
  return h.toString(36);
};
const cacheKey = (url, headers) => `${CACHE_PREFIX}${tokenTag(headers)}:${url}`;
const readCache = (url, headers) => {
  const key = cacheKey(url, headers);
  let entry = memCache.get(key);
  if (!entry) {
    try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; }
  }
  if (!entry || Date.now() - entry.at > CACHE_MAX_AGE) return undefined;
  memCache.set(key, entry);
  return entry.data;
};
const writeCache = (url, headers, data) => {
  const key = cacheKey(url, headers);
  const entry = { at: Date.now(), data };
  memCache.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* quota / private mode */ }
};
/** Calls onData with the cached value now (if any) and again with fresh data.
 *  Returns { value, promise } — value is the cached data or undefined. */
const cachedGet = (url, headers, onData) => {
  const value = readCache(url, headers);
  if (value !== undefined) onData(value);
  const promise = axios.get(url, { headers }).then(({ data }) => {
    writeCache(url, headers, data);
    onData(data);
    return data;
  });
  return { value, promise };
};

/* ─── Shared input style ─────────────────────────────────── */
const inp =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed';

/* Pill-shaped inputs used by the Add form */
const pillBase =
  'w-full border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed';
const pill = `${pillBase} rounded-full px-4 py-2.5`;
const pillArea = `${pillBase} rounded-3xl px-4 py-3 resize-none`;

/* ─── Field label wrapper ────────────────────────────────── */
const Field = ({ label, required, children }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
      {label}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
    {children}
  </div>
);

/* ─── Numbered step title (add form) ─────────────────────── */
const StepTitle = ({ n, title, hint }) => (
  <div className="mb-4 flex items-start gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
      {n}
    </span>
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  </div>
);

/* ─── Round avatar: profile photo, falling back to initials ─ */
const StudentAvatar = ({ name, photo }) => {
  const [failed, setFailed] = useState(false);
  const initials = String(name || 'S').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return photo && !failed ? (
    <img src={photo} alt={name || ''} onError={() => setFailed(true)} className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{initials}</span>
  );
};

/* ─── Avatar chip ────────────────────────────────────────── */
const StudentChip = ({ student, selected, onClick, disabled }) => {
  const name    = student.name || 'Student';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const roll    = student.roll || student.rollNo || student.rollNumber || '';
  const photo   = student.profilePic || student.profileImage || student.photo || '';
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <label
      className={[
        'flex w-full cursor-pointer items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all duration-150',
        selected
          ? 'bg-indigo-50 border-indigo-400 text-indigo-900'
          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50',
        disabled ? 'opacity-60 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onClick}
        disabled={disabled}
        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600"
      />
      {photo && !imgFailed ? (
        <img
          src={photo}
          alt={name}
          onError={() => setImgFailed(true)}
          className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
          {initials}
        </span>
      )}
      <span className="flex flex-col min-w-0">
        <span className="text-xs font-semibold truncate leading-tight">{name}</span>
        {roll && <span className="text-[10px] text-slate-400">Roll {roll}</span>}
      </span>
    </label>
  );
};


/* ─── Edit modal ─────────────────────────────────────────── */
const EditModal = ({ item, onClose, onSave, saving, onViewCurrent }) => {
  const [form, setForm] = useState({
    title:       item?.title || '',
    date:        item?.date ? new Date(item.date).toISOString().slice(0, 10) : '',
    description: item?.description || '',
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const { name: schoolName, logo: schoolLogo } = useTenant();
  const showAuto = !item?.hasCertificate && !certificateFile;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className={`w-full ${showAuto ? "max-w-5xl" : "max-w-lg"} rounded-2xl bg-white shadow-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Edit Achievement</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className={showAuto ? "grid max-h-[80vh] grid-cols-1 overflow-y-auto md:grid-cols-[1fr_1.3fr]" : ""}>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form, certificateFile); }} className="space-y-3 p-5">
          <Field label="Title">
            <input type="text" value={form.title} onChange={set('title')} className={inp} required placeholder="Achievement title" />
          </Field>
          <Field label="Achievement Date">
            <input type="date" value={form.date} onChange={set('date')} className={inp} required />
          </Field>
          <Field label="Details">
            <textarea value={form.description} onChange={set('description')} rows={3} className={`${inp} rounded-xl resize-none`} placeholder="Achievement details…" />
          </Field>
          <Field label={item?.hasCertificate ? 'Replace certificate (optional)' : 'Certificate / Photo (optional)'}>
            {certificateFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
                {isImageFile(certificateFile) ? (
                  <img src={URL.createObjectURL(certificateFile)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><FileText size={17} /></span>
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{certificateFile.name}</p>
                <button type="button" onClick={() => setCertificateFile(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Remove">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40">
                  <Paperclip size={14} className="text-slate-400" />
                  <span>{item?.hasCertificate ? 'Choose new file' : 'Attach certificate'}</span>
                  <span className="ml-auto text-[11px] font-normal text-slate-400">max 2MB</span>
                  <input
                    type="file"
                    accept={CERTIFICATE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const picked = validateCertificate(e.target.files?.[0]);
                      if (picked) setCertificateFile(picked);
                      e.target.value = '';
                    }}
                  />
                </label>
                {item?.hasCertificate && (
                  <button type="button" onClick={() => onViewCurrent?.(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">
                    View current
                  </button>
                )}
              </div>
            )}
          </Field>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
        {showAuto && (
          <div className="border-t border-slate-100 bg-slate-50 p-5 md:border-l md:border-t-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Auto-generated certificate</p>
            <p className="mb-3 text-[11px] text-slate-400">Updates live as you edit. Attach a file to replace it.</p>
            <GeneratedCertificate
              schoolName={schoolName}
              schoolLogo={schoolLogo}
              studentName={item?.studentName}
              grade={item?.className}
              teacherName={String(item?.issuer || '').replace(/^Class Teacher\s*-\s*/i, '').trim()}
              title={form.title || 'Achievement'}
              description={form.description}
              category={item?.category}
              date={form.date || item?.date}
            />
          </div>
        )}
        </div>
      </Motion.div>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────── */
const TeacherAchievements = () => {
  const { name: schoolName, logo: schoolLogo } = useTenant();
  const [students, setStudents]                               = useState([]);
  const [loadingStudents, setLoadingStudents]                 = useState(false);
  const [, setSessionOptions]                                 = useState([]);
  const [classTeacherAllocations, setClassTeacherAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations]           = useState(false);
  const [selectedSession, setSelectedSession]                 = useState('');
  const [selectedClass, setSelectedClass]                     = useState('');
  const [selectedSection, setSelectedSection]                 = useState('');
  const [selectedStudentIds, setSelectedStudentIds]           = useState([]);
  const [studentSearch, setStudentSearch]                     = useState('');
  const [searchOpen, setSearchOpen]                           = useState(false);
  const [achievements, setAchievements]                       = useState([]);
  const [loadingAchievements, setLoadingAchievements]         = useState(false);
  const [deletingAchievementId, setDeletingAchievementId]     = useState('');
  const [editingRow, setEditingRow]                           = useState(null);
  const [updatingAchievementId, setUpdatingAchievementId]     = useState('');
  const [title, setTitle]                                     = useState('');
  const [achievementDate, setAchievementDate]                 = useState('');
  const [description, setDescription]                         = useState('');
  const [certificateFile, setCertificateFile]                 = useState(null);
  const [submitting, setSubmitting]                           = useState(false);
  const [showAdd, setShowAdd]                                 = useState(false);
  const [tableSearch, setTableSearch]                         = useState('');
  const [certUploading, setCertUploading]                     = useState(false);
  const [certProgress, setCertProgress]                       = useState(0);
  const [certPreviewOpen, setCertPreviewOpen]                 = useState(false);
  const certTimerRef = useRef(null);

  // Object URL for the picked certificate (thumbnail + preview); revoked on change.
  const certPreviewUrl = useMemo(
    () => (certificateFile ? URL.createObjectURL(certificateFile) : ''),
    [certificateFile],
  );
  useEffect(() => () => { if (certPreviewUrl) URL.revokeObjectURL(certPreviewUrl); }, [certPreviewUrl]);
  useEffect(() => () => clearInterval(certTimerRef.current), []);

  // Short animated "uploading" step while the file is read in, before it's attached.
  const startCertUpload = (file) => {
    clearInterval(certTimerRef.current);
    setCertificateFile(null);
    setCertUploading(true);
    setCertProgress(0);
    certTimerRef.current = setInterval(() => {
      setCertProgress((p) => {
        const next = Math.min(100, p + 12 + Math.round(Math.random() * 10));
        if (next >= 100) {
          clearInterval(certTimerRef.current);
          setTimeout(() => { setCertificateFile(file); setCertUploading(false); }, 150);
        }
        return next;
      });
    }, 80);
  };

  const token   = localStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);


  const allowedPairs = useMemo(() => {
    const set = new Set();
    classTeacherAllocations.forEach((i) => {
      const cn = String(i?.className || '').trim();
      const sn = String(i?.sectionName || '').trim();
      if (cn && sn) set.add(`${norm(cn)}__${norm(sn)}`);
    });
    return set;
  }, [classTeacherAllocations]);

  const allowedClassOptions = useMemo(() =>
    [...new Set(classTeacherAllocations.map((i) => String(i?.className || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  [classTeacherAllocations]);

  const allowedSectionOptions = useMemo(() =>
    [...new Set(
      classTeacherAllocations
        .filter((i) => !selectedClass || norm(i?.className) === norm(selectedClass))
        .map((i) => String(i?.sectionName || '').trim())
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  [classTeacherAllocations, selectedClass]);

  useEffect(() => {
    if (selectedClass && !allowedClassOptions.some((i) => norm(i) === norm(selectedClass))) {
      setSelectedClass(''); setSelectedSection(''); setSelectedStudentIds([]);
    } else if (selectedSection && !allowedSectionOptions.some((i) => norm(i) === norm(selectedSection))) {
      setSelectedSection(''); setSelectedStudentIds([]);
    }
  }, [selectedClass, selectedSection, allowedClassOptions, allowedSectionOptions]);

  useEffect(() => {
    let alive = true;
    const shape = (data) =>
      (Array.isArray(data) ? data : [])
        .filter((i) => i?.isClassTeacher === true)
        .map((i) => ({
          className:   String(i?.classId?.name   || '').trim(),
          sectionName: String(i?.sectionId?.name || '').trim(),
          classId:     i?.classId?._id  || '',
          sectionId:   i?.sectionId?._id || '',
        }))
        .filter((i) => i.className && i.sectionName);
    // Cached copy renders instantly; the network refresh replaces it.
    const hadCache = cachedGet(`${API_BASE_URL}/teacher/dashboard/allocations`, headers, (data) => {
      if (!alive) return;
      setClassTeacherAllocations(shape(data));
      setLoadingAllocations(false);
    });
    if (!hadCache.value) setLoadingAllocations(true);
    hadCache.promise
      .catch(() => { if (alive && !hadCache.value) setClassTeacherAllocations([]); })
      .finally(() => { if (alive) setLoadingAllocations(false); });
    return () => { alive = false; };
  }, [headers]);

  // Auto-pick scope when the teacher's class-teacher assignment is unambiguous,
  // so they aren't forced to hand-select a class they can only have one of.
  useEffect(() => {
    if (loadingAllocations || !selectedSession || selectedClass) return;
    const classes = [...new Set(classTeacherAllocations.map((a) => a.className).filter(Boolean))];
    if (classes.length === 1) setSelectedClass(classes[0]);
  }, [loadingAllocations, selectedSession, selectedClass, classTeacherAllocations]);

  useEffect(() => {
    if (loadingAllocations || !selectedClass || selectedSection) return;
    const sections = [...new Set(
      classTeacherAllocations
        .filter((a) => norm(a.className) === norm(selectedClass))
        .map((a) => a.sectionName)
        .filter(Boolean),
    )];
    if (sections.length === 1) setSelectedSection(sections[0]);
  }, [loadingAllocations, selectedClass, selectedSection, classTeacherAllocations]);

  useEffect(() => {
    if (!selectedSession || !selectedClass || !selectedSection) { setStudents([]); return; }
    if (loadingAllocations) return;
    let alive = true;
    const q = new URLSearchParams({ session: selectedSession, className: selectedClass, section: selectedSection });
    const apply = (data) => {
      if (!alive) return;
      setStudents(
        (Array.isArray(data?.students) ? data.students : []).filter((s) => {
          const cn = String(s?.grade || s?.className || s?.class || '').trim();
          const sn = String(s?.section || s?.sectionName || '').trim();
          return allowedPairs.has(`${norm(cn)}__${norm(sn)}`);
        }),
      );
      setLoadingStudents(false);
    };
    const req = cachedGet(`${API_BASE_URL}/meeting/teacher/students?${q}`, headers, apply);
    if (!req.value) setLoadingStudents(true);
    req.promise
      .catch(() => { if (alive && !req.value) setStudents([]); })
      .finally(() => { if (alive) setLoadingStudents(false); });
    return () => { alive = false; };
  }, [headers, selectedSession, selectedClass, selectedSection, allowedPairs, loadingAllocations]);

  // Active session — fetched in parallel with allocations (no waterfall). The
  // heavy roster call is only a fallback when the academic year is missing.
  useEffect(() => {
    let alive = true;
    const pick = (name) => {
      if (!alive) return;
      setSessionOptions(name ? [name] : []);
      if (name) setSelectedSession(name);
    };
    const yr = cachedGet(`${API_BASE_URL}/academic/active-year`, headers, (data) =>
      pick(String(data?.name || data?.academicYear || data?.activeYear || '').trim()));
    yr.promise
      .then(async (data) => {
        if (String(data?.name || data?.academicYear || data?.activeYear || '').trim()) return;
        const { data: sr } = await axios.get(`${API_BASE_URL}/meeting/teacher/students`, { headers });
        pick(String(sr?.activeSession || '').trim());
      })
      .catch(() => { if (alive && !yr.value) setSessionOptions([]); });
    return () => { alive = false; };
  }, [headers]);

  const [achievementsSource, setAchievementsSource] = useState(''); // list URL the current `achievements` came from
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing || !selectedSession) return;
    setRefreshing(true);
    setRefreshTick((t) => t + 1);
  };
  const achievementsUrl = useMemo(() => {
    const q = new URLSearchParams();
    if (selectedSession) q.set('session',   selectedSession);
    if (selectedClass)   q.set('className', selectedClass);
    if (selectedSection) q.set('section',   selectedSection);
    return `${API_BASE_URL}/achievements/teacher/list?${q}`;
  }, [selectedSession, selectedClass, selectedSection]);

  useEffect(() => {
    if (!selectedSession) return; // wait for the session so we don't fetch twice
    let alive = true;
    const req = cachedGet(achievementsUrl, headers, (data) => {
      if (!alive) return;
      setAchievementsSource(achievementsUrl);
      setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
      setLoadingAchievements(false);
    });
    if (!req.value) setLoadingAchievements(true);
    req.promise
      .catch(() => {
        if (alive && !req.value) setAchievements([]);
        if (alive && refreshTick) toast.error('Could not refresh records');
      })
      .finally(() => { if (alive) { setLoadingAchievements(false); setRefreshing(false); } });
    return () => { alive = false; };
  }, [headers, achievementsUrl, selectedSession, refreshTick]);

  // Keep the client cache in step with local changes (add / edit / delete).
  useEffect(() => {
    if (!selectedSession || loadingAchievements || achievementsSource !== achievementsUrl) return;
    writeCache(achievementsUrl, headers, { achievements });
  }, [achievements, achievementsSource, achievementsUrl, headers, selectedSession, loadingAchievements]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return q
      ? students.filter((s) => (s.name || '').toLowerCase().includes(q) || String(s.roll || s.rollNo || '').includes(q))
      : students;
  }, [students, studentSearch]);

  const toggleStudent = (id) =>
    setSelectedStudentIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const allFilteredSelected =
    filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.includes(String(s._id)));

  const toggleAllFiltered = () => {
    const ids = filteredStudents.map((s) => String(s._id));
    setSelectedStudentIds((p) =>
      allFilteredSelected ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]);
  };

  const studentById = useMemo(() => new Map(students.map((s) => [String(s._id), s])), [students]);

  const visibleAchievements = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return achievements;
    return achievements.filter((a) =>
      [a.studentName, a.title, a.description].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [achievements, tableSearch]);

  // Group records that were added together (same title, date and details) so a
  // multi-student upload shows as one row with a student count.
  const visibleGroups = useMemo(() => {
    const map = new Map();
    visibleAchievements.forEach((a) => {
      const day = a.date ? new Date(a.date).toISOString().slice(0, 10) : '';
      const key = `${norm(a.title)}|${day}|${norm(a.description)}`;
      if (!map.has(key)) {
        map.set(key, { key, title: a.title, date: a.date, description: a.description, certItem: null, items: [] });
      }
      const g = map.get(key);
      g.items.push(a);
      if (!g.certItem && a.hasCertificate) g.certItem = a;
    });
    return [...map.values()];
  }, [visibleAchievements]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [manageKey, setManageKey] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [genCert, setGenCert] = useState(null); // { items, index } for auto-generated certificate preview
  const [secureCert, setSecureCert] = useState(null); // { name, title, loading, url(blob:), type }
  useEffect(() => { setPage(1); }, [tableSearch, selectedClass, selectedSection]);
  const totalPages = Math.max(1, Math.ceil(visibleGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedGroups = visibleGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const managedGroup = manageKey ? visibleGroups.find((g) => g.key === manageKey) || null : null;
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, safePage - 1, safePage, safePage + 1]);
    const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    return nums.flatMap((n, i) => (i > 0 && n - nums[i - 1] > 1 ? ['…', n] : [n]));
  }, [totalPages, safePage]);

  const rollOf = (item) => {
    const s = studentById.get(String(item.studentId));
    return s?.roll || s?.rollNo || s?.rollNumber || '';
  };
  const photoOf = (item) => {
    const s = studentById.get(String(item.studentId));
    return s?.profilePic || s?.profileImage || s?.photo || '';
  };
  // Numeric roll order (students without a roll go last, then by name).
  const sortByRoll = (items) => [...items].sort((a, b) => {
    const ra = parseInt(rollOf(a), 10);
    const rb = parseInt(rollOf(b), 10);
    const na = Number.isNaN(ra) ? Infinity : ra;
    const nb = Number.isNaN(rb) ? Infinity : rb;
    if (na !== nb) return na - nb;
    return String(a.studentName || '').localeCompare(String(b.studentName || ''));
  });
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const renderActions = (item) => {
    const deleting = String(deletingAchievementId) === String(item.achievementId);
    return (
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => setEditingRow(item)}
          aria-label="Edit"
          title="Edit"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-colors hover:bg-blue-600"
        >
          <Edit size={13} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(item)}
          disabled={deleting}
          aria-label="Delete"
          title="Delete"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    );
  };

  const closeAdd = () => {
    if (submitting) return;
    setShowAdd(false);
    clearInterval(certTimerRef.current); setCertUploading(false); setCertPreviewOpen(false);
    setTitle(''); setAchievementDate(''); setDescription(''); setSelectedStudentIds([]); setCertificateFile(null); setStudentSearch(''); setSearchOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSession || !selectedClass || !selectedSection || selectedStudentIds.length === 0) {
      toast.error('Please select class, section and at least one student.'); return;
    }
    if (!title.trim() || !achievementDate) { toast.error('Title and date are required.'); return; }
    setSubmitting(true);
    try {
      // One request for all selected students (certificate uploaded once server-side).
      const body = new FormData();
      body.append('studentIds', JSON.stringify(selectedStudentIds));
      body.append('title', title.trim());
      body.append('date', achievementDate);
      body.append('description', description.trim());
      if (certificateFile) body.append('certificate', certificateFile);
      const { data } = await axios.post(`${API_BASE_URL}/achievements/teacher/upload-bulk`, body, { headers });

      const okCount = Number(data?.savedCount || 0);
      const failed = Array.isArray(data?.failed) ? data.failed : [];
      if (okCount > 0) toast.success(data?.message || `Achievement added for ${okCount} students.`);
      if (failed.length > 0) {
        toast.error(`${failed.length} failed: ${failed[0]?.error || 'upload error'}`);
        setSelectedStudentIds(failed.map((f) => String(f.studentId))); // keep only the failed ones for retry
      } else {
        setTitle(''); setAchievementDate(''); setDescription(''); setSelectedStudentIds([]); setCertificateFile(null); setStudentSearch(''); setSearchOpen(false);
        setShowAdd(false);
      }
      // Refresh the table in the background.
      const q = new URLSearchParams({ session: selectedSession, className: selectedClass, section: selectedSection });
      axios.get(`${API_BASE_URL}/achievements/teacher/list?${q}`, { headers })
        .then((lr) => setAchievements(Array.isArray(lr?.data?.achievements) ? lr.data.achievements : []))
        .catch(() => {});
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to upload'); }
    finally { setSubmitting(false); }
  };

  // Load an uploaded certificate through the authenticated backend route and
  // show it from a local blob: URL — the Cloudinary URL never reaches the browser.
  const openSecureCert = async (item) => {
    if (!item?.studentId || !item?.achievementId) return;
    setSecureCert({ name: item.studentName || 'Certificate', title: item.title, loading: true, url: '', type: '' });
    try {
      const res = await axios.get(
        `${API_BASE_URL}/achievements/teacher/${item.studentId}/${item.achievementId}/certificate`,
        { headers, responseType: 'blob' },
      );
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      setSecureCert((prev) => (prev ? { ...prev, loading: false, url, type: blob.type || '' } : (URL.revokeObjectURL(url), null)));
    } catch (err) {
      let msg = 'Could not load certificate';
      try { msg = JSON.parse(await err?.response?.data?.text?.())?.error || msg; } catch { /* non-JSON */ }
      toast.error(msg);
      setSecureCert(null);
    }
  };
  const closeSecureCert = () => {
    setSecureCert((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  };

  const handleDelete = async (item) => {
    if (!item?.studentId || !item?.achievementId) return;
    setDeletingAchievementId(String(item.achievementId));
    try {
      const { data } = await axios.delete(`${API_BASE_URL}/achievements/teacher/${item.studentId}/${item.achievementId}`, { headers });
      toast.success(data?.message || 'Deleted.');
      setAchievements((p) => p.filter((r) => String(r.achievementId) !== String(item.achievementId)));
      setConfirmDelete(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
    finally { setDeletingAchievementId(''); }
  };

  const handleUpdate = async (form, certificateFile) => {
    if (!editingRow?.studentId || !editingRow?.achievementId) return;
    if (!form.title.trim() || !form.date) { toast.error('Title and date are required.'); return; }
    setUpdatingAchievementId(String(editingRow.achievementId));
    try {
      const body = new FormData();
      body.append('title', form.title.trim());
      body.append('date', form.date);
      body.append('description', form.description.trim());
      if (certificateFile) body.append('certificate', certificateFile);
      const { data } = await axios.put(
        `${API_BASE_URL}/achievements/teacher/${editingRow.studentId}/${editingRow.achievementId}`,
        body,
        { headers },
      );
      toast.success(data?.message || 'Updated.');
      const nextHasCert = data?.achievement?.hasCertificate;
      setAchievements((p) =>
        p.map((r) =>
          String(r.achievementId) === String(editingRow.achievementId)
            ? {
                ...r,
                title: form.title.trim(),
                date: form.date,
                description: form.description.trim(),
                ...(nextHasCert !== undefined ? { hasCertificate: nextHasCert } : {}),
              }
            : r,
        ),
      );
      setEditingRow(null);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
    finally { setUpdatingAchievementId(''); }
  };

  const scopeReady = selectedSession && selectedClass && selectedSection;

  return (
    <>
      <AnimatePresence>
        {editingRow && (
          <EditModal
            item={editingRow}
            onClose={() => setEditingRow(null)}
            onSave={handleUpdate}
            onViewCurrent={openSecureCert}
            saving={String(updatingAchievementId) === String(editingRow?.achievementId)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating page card (matches the attendance page structure) ── */}
      <Motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[1100px] rounded-[2rem] border border-[#e2e8ee] bg-white p-5 text-black shadow-[0_4px_20px_rgba(0,20,30,0.05)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,20,30,0.07)] sm:p-8"
      >

        {/* ── Page header ───────────────────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            {/* <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-[#e2e8ee] bg-[#f0f4f8]">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div> */}
            <div>
              <h1 className="text-base font-semibold text-slate-950">Student Achievements</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                View achievement records, or use “Add New Record” to add one.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || !selectedSession}
            aria-label="Refresh records"
            title="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:bg-indigo-50 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={!loadingAllocations && classTeacherAllocations.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-violet-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} /> Add New Record
          </button>
          </div>
        </Motion.div>

        {!loadingAllocations && classTeacherAllocations.length === 0 && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Achievements are recorded by the <strong>class teacher</strong> for their class. You&rsquo;re
              not set as a class teacher for any class right now — ask your school admin to assign you as
              class teacher if you need to manage achievements here.
            </span>
          </div>
        )}

        {/* ── Achievements table ─────────────────────────────── */}
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="rounded-2xl border border-[#e2e8ee] bg-[#fafbfc] p-4"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Achievement records</h3>
            {achievements.length > 0 && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">
                {visibleGroups.length}
              </span>
            )}
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student or title…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          {loadingAchievements ? (
            <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-sm text-slate-400">
              <Trophy size={18} className="text-slate-300" />
              {achievements.length === 0
                ? 'No achievements yet. Click “Add New Record” to create one.'
                : 'No records match your search.'}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-indigo-50/70 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                    <tr>
                      <th className="w-12 px-4 py-3">#</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="w-44 px-4 py-3">Students</th>
                      <th className="w-32 px-4 py-3">Date</th>
                      <th className="w-28 px-4 py-3">Certificate</th>
                      <th className="w-32 px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedGroups.map((group, idx) => {
                      const single = group.items.length === 1 ? group.items[0] : null;
                      const rowNo = (safePage - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <React.Fragment key={group.key}>
                          <tr className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-slate-400">{rowNo}</td>
                            <td className="px-4 py-3">
                              <span className="block truncate font-semibold text-slate-900" title={group.title}>{group.title || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              {single ? (
                                <span className="block truncate text-slate-700" title={single.studentName}>
                                  {single.studentName || '—'}
                                  {rollOf(single) && <span className="ml-1 text-xs text-slate-400">· Roll {rollOf(single)}</span>}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setManageKey(group.key)}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                                >
                                  <Users size={12} /> {group.items.length} students
                                </button>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(group.date)}</td>
                            <td className="px-4 py-3">
                              {group.certItem ? (
                                <button
                                  type="button" onClick={() => openSecureCert(group.certItem)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                                >
                                  <Paperclip size={11} /> View
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setGenCert({ items: group.items, index: 0 })}
                                  title="View auto-generated certificate"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline"
                                >
                                  <Award size={11} /> Auto
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                {single ? (
                                  renderActions(single)
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setManageKey(group.key)}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/30 transition hover:from-violet-700 hover:to-fuchsia-700"
                                  >
                                    <Settings2 size={12} /> Manage
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  Showing <strong className="text-slate-700">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visibleGroups.length)}</strong> of{' '}
                  <strong className="text-slate-700">{visibleGroups.length}</strong> records
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      aria-label="Previous page"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {pageNumbers.map((n, i) => (n === '…' ? (
                      <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={[
                          'h-8 min-w-8 rounded-full px-2 text-xs font-semibold transition',
                          n === safePage
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600',
                        ].join(' ')}
                      >
                        {n}
                      </button>
                    )))}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      aria-label="Next page"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </Motion.div>

      </Motion.div>

      {/* ── Add new record modal ─────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <Motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Add New Achievement</h3>
                    <p className="text-xs text-slate-500">
                      Pick the students on the left, fill the achievement details on the right, then save.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeAdd}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_2fr] lg:overflow-hidden">

                  {/* ── Step 1: Students ── */}
                  <section className="flex min-h-0 flex-col border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
                    <div className="flex items-start justify-between gap-2">
                      <StepTitle
                        n={1}
                        title="Select students"
                        hint={scopeReady ? `Class ${selectedClass} – ${selectedSection} · tick one or more students.` : 'Tick one or more students.'}
                      />
                      {students.length > 0 && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {selectedStudentIds.length} / {students.length} selected
                        </span>
                      )}
                    </div>

                    {loadingStudents ? (
                      <div className="flex flex-1 items-center justify-center gap-2 py-10 text-sm text-slate-400">
                        <Loader2 size={14} className="animate-spin" /> Loading students…
                      </div>
                    ) : students.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                        {scopeReady ? 'No students found for this class / section.' : 'Select a class and section to see students.'}
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
                        <div className="flex h-12 items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 text-xs">
                          {searchOpen ? (
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search by name or roll…"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setStudentSearch(''); setSearchOpen(false); } }}
                                className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                              />
                            </div>
                          ) : (
                            <span className="flex flex-1 items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-600">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                  checked={allFilteredSelected}
                                  onChange={toggleAllFiltered}
                                  disabled={submitting || filteredStudents.length === 0}
                                />
                                Select all
                              </label>
                              {selectedStudentIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentIds([])}
                                  disabled={submitting}
                                  className="font-semibold text-slate-400 hover:text-rose-500"
                                >
                                  Clear
                                </button>
                              )}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (searchOpen) setStudentSearch('');
                              setSearchOpen((o) => !o);
                            }}
                            aria-label={searchOpen ? 'Close search' : 'Search students'}
                            title={searchOpen ? 'Close search' : 'Search students'}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
                          >
                            {searchOpen ? <X size={15} /> : <Search size={15} />}
                          </button>
                        </div>
                        <div className="max-h-72 min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
                          {filteredStudents.length === 0 ? (
                            <p className="py-6 text-center text-sm text-slate-400">No students match “{studentSearch}”.</p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {filteredStudents.map((student) => {
                                const id = String(student._id || '');
                                return (
                                  <StudentChip
                                    key={id}
                                    student={student}
                                    selected={selectedStudentIds.includes(id)}
                                    onClick={() => toggleStudent(id)}
                                    disabled={submitting}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ── Step 2: Details ── */}
                  <section className="space-y-4 p-5 lg:overflow-y-auto">
                    <StepTitle n={2} title="Achievement details" hint="The same details will be saved for every selected student." />

                    <Field label="Title" required>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={pill}
                        placeholder="e.g. Science Olympiad Gold"
                        required
                      />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Achievement Date" required>
                        <input
                          type="date"
                          value={achievementDate}
                          onChange={(e) => setAchievementDate(e.target.value)}
                          className={pill}
                          required
                        />
                      </Field>

                      <Field label="Certificate / Photo">
                        {certUploading ? (
                          <div className="relative flex h-[42px] items-center gap-2 overflow-hidden rounded-full border border-indigo-200 bg-indigo-50 px-4">
                            <Loader2 size={14} className="shrink-0 animate-spin text-indigo-500" />
                            <span className="truncate text-xs font-semibold text-indigo-700">Uploading… {certProgress}%</span>
                            <Motion.span
                              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${certProgress}%` }}
                              transition={{ ease: 'easeOut', duration: 0.15 }}
                            />
                          </div>
                        ) : certificateFile ? (
                          <div className="flex h-[42px] items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-1.5">
                            {isImageFile(certificateFile) && certPreviewUrl ? (
                              <img src={certPreviewUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white object-cover" />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                                <FileText size={14} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="truncate text-xs font-semibold text-slate-700">{certificateFile.name}</p>
                              <p className="text-[10px] text-emerald-600">{(certificateFile.size / 1024).toFixed(0)} KB · ready</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCertPreviewOpen(true)}
                              aria-label="Preview certificate"
                              title="Preview"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-indigo-500 transition-colors hover:bg-indigo-100"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCertificateFile(null)}
                              disabled={submitting}
                              aria-label="Remove certificate"
                              title="Remove"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-100 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-full border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600">
                            <Upload size={14} className="shrink-0 text-indigo-400" />
                            <span className="truncate">Upload file</span>
                            <span className="ml-auto shrink-0 text-[10px] text-slate-400">max 2MB</span>
                            <input
                              type="file"
                              accept={CERTIFICATE_ACCEPT}
                              className="hidden"
                              onChange={(e) => {
                                const picked = validateCertificate(e.target.files?.[0]);
                                e.target.value = '';
                                if (picked) startCertUpload(picked);
                              }}
                            />
                          </label>
                        )}
                      </Field>
                    </div>

                    <Field label="Details">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className={pillArea}
                        placeholder="Describe the achievement (event, position, level…)"
                      />
                    </Field>
                  </section>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
                  <p className="text-xs text-slate-500">
                    {selectedStudentIds.length === 0
                      ? 'No students selected yet.'
                      : <>Saving for <strong className="text-indigo-700">{selectedStudentIds.length} student{selectedStudentIds.length === 1 ? '' : 's'}</strong>.</>}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeAdd}
                      className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || certUploading || selectedStudentIds.length === 0}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {submitting
                        ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                        : <><Upload size={14} className="opacity-80" /> Save Achievement</>}
                    </button>
                  </div>
                </div>
              </form>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Certificate preview ─────────────────────────────── */}
      <AnimatePresence>
        {certPreviewOpen && certificateFile && certPreviewUrl && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setCertPreviewOpen(false)}
          >
            <Motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <p className="truncate text-sm font-semibold text-slate-800">{certificateFile.name}</p>
                <button
                  type="button"
                  onClick={() => setCertPreviewOpen(false)}
                  aria-label="Close preview"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 p-3">
                {isImageFile(certificateFile) ? (
                  <img src={certPreviewUrl} alt="Certificate" className="max-h-[75vh] max-w-full rounded-lg object-contain" />
                ) : (
                  <iframe src={certPreviewUrl} title="Certificate PDF" className="h-[75vh] w-full rounded-lg border-0 bg-white" />
                )}
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Manage grouped achievement ──────────────────────── */}
      <AnimatePresence>
        {managedGroup && (
          <div
            className="fixed inset-0 z-[190] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setManageKey('')}
          >
            <Motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                    <Trophy size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">{managedGroup.title || 'Achievement'}</h3>
                    <p className="text-xs text-slate-500">
                      Awarded to {managedGroup.items.length} student{managedGroup.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setManageKey('')}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
                {/* Details */}
                <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{fmtDate(managedGroup.date)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Students</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{managedGroup.items.length}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Certificate</p>
                    {managedGroup.certItem ? (
                      <button
                        type="button" onClick={() => openSecureCert(managedGroup.certItem)}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline"
                      >
                        <Eye size={13} /> View
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setGenCert({ items: managedGroup.items, index: 0 })}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline"
                      >
                        <Award size={13} /> Auto-generated · View
                      </button>
                    )}
                  </div>
                </div>
                <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Details</p>
                  <p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-line text-sm text-slate-700">{managedGroup.description || '—'}</p>
                </div>

                {/* Students */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Students</p>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-indigo-50 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-600">
                        <tr>
                          <th className="w-12 px-4 py-2.5">#</th>
                          <th className="px-4 py-2.5">Student</th>
                          <th className="w-24 px-4 py-2.5">Roll</th>
                          <th className="w-32 px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortByRoll(managedGroup.items).map((item, i) => (
                          <tr key={`${item.studentId}-${item.achievementId}`} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <StudentAvatar name={item.studentName} photo={photoOf(item)} />
                                <span className="truncate font-medium text-slate-800">{item.studentName || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{rollOf(item) || '—'}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-end">{renderActions(item)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ─────────────────────────────── */}
      <AnimatePresence>
        {confirmDelete && (
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => { if (!deletingAchievementId) setConfirmDelete(null); }}
          >
            <Motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-500">
                  <Trash2 size={18} />
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Delete achievement?</h3>
              <p className="mt-2 text-sm text-slate-500">
                <strong className="text-slate-700">“{confirmDelete.title || 'Achievement'}”</strong> will be removed for{' '}
                <strong className="text-slate-700">{confirmDelete.studentName || 'this student'}</strong>. This can’t be undone.
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={Boolean(deletingAchievementId)}
                  className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={Boolean(deletingAchievementId)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-500/25 transition-colors hover:bg-red-600 disabled:opacity-60"
                >
                  {deletingAchievementId
                    ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                    : <><Trash2 size={14} /> Delete</>}
                </button>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Auto-generated certificate preview ──────────────── */}
      <AnimatePresence>
        {genCert && genCert.items[genCert.index] && (() => {
          const item = genCert.items[genCert.index];
          const total = genCert.items.length;
          const teacher = String(item.issuer || '').replace(/^Class Teacher\s*-\s*/i, '').trim();
          return (
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setGenCert(null)}
            >
              <Motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      Certificate · {item.studentName || 'Student'}
                    </p>
                    <p className="text-[11px] text-slate-400">Auto-generated — no file was uploaded for this achievement</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenCert(null)}
                    aria-label="Close preview"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
                  <GeneratedCertificate
                    schoolName={schoolName}
                    schoolLogo={schoolLogo}
                    studentName={item.studentName}
                    grade={item.className}
                    teacherName={teacher}
                    title={item.title}
                    description={item.description}
                    category={item.category}
                    date={item.date}
                  />
                </div>
                {total > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setGenCert((g) => ({ ...g, index: Math.max(0, g.index - 1) }))}
                      disabled={genCert.index === 0}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <ChevronLeft size={13} /> Previous
                    </button>
                    <span className="font-semibold">Student {genCert.index + 1} of {total}</span>
                    <button
                      type="button"
                      onClick={() => setGenCert((g) => ({ ...g, index: Math.min(total - 1, g.index + 1) }))}
                      disabled={genCert.index === total - 1}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
                    >
                      Next <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </Motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── Secure uploaded-certificate viewer ──────────────── */}
      <AnimatePresence>
        {secureCert && (
          <div
            className="fixed inset-0 z-[215] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={closeSecureCert}
          >
            <Motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">Certificate · {secureCert.name}</p>
                  {secureCert.title && <p className="truncate text-[11px] text-slate-400">{secureCert.title}</p>}
                </div>
                <button
                  type="button"
                  onClick={closeSecureCert}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex min-h-[300px] flex-1 items-center justify-center bg-slate-50 p-3">
                {secureCert.loading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" /> Loading certificate…
                  </div>
                ) : secureCert.type.startsWith('image/') ? (
                  <img
                    src={secureCert.url}
                    alt="Certificate"
                    draggable={false}
                    className="max-h-[75vh] max-w-full select-none rounded-lg object-contain"
                  />
                ) : (
                  <iframe src={secureCert.url} title="Certificate" className="h-[75vh] w-full rounded-lg border-0 bg-white" />
                )}
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TeacherAchievements;
