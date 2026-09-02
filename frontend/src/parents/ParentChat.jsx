import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import {
  MessageSquare, Send, Search, ChevronLeft,
  PlusCircle, X, Loader2, Check, CheckCheck, Palette,
  GraduationCap, BookOpen, User, Mail, Phone, Lock
} from 'lucide-react';
import { decryptChatMessage, encryptChatMessage, ensureE2EEIdentity } from '../utils/chatE2EE';
import { chatCacheKeys, readChatCache, writeChatCache } from '../utils/chatCache';
import { AUTH_LOGOUT_EVENT } from '../utils/authSession';
import { useDialog } from './useDialog';
import { parentApiJson } from './parentApi';

const resolveApiBaseUrl = () => {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'http://localhost:5000';
};

const API_URL = resolveApiBaseUrl();
const THREADS_CACHE_TTL_MS = 15 * 60 * 1000;
const MESSAGES_CACHE_TTL_MS = 15 * 60 * 1000;
const CONTACTS_CACHE_TTL_MS = 5 * 60 * 1000;
const LAST_PARENT_CHAT_ME_KEY = 'parent_chat_me_id_v1';

// Delegates to the shared parent wrapper: attaches the token, parses JSON, throws
// on non-2xx, and on 401 clears the session + fires AUTH_LOGOUT_EVENT (which this
// screen already listens for to tear down the socket).
const apiFetch = (path, options = {}) => parentApiJson(path, options);

const formatTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMessageTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const isThreadCacheUsable = (items) =>
  Array.isArray(items) &&
  items.every((thread) => thread && thread._id && thread.otherParticipant && thread.otherParticipant.name);

const formatLastSeen = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return `today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const formatDaySeparator = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const todayKey = dayKey(now);
  const msgKey = dayKey(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);
  if (msgKey === todayKey) return 'Today';
  if (msgKey === yesterdayKey) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const getInitials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const resolveImg = (src) => {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) return src;
  return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
};

const pickImg = (obj) => {
  const raw = obj?.profilePic || obj?.profileImage || obj?.photo || obj?.avatar || obj?.image || null;
  if (!raw) return null;
  if (typeof raw === 'object') return raw.secure_url || raw.url || raw.path || null;
  return raw;
};

// ── Chat wallpaper SVGs ────────────────────────────────────────────────────────
const _SVG_DOODLE = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <rect width="300" height="300" fill="#f5f0e8"/>
  <g opacity="0.45">
    <rect x="15" y="18" width="58" height="30" rx="8" fill="#c9ad88"/>
    <path d="M22,48 L13,62 L33,48" fill="#c9ad88"/>
    <line x1="22" y1="28" x2="60" y2="28" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="22" y1="36" x2="52" y2="36" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <g opacity="0.38">
    <rect x="216" y="22" width="52" height="26" rx="7" fill="#c9ad88"/>
    <path d="M258,48 L266,61 L250,48" fill="#c9ad88"/>
    <line x1="224" y1="31" x2="258" y2="31" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="224" y1="39" x2="246" y2="39" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <path d="M148,25 L140,17 C137,14 137,9 140,6 C143,3 148,4.5 148,8 C148,4.5 153,3 156,6 C159,9 159,14 156,17 Z" fill="#e8a87c" opacity="0.42"/>
  <g transform="translate(243,68)" fill="#c9ad88" opacity="0.45">
    <path d="M11,0 L13.5,8 L22,8 L15,13 L17.5,21 L11,16 L4.5,21 L7,13 L0,8 L8.5,8 Z"/>
  </g>
  <g opacity="0.45">
    <rect x="18" y="148" width="56" height="32" rx="12" fill="#c9ad88"/>
    <path d="M24,180 L13,195 L35,180" fill="#c9ad88"/>
    <circle cx="34" cy="164" r="4" fill="#f5f0e8"/>
    <circle cx="46" cy="164" r="4" fill="#f5f0e8"/>
    <circle cx="58" cy="164" r="4" fill="#f5f0e8"/>
  </g>
  <g transform="translate(152,132)" opacity="0.38">
    <rect x="1" y="11" width="20" height="14" rx="3" fill="#c9ad88"/>
    <path d="M4,11 L4,7 C4,2 18,2 18,7 L18,11" fill="none" stroke="#c9ad88" stroke-width="2.5"/>
    <circle cx="11" cy="18" r="3" fill="#f5f0e8"/>
  </g>
  <g transform="translate(237,183)" opacity="0.38">
    <circle cx="14" cy="14" r="13" fill="none" stroke="#c9ad88" stroke-width="2"/>
    <circle cx="9" cy="11" r="2" fill="#c9ad88"/>
    <circle cx="19" cy="11" r="2" fill="#c9ad88"/>
    <path d="M8,18 Q14,24 20,18" fill="none" stroke="#c9ad88" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g opacity="0.42">
    <rect x="196" y="240" width="72" height="36" rx="8" fill="#c9ad88"/>
    <path d="M258,276 L268,290 L254,276" fill="#c9ad88"/>
    <line x1="206" y1="253" x2="256" y2="253" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="206" y1="264" x2="244" y2="264" stroke="#f5f0e8" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <g transform="translate(86,207)" opacity="0.38">
    <circle cx="10" cy="10" r="10" fill="none" stroke="#c9ad88" stroke-width="1.8" stroke-dasharray="4 3"/>
    <line x1="10" y1="3" x2="10" y2="17" stroke="#c9ad88" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="3" y1="10" x2="17" y2="10" stroke="#c9ad88" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <g transform="translate(100,92)" fill="#e8a87c" opacity="0.35">
    <path d="M12,3 L14,9 L20,9 L15.5,12.5 L17.5,18.5 L12,15 L6.5,18.5 L8.5,12.5 L4,9 L10,9 Z"/>
  </g>
  <g transform="translate(178,148)" opacity="0.35">
    <rect x="0" y="8" width="34" height="22" rx="6" fill="#c9ad88"/>
    <path d="M5,8 L5,5 C5,1 29,1 29,5 L29,8" fill="none" stroke="#c9ad88" stroke-width="2.5"/>
  </g>
  <g fill="#c9ad88" opacity="0.22">
    <circle cx="104" cy="58" r="3"/><circle cx="174" cy="96" r="3"/><circle cx="278" cy="154" r="3"/>
    <circle cx="122" cy="270" r="3"/><circle cx="70" cy="112" r="3"/><circle cx="202" cy="116" r="3"/>
    <circle cx="142" cy="212" r="3"/><circle cx="56" cy="240" r="3"/><circle cx="290" cy="60" r="3"/>
  </g>
</svg>`;

