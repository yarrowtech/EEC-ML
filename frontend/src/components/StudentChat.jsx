import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  MessageSquare, Send, Search, ChevronLeft,
  PlusCircle, X, Loader2, Eye, Mail, BookOpen,
  GraduationCap, Phone, User, Check, CheckCheck,
  Info, Palette, Lock, Link2, ExternalLink, Pencil, ChevronDown
} from 'lucide-react';
import { decryptChatMessage, encryptChatMessage, ensureE2EEIdentity } from '../utils/chatE2EE';
import { chatCacheKeys, readChatCache, writeChatCache } from '../utils/chatCache';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const THREADS_CACHE_TTL_MS = 15 * 60 * 1000;
const MESSAGES_CACHE_TTL_MS = 15 * 60 * 1000;
const CONTACTS_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_EDIT_WINDOW_MS = Math.max(1000, Number(import.meta.env.VITE_CHAT_EDIT_WINDOW_MS || 15 * 60 * 1000));
const LAST_STUDENT_CHAT_ME_KEY = 'student_chat_me_id_v1';

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

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

const isEncryptedPreviewPlaceholder = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '[encrypted message]' || normalized === '[encrypted msg]') return true;
  return normalized.includes('encrypted message') || normalized.includes('encrypted msg');
};

const normalizeId = (value) => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value._id != null) return String(value._id);
    if (value.id != null) return String(value.id);
    if (value.$oid != null) return String(value.$oid);
  }
  return '';
};

const isSameId = (left, right) => {
  const a = normalizeId(left);
  const b = normalizeId(right);
  return Boolean(a && b && a === b);
};

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

/* resolve relative image paths from the server */
const resolveImg = (src) => {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) return src;
  return `${API_URL}${src.startsWith('/') ? '' : '/'}${src}`;
};

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.!?;:]+$/;

const normalizeUrl = (raw = '') => {
  const trimmed = String(raw || '').trim().replace(TRAILING_PUNCTUATION_REGEX, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const extractMessageLinks = (text = '') => {
  const value = String(text || '');
  const links = [];
  const seen = new Set();
  let match;
  const regex = new RegExp(URL_REGEX.source, 'gi');
  while ((match = regex.exec(value)) !== null) {
    const normalized = normalizeUrl(match[0]);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
  }
  return links;
};

const linkifyMessageText = (text = '') => {
  const value = String(text || '');
  const parts = [];
  let cursor = 0;
  let match;
  const regex = new RegExp(URL_REGEX.source, 'gi');
  while ((match = regex.exec(value)) !== null) {
    const raw = match[0] || '';
    const cleanRaw = raw.replace(TRAILING_PUNCTUATION_REGEX, '');
    const trailing = raw.slice(cleanRaw.length);
    const start = match.index;
    const end = start + raw.length;
    if (start > cursor) parts.push({ type: 'text', value: value.slice(cursor, start) });
    const href = normalizeUrl(cleanRaw);
    if (href) parts.push({ type: 'link', href, label: cleanRaw });
    else parts.push({ type: 'text', value: raw });
    if (trailing) parts.push({ type: 'text', value: trailing });
    cursor = end;
  }
  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });
  return parts;
};

const getYouTubeVideoId = (url = '') => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || '';
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v') || '';
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || '';
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || '';
    }
  } catch {
    return '';
  }
  return '';
};

const getLinkPreviewData = (url = '') => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = `${parsed.pathname || '/'}${parsed.search || ''}`;
    const youtubeId = getYouTubeVideoId(url);
    return {
      href: url,
      host,
      path: path === '/' ? '' : path.slice(0, 60),
      title: youtubeId ? 'YouTube video' : host,
      thumbnail: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : '',
      favicon: `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`,
    };
  } catch {
    return {
      href: url,
      host: url,
      path: '',
      title: 'Open link',
      thumbnail: '',
      favicon: '',
    };
  }
};

/* pick whichever image field the server returns */
const pickImg = (obj) => {
  const raw = obj?.profilePic || obj?.profileImage || obj?.photo || obj?.avatar || obj?.image || null;
  if (!raw) return null;
  // Handle case where field is a Cloudinary response object
  if (typeof raw === 'object') return raw.secure_url || raw.url || raw.path || null;
  return raw;
};

// ── Chat wallpaper (WhatsApp-style doodle background) ─────────────────────────
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
    <circle cx="104" cy="58" r="3"/>
    <circle cx="174" cy="96" r="3"/>
    <circle cx="278" cy="154" r="3"/>
    <circle cx="122" cy="270" r="3"/>
    <circle cx="70" cy="112" r="3"/>
    <circle cx="202" cy="116" r="3"/>
    <circle cx="142" cy="212" r="3"/>
    <circle cx="56" cy="240" r="3"/>
    <circle cx="290" cy="60" r="3"/>
  </g>
</svg>`;
// ── Geometric SVG ──────────────────────────────────────────────────────────────
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
  <polygon points="240,92 262,92 273,111 262,130 240,130 229,111" fill="#c7d9ef" opacity="0.3"/>
  <polygon points="65,135 95,185 35,185" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="185,135 215,185 155,185" fill="#d1e3f3" opacity="0.35"/>
  <polygon points="48,200 64,184 80,200 64,216" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.45"/>
  <polygon points="148,198 164,182 180,198 164,214" fill="#c7d9ef" opacity="0.4"/>
  <polygon points="228,195 244,179 260,195 244,211" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.4"/>
  <polygon points="30,168 52,168 63,187 52,206 30,206 19,187" fill="none" stroke="#94a3b8" stroke-width="1.5" opacity="0.35"/>
  <polygon points="100,173 122,173 133,192 122,211 100,211 89,192" fill="#c7d9ef" opacity="0.3"/>
  <g fill="#94a3b8" opacity="0.28">
    <circle cx="100" cy="95" r="2.5"/>
    <circle cx="170" cy="55" r="2.5"/>
    <circle cx="240" cy="95" r="2.5"/>
    <circle cx="65" cy="165" r="2.5"/>
    <circle cx="205" cy="165" r="2.5"/>
    <circle cx="135" cy="245" r="2.5"/>
  </g>
</svg>`;

