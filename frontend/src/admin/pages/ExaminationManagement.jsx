import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  Award, BookOpen, Building2, Calendar, ChevronRight,
  Clock, DoorOpen, Edit2, FileText, Filter, Layers,
  Loader2, MapPin, Plus, RefreshCw, Search, Trash2,
  User, X, CheckCircle2, XCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TERM_OPTIONS   = ['Class Test','Unit Test','Monthly Test','Term 1','Term 2','Term 3','Half Yearly','Annual','Final'];
const GROUP_STATUS_OPTIONS = ['Scheduled', 'Completed'];
const SUBJECT_STATUS_OPTIONS = ['Scheduled','Ongoing','Completed','Cancelled','Postponed'];

const TERM_COLORS = {
  'Class Test':  'bg-sky-50 text-sky-700 border-sky-200',
  'Unit Test':   'bg-violet-50 text-violet-700 border-violet-200',
  'Monthly Test':'bg-amber-50 text-amber-700 border-amber-200',
  'Term 1':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Term 2':      'bg-blue-50 text-blue-700 border-blue-200',
  'Term 3':      'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Half Yearly': 'bg-orange-50 text-orange-700 border-orange-200',
  'Annual':      'bg-rose-50 text-rose-700 border-rose-200',
  'Final':       'bg-red-50 text-red-700 border-red-200',
};
const STATUS_COLORS = {
  Scheduled: 'bg-blue-50 text-blue-700',
  Ongoing:   'bg-emerald-50 text-emerald-700',
  Completed: 'bg-slate-100 text-slate-600',
  Cancelled: 'bg-red-50 text-red-600',
  Postponed: 'bg-amber-50 text-amber-700',
};

const EMPTY_GROUP   = { title:'', term:'Term 1', classId:'', sectionId:'', status:'Scheduled', startDate:'', endDate:'' };
const EMPTY_SUBJECT = { subjectId:'', marks:'100', date:'', time:'', duration:'', buildingId:'', floorId:'', roomId:'', venue:'', primaryInstructor:'', secondaryInstructor:'', status:'Scheduled' };

const inp = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400';
const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const timeToMins = (t) => { const [h,m] = String(t||'').split(':').map(Number); return (h||0)*60+(m||0); };
const hasOverlap = (fd, ft, fdur, ex) => {
  if (!fd||!ft||!fdur||!ex.date||!ex.time||!ex.duration) return false;
  if (String(fd).slice(0,10) !== String(ex.date).slice(0,10)) return false;
  const fs = timeToMins(ft), fe = fs+Number(fdur);
  const es = timeToMins(ex.time), ee = es+Number(ex.duration);
  return fs < ee && fe > es;
};

const toDataUrl = async (url) => {
  const src = String(url || '').trim();
  if (!src) return '';
  try {
    const response = await fetch(src);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

const findCreatedGroupFromList = ({ list = [], payload = {}, fallbackId = '' }) => {
  if (!Array.isArray(list) || !list.length) return null;
  if (fallbackId) {
    const direct = list.find((g) => String(g?._id) === String(fallbackId));
    if (direct) return direct;
  }
  const scoped = list
    .filter((g) => String(g?.title || '').trim() === String(payload?.title || '').trim())
    .filter((g) => String(g?.term || '') === String(payload?.term || ''))
    .filter((g) => String(g?.classId?._id || g?.classId || '') === String(payload?.classId || ''))
    .filter((g) => String(g?.sectionId?._id || g?.sectionId || '') === String(payload?.sectionId || ''));
  if (!scoped.length) return list[0] || null;
  return scoped.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))[0];
};

