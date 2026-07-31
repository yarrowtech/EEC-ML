import {
  Bell, Megaphone, GraduationCap, ClipboardList, PartyPopper, IndianRupee, Bus,
} from 'lucide-react';

export const CATEGORY_ORDER = ['all', 'general', 'academic', 'exam', 'events', 'fee', 'transport'];

export const CATEGORY_META = {
  all:       { label: 'All Notices', icon: Bell },
  general:   { label: 'General',   icon: Megaphone,     iconBg: 'bg-blue-50',    iconColor: 'text-blue-500',    text: 'text-blue-600',    badge: 'bg-blue-50 text-blue-600 border-blue-200' },
  academic:  { label: 'Academic',  icon: GraduationCap, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  exam:      { label: 'Exam',      icon: ClipboardList, iconBg: 'bg-amber-50',   iconColor: 'text-amber-500',   text: 'text-amber-600',   badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  events:    { label: 'Events',    icon: PartyPopper,   iconBg: 'bg-pink-50',    iconColor: 'text-pink-500',    text: 'text-pink-600',    badge: 'bg-pink-50 text-pink-600 border-pink-200' },
  fee:       { label: 'Fee',       icon: IndianRupee,   iconBg: 'bg-purple-50',  iconColor: 'text-purple-500',  text: 'text-purple-600',  badge: 'bg-purple-50 text-purple-600 border-purple-200' },
  transport: { label: 'Transport', icon: Bus,           iconBg: 'bg-sky-50',     iconColor: 'text-sky-500',     text: 'text-sky-600',     badge: 'bg-sky-50 text-sky-600 border-sky-200' },
};

export const PRIORITY_META = {
  high:   { label: 'High',   badge: 'bg-orange-50 text-orange-600 border-orange-200' },
  medium: { label: 'Medium', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  low:    { label: 'Low',    badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const DEPT_FALLBACK = {
  exam: 'Exam Cell',
  transport: 'Transport Dept.',
  fee: 'Accounts Dept.',
  academic: 'Admin',
  events: 'Admin',
  general: 'Admin',
};

export const CREATOR_TYPE_LABEL = {
  admin: 'Admin',
  super_admin: 'Super Admin',
  teacher: 'Teacher',
};

export const getDisplayCategory = (notice) => {
  const type = String(notice?.type || '').toLowerCase();
  if (type === 'exam' || type === 'result') return 'exam';
  if (type === 'fee') return 'fee';
  const category = String(notice?.category || '').toLowerCase();
  if (['academic', 'events', 'transport'].includes(category)) return category;
  return 'general';
};

export const isNewNotice = (notice) => {
  if (!notice?.createdAt) return false;
  const diffMs = Date.now() - new Date(notice.createdAt).getTime();
  return diffMs <= 1000 * 60 * 60 * 24 * 7;
};

export const isPinnedNotice = (notice) => notice?.priority === 'high';

export const getCreatorLabel = (notice, currentAdminId) => {
  const createdById = String(notice?.createdBy || '');
  if (currentAdminId && createdById && currentAdminId === createdById) return 'By You';
  if (notice?.createdByName) return notice.createdByName;
  return DEPT_FALLBACK[getDisplayCategory(notice)] || 'Admin';
};

export const formatNoticeDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatNoticeTime = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const formatNoticeDateTime = (iso) => {
  if (!iso) return null;
  return `${formatNoticeDate(iso)}, ${formatNoticeTime(iso)}`;
};

export const getNoticeDisplayId = (notice) => {
  if (!notice?._id || !notice?.createdAt) return '—';
  const d = new Date(notice.createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const idTail = String(notice._id).slice(-6);
  const seq = String(parseInt(idTail, 16) % 1000).padStart(3, '0');
  return `N-${y}-${m}-${day}-${seq}`;
};

export const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getAttachmentMeta = (attachment) => {
  const name = attachment?.name || attachment?.url || 'Attachment';
  const ext = (name.split('.').pop() || attachment?.type || '').toLowerCase();
  if (ext === 'pdf') return { label: 'PDF', color: 'bg-red-50 text-red-500', kind: 'pdf' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-emerald-50 text-emerald-500', kind: 'sheet' };
  if (['doc', 'docx'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-blue-50 text-blue-500', kind: 'doc' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { label: ext.toUpperCase(), color: 'bg-purple-50 text-purple-500', kind: 'image' };
  return { label: ext ? ext.toUpperCase() : 'FILE', color: 'bg-slate-100 text-slate-500', kind: 'file' };
};

export const getVisibleToLabel = (notice, classes = [], sections = []) => {
  const audienceLabel = {
    All: 'All Students, Parents, Teachers',
    Student: 'Students',
    Parent: 'Parents',
    Teacher: 'Teachers',
  }[notice?.audience] || (notice?.audience || 'All');

  const parts = [audienceLabel];
  if (notice?.classId) {
    const cls = classes.find((c) => String(c._id) === String(notice.classId));
    if (cls?.name) parts.push(`Class ${cls.name}`);
  }
  if (notice?.sectionId) {
    const sec = sections.find((s) => String(s._id) === String(notice.sectionId));
    if (sec?.name) parts.push(`Section ${sec.name}`);
  }
  return parts.join(' · ');
};