// ── Floral SVG ─────────────────────────────────────────────────────────────────
const _SVG_FLORAL = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
  <rect width="240" height="240" fill="#fdf4fc"/>
  <g transform="translate(60,65)" opacity="0.5">
    <circle cx="0" cy="-16" r="10" fill="#f0abda"/>
    <circle cx="16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="16" r="10" fill="#f0abda"/>
    <circle cx="-16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="11" cy="-11" r="8" fill="#f0abda"/>
    <circle cx="11" cy="11" r="8" fill="#f0abda"/>
    <circle cx="-11" cy="11" r="8" fill="#f0abda"/>
    <circle cx="-11" cy="-11" r="8" fill="#f0abda"/>
    <circle cx="0" cy="0" r="8" fill="#e040af"/>
  </g>
  <g transform="translate(185,75) scale(0.65)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#c084fc"/>
    <circle cx="16" cy="0" r="10" fill="#c084fc"/>
    <circle cx="0" cy="16" r="10" fill="#c084fc"/>
    <circle cx="-16" cy="0" r="10" fill="#c084fc"/>
    <circle cx="0" cy="0" r="8" fill="#9333ea"/>
  </g>
  <g transform="translate(28,185) scale(0.6)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#fca5a5"/>
    <circle cx="16" cy="0" r="10" fill="#fca5a5"/>
    <circle cx="0" cy="16" r="10" fill="#fca5a5"/>
    <circle cx="-16" cy="0" r="10" fill="#fca5a5"/>
    <circle cx="0" cy="0" r="8" fill="#ef4444"/>
  </g>
  <g transform="translate(195,195) scale(0.75)" opacity="0.45">
    <circle cx="0" cy="-16" r="10" fill="#f0abda"/>
    <circle cx="16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="16" r="10" fill="#f0abda"/>
    <circle cx="-16" cy="0" r="10" fill="#f0abda"/>
    <circle cx="0" cy="0" r="8" fill="#e040af"/>
  </g>
  <ellipse cx="130" cy="38" rx="9" ry="22" transform="rotate(-30,130,38)" fill="#bbf7d0" opacity="0.55"/>
  <ellipse cx="102" cy="152" rx="8" ry="20" transform="rotate(25,102,152)" fill="#bbf7d0" opacity="0.5"/>
  <ellipse cx="165" cy="158" rx="7" ry="18" transform="rotate(-20,165,158)" fill="#bbf7d0" opacity="0.45"/>
  <g fill="#f0abda" opacity="0.28">
    <circle cx="92" cy="22" r="3"/>
    <circle cx="218" cy="142" r="3"/>
    <circle cx="112" cy="222" r="3"/>
    <circle cx="8" cy="104" r="3"/>
  </g>
</svg>`;

// ── Polka-dots SVG (small tile) ────────────────────────────────────────────────
const _SVG_POLKA = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
  <rect width="60" height="60" fill="#f9f9f9"/>
  <circle cx="15" cy="15" r="4.5" fill="#e2e8f0" opacity="0.85"/>
  <circle cx="45" cy="45" r="4.5" fill="#e2e8f0" opacity="0.85"/>
  <circle cx="45" cy="15" r="2.5" fill="#e2e8f0" opacity="0.55"/>
  <circle cx="15" cy="45" r="2.5" fill="#e2e8f0" opacity="0.55"/>
  <circle cx="30" cy="30" r="1.5" fill="#e2e8f0" opacity="0.4"/>
</svg>`;

// ── Dark SVG ───────────────────────────────────────────────────────────────────
const _SVG_DARK = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
  <rect width="300" height="300" fill="#1e1b2e"/>
  <g opacity="0.22">
    <rect x="15" y="18" width="58" height="30" rx="8" fill="#8b5cf6"/>
    <path d="M22,48 L13,62 L33,48" fill="#8b5cf6"/>
    <line x1="22" y1="28" x2="60" y2="28" stroke="#1e1b2e" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="22" y1="36" x2="52" y2="36" stroke="#1e1b2e" stroke-width="2.5" stroke-linecap="round"/>
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
    <path d="M24,180 L13,195 L35,180" fill="#6366f1"/>
    <circle cx="34" cy="164" r="4" fill="#1e1b2e"/>
    <circle cx="46" cy="164" r="4" fill="#1e1b2e"/>
    <circle cx="58" cy="164" r="4" fill="#1e1b2e"/>
  </g>
  <g transform="translate(237,183)" opacity="0.2">
    <circle cx="14" cy="14" r="13" fill="none" stroke="#8b5cf6" stroke-width="2"/>
    <circle cx="9" cy="11" r="2" fill="#8b5cf6"/>
    <circle cx="19" cy="11" r="2" fill="#8b5cf6"/>
    <path d="M8,18 Q14,24 20,18" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
  </g>
  <g opacity="0.2">
    <rect x="196" y="240" width="72" height="36" rx="8" fill="#7c3aed"/>
    <path d="M258,276 L268,290 L254,276" fill="#7c3aed"/>
    <line x1="206" y1="253" x2="256" y2="253" stroke="#1e1b2e" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="206" y1="264" x2="244" y2="264" stroke="#1e1b2e" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <g fill="#7c3aed" opacity="0.18">
    <circle cx="104" cy="58" r="3"/>
    <circle cx="174" cy="96" r="3"/>
    <circle cx="278" cy="154" r="3"/>
    <circle cx="122" cy="270" r="3"/>
    <circle cx="70" cy="112" r="3"/>
    <circle cx="202" cy="116" r="3"/>
    <circle cx="142" cy="212" r="3"/>
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
  amber:  { label: 'Amber',  color: '#f59e0b', hover: '#d97706', light: '#fef3c7', lighter: '#fffbeb' },
  blue:   { label: 'Blue',   color: '#3b82f6', hover: '#2563eb', light: '#dbeafe', lighter: '#eff6ff' },
  purple: { label: 'Purple', color: '#8b5cf6', hover: '#7c3aed', light: '#ede9fe', lighter: '#f5f3ff' },
  green:  { label: 'Green',  color: '#22c55e', hover: '#16a34a', light: '#dcfce7', lighter: '#f0fdf4' },
  rose:   { label: 'Rose',   color: '#f43f5e', hover: '#e11d48', light: '#ffe4e6', lighter: '#fff1f2' },
  teal:   { label: 'Teal',   color: '#14b8a6', hover: '#0f9688', light: '#ccfbf1', lighter: '#f0fdfa' },
};