/* ── Modal shell ── */
const Modal = ({ show, onClose, title, subtitle, icon:Icon, iconColor='bg-indigo-600', children, maxWidth='sm:max-w-2xl' }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${maxWidth} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-100`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {Icon && <div className={`h-9 w-9 rounded-xl ${iconColor} flex items-center justify-center shadow-sm`}><Icon size={16} className="text-white" /></div>}
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════ */
const ExaminationManagement = ({ setShowAdminHeader }) => {
  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  const authH = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('token')}` });

  /* ── data ── */
  const [groups,    setGroups]    = useState([]);
  const [ungrouped, setUngrouped] = useState([]);   // legacy exams without groupId
  const [classes,   setClasses]   = useState([]);
  const [years,     setYears]     = useState([]);
  const [sections,  setSections]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [floors,    setFloors]    = useState([]);
  const [rooms,     setRooms]     = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [pdfHeader, setPdfHeader] = useState({ schoolName: '', schoolAddressLine: '', logoUrl: '' });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  /* ── UI state ── */
  const [search,         setSearch]         = useState('');
  const [termFilter,     setTermFilter]      = useState('all');
  const [yearFilterId,   setYearFilterId]    = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  /* ── group modal ── */
  const [showGroupModal,   setShowGroupModal]   = useState(false);
  const [editingGroupId,   setEditingGroupId]   = useState(null);
  const [groupForm,        setGroupForm]        = useState(EMPTY_GROUP);
  const [groupYearId,      setGroupYearId]      = useState('');

  /* ── subject modal ── */
  const [showSubjectModal,   setShowSubjectModal]   = useState(false);
  const [editingSubjectId,   setEditingSubjectId]   = useState(null);
  const [activeGroup,        setActiveGroup]        = useState(null);  // the parent group
  const [subjectForm,        setSubjectForm]        = useState(EMPTY_SUBJECT);

  /* ── load ── */
  const loadGroups = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/exam/groups`, { headers: authH() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed');
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      return list;
    } catch (err) { toast.error(err.message || 'Failed to load exam groups'); }
    finally { setLoading(false); }
    return [];
  };

  const loadUngrouped = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/exam/fetch`, { headers: authH() });
      const data = await res.json().catch(() => []);
      if (res.ok) setUngrouped((Array.isArray(data) ? data : []).filter(e => !e.groupId));
    } catch { /* silent */ }
  };

  const loadOptions = async () => {
    const h = authH();
    const results = await Promise.allSettled([
      fetch(`${API_BASE}/api/academic/years`,             { headers: h }),
      fetch(`${API_BASE}/api/academic/classes`,           { headers: h }),
      fetch(`${API_BASE}/api/academic/sections`,          { headers: h }),
      fetch(`${API_BASE}/api/academic/subjects`,          { headers: h }),
      fetch(`${API_BASE}/api/academic/buildings`,         { headers: h }),
      fetch(`${API_BASE}/api/academic/floors`,            { headers: h }),
      fetch(`${API_BASE}/api/academic/rooms`,             { headers: h }),
      fetch(`${API_BASE}/api/admin/users/get-teachers`,   { headers: h }),
      fetch(`${API_BASE}/api/reports/report-cards/template`, { headers: h }),
    ]);
    const parse = async (r) => r.status === 'fulfilled' ? (await r.value.json().catch(() => [])) : [];
    const [y,c,s,sub,b,f,rm,tch,template] = await Promise.all(results.map(parse));
    const yearItems = Array.isArray(y) ? y : [];
    setYears(yearItems);
    const activeYear = yearItems.find((item) => item?.isActive);
    if (activeYear?._id) {
      setGroupYearId(String(activeYear._id));
      setYearFilterId((current) => current || String(activeYear._id));
    } else if (yearItems[0]?._id) {
      setGroupYearId(String(yearItems[0]._id));
      setYearFilterId((current) => current || String(yearItems[0]._id));
    }
    setClasses(Array.isArray(c) ? c : []);
    setSections(Array.isArray(s) ? s : []);
    setSubjects(Array.isArray(sub) ? sub : []);
    setBuildings(Array.isArray(b) ? b : []);
    setFloors(Array.isArray(f) ? f : []);
    setRooms(Array.isArray(rm) ? rm : []);
    setTeachers(Array.isArray(tch) ? tch : []);
    setPdfHeader({
      schoolName: String(template?.schoolName || '').trim(),
      schoolAddressLine: String(template?.schoolAddressLine || '').trim(),
      logoUrl: String(template?.logoUrl || template?.logoUrlOverride || '').trim(),
    });
  };

  useEffect(() => { loadGroups(); loadUngrouped(); loadOptions(); }, []);

  /* ── derived: subject-modal dropdowns ── */
  const groupClassId = activeGroup?.classId?._id || activeGroup?.classId || '';

  const modalSubjects = useMemo(() =>
    subjects.filter(s => groupClassId ? String(s.classId||'') === String(groupClassId) : true),
    [subjects, groupClassId]);

  const modalFloors = useMemo(() =>
    floors.filter(f => subjectForm.buildingId ? String(f.buildingId?._id||f.buildingId) === String(subjectForm.buildingId) : true),
    [floors, subjectForm.buildingId]);

  const allExamsForConflict = useMemo(() => groups.flatMap(g => g.subjects || []), [groups]);

  const modalRooms = useMemo(() => {
    const occupied = new Set();
    if (subjectForm.date && subjectForm.time && subjectForm.duration) {
      allExamsForConflict.forEach(ex => {
        if (editingSubjectId && ex._id === editingSubjectId) return;
        if (hasOverlap(subjectForm.date, subjectForm.time, subjectForm.duration, ex) && ex.roomId) {
          occupied.add(String(typeof ex.roomId === 'object' ? ex.roomId._id : ex.roomId));
        }
      });
    }
    return rooms.filter(r => {
      if (occupied.has(String(r._id))) return false;
      if (subjectForm.floorId) return String(r.floorId?._id||r.floorId) === String(subjectForm.floorId);
      if (subjectForm.buildingId) return String(r.floorId?.buildingId?._id||r.floorId?.buildingId) === String(subjectForm.buildingId);
      return true;
    });
  }, [rooms, subjectForm.floorId, subjectForm.buildingId, subjectForm.date, subjectForm.time, subjectForm.duration, allExamsForConflict, editingSubjectId]);

  const modalTeachers = useMemo(() => {
    const occupied = new Set();
    if (subjectForm.date && subjectForm.time && subjectForm.duration) {
      allExamsForConflict.forEach(ex => {
        if (editingSubjectId && ex._id === editingSubjectId) return;
        if (hasOverlap(subjectForm.date, subjectForm.time, subjectForm.duration, ex) && ex.instructor) {
          ex.instructor.split(',').forEach(t => occupied.add(t.trim()));
        }
      });
    }
    return teachers.filter(t => !occupied.has(t.name));
  }, [teachers, subjectForm.date, subjectForm.time, subjectForm.duration, allExamsForConflict, editingSubjectId]);

  const activeYears = useMemo(
    () => years.filter((y) => y?.isActive),
    [years]
  );

  const modalClasses = useMemo(
    () => classes.filter((c) => groupYearId ? String(c.academicYearId || '') === String(groupYearId) : true),
    [classes, groupYearId]
  );

  /* ── group sections ── */
  const groupFormSections = useMemo(() =>
    sections.filter(s => groupForm.classId ? String(s.classId) === String(groupForm.classId) : true),
    [sections, groupForm.classId]);

  /* ── filtered display ── */
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      const classItem = classes.find((item) => String(item._id) === String(g.classId?._id || g.classId || ''));
      const groupYear = String(classItem?.academicYearId || '');
      const matchTerm = termFilter === 'all' || g.term === termFilter;
      const matchYear = !yearFilterId || groupYear === String(yearFilterId);
      const matchQ = !q || [g.title, g.grade, g.section, g.term].some(v => String(v||'').toLowerCase().includes(q));
      return matchTerm && matchYear && matchQ;
    });
  }, [groups, search, termFilter, yearFilterId, classes]);

  const generateExamSchedulePdf = async (group) => {
    if (!group?._id) return;
    const className = group.classId?.name || group.grade || '—';
    const sectionName = group.sectionId?.name || group.section || '—';
    const classItem = classes.find((item) => String(item._id) === String(group.classId?._id || group.classId || ''));
    const yearName = years.find((y) => String(y._id) === String(classItem?.academicYearId || ''))?.name || '';
    const title = String(group.title || 'Exam Schedule').trim();

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    let y = 0;

    // ── Gradient-style top banner ──────────────────────────────────────────
    doc.setFillColor(15, 23, 42);           // slate-900
    doc.rect(0, 0, pageWidth, 38, 'F');
    doc.setFillColor(30, 58, 138);          // indigo accent strip on left
    doc.rect(0, 0, 5, 38, 'F');

    // Logo inside banner
    const logoDataUrl = await toDataUrl(pdfHeader.logoUrl);
    if (logoDataUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 6, 24, 24, 2, 2, 'F');
        doc.addImage(logoDataUrl, 'PNG', margin + 1, 7, 22, 22);
      } catch { /* ignore */ }
    }

    // School name & address inside banner
    const textX = logoDataUrl ? margin + 30 : margin + 8;
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text((pdfHeader.schoolName || 'School').toUpperCase(), textX, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);        // slate-400
    if (pdfHeader.schoolAddressLine) {
      doc.text(pdfHeader.schoolAddressLine, textX, 26);
    }

    y = 46;

    // ── Exam title block ──────────────────────────────────────────────────
    doc.setFillColor(238, 242, 255);        // indigo-50
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'F');
    doc.setDrawColor(199, 210, 254);        // indigo-200
    doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 22, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 27, 75);           // indigo-950
    doc.text(title, pageWidth / 2, y + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(99, 102, 241);         // indigo-500
    const meta = [
      yearName ? `Session: ${yearName}` : '',
      `Class: ${className}`,
      `Section: ${sectionName}`,
    ].filter(Boolean).join('   •   ');
    doc.text(meta, pageWidth / 2, y + 11, { align: 'center' });

    y += 26;

    // ── Table ─────────────────────────────────────────────────────────────
    const headers = ['Date', 'Day', 'Subject', 'Room No.'];
    const colWidths = [30, 34, 88, 30];
    const tableW = colWidths.reduce((s, v) => s + v, 0);
    const startX = margin;
    const rowH = 9;

    // Header row
    doc.setFillColor(30, 41, 59);           // slate-800
    doc.roundedRect(startX, y, tableW, rowH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x + colWidths[i] / 2, y + 6, { align: 'center' });
      x += colWidths[i];
    });
    y += rowH;

    // Data rows
    const rows = (group.subjects || [])
      .map((exam) => {
        const date = exam?.date ? new Date(exam.date) : null;
        const dateText = date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';
        const dayText = date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('en-US', { weekday: 'long' })
          : '—';
        const subjectName = exam?.subjectId?.name || exam?.subject || 'Subject';
        const room = exam?.roomId?.roomNumber || exam?.roomId?.name || '—';
        return [dateText, dayText, subjectName, room];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    if (!rows.length) {
      rows.push(['—', '—', 'No subjects added yet', '—']);
    }

    rows.forEach((row, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 14;
      }
      // Alternating row fill
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      doc.rect(startX, y, tableW, rowH, 'F');

      // Row border
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX, y, tableW, rowH, 'S');

      // Vertical column separators
      doc.setDrawColor(226, 232, 240);
      let sepX = startX;
      colWidths.forEach((w, i) => {
        sepX += w;
        if (i < colWidths.length - 1) {
          doc.line(sepX, y, sepX, y + rowH);
        }
      });

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      let cx = startX;
      row.forEach((cell, i) => {
        const clipped = doc.splitTextToSize(String(cell || ''), colWidths[i] - 4)[0] || '';
        doc.text(clipped, cx + colWidths[i] / 2, y + 6, { align: 'center' });
        cx += colWidths[i];
      });
      y += rowH;
    });

    // ── Footer ────────────────────────────────────────────────────────────
    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
    doc.text(pdfHeader.schoolName || '', pageWidth - margin, y, { align: 'right' });

    const safeFile = `${title}_${className}_${sectionName}`.replace(/[^\w.-]+/g, '_').toLowerCase();
    doc.save(`${safeFile}_schedule.pdf`);
  };

  /* ── group handlers ── */
  const openCreateGroup = () => {
    setEditingGroupId(null);
    setGroupForm(EMPTY_GROUP);
    const activeYear = activeYears[0];
    if (activeYear?._id) {
      setGroupYearId(String(activeYear._id));
    }
    setShowGroupModal(true);
  };
  const openEditGroup   = (g)  => {
    setEditingGroupId(g._id);
    const classId = g.classId?._id || g.classId || '';
    const classItem = classes.find((item) => String(item._id) === String(classId));
    setGroupYearId(String(classItem?.academicYearId || ''));
    setGroupForm({ title: g.title||'', term: g.term||'Term 1', classId, sectionId: g.sectionId?._id||g.sectionId||'', status: g.status||'Scheduled', startDate: g.startDate||'', endDate: g.endDate||'' });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const isCreating = !editingGroupId;
      if (!groupForm.title.trim()) throw new Error('Exam group title is required');
      const url    = editingGroupId ? `${API_BASE}/api/exam/groups/${editingGroupId}` : `${API_BASE}/api/exam/groups`;
      const method = editingGroupId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authH(), body: JSON.stringify(groupForm) });
      const data   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success(editingGroupId ? 'Exam updated!' : 'Exam created!');
      setShowGroupModal(false);
      const list = await loadGroups();

      if (isCreating) {
        const targetGroup = findCreatedGroupFromList({
          list,
          payload: groupForm,
          fallbackId: data?.group?._id || data?._id || '',
        });
        if (targetGroup?._id) {
          setExpandedGroups((prev) => {
            const next = new Set(prev);
            next.add(targetGroup._id);
            return next;
          });
          const choice = await Swal.fire({
            title: 'Step 1 completed',
            text: 'Exam created successfully. Do you want to add subjects now?',
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'Add Subjects',
            cancelButtonText: 'Later',
            confirmButtonColor: '#4f46e5',
          });
          if (choice.isConfirmed) {
            openAddSubject(targetGroup);
          }
        }
      }
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteGroup = async (g) => {
    const count = g.subjects?.length || 0;
    const conf  = await Swal.fire({
      title: 'Delete Exam?',
      html: `Delete <strong>${g.title}</strong>${count ? ` and its <strong>${count} subject exam${count>1?'s':''}</strong>` : ''}?`,
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Delete',
    });
    if (!conf.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/exam/groups/${g._id}`, { method:'DELETE', headers: authH() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success('Exam deleted');
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  /* ── subject handlers ── */
  const openAddSubject = (group) => {
    setActiveGroup(group);
    setEditingSubjectId(null);
    setSubjectForm({ ...EMPTY_SUBJECT });
    setShowSubjectModal(true);
  };

  const openEditSubject = (group, exam) => {
    setActiveGroup(group);
    setEditingSubjectId(exam._id);
    const instructors = (exam.instructor||'').split(',').map(s=>s.trim());
    setSubjectForm({
      subjectId:          exam.subjectId?._id||exam.subjectId||'',
      marks:              exam.marks??'100',
      date:               exam.date ? String(exam.date).slice(0,10) : '',
      time:               exam.time||'',
      duration:           exam.duration??'',
      buildingId:         exam.roomId?.floorId?.buildingId?._id||'',
      floorId:            exam.roomId?.floorId?._id||'',
      roomId:             exam.roomId?._id||exam.roomId||'',
      venue:              exam.venue||'',
      primaryInstructor:  instructors[0]||'',
      secondaryInstructor:instructors[1]||'',
      status:             exam.status||'Scheduled',
    });
    setShowSubjectModal(true);
  };

  const handleSaveSubject = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (!subjectForm.subjectId) throw new Error('Subject is required');
      const instructor = [subjectForm.primaryInstructor, subjectForm.secondaryInstructor].filter(Boolean).join(', ');
      const payload = {
        groupId:   activeGroup._id,
        classId:   activeGroup.classId?._id || activeGroup.classId,
        sectionId: activeGroup.sectionId?._id || activeGroup.sectionId,
        title:     activeGroup.title,
        term:      activeGroup.term,
        subjectId: subjectForm.subjectId,
        marks:     subjectForm.marks === '' ? undefined : Number(subjectForm.marks),
        date:      subjectForm.date,
        time:      subjectForm.time,
        duration:  subjectForm.duration === '' ? undefined : Number(subjectForm.duration),
        roomId:    subjectForm.roomId || undefined,
        venue:     subjectForm.venue,
        status:    subjectForm.status,
        instructor,
      };
      const url    = editingSubjectId ? `${API_BASE}/api/exam/${editingSubjectId}` : `${API_BASE}/api/exam/add`;
      const method = editingSubjectId ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: authH(), body: JSON.stringify(payload) });
      const data   = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success(editingSubjectId ? 'Subject exam updated!' : 'Subject exam added!');
      setShowSubjectModal(false);
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDeleteSubject = async (exam) => {
    const conf = await Swal.fire({ title:'Delete Subject Exam?', html:`Delete <strong>${exam.subject || exam.subjectId?.name || 'this subject'}</strong>?`, icon:'warning', showCancelButton:true, confirmButtonColor:'#dc2626', confirmButtonText:'Delete' });
    if (!conf.isConfirmed) return;
    try {
      const res  = await fetch(`${API_BASE}/api/exam/${exam._id}`, { method:'DELETE', headers: authH() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      toast.success('Subject exam deleted');
      await loadGroups();
    } catch (err) { toast.error(err.message || 'Failed to delete'); }
  };

  const toggleGroup = (id) => setExpandedGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  /* ── stats ── */
  const totalSubjects = groups.reduce((n, g) => n + (g.subjects?.length||0), 0);
  const totalScheduled = groups.filter(g => g.status === 'Scheduled').length;
  const totalCompleted = groups.filter(g => g.status === 'Completed').length;

  /* ════════════ RENDER ════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-6 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Examination Management</h1>
            <p className="mt-0.5 text-sm text-slate-400">Create exams, then add subject-wise papers inside each</p>
          </div>
          <div className="flex items-center gap-3">
            {[{label:'Exams', val:groups.length},{label:'Subjects', val:totalSubjects},{label:'Scheduled', val:totalScheduled},{label:'Completed', val:totalCompleted}].map(({label,val}) => (
              <div key={label} className="flex flex-col items-center rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                <span className="text-xl font-bold">{val}</span>
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── Toolbar ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={yearFilterId}
                onChange={(e) => setYearFilterId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
              >
                <option value="">All Sessions</option>
                {years.map((year) => (
                  <option key={year._id} value={year._id}>
                    {year.name}{year.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search exam or class…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select value={termFilter} onChange={e => setTermFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none">
                <option value="all">All Terms</option>
                {TERM_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={() => { loadGroups(); loadUngrouped(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw size={13} />
            </button>
            <button onClick={openCreateGroup}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
              <Plus size={15} /> Create Exam
            </button>
          </div>
        </div>

        {/* ── Groups ── */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 size={18} className="animate-spin text-indigo-400" /> Loading exams…
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <BookOpen size={22} className="text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">No exams yet</p>
            <button onClick={openCreateGroup} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              <Plus size={12} /> Create your first exam
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(group => {
              const isOpen   = expandedGroups.has(group._id);
              const termCls  = TERM_COLORS[group.term] || 'bg-slate-50 text-slate-600 border-slate-200';
              const statCls  = STATUS_COLORS[group.status] || 'bg-slate-100 text-slate-600';
              const subCount = group.subjects?.length || 0;
              return (
                <div key={group._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* ── group header ── */}
                  <div className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                          <BookOpen size={16} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold ${termCls}`}>{group.term}</span>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">{group.title}</h3>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                            {(group.classId?.name || group.grade) && <span>Class {group.classId?.name || group.grade}</span>}
                            {(group.sectionId?.name || group.section) && <><span>·</span><span>Section {group.sectionId?.name || group.section}</span></>}
                            {group.startDate && <><span>·</span><span className="flex items-center gap-1"><Calendar size={10}/>{group.startDate}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statCls}`}>{group.status}</span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          <FileText size={11} /> {subCount} Subject{subCount !== 1 ? 's' : ''}
                        </span>
                        <button onClick={() => openAddSubject(group)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
                          <Plus size={12} /> Step 2: Add Subject
                        </button>
                        <button
                          onClick={() => generateExamSchedulePdf(group)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <FileText size={12} /> Download Routine
                        </button>
                        <button onClick={() => openEditGroup(group)}
                          className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteGroup(group)}
                          className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                        <button onClick={() => toggleGroup(group._id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                          <ChevronRight size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── subject rows ── */}
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {subCount === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                          <FileText size={20} className="text-slate-300" />
                          <p className="text-xs font-medium">Step 2 pending: add subjects for this exam</p>
                          <button onClick={() => openAddSubject(group)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            <Plus size={11} /> Add first subject
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50">
                                {['Subject','Date & Time','Venue','Marks','Invigilator','Status',''].map((h,i) => (
                                  <th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {group.subjects.map(exam => {
                                const venueStr = exam.roomId?.floorId?.buildingId?.name
                                  ? `${exam.roomId.floorId.buildingId.name} / ${exam.roomId.floorId.name} / ${exam.roomId.roomNumber}`
                                  : (exam.venue || null);
                                const sCls = STATUS_COLORS[exam.status] || 'bg-slate-100 text-slate-600';
                                const isPast = exam.date && new Date(exam.date) < new Date();
                                return (
                                  <tr key={exam._id} className="hover:bg-indigo-50/20 transition-colors group">
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-slate-800">{exam.subjectId?.name || exam.subject || '—'}</p>
                                      {exam.subjectId?.code && <p className="text-xs text-slate-400">{exam.subjectId.code}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                      {exam.date ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className={`flex items-center gap-1.5 text-xs font-medium ${isPast ? 'text-slate-400' : 'text-slate-700'}`}>
                                            <Calendar size={11} />{new Date(exam.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                                          </span>
                                          {exam.time && <span className="flex items-center gap-1.5 text-xs text-slate-400"><Clock size={11}/>{exam.time}</span>}
                                          {exam.duration && <span className="text-xs text-slate-400">{exam.duration} min</span>}
                                        </div>
                                      ) : <span className="text-slate-300 text-xs">Not set</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      {venueStr ? (
                                        <span className="flex items-start gap-1.5 text-xs text-slate-500 max-w-[160px]">
                                          <MapPin size={11} className="shrink-0 mt-0.5 text-slate-400"/>{venueStr}
                                        </span>
                                      ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1">
                                        <Award size={12} className="text-amber-400 shrink-0"/>
                                        <span className="font-semibold text-slate-700">{exam.marks ?? '—'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {exam.instructor ? (
                                        <span className="flex items-center gap-1 text-xs text-slate-500"><User size={10}/>{exam.instructor}</span>
                                      ) : <span className="text-slate-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${sCls}`}>{exam.status||'—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditSubject(group, exam)}
                                          className="h-7 w-7 flex items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                          <Edit2 size={13}/>
                                        </button>
                                        <button onClick={() => handleDeleteSubject(exam)}
                                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                          <Trash2 size={13}/>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ungrouped / Legacy exams ── */}
        {ungrouped.length > 0 && (
          <details className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-slate-500 flex items-center gap-2 select-none">
              <FileText size={14} /> {ungrouped.length} Legacy Exam{ungrouped.length!==1?'s':''} (without groups)
            </summary>
            <div className="border-t border-slate-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">{['Exam','Subject','Term','Class','Status',''].map((h,i)=><th key={i} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {ungrouped.map(ex => (
                    <tr key={ex._id} className="hover:bg-indigo-50/20 group">
                      <td className="px-4 py-3 font-semibold text-slate-800">{ex.title||'—'}</td>
                      <td className="px-4 py-3 text-slate-600">{ex.subjectId?.name||ex.subject||'—'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold ${TERM_COLORS[ex.term]||'bg-slate-50 text-slate-600 border-slate-200'}`}>{ex.term||'—'}</span></td>
                      <td className="px-4 py-3 text-slate-600">{ex.classId?.name||ex.grade||'—'} {ex.sectionId?.name||ex.section||''}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLORS[ex.status]||'bg-slate-100 text-slate-600'}`}>{ex.status||'—'}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { const c=await Swal.fire({title:'Delete?',html:`Delete <strong>${ex.title||'this exam'}</strong>?`,icon:'warning',showCancelButton:true,confirmButtonColor:'#dc2626',confirmButtonText:'Delete'}); if(!c.isConfirmed)return; const r=await fetch(`${API_BASE}/api/exam/${ex._id}`,{method:'DELETE',headers:authH()}); if(r.ok){toast.success('Deleted');loadUngrouped();}else{toast.error('Failed');} }}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* ══════════ CREATE / EDIT GROUP MODAL ══════════ */}
      <Modal show={showGroupModal} onClose={() => setShowGroupModal(false)}
        title={editingGroupId ? 'Edit Exam' : 'Create Exam'}
        subtitle={editingGroupId ? 'Update exam details' : 'Step 1 — Set the exam title, term and class'}
        icon={BookOpen} iconColor="bg-indigo-600" maxWidth="sm:max-w-lg">
        <form onSubmit={handleSaveGroup} className="space-y-4">
          {!editingGroupId && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              <span className="font-semibold">Simple flow:</span> Step 1 Create exam → Step 2 Add subjects → Step 3 Download routine.
            </div>
          )}
          <Field label="Exam Title">
            <input value={groupForm.title} onChange={e => setGroupForm(p=>({...p,title:e.target.value}))} className={inp} placeholder="e.g. First Term 2024-25" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exam Type / Term">
              <select value={groupForm.term} onChange={e => setGroupForm(p=>({...p,term:e.target.value}))} className={inp}>
                {TERM_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={groupForm.status} onChange={e => setGroupForm(p=>({...p,status:e.target.value}))} className={inp}>
                {GROUP_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Academic Year">
              <select
                value={groupYearId}
                onChange={e => {
                  setGroupYearId(e.target.value);
                  setGroupForm(p => ({ ...p, classId: '', sectionId: '' }));
                }}
                className={inp}
                required
              >
                <option value="">Select active year</option>
                {activeYears.map(y => <option key={y._id} value={y._id}>{y.name} (Active)</option>)}
              </select>
            </Field>
            <div />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class">
              <select
                value={groupForm.classId}
                onChange={e => setGroupForm(p=>({...p,classId:e.target.value,sectionId:''}))}
                className={inp}
                disabled={!groupYearId}
                required
              >
                <option value="">{groupYearId ? 'Select class' : 'Select active year first'}</option>
                {modalClasses.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Section">
              <select
                value={groupForm.sectionId}
                onChange={e => setGroupForm(p=>({...p,sectionId:e.target.value}))}
                className={inp}
                disabled={!groupForm.classId}
              >
                <option value="">Select section</option>
                {groupFormSections.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date"><input type="date" value={groupForm.startDate} onChange={e => setGroupForm(p=>({...p,startDate:e.target.value}))} className={inp}/></Field>
            <Field label="End Date"><input type="date" value={groupForm.endDate} onChange={e => setGroupForm(p=>({...p,endDate:e.target.value}))} className={inp}/></Field>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setShowGroupModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 shadow-md shadow-indigo-200">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <BookOpen size={14}/>}
              {saving ? 'Saving…' : editingGroupId ? 'Update Exam' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════ ADD / EDIT SUBJECT MODAL ══════════ */}
      <Modal show={showSubjectModal} onClose={() => setShowSubjectModal(false)}
        title={editingSubjectId ? 'Edit Subject Exam' : 'Add Subject Exam'}
        subtitle={activeGroup ? `Step 2 — ${activeGroup.title} · ${activeGroup.term}` : 'Step 2 — Add subjects to the exam'}
        icon={FileText} iconColor="bg-violet-600">
        <form onSubmit={handleSaveSubject} className="space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Subject">
              <select value={subjectForm.subjectId} onChange={e => setSubjectForm(p=>({...p,subjectId:e.target.value}))} className={inp} required>
                <option value="">Select subject</option>
                {modalSubjects.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Total Marks">
              <input type="number" min="1" value={subjectForm.marks} onChange={e => setSubjectForm(p=>({...p,marks:e.target.value}))} className={inp} placeholder="100"/>
            </Field>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Schedule</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Date"><input type="date" value={subjectForm.date} onChange={e => setSubjectForm(p=>({...p,date:e.target.value}))} className={inp}/></Field>
              <Field label="Time"><input type="time" value={subjectForm.time} onChange={e => setSubjectForm(p=>({...p,time:e.target.value}))} className={inp}/></Field>
              <Field label="Duration (min)"><input type="number" min="0" value={subjectForm.duration} onChange={e => setSubjectForm(p=>({...p,duration:e.target.value}))} className={inp} placeholder="90"/></Field>
              <Field label="Status">
                <select value={subjectForm.status} onChange={e => setSubjectForm(p=>({...p,status:e.target.value}))} className={inp}>
                  {SUBJECT_STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Venue</p>
            <div className="rounded-2xl bg-slate-50/80 border border-slate-100 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Building">
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.buildingId} onChange={e => setSubjectForm(p=>({...p,buildingId:e.target.value,floorId:'',roomId:''}))} className={`${inp} pl-8`}>
                      <option value="">Select building</option>
                      {buildings.map(b=><option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Floor">
                  <div className="relative">
                    <Layers size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.floorId} onChange={e => setSubjectForm(p=>({...p,floorId:e.target.value,roomId:''}))} className={`${inp} pl-8`}>
                      <option value="">Select floor</option>
                      {modalFloors.map(f=><option key={f._id} value={f._id}>{f.name}</option>)}
                    </select>
                  </div>
                </Field>
                <Field label="Room">
                  <div className="relative">
                    <DoorOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                    <select value={subjectForm.roomId} onChange={e => {
                      const rid=e.target.value; const room=rooms.find(r=>String(r._id)===String(rid));
                      setSubjectForm(p=>({...p,roomId:rid,buildingId:room?String(room.floorId?.buildingId?._id||room.floorId?.buildingId||p.buildingId):p.buildingId,floorId:room?String(room.floorId?._id||room.floorId||''):p.floorId,venue:room?`${room.floorId?.buildingId?.name||'Building'} / ${room.floorId?.name||'Floor'} / ${room.roomNumber}`:p.venue}));
                    }} className={`${inp} pl-8`}>
                      <option value="">Select room</option>
                      {modalRooms.map(r=><option key={r._id} value={r._id}>{r.floorId?.buildingId?.name||'Bldg'} / {r.floorId?.name||'Floor'} / {r.roomNumber}</option>)}
                    </select>
                  </div>
                </Field>
              </div>
              <Field label="Venue Note (optional)">
                <input value={subjectForm.venue} onChange={e => setSubjectForm(p=>({...p,venue:e.target.value}))} className={inp} placeholder="Custom venue or extra detail"/>
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primary Invigilator">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <select value={subjectForm.primaryInstructor} onChange={e => setSubjectForm(p=>({...p,primaryInstructor:e.target.value}))} className={`${inp} pl-8`}>
                  <option value="">Select</option>
                  {modalTeachers.map(t=><option key={t._id} value={t.name} disabled={t.name===subjectForm.secondaryInstructor}>{t.name}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Secondary Invigilator">
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                <select value={subjectForm.secondaryInstructor} onChange={e => setSubjectForm(p=>({...p,secondaryInstructor:e.target.value}))} className={`${inp} pl-8`}>
                  <option value="">Select</option>
                  {modalTeachers.map(t=><option key={t._id} value={t.name} disabled={t.name===subjectForm.primaryInstructor}>{t.name}</option>)}
                </select>
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={() => setShowSubjectModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 shadow-md shadow-violet-200">
              {saving ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
              {saving ? 'Saving…' : editingSubjectId ? 'Update Subject' : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExaminationManagement;