const _SVG_GEOMETRIC = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280">
  <rect width="280" height="280" fill="#edf2f7"/>
  <polygon points="30,16 52,16 63,35 52,54 30,54 19,35" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.5"/>
  <polygon points="100,16 122,16 133,35 122,54 100,54 89,35" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="170,16 192,16 203,35 192,54 170,54 159,35" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.5"/>
  <polygon points="240,16 262,16 273,35 262,54 240,54 229,35" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="65,54 87,54 98,73 87,92 65,92 54,73" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="135,54 157,54 168,73 157,92 135,92 124,73" fill="#c7d9ef" opacity="0.35"/>
  <polygon points="205,54 227,54 238,73 227,92 205,92 194,73" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="30,92 52,92 63,111 52,130 30,130 19,111" fill="#c7d9ef" opacity="0.4"/>
  <polygon points="100,92 122,92 133,111 122,130 100,130 89,111" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="170,92 192,92 203,111 192,130 170,130 159,111" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.5"/>
  <polygon points="65,135 95,185 35,185" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="185,135 215,185 155,185" fill="#d1e3f3" opacity="0.35"/>
  <polygon points="48,200 64,184 80,200 64,216" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.45"/>
  <polygon points="148,198 164,182 180,198 164,214" fill="#c7d9ef" opacity="0.4"/>
  <g fill="#94a3b8" opacity="0.28">
    <circle cx="100" cy="95" r="2.5"/><circle cx="170" cy="55" r="2.5"/>
    <circle cx="240" cy="95" r="2.5"/><circle cx="65" cy="165" r="2.5"/>
    <circle cx="205" cy="165" r="2.5"/><circle cx="135" cy="245" r="2.5"/>
  </g>
</svg>`;

const _SVG_FLORAL = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <rect width="240" height="240" fill="#fdf4fc"/>
  <g transform="translate(60,65)" opacity="0.5">
    <circle cx="0" cy="-16" r="10" fill="#f0abda"/><circle cx="16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="16" r="10" fill="#f0abda"/><circle cx="-16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="11" cy="-11" r="8" fill="#f0abda"/><circle cx="11" cy="11" r="8" fill="#f0abda"/>
    <circle cx="-11" cy="11" r="8" fill="#f0abda"/><circle cx="-11" cy="-11" r="8" fill="#f0abda"/>
    <circle cx="0" cy="0" r="8" fill="#e040af"/>
  </g>
  <g transform="translate(185,75) scale(0.65)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#c084fc"/><circle cx="16" cy="0" r="10" fill="#c084fc"/>
    <circle cx="0" cy="16" r="10" fill="#c084fc"/><circle cx="-16" cy="0" r="10" fill="#c084fc"/>
    <circle cx="0" cy="0" r="8" fill="#9333ea"/>
  </g>
  <g transform="translate(28,185) scale(0.6)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#fca5a5"/><circle cx="16" cy="0" r="10" fill="#fca5a5"/>
    <circle cx="0" cy="16" r="10" fill="#fca5a5"/><circle cx="-16" cy="0" r="10" fill="#fca5a5"/>
    <circle cx="0" cy="0" r="8" fill="#ef4444"/>
  </g>
  <g transform="translate(195,195) scale(0.75)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#f0abda"/><circle cx="16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="16" r="10" fill="#f0abda"/><circle cx="-16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="0" r="8" fill="#e040af"/>
  </g>
  <ellipse cx="130" cy="38" rx="9" ry="22" transform="rotate(-30,130,38)" fill="#bbf7d0" opacity="0.55"/>
  <ellipse cx="102" cy="152" rx="8" ry="20" transform="rotate(25,102,152)" fill="#bbf7d0" opacity="0.5"/>
  <g fill="#f0abda" opacity="0.28">
    <circle cx="92" cy="22" r="3"/><circle cx="218" cy="142" r="3"/>
    <circle cx="112" cy="222" r="3"/><circle cx="8" cy="104" r="3"/>
  </g>
</svg>`;

const _SVG_POLKA = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
  <rect width="60" height="60" fill="#f9f9f9"/>
  <circle cx="15" cy="15" r="4.5" fill="#e2e8f0" opacity="0.85"/>
  <circle cx="45" cy="45" r="4.5" fill="#e2e8f0" opacity="0.85"/>
  <circle cx="45" cy="15" r="2.5" fill="#e2e8f0" opacity="0.55"/>
  <circle cx="15" cy="45" r="2.5" fill="#e2e8f0" opacity="0.55"/>
  <circle cx="30" cy="30" r="1.5" fill="#e2e8f0" opacity="0.4"/>
</svg>`;

const _SVG_DARK = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <rect width="300" height="300" fill="#1e1b2e"/>
  <g opacity="0.22">
    <rect x="15" y="18" width="58" height="30" rx="8" fill="#8b5cf6"/>
    <path d="M22,48 L13,62 L33,48" fill="#8b5cf6"/>
  </g>
  <g opacity="0.18">
    <rect x="216" y="22" width="52" height="26" rx="7" fill="#6366f1"/>
    <path d="M258,48 L266,61 L250,48" fill="#6366f1"/>
  </g>
  <path d="M148,25 L140,17 C137,14 137,9 140,6 C143,3 148,4.5 148,8 C148,4.5 153,3 156,6 C159,9 159,14 156,17 Z" fill="#a855f7" opacity="0.3"/>
  <g transform="translate(243,68)" fill="#818cf8" opacity="0.22">
    <path d="M11,0 L13.5,8 L22,8 L15,13 L17.5,21 L11,16 L4.5,21 L7,13 L0,8 L8.5,8 Z"/>
  </g>
  <g opacity="0.22">
    <rect x="18" y="148" width="56" height="32" rx="12" fill="#6366f1"/>
    <circle cx="34" cy="164" r="4" fill="#1e1b2e"/>
    <circle cx="46" cy="164" r="4" fill="#1e1b2e"/>
    <circle cx="58" cy="164" r="4" fill="#1e1b2e"/>
  </g>
  <g transform="translate(237,183)" opacity="0.2">
    <circle cx="14" cy="14" r="13" fill="none" stroke="#8b5cf6" stroke-width="2"/>
    <path d="M8,18 Q14,24 20,18" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g fill="#7c3aed" opacity="0.18">
    <circle cx="104" cy="58" r="3"/><circle cx="174" cy="96" r="3"/><circle cx="278" cy="154" r="3"/>
    <circle cx="122" cy="270" r="3"/><circle cx="70" cy="112" r="3"/>
  </g>
</svg>`;