// ── Avatar: shows real image or coloured initials ──────────────────────────────
const SIZES = {
  xs:  'h-7  w-7  text-xs',
  sm:  'h-9  w-9  text-sm',
  md:  'h-11 w-11 text-sm',
  lg:  'h-16 w-16 text-lg',
  xl:  'h-24 w-24 text-2xl',
};

const Avatar = ({ src, name = '', size = 'sm', ring = false, className = '', themeColor = '#f59e0b' }) => {
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
        className={`rounded-full object-cover flex-shrink-0 ${sz} ${className}`}
        style={ringStyle}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${sz} ${className}`}
      style={{ background: `linear-gradient(135deg, ${themeColor}bb, ${themeColor})`, ...ringStyle }}
    >
      {getInitials(name)}
    </div>
  );
};

// ── Teacher Details Modal ──────────────────────────────────────────────────────
const TeacherModal = ({ teacher, onClose }) => {
  if (!teacher) return null;

  const img    = pickImg(teacher);
  const name   = teacher.name   || 'Teacher';
  const email  = teacher.email  || teacher.userId || null;
  const phone  = teacher.phone  || teacher.mobile || null;
  const subj   = Array.isArray(teacher.subjects)
    ? teacher.subjects.join(', ')
    : (teacher.subject || teacher.specialization || null);
  const dept   = teacher.department || null;
  const grade  = teacher.grade || teacher.class || null;
  const bio    = teacher.bio || teacher.about || null;
  const exp    = teacher.experience || null;
  const qual   = teacher.qualification || teacher.degree || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top banner */}
        <div className="h-24 bg-gradient-to-r from-amber-400 to-orange-400 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Avatar overlapping banner */}
        <div className="flex justify-center -mt-12 mb-3">
          <Avatar src={img} name={name} size="xl"
            className="ring-4 ring-white shadow-lg z-50" />
        </div>

        {/* Name + role */}
        <div className="text-center px-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900">{name}</h2>
          <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
            <GraduationCap className="h-3.5 w-3.5" /> Teacher
          </span>
        </div>

        {/* Details list */}
        <div className="border-t border-gray-100 divide-y divide-gray-100 mx-4 mb-4 rounded-xl overflow-hidden border">
          {[
            subj  && { icon: BookOpen, label: 'Subject',        value: subj },
            dept  && { icon: GraduationCap, label: 'Department', value: dept },
            grade && { icon: User,     label: 'Class',          value: grade },
            qual  && { icon: GraduationCap, label: 'Qualification', value: qual },
            exp   && { icon: User,     label: 'Experience',     value: exp },
            email && { icon: Mail,     label: 'Email',          value: email },
            phone && { icon: Phone,    label: 'Phone',          value: phone },
          ].filter(Boolean).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3 bg-white">
              <div className="p-1.5 rounded-lg bg-amber-50 shrink-0">
                <Icon className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-sm text-gray-800 font-semibold truncate">{value}</p>
              </div>
            </div>
          ))}

          {/* if nothing to show */}
          {!subj && !dept && !email && !phone && !qual && !exp && !grade && (
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
  msg.seenBy.some((entry) => !isSameId(entry?.userId, myId));

const canEditOwnMessage = (msg, myId) => {
  if (!msg || !myId) return false;
  if (msg?._optimistic === true) return false;
  if (String(msg?.senderType || '').toLowerCase() === 'system') return false;
  if (!isSameId(msg?.senderId, myId)) return false;
  const createdAt = msg?.createdAt || msg?.ts;
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= CHAT_EDIT_WINDOW_MS;
};

const MessageLinkPreview = ({ url, isMine, theme }) => {
  const t = theme || THEMES.amber;
  const preview = getLinkPreviewData(url);
  const border = isMine ? 'rgba(255,255,255,0.35)' : '#e5e7eb';
  const bg = isMine ? 'rgba(255,255,255,0.16)' : '#f9fafb';
  const text = isMine ? 'text-white' : 'text-gray-800';
  const subtext = isMine ? 'text-white/80' : 'text-gray-500';

  return (
    <a
      href={preview.href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-xl border overflow-hidden hover:opacity-95 transition-opacity"
      style={{ borderColor: border, backgroundColor: bg }}
    >
      {preview.thumbnail && (
        <div className="h-28 w-full bg-black/10">
          <img src={preview.thumbnail} alt={preview.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        {preview.favicon ? (
          <img src={preview.favicon} alt="" className="h-4 w-4 mt-0.5 rounded-sm shrink-0" loading="lazy" />
        ) : (
          <Link2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: isMine ? 'rgba(255,255,255,0.9)' : t.color }} />
        )}
        <div className="min-w-0">
          <div className={`text-xs font-semibold truncate ${text}`}>{preview.title}</div>
          <div className={`text-[11px] truncate ${subtext}`}>{preview.host}</div>
          {preview.path && <div className={`text-[11px] truncate ${subtext}`}>{preview.path}</div>}
        </div>
        {/* <ExternalLink className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${subtext}`} /> */}
      </div>
    </a>
  );
};

const ChatMessage = ({
  msg,
  isMine,
  myId,
  showSenderLabel = true,
  theme,
  canEdit = false,
  isEditing = false,
  editDraft = '',
  editSaving = false,
  onEditDraftChange = () => {},
  onEditCancel = () => {},
  onEditSave = () => {},
  onStartEdit = () => {},
}) => {
  const t = theme || THEMES.amber;
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
  const seen = isMine && isSeenByOther(msg, myId);
  const delivered = isMine && !optimistic;
  const LONG_MESSAGE_LIMIT = 260;
  const fullText = String(msg?.text || '');
  const isLongMessage = fullText.length > LONG_MESSAGE_LIMIT;
  const [expanded, setExpanded] = useState(false);
  const visibleText = isLongMessage && !expanded
    ? `${fullText.slice(0, LONG_MESSAGE_LIMIT)}...`
    : fullText;
  const textParts = useMemo(() => linkifyMessageText(visibleText), [visibleText]);
  const links = useMemo(() => extractMessageLinks(fullText).slice(0, 2), [fullText]);
  const senderLabel = isMine ? 'You' : (msg?.senderName || 'User');

  return (
  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
    <div
      className={`relative max-w-[78%] w-fit rounded-xl px-4 py-1 text-sm shadow-sm
        ${isMine ? 'text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}
      style={isMine ? { backgroundColor: t.color } : {}}
    >
      {showSenderLabel && (
        <div
          className="text-xs font-semibold mb-1"
          style={isMine ? { color: 'rgba(255,255,255,0.85)' } : { color: t.color }}
        >
          {senderLabel}
        </div>
      )}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEditSave();
              }
              if (e.key === 'Escape') onEditCancel();
            }}
            className={`w-full rounded-lg border px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 ${
              isMine
                ? 'bg-white/15 border-white/30 text-white placeholder-white/70 focus:ring-white/40'
                : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-amber-200'
            }`}
            placeholder="Edit message..."
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onEditCancel}
              className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                isMine ? 'text-white/90 hover:bg-white/15' : 'text-gray-600 hover:bg-gray-100'
              }`}
              disabled={editSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onEditSave}
              className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                isMine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              } disabled:opacity-50`}
              disabled={editSaving || !String(editDraft || '').trim()}
            >
              {editSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {links.map((url) => (
            <MessageLinkPreview key={url} url={url} isMine={isMine} theme={t} />
          ))}
          <div className="whitespace-pre-wrap leading-relaxed break-words flex justify-between items-end">
            {textParts.map((part, index) => (
              part.type === 'link' ? (
                <a
                  key={`${part.href}-${index}`}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline break-all"
                  style={{ color: isMine ? 'rgba(255,255,255,0.96)' : t.color }}
                >
                  {part.label}
                </a>
              ) : (
                <React.Fragment key={`text-${index}`}>{part.value}</React.Fragment>
              )
            ))}
            <span
              className={`inline-flex items-center gap-1 ml-2 text-[11px] whitespace-nowrap align-baseline ${!isMine ? 'text-gray-400' : ''}`}
              style={isMine ? { color: 'rgba(255,255,255,0.75)' } : {}}
            >
              {msg?.isEdited && <span>(edited)</span>}
              <span>{formatMessageTime(msg.createdAt || msg.ts)}</span>
              {isMine && (
                <span style={{ color: seen ? '#7dd3fc' : 'rgba(255,255,255,0.75)' }} className="inline-flex items-center">
                  {seen || delivered ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </span>
              )}
            </span>
          </div>
          {isLongMessage && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-xs font-semibold hover:underline"
              style={{ color: isMine ? 'rgba(255,255,255,0.8)' : t.color }}
            >
              {expanded ? 'Read less' : 'Read more'}
            </button>
          )}
          {canEdit && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onStartEdit}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 ${
                  isMine
                    ? 'text-white/90 hover:bg-white/15 focus:ring-white/40'
                    : 'text-amber-700 hover:bg-amber-100 focus:ring-amber-200'
                }`}
                title="Edit this message"
                aria-label="Edit this message"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  </div>
  );
};