// ── Wallpapers & Themes ────────────────────────────────────────────────────────
const mkBg = (svg, size = '300px 300px') => ({
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
  backgroundRepeat: 'repeat',
  backgroundSize: size,
});

const WALLPAPERS = {
  doodle:    { label: 'Doodle',    preview: '#f5f0e8', style: mkBg(_SVG_DOODLE) },
  geometric: { label: 'Geometric', preview: '#edf2f7', style: mkBg(_SVG_GEOMETRIC, '280px 280px') },
  floral:    { label: 'Floral',    preview: '#fdf4fc', style: mkBg(_SVG_FLORAL, '240px 240px') },
  polka:     { label: 'Polka',     preview: '#f9f9f9', style: mkBg(_SVG_POLKA, '60px 60px') },
  dark:      { label: 'Dark',      preview: '#1e1b2e', style: mkBg(_SVG_DARK) },
  plain:     { label: 'Plain',     preview: '#f1f5f9', style: { backgroundColor: '#f1f5f9' } },
};

const THEMES = {
  green:  { label: 'Green',  color: '#22c55e', hover: '#16a34a', light: '#dcfce7', lighter: '#f0fdf4' },
  blue:   { label: 'Blue',   color: '#3b82f6', hover: '#2563eb', light: '#dbeafe', lighter: '#eff6ff' },
  amber:  { label: 'Amber',  color: '#f59e0b', hover: '#d97706', light: '#fef3c7', lighter: '#fffbeb' },
  purple: { label: 'Purple', color: '#8b5cf6', hover: '#7c3aed', light: '#ede9fe', lighter: '#f5f3ff' },
  rose:   { label: 'Rose',   color: '#f43f5e', hover: '#e11d48', light: '#ffe4e6', lighter: '#fff1f2' },
  teal:   { label: 'Teal',   color: '#14b8a6', hover: '#0f9688', light: '#ccfbf1', lighter: '#f0fdfa' },
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
const SIZES = {
  xs: 'h-7  w-7  text-xs',
  sm: 'h-9  w-9  text-sm',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

const Avatar = ({ src, name = '', size = 'sm', ring = false, themeColor = '#22c55e', className = '' }) => {
  const [err, setErr] = useState(false);
  const url = resolveImg(src);
  const sz = SIZES[size] || SIZES.sm;
  const ringStyle = ring ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${themeColor}` } : {};

  if (url && !err) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setErr(true)}
        className={`rounded-full object-cover shrink-0 ${sz} ${className}`}
        style={ringStyle}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${sz} ${className}`}
      style={{ background: `linear-gradient(135deg, ${themeColor}99, ${themeColor})`, ...ringStyle }}
    >
      {getInitials(name)}
    </div>
  );
};

const TeacherModal = ({ teacher, onClose, theme }) => {
  const dialogRef = useDialog(Boolean(teacher), onClose);
  if (!teacher) return null;
  const t = theme || THEMES.green;

  const img = pickImg(teacher);
  const name = teacher.name || 'Teacher';
  const email = teacher.email || teacher.userId || null;
  const phone = teacher.phone || teacher.mobile || null;
  const subj = Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : (teacher.subject || teacher.specialization || null);
  const dept = teacher.department || null;
  const grade = teacher.grade || teacher.class || null;
  const bio = teacher.bio || teacher.about || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-chat-teacher-name"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-24 relative" style={{ background: `linear-gradient(90deg, ${t.color}, ${t.hover})` }}>
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="flex justify-center -mt-12 mb-3">
          <Avatar src={img} name={name} size="xl" className="ring-4 ring-white shadow-lg z-50" themeColor={t.color} />
        </div>

        <div className="text-center px-6 pb-4">
          <h2 id="parent-chat-teacher-name" className="text-lg font-bold text-gray-900">{name}</h2>
          <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: t.lighter, color: t.color }}>
            <GraduationCap className="h-3.5 w-3.5" /> Teacher
          </span>
        </div>

        <div className="border-t border-gray-100 divide-y divide-gray-100 mx-4 mb-4 rounded-xl overflow-hidden border">
          {[
            subj && { icon: BookOpen, label: 'Subject', value: subj },
            dept && { icon: GraduationCap, label: 'Department', value: dept },
            grade && { icon: User, label: 'Class', value: grade },
            email && { icon: Mail, label: 'Email', value: email },
            phone && { icon: Phone, label: 'Phone', value: phone },
          ].filter(Boolean).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3 bg-white">
              <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: t.lighter }}>
                <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-sm text-gray-800 font-semibold truncate">{value}</p>
              </div>
            </div>
          ))}

          {!subj && !dept && !grade && !email && !phone && (
            <div className="px-4 py-6 text-center text-sm text-gray-400 bg-white">
              No additional details available.
            </div>
          )}
        </div>

        {bio && (
          <div className="mx-4 mb-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">About</p>
            <p className="text-sm text-gray-700 leading-relaxed">{bio}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── ChatMessage ────────────────────────────────────────────────────────────────
const isSeenByOther = (msg, myId) =>
  Array.isArray(msg?.seenBy) &&
  msg.seenBy.some((entry) => String(entry?.userId) !== String(myId));

const ChatMessage = ({ msg, isMine, myId, theme }) => {
  const t = theme || THEMES.green;
  const isSystem = String(msg?.senderType || '').toLowerCase() === 'system';
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] px-3 py-1 rounded-full bg-gray-200 text-gray-600 font-medium">
          {msg?.text || msg?.senderName || 'System message'}
        </span>
      </div>
    );
  }
  const optimistic = Boolean(msg?._optimistic);
  const delivered = isMine && !optimistic;
  const seen = isMine && isSeenByOther(msg, myId);
  const LONG_MESSAGE_LIMIT = 260;
  const fullText = String(msg?.text || '');
  const isLong = fullText.length > LONG_MESSAGE_LIMIT;
  const [expanded, setExpanded] = useState(false);
  const visibleText = isLong && !expanded ? `${fullText.slice(0, LONG_MESSAGE_LIMIT)}...` : fullText;

  return (
    <motion.div
      initial={{ opacity: 0, x: isMine ? 20 : -20, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[78%] w-fit rounded-2xl border px-4 py-2.5 text-sm text-slate-900 shadow-sm backdrop-blur-lg
          ${isMine ? 'rounded-br-md' : 'rounded-bl-md border-white/90 bg-white/65'}`}
        style={isMine ? { backgroundColor: `${t.color}20`, borderColor: `${t.color}35` } : {}}
      >
        {!isMine && (
          <div className="text-xs font-semibold mb-1" style={{ color: t.color }}>{msg.senderName}</div>
        )}
        <div className="whitespace-pre-wrap leading-relaxed wrap-break-word">
          {visibleText}
          <span className="inline-block w-14" aria-hidden="true" />
        </div>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(p => !p)}
            className="mt-1 text-xs font-semibold hover:underline"
            style={{ color: t.color }}
          >
            {expanded ? 'Read less' : 'Read more'}
          </button>
        )}
        <div
          className="-mt-4 flex items-center justify-end gap-1 text-xs text-slate-400"
        >
          <span>{formatMessageTime(msg.createdAt || msg.ts)}</span>
          {isMine && (
            <span style={{ color: seen ? t.color : '#94a3b8' }} className="inline-flex items-center">
              {seen || delivered ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── ConversationItem ───────────────────────────────────────────────────────────
const ConversationItem = ({ thread, isActive, onClick, isTyping, theme }) => {
  const t      = theme || THEMES.green;
  const other  = thread.otherParticipant;
  const name   = other?.name || 'Unknown';
  const img    = pickImg(other);
  const unread = thread.unreadCount || 0;

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3.5 text-left flex items-center gap-3 transition-all backdrop-blur-sm
        ${isActive ? 'bg-white/65 border-white/90 shadow-md' : 'bg-white/25 border-white/35 hover:bg-white/50 hover:border-white/70'}`}
      style={isActive ? { boxShadow: `0 8px 24px ${t.color}12` } : {}}
    >
      <Avatar src={img} name={name} size="md" ring={isActive} themeColor={t.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {name}
          </span>
          <span className="text-xs text-gray-400 ml-2 shrink-0">{formatTime(thread.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className="text-xs truncate"
            style={isTyping ? { color: t.color, fontWeight: 500, fontStyle: 'italic' } : { color: '#6b7280' }}
          >
            {isTyping ? 'typing...' : (thread.lastMessage || 'No messages yet')}
          </span>
          {unread > 0 && (
            <span
              className="ml-2 shrink-0 h-5 min-w-[20px] px-1.5 rounded-full text-white text-xs flex items-center justify-center font-semibold"
              style={{ backgroundColor: t.color }}
            >
              {unread}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
};

// ── ContactItem ────────────────────────────────────────────────────────────────
const ContactItem = ({ contact, onClick, theme }) => {
  const t   = theme || THEMES.green;
  const img = pickImg(contact);
  return (
    <button
      onClick={onClick}
      className="mx-2 my-1 flex w-[calc(100%-1rem)] items-center gap-3 rounded-2xl border border-white/40 bg-white/25 px-4 py-3 text-left backdrop-blur-sm transition-all hover:bg-white/55 hover:shadow-sm"
    >
      <Avatar src={img} name={contact.name} size="md" themeColor={t.color} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{contact.name}</div>
        <div className="text-xs text-gray-500 truncate">{contact.subtitle || 'Teacher'}</div>
      </div>
      <MessageSquare className="h-4 w-4 shrink-0" style={{ color: t.color }} />
    </button>
  );
};

// ── Main ParentChat ────────────────────────────────────────────────────────────
const ParentChat = () => {
  const [me, setMe]                             = useState(null);
  const [threads, setThreads]                   = useState([]);
  const [activeThreadId, setActiveThreadId]     = useState(null);
  const [messages, setMessages]                 = useState([]);
  const [draft, setDraft]                       = useState('');
  const [query, setQuery]                       = useState('');
  const [contacts, setContacts]                 = useState([]);
  const [showContacts, setShowContacts]         = useState(false);
  const [contactQuery, setContactQuery]         = useState('');
  const [loadingThreads, setLoadingThreads]     = useState(true);
  const [syncingThreads, setSyncingThreads]     = useState(false);
  const [loadingMessages, setLoadingMessages]   = useState(false);
  const [typingUsers, setTypingUsers]           = useState({});
  const [presenceByUser, setPresenceByUser]     = useState({});
  const [isMobileView, setIsMobileView]         = useState(false);
  const [wallpaperKey, setWallpaperKey]         = useState(() => localStorage.getItem('parent_chat_wallpaper') || 'doodle');
  const [themeKey, setThemeKey]                 = useState(() => localStorage.getItem('parent_chat_theme')     || 'green');
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [teacherModal, setTeacherModal]         = useState(null);

  const socketRef         = useRef(null);
  const activeThreadIdRef = useRef(null);
  const messagesEndRef    = useRef(null);
  const typingTimers      = useRef({});
  const typingDebounce    = useRef(null);
  const isTyping          = useRef(false);
  const meRef             = useRef(null);
  const privateKeyRef     = useRef('');

  const activeThread = useMemo(
    () => threads.find(t => String(t._id) === activeThreadId),
    [threads, activeThreadId]
  );

  useEffect(() => {
    const disconnectSocket = () => {
      socketRef.current?.disconnect();
    };
    const handleStorage = (event) => {
      if (event.key === 'token' || event.key === null) {
        disconnectSocket();
      }
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, disconnectSocket);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, disconnectSocket);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const decryptForUI = useCallback(async (rawMsg) => {
    if (!rawMsg) return rawMsg;
    if (rawMsg.text && String(rawMsg.text).trim()) return rawMsg;
    const plainText = await decryptChatMessage({
      message: rawMsg,
      myId: meRef.current?.id,
      privateKeyBase64: privateKeyRef.current,
    });
    return { ...rawMsg, text: plainText };
  }, []);

  const decryptThreadPreview = useCallback(async (thread) => {
    if (!thread) return thread;
    const payload = thread.lastMessagePayload;
    if (!payload) return thread;
    const preview = await decryptChatMessage({
      message: payload,
      myId: meRef.current?.id,
      privateKeyBase64: privateKeyRef.current,
    });
    return { ...thread, lastMessage: preview || thread.lastMessage || '' };
  }, []);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (!token || userType !== 'Parent') {
      setLoadingThreads(false);
      return;
    }
    let mounted = true;

    const hintedMeId = localStorage.getItem(LAST_PARENT_CHAT_ME_KEY);
    if (hintedMeId) {
      const hintedCachedThreads = readChatCache(chatCacheKeys.threads(hintedMeId), THREADS_CACHE_TTL_MS);
      if (isThreadCacheUsable(hintedCachedThreads)) {
        setThreads(hintedCachedThreads);
        setLoadingThreads(false);
      }
    }

    const init = async () => {
      try {
        setSyncingThreads(true);
        const meData = await apiFetch('/api/chat/me');
        if (!mounted) return;
        setMe(meData);
        meRef.current = meData;
        if (meData?.id) {
          localStorage.setItem(LAST_PARENT_CHAT_ME_KEY, String(meData.id));
        }
        const identity = await ensureE2EEIdentity({ userId: meData?.id, apiFetch });
        privateKeyRef.current = identity?.privateKey || '';
        const threadsCacheKey = chatCacheKeys.threads(meData?.id);
        const cachedThreads = readChatCache(threadsCacheKey, THREADS_CACHE_TTL_MS);
        if (isThreadCacheUsable(cachedThreads)) {
          setThreads(cachedThreads);
          if (mounted) setLoadingThreads(false);
        }
        const threadsData = await apiFetch('/api/chat/threads');
        if (!mounted) return;
        const hydratedThreads = await Promise.all(
          (Array.isArray(threadsData) ? threadsData : []).map(t => decryptThreadPreview(t))
        );
        setThreads(hydratedThreads);
        writeChatCache(threadsCacheKey, hydratedThreads);
      } catch { /* ignore */ } finally {
        if (mounted) {
          setLoadingThreads(false);
          setSyncingThreads(false);
        }
      }
    };

    init();

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (activeThreadIdRef.current) {
        socket.emit('join-thread', { threadId: activeThreadIdRef.current });
      }
    });

    socket.on('new-message', async (rawMsg) => {
      const msg = await decryptForUI(rawMsg);
      const threadId = String(msg.threadId);
      const isActiveThread = String(activeThreadIdRef.current) === threadId;
      const isIncomingForMe = String(msg.senderId) !== String(meRef.current?.id);
      setMessages(prev => {
        if (activeThreadIdRef.current !== threadId) return prev;
        if (String(msg.senderId) === String(meRef.current?.id)) {
          const optIdx = prev.findLastIndex(m => m._optimistic);
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = msg;
            return next;
          }
        }
        if (prev.find(m => String(m._id) === String(msg._id))) return prev;
        const hydratedMsg = isIncomingForMe
          ? {
              ...msg,
              seenBy: [
                ...(Array.isArray(msg.seenBy) ? msg.seenBy : []),
                { userId: meRef.current?.id, seenAt: new Date().toISOString() }
              ]
            }
          : msg;
        return [...prev, hydratedMsg];
      });
      setThreads(prev => prev.map(t =>
        String(t._id) === threadId
          ? { ...t, lastMessage: msg.text, lastMessageAt: msg.createdAt, unreadCount: activeThreadIdRef.current === threadId ? 0 : (t.unreadCount || 0) + 1 }
          : t
      ));
      if (isActiveThread && isIncomingForMe) {
        socket.emit('mark-seen', { threadId });
      }
    });

    socket.on('message-sent', async (rawMsg) => {
      const msg = await decryptForUI(rawMsg);
      const threadId = String(msg?.threadId || '');
      if (!threadId || String(activeThreadIdRef.current) !== threadId) return;
      setMessages((prev) => {
        if (prev.some((item) => String(item?._id) === String(msg?._id))) return prev;
        const optimisticIndex = prev.findLastIndex((item) => item?._optimistic && String(item.senderId) === String(msg.senderId));
        if (optimisticIndex === -1) return [...prev, msg];
        const next = [...prev];
        next[optimisticIndex] = msg;
        return next;
      });
    });

    socket.on('thread-updated', async ({ threadId, lastMessage, lastMessageAt, message }) => {
      let resolvedLastMessage = lastMessage;
      if (message) {
        resolvedLastMessage = await decryptChatMessage({
          message,
          myId: meRef.current?.id,
          privateKeyBase64: privateKeyRef.current,
        });
      }
      setThreads(prev => prev.map(t =>
        String(t._id) === threadId
          ? { ...t, lastMessage: resolvedLastMessage, lastMessageAt, unreadCount: activeThreadIdRef.current === threadId ? 0 : (t.unreadCount || 0) + 1 }
          : t
      ));
    });

    socket.on('typing', ({ threadId, isTyping: typing, userName }) => {
      const key = String(threadId);
      if (typing) {
        setTypingUsers(prev => ({ ...prev, [key]: userName }));
        clearTimeout(typingTimers.current[key]);
        typingTimers.current[key] = setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[key]; return n; });
        }, 3000);
      } else {
        setTypingUsers(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
    });

    socket.on('presence-update', ({ userId, online, lastSeen }) => {
      if (!userId) return;
      setPresenceByUser(prev => ({ ...prev, [String(userId)]: { online: Boolean(online), lastSeen: lastSeen || null } }));
    });

    socket.on('presence-sync', ({ presence }) => {
      if (!presence || typeof presence !== 'object') return;
      setPresenceByUser(prev => {
        const next = { ...prev };
        Object.entries(presence).forEach(([uid, state]) => {
          next[String(uid)] = { online: Boolean(state?.online), lastSeen: state?.lastSeen || null };
        });
        return next;
      });
    });

    socket.on('message-seen', ({ threadId, userId }) => {
      if (String(activeThreadIdRef.current) !== String(threadId)) return;
      setMessages(prev =>
        prev.map(msg => {
          if (String(msg.senderId) !== String(meRef.current?.id)) return msg;
          if (Array.isArray(msg.seenBy) && msg.seenBy.some(e => String(e?.userId) === String(userId))) return msg;
          return { ...msg, seenBy: [...(Array.isArray(msg.seenBy) ? msg.seenBy : []), { userId, seenAt: new Date().toISOString() }] };
        })
      );
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [decryptForUI, decryptThreadPreview]);

  // Periodic REST catch-up keeps messages current if a reverse proxy or
  // reconnect briefly drops a Socket.IO event.
  useEffect(() => {
    if (!activeThreadId || !me?.id) return undefined;
    let cancelled = false;
    const refreshMessages = async () => {
      try {
        const rawMessages = await apiFetch(`/api/chat/threads/${activeThreadId}/messages`);
        const freshMessages = await Promise.all((Array.isArray(rawMessages) ? rawMessages : []).map((msg) => decryptForUI(msg)));
        if (cancelled) return;
        setMessages((previous) => {
          const optimistic = previous.filter((msg) => msg?._optimistic);
          const merged = new Map(freshMessages.map((msg) => [String(msg?._id), msg]));
          optimistic.forEach((msg) => {
            if (!merged.has(String(msg?._id))) merged.set(String(msg?._id), msg);
          });
          return Array.from(merged.values()).sort((left, right) => (
            new Date(left?.createdAt || left?.ts || 0).getTime()
            - new Date(right?.createdAt || right?.ts || 0).getTime()
          ));
        });
      } catch {
        // Retry on the next interval.
      }
    };
    const interval = window.setInterval(refreshMessages, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeThreadId, me?.id, decryptForUI]);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId) return;
    writeChatCache(chatCacheKeys.threads(userId), threads);
  }, [threads, me?.id]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId || !activeThreadId) return;
    const stableMessages = (Array.isArray(messages) ? messages : [])
      .filter(m => !m?._optimistic)
      .slice(-120);
    writeChatCache(chatCacheKeys.messages(userId, activeThreadId), stableMessages);
  }, [messages, activeThreadId, me?.id]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId || !Array.isArray(contacts) || contacts.length === 0) return;
    writeChatCache(chatCacheKeys.contacts(userId), contacts);
  }, [contacts, me?.id]);

  // ── Thread actions ──────────────────────────────────────────────────────────
  const selectThread = useCallback(async (threadId) => {
    const socket = socketRef.current;
    if (activeThreadIdRef.current && activeThreadIdRef.current !== threadId) {
      socket?.emit('leave-thread', { threadId: activeThreadIdRef.current });
    }
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
    const userId = meRef.current?.id || me?.id;
    const cachedMessages = userId
      ? readChatCache(chatCacheKeys.messages(userId, threadId), MESSAGES_CACHE_TTL_MS)
      : null;
    if (Array.isArray(cachedMessages)) {
      setMessages(cachedMessages);
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }
    setThreads(prev => prev.map(t => String(t._id) === threadId ? { ...t, unreadCount: 0 } : t));
    socket?.emit('join-thread', { threadId });
    socket?.emit('mark-seen', { threadId });
    try {
      const presenceRes = await apiFetch(`/api/chat/threads/${threadId}/presence`);
      if (presenceRes?.presence && typeof presenceRes.presence === 'object') {
        setPresenceByUser(prev => {
          const next = { ...prev };
          Object.entries(presenceRes.presence).forEach(([uid, state]) => {
            next[String(uid)] = { online: Boolean(state?.online), lastSeen: state?.lastSeen || null };
          });
          return next;
        });
      }
      const msgs = await apiFetch(`/api/chat/threads/${threadId}/messages`);
      const decrypted = await Promise.all((Array.isArray(msgs) ? msgs : []).map(m => decryptForUI(m)));
      setMessages(decrypted);
      if (userId) writeChatCache(chatCacheKeys.messages(userId, threadId), decrypted.slice(-120));
      const latest = decrypted[decrypted.length - 1];
      if (latest?.text) {
        setThreads(prev =>
          prev.map(t =>
            String(t._id) === String(threadId)
              ? { ...t, lastMessage: latest.text, lastMessageAt: latest.createdAt || t.lastMessageAt }
              : t
          )
        );
      }
    } catch {
      if (!Array.isArray(cachedMessages)) setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [decryptForUI, me?.id]);

  const startConversation = useCallback(async (contact) => {
    setShowContacts(false);
    setContactQuery('');
    try {
      const thread = await apiFetch('/api/chat/threads/direct', {
        method: 'POST',
        body: JSON.stringify({ targetId: contact._id, targetType: contact.userType }),
      });
      setThreads(prev => {
        const exists = prev.find(t => String(t._id) === String(thread._id));
        return exists ? prev : [thread, ...prev];
      });
      selectThread(String(thread._id));
    } catch { /* ignore */ }
  }, [selectThread]);

  const openContacts = useCallback(async () => {
    if (contacts.length === 0) {
      const userId = meRef.current?.id || me?.id;
      const cachedContacts = userId
        ? readChatCache(chatCacheKeys.contacts(userId), CONTACTS_CACHE_TTL_MS)
        : null;
      if (Array.isArray(cachedContacts)) {
        setContacts(cachedContacts);
      } else {
        try {
          const data = await apiFetch('/api/chat/contacts');
          setContacts(data);
          if (userId) writeChatCache(chatCacheKeys.contacts(userId), data);
        } catch { /* ignore */ }
      }
    }
    setShowContacts(true);
  }, [contacts, me?.id]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !activeThreadId) return;
    setDraft('');

    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      _id: optimisticId, threadId: activeThreadId,
      senderId: me?.id, senderType: 'parent',
      senderName: me?.name || 'Parent', text,
      createdAt: new Date().toISOString(),
      seenBy: [{ userId: me?.id, seenAt: new Date().toISOString() }],
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);

    const sendPayload = async () => {
      const encrypted = await encryptChatMessage({ threadId: activeThreadId, text, myId: me?.id, apiFetch });
      return encrypted;
    };

    if (socketRef.current?.connected) {
      sendPayload().then(encrypted => {
        socketRef.current.emit('send-message', {
          threadId: activeThreadId,
          text: encrypted ? '' : text,
          encrypted: encrypted || undefined,
        });
      }).catch(() => {
        socketRef.current.emit('send-message', { threadId: activeThreadId, text });
      });
    } else {
      sendPayload().then(encrypted =>
        apiFetch(`/api/chat/threads/${activeThreadId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text: encrypted ? '' : text, encrypted: encrypted || undefined }),
        })
      ).then(async msg => {
        const decrypted = await decryptForUI(msg);
        setMessages(prev => prev.map(m => m._id === optimisticId ? decrypted : m));
      }).catch(() => {
        setMessages(prev => prev.filter(m => m._id !== optimisticId));
      });
    }

    setThreads(prev => prev.map(t =>
      String(t._id) === activeThreadId
        ? { ...t, lastMessage: text, lastMessageAt: new Date().toISOString() }
        : t
    ));

    if (isTyping.current) {
      isTyping.current = false;
      socketRef.current?.emit('typing-stop', { threadId: activeThreadId });
    }
  }, [draft, activeThreadId, me, decryptForUI]);

  const handleDraftChange = useCallback((val) => {
    setDraft(val);
    if (!activeThreadId || !socketRef.current) return;
    if (!isTyping.current) {
      isTyping.current = true;
      socketRef.current.emit('typing-start', { threadId: activeThreadId });
    }
    clearTimeout(typingDebounce.current);
    typingDebounce.current = setTimeout(() => {
      isTyping.current = false;
      socketRef.current?.emit('typing-stop', { threadId: activeThreadId });
    }, 2000);
  }, [activeThreadId]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(t => {
      const name = t.otherParticipant?.name || '';
      return name.toLowerCase().includes(q) || t.lastMessage?.toLowerCase().includes(q);
    });
  }, [threads, query]);

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => c.name?.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q));
  }, [contacts, contactQuery]);

  const theme          = THEMES[themeKey]         || THEMES.green;
  const wallpaperStyle = (WALLPAPERS[wallpaperKey] || WALLPAPERS.doodle).style;
  const chatSurfaceStyle = wallpaperStyle.backgroundImage
    ? {
        ...wallpaperStyle,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.48), rgba(255,255,255,0.48)), ${wallpaperStyle.backgroundImage}`,
      }
    : { ...wallpaperStyle, backgroundColor: wallpaperStyle.backgroundColor || 'rgba(255,255,255,0.16)' };
  const handleSetWallpaper = (key) => { setWallpaperKey(key); localStorage.setItem('parent_chat_wallpaper', key); };
  const handleSetTheme     = (key) => { setThemeKey(key);     localStorage.setItem('parent_chat_theme',    key); };

  const isTypingInActive   = activeThreadId ? typingUsers[activeThreadId] : null;
  const showSidebar        = !isMobileView || !activeThreadId;
  const showMain           = !isMobileView || activeThreadId;

  const activeTeacher     = activeThread?.otherParticipant || null;
  const activePresence    = activeTeacher?.userId ? presenceByUser[String(activeTeacher.userId)] : null;
  const activeStatusText  = isTypingInActive
    ? 'typing...'
    : activePresence?.online
    ? 'online'
    : activePresence?.lastSeen
    ? `last seen ${formatLastSeen(activePresence.lastSeen)}`
    : (activeTeacher?.subtitle || activeTeacher?.subject || 'Teacher');

  return (
    <div className="relative isolate flex min-h-[calc(100vh-1.5rem)] items-center justify-center overflow-hidden rounded-[2rem] bg-slate-100 p-2 sm:p-4 lg:p-6">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-violet-300/25 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
      </div>
      {teacherModal && (
        <TeacherModal teacher={teacherModal} onClose={() => setTeacherModal(null)} theme={theme} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-[calc(100vh-3rem)] max-h-[900px] min-h-[620px] w-full max-w-7xl overflow-hidden rounded-[28px] border border-white/70 bg-white/55 shadow-2xl shadow-black/10 backdrop-blur-[20px] backdrop-saturate-[1.8]"
      >

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {showSidebar && (
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative flex h-full w-full shrink-0 flex-col border-r border-white/60 bg-white/40 backdrop-blur-xl md:w-[360px]"
        >

          {/* Header */}
          <div className="border-b border-white/60 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/45 shadow-sm backdrop-blur-sm" style={{ color: theme.color }}>
                  <MessageSquare className="h-5 w-5" style={{ color: theme.color }} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">Messages</h1>
                  <p className="text-xs text-gray-500">Chat with your teachers</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowChatSettings(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 bg-white/25 backdrop-blur-sm transition-all hover:bg-white/55"
                  title="Chat settings"
                >
                  <Palette className="h-4 w-4" style={{ color: theme.color }} />
                </button>
                <button
                  onClick={openContacts}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 backdrop-blur-sm transition-all"
                  title="Start new conversation"
                  style={{ backgroundColor: theme.lighter, color: theme.color }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.light; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = theme.lighter; }}
                >
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 shadow-sm backdrop-blur-sm focus-within:bg-white/70">
              <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search conversations..."
                className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Contacts overlay */}
          {showContacts && (
            <div className="absolute inset-0 z-50 flex h-full w-full flex-col bg-white/80 shadow-xl backdrop-blur-2xl">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">New Conversation</h2>
                <button onClick={() => { setShowContacts(false); setContactQuery(''); }}
                  className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <div className="px-4 py-2 border-b">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-gray-400" />
                  <input
                    autoFocus
                    value={contactQuery}
                    onChange={e => setContactQuery(e.target.value)}
                    placeholder="Search teachers..."
                    className="bg-transparent outline-none text-xs flex-1 placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500">
                    {contacts.length === 0 ? 'No teachers found' : 'No results'}
                  </div>
                ) : (
                  filteredContacts.map(c => (
                    <ContactItem key={c._id} contact={c} onClick={() => startConversation(c)} theme={theme} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat Settings Overlay */}
          {showChatSettings && (
            <div className="absolute inset-0 z-50 flex flex-col bg-white/80 backdrop-blur-2xl">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h2 className="font-semibold text-gray-800 text-sm">Chat Settings</h2>
                <button
                  onClick={() => setShowChatSettings(false)}
                  className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Wallpaper Picker */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Wallpaper</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(WALLPAPERS).map(([key, wp]) => (
                      <button
                        key={key}
                        onClick={() => handleSetWallpaper(key)}
                        className="relative rounded-xl overflow-hidden border-2 transition-all"
                        style={{
                          aspectRatio: '1',
                          borderColor: wallpaperKey === key ? theme.color : '#e5e7eb',
                          transform: wallpaperKey === key ? 'scale(0.95)' : 'scale(1)',
                          boxShadow: wallpaperKey === key ? `0 4px 12px ${theme.color}40` : 'none',
                        }}
                        title={wp.label}
                      >
                        <div style={{ ...wp.style, height: '80px', width: '100%' }} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent text-white text-[9px] text-center pb-1 pt-3 font-semibold">
                          {wp.label}
                        </div>
                        {wallpaperKey === key && (
                          <div
                            className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: theme.color }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Color Picker */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Theme Color</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(THEMES).map(([key, th]) => (
                      <button
                        key={key}
                        onClick={() => handleSetTheme(key)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor: themeKey === key ? th.color : '#e5e7eb',
                          backgroundColor: themeKey === key ? th.lighter : 'transparent',
                        }}
                      >
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center shadow-sm shrink-0"
                          style={{ backgroundColor: th.color }}
                        >
                          {themeKey === key && <Check className="h-4 w-4 text-white" />}
                        </div>
                        <span className="text-[11px] font-medium text-gray-700">{th.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Preview */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview</p>
                  <div className="rounded-xl overflow-hidden border border-gray-200">
                    <div className="p-3 space-y-2" style={wallpaperStyle}>
                      <div className="flex justify-start">
                        <div className="max-w-[70%] bg-white rounded-2xl rounded-bl-sm px-3 py-2 text-xs shadow-sm">
                          <div className="font-semibold text-[10px] mb-0.5" style={{ color: theme.color }}>Teacher</div>
                          Hello! How can I help you?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[70%] rounded-2xl rounded-br-sm px-3 py-2 text-xs text-white shadow-sm" style={{ backgroundColor: theme.color }}>
                          How is my child doing?
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Thread list */}
          <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
            {loadingThreads ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.color }} />
              </div>
            ) : syncingThreads && filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.color }} />
                <p className="text-xs text-gray-500">Loading conversations...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {query ? 'No results found' : 'No conversations yet'}
                </p>
                {!query && (
                  <button onClick={openContacts}
                    className="mt-3 text-xs hover:underline font-medium"
                    style={{ color: theme.color }}>
                    Start a conversation
                  </button>
                )}
              </div>
            ) : (
              filteredThreads.map(t => (
                <ConversationItem
                  key={t._id}
                  thread={t}
                  isActive={String(t._id) === activeThreadId}
                  isTyping={Boolean(typingUsers[String(t._id)])}
                  onClick={() => selectThread(String(t._id))}
                  theme={theme}
                />
              ))
            )}
            {syncingThreads && filteredThreads.length > 0 && (
              <div className="rounded-xl border border-white/60 bg-white/50 px-4 py-2 backdrop-blur-sm">
                <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: theme.color }} />
                  Syncing latest chats...
                </div>
              </div>
            )}
          </div>

          {/* Footer — parent info */}
          <div className="border-t border-white/60 bg-white/20 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <Avatar src={pickImg(me)} name={me?.name || 'P'} size="xs" themeColor={theme.color} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 truncate">{me?.name || 'Parent'}</p>
                <p className="text-xs text-gray-400">Parent</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Online</span>
            </div>
          </div>
        </motion.aside>
      )}

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      {showMain && (
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white/10 backdrop-blur-sm">
          {activeThreadId ? (
            <>
              {/* Chat header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/50 bg-white/20 px-5 py-4 backdrop-blur-lg sm:px-7">
                <div className="flex items-center gap-3">
                  {isMobileView && (
                    <button
                      onClick={() => { setActiveThreadId(null); activeThreadIdRef.current = null; }}
                      className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-500" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTeacherModal(activeTeacher)}
                    className="flex items-center gap-3 text-left"
                    title="View teacher profile"
                  >
                    <Avatar
                      src={pickImg(activeTeacher)}
                      name={activeTeacher?.name || ''}
                      size="sm"
                      ring
                      themeColor={theme.color}
                      className="hover:opacity-90 transition-opacity cursor-pointer"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {activeTeacher?.name || 'Teacher'}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span style={isTypingInActive ? { color: theme.color, fontWeight: 500 } : {}}>{activeStatusText}</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 backdrop-blur-sm sm:px-7" style={chatSurfaceStyle}>
                <div className="flex justify-center mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/45 px-3 py-1 text-[11px] font-medium text-slate-500 backdrop-blur-sm">
                    <Lock className="h-3 w-3" />
                    Messages are end-to-end encrypted
                  </span>
                </div>
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.color }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <Avatar src={pickImg(activeTeacher)} name={activeTeacher?.name || ''} size="lg" themeColor={theme.color} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">{activeTeacher?.name || 'Teacher'}</p>
                      <p className="text-xs text-gray-400 mt-1">No messages yet — say hello!</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => {
                      const currentTs = msg.createdAt || msg.ts;
                      const prevTs = index > 0 ? (messages[index - 1].createdAt || messages[index - 1].ts) : null;
                      const showDateSep = index === 0 || dayKey(currentTs) !== dayKey(prevTs);
                      return (
                        <React.Fragment key={msg._id}>
                          {showDateSep && (
                            <div className="flex justify-center my-3">
                              <span className="rounded-full border border-white/40 bg-white/40 px-3 py-1 text-[11px] font-medium text-slate-500 backdrop-blur-sm">
                                {formatDaySeparator(currentTs)}
                              </span>
                            </div>
                          )}
                          <ChatMessage
                            msg={msg}
                            isMine={String(msg.senderId) === String(me?.id)}
                            myId={me?.id}
                            theme={theme}
                          />
                        </React.Fragment>
                      );
                    })}
                    {isTypingInActive && (
                      <div className="flex justify-start mb-3">
                        <div className="rounded-2xl rounded-bl-md border border-white/80 bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-lg">
                          <div className="flex gap-1 items-center h-4">
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-white/40 bg-white/10 px-4 py-3 backdrop-blur-lg sm:px-5 sm:py-4">
                <div className="flex items-end gap-2.5 rounded-2xl border border-white/60 bg-white/35 p-1.5 pl-4 shadow-sm backdrop-blur-lg focus-within:bg-white/55">
                  <div className="flex-1 py-1">
                    <textarea
                      rows={1}
                      value={draft}
                      onChange={e => handleDraftChange(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                      }}
                      placeholder="Type a message..."
                      className="min-h-[20px] max-h-28 w-full resize-none bg-transparent text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!draft.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{ backgroundColor: theme.color }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center bg-white/10 p-8 backdrop-blur-sm">
              <div className="text-center max-w-xs">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: theme.light }}>
                  <MessageSquare className="h-8 w-8" style={{ color: theme.color }} />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Parent Chat</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Connect with your child's teachers.
                </p>
                <button
                  onClick={openContacts}
                  className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: theme.color }}
                >
                  <PlusCircle className="h-4 w-4" />
                  New Conversation
                </button>
              </div>
            </div>
          )}
        </main>
      )}
      </motion.div>
    </div>
  );
};

export default ParentChat;