// ── ConversationItem ──────────────────────────────────────────────────────────
const ConversationItem = ({ thread, isActive, onClick, typingName, theme }) => {
  const t       = theme || THEMES.amber;
  const other   = thread.otherParticipant;
  const name    = other?.name || 'Unknown';
  const img     = pickImg(other);
  const unread  = thread.unreadCount || 0;
  const isTyping = Boolean(typingName);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-gray-100
        ${isActive ? '' : 'hover:bg-gray-50'}`}
      style={isActive ? { backgroundColor: t.lighter, borderLeft: `4px solid ${t.color}` } : {}}
    >
      <Avatar src={img} name={name} size="md" ring={isActive} themeColor={t.color} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {name}
          </span>
          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatTime(thread.lastMessageAt)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className="text-xs truncate"
            style={isTyping ? { color: t.color, fontWeight: 500, fontStyle: 'italic' } : { color: '#6b7280' }}
          >
            {isTyping ? `${typingName} is typing...` : (thread.lastMessage || 'No messages yet')}
          </span>
          {unread > 0 && (
            <span
              className="ml-2 flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded-full text-white text-xs flex items-center justify-center font-semibold"
              style={{ backgroundColor: t.color }}
            >
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// ── ContactItem ───────────────────────────────────────────────────────────────
const ContactItem = ({ contact, onClick, theme }) => {
  const t   = theme || THEMES.amber;
  const img = pickImg(contact);
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
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

// ── Main StudentChat ───────────────────────────────────────────────────────────
const StudentChat = () => {
  const [me, setMe]                         = useState(null);
  const [threads, setThreads]               = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [draft, setDraft]                   = useState('');
  const [query, setQuery]                   = useState('');
  const [contacts, setContacts]             = useState([]);
  const [showContacts, setShowContacts]     = useState(false);
  const [contactQuery, setContactQuery]     = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [syncingThreads, setSyncingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers]       = useState({});
  const [presenceByUser, setPresenceByUser] = useState({});
  const [isMobileView, setIsMobileView]     = useState(false);
  const [teacherModal, setTeacherModal]     = useState(null); // teacher object or null
  const [wallpaperKey, setWallpaperKey]     = useState(() => localStorage.getItem('chat_wallpaper') || 'doodle');
  const [themeKey, setThemeKey]             = useState(() => localStorage.getItem('chat_theme')     || 'amber');
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const socketRef          = useRef(null);
  const activeThreadIdRef  = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesEndRef     = useRef(null);
  const typingTimers       = useRef({});
  const typingDebounce     = useRef(null);
  const isTyping           = useRef(false);
  const meRef              = useRef(null);
  const privateKeyRef      = useRef('');
  const shouldAutoScrollRef = useRef(true);

  const activeThread = useMemo(
    () => threads.find(t => String(t._id) === activeThreadId),
    [threads, activeThreadId]
  );
  const isGroupActiveThread = String(activeThread?.threadType || '').toLowerCase() === 'group';

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
    const safePreview = String(preview || '').trim();
    if (safePreview && !isEncryptedPreviewPlaceholder(safePreview)) {
      return { ...thread, lastMessage: safePreview };
    }
    const fallback = String(thread.lastMessage || '').trim();
    return { ...thread, lastMessage: isEncryptedPreviewPlaceholder(fallback) ? '' : fallback };
  }, []);

  const hydrateEncryptedThreadPreviews = useCallback(async (threadList) => {
    if (!Array.isArray(threadList) || threadList.length === 0) return threadList;
    const candidates = threadList.filter((thread) => {
      const preview = String(thread?.lastMessage || '').trim();
      const hasPayload = Boolean(thread?.lastMessagePayload);
      return isEncryptedPreviewPlaceholder(preview) || (!preview && !hasPayload && Boolean(thread?.lastMessageAt));
    });
    if (candidates.length === 0) return threadList;
    const recovered = await Promise.all(
      candidates.map(async (thread) => {
        try {
          const msgs = await apiFetch(`/api/chat/threads/${thread._id}/messages`);
          const latest = (Array.isArray(msgs) ? msgs : []).slice(-1)[0];
          if (!latest) return [String(thread._id), null];
          const decrypted = await decryptForUI(latest);
          const text = String(decrypted?.text || '').trim();
          return [String(thread._id), text && !isEncryptedPreviewPlaceholder(text) ? text : null];
        } catch {
          return [String(thread._id), null];
        }
      })
    );
    const recoveredMap = new Map(recovered.filter((entry) => Array.isArray(entry)));
    return threadList.map((thread) => {
      const text = recoveredMap.get(String(thread._id));
      return text ? { ...thread, lastMessage: text } : thread;
    });
  }, [decryptForUI]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    let mounted = true;

    const hintedMeId = localStorage.getItem(LAST_STUDENT_CHAT_ME_KEY);
    if (hintedMeId) {
      const hintedCachedMe = readChatCache(chatCacheKeys.me(hintedMeId), THREADS_CACHE_TTL_MS);
      if (hintedCachedMe?.id) {
        setMe(hintedCachedMe);
        meRef.current = hintedCachedMe;
      }
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
          localStorage.setItem(LAST_STUDENT_CHAT_ME_KEY, String(meData.id));
          writeChatCache(chatCacheKeys.me(meData.id), meData);
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
        const hydratedThreads = await Promise.all((Array.isArray(threadsData) ? threadsData : []).map((thread) => decryptThreadPreview(thread)));
        const hydratedWithFallback = await hydrateEncryptedThreadPreviews(hydratedThreads);
        const cachedById = new Map(
          (Array.isArray(cachedThreads) ? cachedThreads : []).map((thread) => [String(thread?._id || ''), thread])
        );
        const mergedThreads = hydratedWithFallback.map((thread) => {
          const threadId = String(thread?._id || '');
          const cachedThread = cachedById.get(threadId);
          const currentPreview = String(thread?.lastMessage || '').trim();
          if (!isEncryptedPreviewPlaceholder(currentPreview)) return thread;
          const cachedPreview = String(cachedThread?.lastMessage || '').trim();
          if (!cachedPreview || isEncryptedPreviewPlaceholder(cachedPreview)) return thread;
          return { ...thread, lastMessage: cachedPreview };
        });
        setThreads(mergedThreads);
        writeChatCache(threadsCacheKey, mergedThreads);
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
      const currentThreadId = activeThreadIdRef.current;
      if (!currentThreadId) return;
      socket.emit('join-thread', { threadId: currentThreadId });
      socket.emit('mark-seen', { threadId: currentThreadId });
    });

    socket.on('new-message', async (rawMsg) => {
      const msg = await decryptForUI(rawMsg);
      const threadId = String(msg.threadId);
      const isActiveThread = String(activeThreadIdRef.current) === threadId;
      const isIncomingForMe = !isSameId(msg.senderId, meRef.current?.id);
      setMessages(prev => {
        if (String(activeThreadIdRef.current) !== threadId) return prev;
        if (isSameId(msg.senderId, meRef.current?.id)) {
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

      // Real-time seen: if this thread is open and message is incoming, mark seen immediately.
      if (isActiveThread && isIncomingForMe) {
        socket.emit('mark-seen', { threadId });
      }
    });

    socket.on('thread-updated', async ({ threadId, lastMessage, lastMessageAt, message }) => {
      let resolvedLastMessage = lastMessage;
      let decryptedMessage = null;
      if (message) {
        decryptedMessage = await decryptForUI(message);
        resolvedLastMessage = decryptedMessage?.text || resolvedLastMessage;
      }
      setThreads(prev => prev.map(t =>
        String(t._id) === threadId
          ? {
              ...t,
              lastMessage: resolvedLastMessage,
              lastMessageAt,
              unreadCount: activeThreadIdRef.current === threadId
                ? 0
                : (isSameId(message?.senderId, meRef.current?.id) ? (t.unreadCount || 0) : (t.unreadCount || 0) + 1),
            }
          : t
      ));

      if (decryptedMessage && String(activeThreadIdRef.current) === String(threadId)) {
        const isIncomingForMe = !isSameId(decryptedMessage.senderId, meRef.current?.id);
        setMessages((prev) => {
          if (prev.find((m) => String(m._id) === String(decryptedMessage._id))) return prev;
          const hydrated = isIncomingForMe
            ? {
                ...decryptedMessage,
                seenBy: [
                  ...(Array.isArray(decryptedMessage.seenBy) ? decryptedMessage.seenBy : []),
                  { userId: meRef.current?.id, seenAt: new Date().toISOString() },
                ],
              }
            : decryptedMessage;
          return [...prev, hydrated];
        });
        if (isIncomingForMe) {
          socket.emit('mark-seen', { threadId: String(threadId) });
        }
      }
    });

    socket.on('message-edited', async ({ threadId, message }) => {
      if (!message || !threadId) return;
      const decrypted = await decryptForUI(message);
      if (String(activeThreadIdRef.current) !== String(threadId)) return;
      setMessages((prev) =>
        prev.map((msg) => (String(msg._id) === String(decrypted._id) ? { ...msg, ...decrypted } : msg))
      );
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
      setPresenceByUser((prev) => ({
        ...prev,
        [String(userId)]: { online: Boolean(online), lastSeen: lastSeen || null },
      }));
    });

    socket.on('presence-sync', ({ presence }) => {
      if (!presence || typeof presence !== 'object') return;
      setPresenceByUser((prev) => {
        const next = { ...prev };
        Object.entries(presence).forEach(([uid, state]) => {
          next[String(uid)] = { online: Boolean(state?.online), lastSeen: state?.lastSeen || null };
        });
        return next;
      });
    });

    socket.on('message-seen', ({ threadId, userId }) => {
      if (String(activeThreadIdRef.current) !== String(threadId)) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (!isSameId(msg.senderId, meRef.current?.id)) return msg;
          if (Array.isArray(msg.seenBy) && msg.seenBy.some((entry) => isSameId(entry?.userId, userId))) {
            return msg;
          }
          return {
            ...msg,
            seenBy: [...(Array.isArray(msg.seenBy) ? msg.seenBy : []), { userId, seenAt: new Date().toISOString() }]
          };
        })
      );
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [decryptForUI, decryptThreadPreview, hydrateEncryptedThreadPreviews]);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distance < 120;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    shouldAutoScrollRef.current = nearBottom;
    setShowScrollToBottom(!nearBottom);
  }, [isNearBottom]);

  useEffect(() => {
    if (shouldAutoScrollRef.current || isNearBottom()) {
      scrollToBottom('smooth');
    } else {
      setShowScrollToBottom(true);
    }
  }, [messages, isNearBottom, scrollToBottom]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
  }, [activeThreadId]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId) return;
    writeChatCache(chatCacheKeys.threads(userId), threads);
  }, [threads, me?.id]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId || !activeThreadId) return;
    const stableMessages = (Array.isArray(messages) ? messages : [])
      .filter((msg) => !msg?._optimistic)
      .slice(-120);
    writeChatCache(chatCacheKeys.messages(userId, activeThreadId), stableMessages);
  }, [messages, activeThreadId, me?.id]);

  useEffect(() => {
    const userId = me?.id;
    if (!userId || !Array.isArray(contacts) || contacts.length === 0) return;
    writeChatCache(chatCacheKeys.contacts(userId), contacts);
  }, [contacts, me?.id]);

  // ── Thread actions ─────────────────────────────────────────────────────────
  const selectThread = useCallback(async (threadId) => {
    setEditingMessageId('');
    setEditDraft('');
    setEditSaving(false);
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
        setPresenceByUser((prev) => {
          const next = { ...prev };
          Object.entries(presenceRes.presence).forEach(([uid, state]) => {
            next[String(uid)] = { online: Boolean(state?.online), lastSeen: state?.lastSeen || null };
          });
          return next;
        });
      }
      const msgs = await apiFetch(`/api/chat/threads/${threadId}/messages`);
      const decrypted = await Promise.all((Array.isArray(msgs) ? msgs : []).map((msg) => decryptForUI(msg)));
      setMessages(decrypted);
      if (userId) {
        writeChatCache(chatCacheKeys.messages(userId, threadId), decrypted.slice(-120));
      }
      const latest = decrypted[decrypted.length - 1];
      if (latest?.text) {
        setThreads((prev) =>
          prev.map((thread) =>
            String(thread._id) === String(threadId)
              ? { ...thread, lastMessage: latest.text, lastMessageAt: latest.createdAt || thread.lastMessageAt }
              : thread
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
    const userId = meRef.current?.id || me?.id;
    const cachedContacts = userId
      ? readChatCache(chatCacheKeys.contacts(userId), CONTACTS_CACHE_TTL_MS)
      : null;
    try {
      const data = await apiFetch('/api/chat/contacts');
      setContacts(data);
      if (userId) writeChatCache(chatCacheKeys.contacts(userId), data);
    } catch {
      if (Array.isArray(cachedContacts)) {
        setContacts(cachedContacts);
      }
    }
    setShowContacts(true);
  }, [me?.id]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !activeThreadId) return;
    setDraft('');

    const optimisticId = `opt-${Date.now()}`;
    const optimistic = {
      _id: optimisticId, threadId: activeThreadId,
      senderId: me?.id, senderType: 'student',
      senderName: me?.name || 'You', text,
      createdAt: new Date().toISOString(),
      seenBy: [{ userId: me?.id, seenAt: new Date().toISOString() }],
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);

    const sendPayload = async () => {
      const encrypted = await encryptChatMessage({
        threadId: activeThreadId,
        text,
        myId: me?.id,
        apiFetch,
      });
      return encrypted;
    };

    if (socketRef.current?.connected) {
      sendPayload().then((encrypted) => {
        socketRef.current.emit('send-message', {
          threadId: activeThreadId,
          text,
          encrypted: encrypted || undefined,
        });
      }).catch(() => {
        socketRef.current.emit('send-message', { threadId: activeThreadId, text });
      });
    } else {
      sendPayload().then((encrypted) => {
        return apiFetch(`/api/chat/threads/${activeThreadId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text, encrypted: encrypted || undefined }),
        });
      }).then(async (msg) => {
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

  const startEditMessage = useCallback((msg) => {
    if (!canEditOwnMessage(msg, me?.id)) return;
    setEditingMessageId(String(msg._id || ''));
    setEditDraft(String(msg?.text || ''));
  }, [me?.id]);

  const cancelEditMessage = useCallback(() => {
    setEditingMessageId('');
    setEditDraft('');
    setEditSaving(false);
  }, []);

  const saveEditedMessage = useCallback(async () => {
    const messageId = String(editingMessageId || '');
    const text = String(editDraft || '').trim();
    if (!messageId || !activeThreadId || !text) return;
    const current = messages.find((m) => String(m._id) === messageId);
    if (!canEditOwnMessage(current, me?.id)) {
      cancelEditMessage();
      return;
    }
    setEditSaving(true);
    try {
      const encrypted = await encryptChatMessage({
        threadId: activeThreadId,
        text,
        myId: me?.id,
        apiFetch,
      });
      const updated = await apiFetch(`/api/chat/threads/${activeThreadId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text, encrypted: encrypted || undefined }),
      });
      const decrypted = await decryptForUI(updated);
      setMessages((prev) =>
        prev.map((msg) => (String(msg._id) === messageId ? { ...msg, ...decrypted } : msg))
      );
      setThreads((prev) =>
        prev.map((thread) =>
          String(thread?._id) === String(activeThreadId) &&
          isSameId(thread?.lastSenderId, me?.id)
            ? { ...thread, lastMessage: decrypted?.text || thread.lastMessage }
            : thread
        )
      );
      setEditingMessageId('');
      setEditDraft('');
    } catch {
      // keep draft for retry
    } finally {
      setEditSaving(false);
    }
  }, [editingMessageId, editDraft, activeThreadId, messages, me?.id, decryptForUI, cancelEditMessage]);

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

  // ── Derived ────────────────────────────────────────────────────────────────
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
    return contacts.filter(c => c.name.toLowerCase().includes(q) || c.subtitle?.toLowerCase().includes(q));
  }, [contacts, contactQuery]);
  const totalUnreadCount = useMemo(
    () =>
      (Array.isArray(threads) ? threads : []).reduce(
        (sum, thread) => sum + Math.max(0, Number(thread?.unreadCount || 0)),
        0
      ),
    [threads]
  );

  const theme          = THEMES[themeKey]         || THEMES.amber;
  const wallpaperStyle = (WALLPAPERS[wallpaperKey] || WALLPAPERS.doodle).style;
  const handleSetWallpaper = (key) => { setWallpaperKey(key); localStorage.setItem('chat_wallpaper', key); };
  const handleSetTheme     = (key) => { setThemeKey(key);     localStorage.setItem('chat_theme',    key); };

  const isTypingInActive = activeThreadId ? typingUsers[activeThreadId] : null;
  const showSidebar = !isMobileView || !activeThreadId;
  const showMain    = !isMobileView || activeThreadId;

  const activeTeacher = activeThread?.otherParticipant || null;
  const activeParticipantType = String(activeTeacher?.userType || '').toLowerCase();
  const activeParticipantLabel = activeParticipantType === 'group' ? 'Group' : 'Teacher';
  const activePresence = activeTeacher?.userId ? presenceByUser[String(activeTeacher.userId)] : null;
  const activeStatusText = isTypingInActive
    ? `${isTypingInActive} is typing...`
    : activePresence?.online
    ? 'online'
    : activePresence?.lastSeen
    ? `last seen ${formatLastSeen(activePresence.lastSeen)}`
    : (activeParticipantType === 'group'
      ? 'Group'
      : (activeTeacher?.subject || activeTeacher?.subjects?.[0] || 'Teacher'));

  return (
    <>
      {/* Teacher Details Modal */}
      {teacherModal && (
        <TeacherModal teacher={teacherModal} onClose={() => setTeacherModal(null)} />
      )}

      <div className="h-[100dvh] md:h-full flex bg-gray-50 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        {showSidebar && (
          <div className="w-full md:w-[320px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full relative">

            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.light }}>
                    <MessageSquare className="h-5 w-5" style={{ color: theme.color }} />
                  </div>
                  <div>
                    <h1 className="font-bold text-gray-900 text-sm">Messages</h1>
                    <p className="text-xs text-gray-500">Chat with your teachers</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowChatSettings(true)}
                    className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                    title="Chat settings"
                  >
                    <Palette className="h-4 w-4" style={{ color: theme.color }} />
                  </button>
                  <button
                    onClick={openContacts}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                    title="Start new conversation"
                    style={{ backgroundColor: theme.lighter, color: theme.color }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.light; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = theme.lighter; }}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="bg-transparent outline-none text-xs flex-1 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Contacts overlay */}
            {showContacts && (
              <div className="absolute inset-0 w-full h-full bg-white z-50 flex flex-col shadow-xl">
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
              <div className="absolute inset-0 bg-white z-50 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
                           <span className='text-black'> Hey! How are you doing? </span>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="max-w-[70%] rounded-2xl rounded-br-sm px-3 py-2 text-xs text-white shadow-sm" style={{ backgroundColor: theme.color }}>
                            I'm doing great, thanks!
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                </div>
              ) : syncingThreads && filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
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
                    typingName={typingUsers[String(t._id)] || ''}
                    onClick={() => selectThread(String(t._id))}
                    theme={theme}
                  />
                ))
              )}
              {syncingThreads && filteredThreads.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 bg-white/90 backdrop-blur-sm">
                  <div className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    <span className='text-center'>Syncing latest chats...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer — student info */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2.5">
                <Avatar src={pickImg(me)} name={me?.name || 'S'} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{me?.name || 'Student'}</p>
                  <p className="text-xs text-gray-400">Student</p>
                </div>
                {totalUnreadCount > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-semibold min-w-[22px] text-center"
                    title={`${totalUnreadCount} unread`}
                  >
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Online</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Chat Area ───────────────────────────────────────────────── */}
        {showMain && (
          <div className="flex-1 flex flex-col h-full min-h-0 min-w-0">
            {activeThreadId ? (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0 sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                    {isMobileView && (
                      <button
                        onClick={() => { setActiveThreadId(null); activeThreadIdRef.current = null; }}
                        className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                      >
                        <ChevronLeft className="h-5 w-5 text-gray-500" />
                      </button>
                    )}
                    {/* Clickable avatar → opens modal */}
                    <button
                      onClick={() => setTeacherModal(activeTeacher)}
                      className="shrink-0 focus:outline-none"
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
                    </button>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {activeTeacher?.name || activeParticipantLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        <span style={isTypingInActive ? { color: theme.color, fontWeight: 500 } : {}}>{activeStatusText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Info button → teacher details modal */}
                  <button
                    onClick={() => setTeacherModal(activeTeacher)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                    title="View teacher details"
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = theme.lighter; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <Info className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="relative flex-1 min-h-0 overflow-y-auto px-4 py-4"
                  style={wallpaperStyle}
                >
                  <div className="flex justify-center mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                      <Lock className="h-3 w-3" />
                      Messages are end-to-end encrypted
                    </span>
                  </div>
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      {/* Show teacher avatar in empty state */}
                      <Avatar src={pickImg(activeTeacher)} name={activeTeacher?.name || ''} size="lg" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700">{activeTeacher?.name || activeParticipantLabel}</p>
                        <p className="text-xs text-gray-400 mt-1">No messages yet — say hello!</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, index) => {
                        const currentTs = msg.createdAt || msg.ts;
                        const prevTs = index > 0 ? (messages[index - 1].createdAt || messages[index - 1].ts) : null;
                        const showDateSeparator = index === 0 || dayKey(currentTs) !== dayKey(prevTs);
                        return (
                          <React.Fragment key={msg._id}>
                            {showDateSeparator && (
                              <div className="flex justify-center my-3">
                                <span className="text-[11px] px-3 py-1 rounded-full bg-gray-200 text-gray-600 font-medium">
                                  {formatDaySeparator(currentTs)}
                                </span>
                              </div>
                            )}
                            <ChatMessage
                            msg={msg}
                            isMine={isSameId(msg.senderId, me?.id)}
                            myId={me?.id}
                            showSenderLabel={isGroupActiveThread}
                            theme={theme}
                            canEdit={canEditOwnMessage(msg, me?.id)}
                              isEditing={String(editingMessageId) === String(msg._id)}
                              editDraft={editDraft}
                              editSaving={editSaving}
                              onEditDraftChange={setEditDraft}
                              onEditCancel={cancelEditMessage}
                              onEditSave={saveEditedMessage}
                              onStartEdit={() => startEditMessage(msg)}
                            />
                          </React.Fragment>
                        );
                      })}
                      {isTypingInActive && (
                        <div className="flex justify-start mb-3">
                          <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
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
                  {showScrollToBottom && messages.length > 0 && !loadingMessages && (
                    <button
                      type="button"
                      onClick={() => scrollToBottom('smooth')}
                      className="absolute bottom-4 right-4 h-9 w-9 rounded-full shadow-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-center z-10"
                      title="Scroll to latest messages"
                      aria-label="Scroll to latest messages"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(4rem+max(0.75rem,env(safe-area-inset-bottom)))] md:py-3 flex-shrink-0 sticky bottom-0 z-20">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5">
                      <textarea
                        rows={1}
                        value={draft}
                        onChange={e => handleDraftChange(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                        }}
                        placeholder="Type a message..."
                        className="w-full resize-none bg-transparent text-sm text-gray-900 caret-gray-900 focus:outline-none placeholder:text-gray-400 min-h-[20px] max-h-28"
                        style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                      />
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!draft.trim()}
                      className="h-10 w-10 rounded-full text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      style={{ backgroundColor: theme.color }}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
                <div className="text-center max-w-xs">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: theme.light }}>
                    <MessageSquare className="h-8 w-8" style={{ color: theme.color }} />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">Student Chat</h2>
                  <p className="text-sm text-gray-500 mb-5">
                    Select a conversation or start a new one with your teachers.
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
          </div>
        )}
      </div>
    </>
  );
};

export default StudentChat;
