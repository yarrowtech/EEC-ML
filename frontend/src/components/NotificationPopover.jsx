/* eslint-disable react/prop-types */
// Shared notification panel for every portal (student, teacher, parent,
// principal, admin). Facebook-style: grouped Today / Earlier, the poster's
// photo (or a type avatar) with a small badge icon, unread rows tinted with a
// blue dot, and search.
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Bell, Check, Search, X, FileText, FileCheck2, Megaphone,
  BarChart3, Users, CalendarDays, Wallet, Award, ClipboardList, MessageCircle,
  CalendarCheck,
} from 'lucide-react';

/* ── Type → avatar look ─────────────────────────────────────────────────── */
const TYPE_STYLES = [
  { match: /(leave|excuse).*(approv|accept)|approv/i, icon: FileCheck2, bg: 'bg-emerald-100', fg: 'text-emerald-600', badge: Check, badgeBg: 'bg-emerald-500' },
  { match: /excuse|leave/i, icon: FileText, bg: 'bg-blue-100', fg: 'text-blue-600', badge: FileText, badgeBg: 'bg-blue-600' },
  { match: /meeting|ptm/i, icon: Users, bg: 'bg-violet-100', fg: 'text-violet-600', badge: CalendarDays, badgeBg: 'bg-violet-500' },
  { match: /poll/i, icon: BarChart3, bg: 'bg-amber-100', fg: 'text-amber-600', badge: BarChart3, badgeBg: 'bg-amber-500' },
  { match: /notice|announce|circular/i, icon: Megaphone, bg: 'bg-rose-100', fg: 'text-rose-600', badge: Megaphone, badgeBg: 'bg-red-500' },
  { match: /fee|payment|invoice|paid/i, icon: Wallet, bg: 'bg-emerald-100', fg: 'text-emerald-600', badge: Wallet, badgeBg: 'bg-emerald-600' },
  { match: /exam|result|grade|marks|report card/i, icon: Award, bg: 'bg-indigo-100', fg: 'text-indigo-600', badge: Award, badgeBg: 'bg-indigo-500' },
  { match: /assignment|homework|worksheet|practice/i, icon: ClipboardList, bg: 'bg-sky-100', fg: 'text-sky-600', badge: ClipboardList, badgeBg: 'bg-sky-500' },
  { match: /attendance|absent|present/i, icon: CalendarCheck, bg: 'bg-teal-100', fg: 'text-teal-600', badge: CalendarCheck, badgeBg: 'bg-teal-500' },
  { match: /chat|message|community|post|comment/i, icon: MessageCircle, bg: 'bg-blue-100', fg: 'text-blue-600', badge: MessageCircle, badgeBg: 'bg-blue-500' },
];
const DEFAULT_STYLE = { icon: FileText, bg: 'bg-blue-50', fg: 'text-blue-600', badge: null, badgeBg: '' };

const styleFor = (notification) => {
  const haystack = [notification?.type, notification?.category, notification?.typeLabel, notification?.title]
    .filter(Boolean).join(' ');
  return TYPE_STYLES.find((s) => s.match.test(haystack)) || DEFAULT_STYLE;
};

// Photo of whoever posted it (attached by GET /api/notifications/user).
const avatarImageOf = (n) =>
  n?.senderAvatar || n?.senderPhoto || n?.avatar || n?.schoolLogo || '';

/* ── Time helpers ───────────────────────────────────────────────────────── */
const isToday = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

const relativeTime = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/* ── Row ───────────────────────────────────────────────────────────────── */
const NotificationRow = ({ notification, formatTime, onOpen }) => {
  const isRead = Boolean(notification?.isRead);
  const style = styleFor(notification);
  const Icon = style.icon;
  const Badge = style.badge;
  const image = avatarImageOf(notification);
  const [imageFailed, setImageFailed] = useState(false);
  const time = relativeTime(notification?.createdAt) || notification?.timeLabel || formatTime?.(notification?.createdAt) || '';

  return (
    <Motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22 }}
      className={`group relative flex items-start gap-2.5 border-b border-slate-100 px-3.5 py-2.5 transition-colors ${
        isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/70 hover:bg-blue-50'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen?.(notification)}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        aria-label={notification?.title || 'Notification'}
      >
        {/* Avatar + badge */}
        <span className="relative shrink-0">
          {image && !imageFailed ? (
            <img
              src={image}
              alt=""
              onError={() => setImageFailed(true)}
              className="h-10 w-10 rounded-full border border-slate-100 bg-white object-cover"
            />
          ) : (
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${style.bg}`}>
              <Icon size={18} className={style.fg} />
            </span>
          )}
          {Badge && (
            <span className={`absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white ${style.badgeBg}`}>
              <Badge size={9} className="text-white" strokeWidth={2.8} />
            </span>
          )}
        </span>

        {/* Text */}
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-[13px] font-semibold leading-snug text-slate-900">
            {notification?.title || 'Notification'}
          </span>
          {notification?.message && (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-slate-500">
              {notification.message}
            </span>
          )}
          {time && <span className="mt-0.5 block text-[11px] text-slate-400">{time}</span>}
        </span>
      </button>

      {/* Unread dot */}
      {!isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
    </Motion.div>
  );
};

/* ── Panel ──────────────────────────────────────────────────────────────── */
const NotificationPopover = ({
  notifications = [],
  unreadCount = 0,
  loading = false,
  error = '',
  onMarkAllRead,
  onOpenNotification,
  formatTime,
  footerLabel = '',
  onFooterClick,
  // `embedded`: fill a parent container (e.g. a mobile bottom sheet) instead
  // of positioning itself as a dropdown.
  embedded = false,
  onClose,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((n) =>
      `${n?.title || ''} ${n?.message || ''}`.toLowerCase().includes(q));
  }, [notifications, query]);

  // Undated items (live alerts) count as today.
  const today = filtered.filter((n) => !n?.createdAt || isToday(n.createdAt));
  const earlier = filtered.filter((n) => n?.createdAt && !isToday(n.createdAt));

  const renderGroup = (label, items) => items.length > 0 && (
    <div key={label}>
      <p className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-1.5 text-xs font-bold text-slate-500">{label}</p>
      <AnimatePresence initial={false}>
        {items.map((n, index) => (
          <NotificationRow
            key={String(n?._id || n?.id || `${n?.title}-${index}`)}
            notification={n}
            formatTime={formatTime}
            onOpen={onOpenNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <Motion.section
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.985 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-label="Notifications"
      data-testid="notification-popover"
      data-dropdown
      className={embedded
        ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-left'
        : 'fixed inset-x-2 top-[calc(4.5rem+env(safe-area-inset-top))] z-[60] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_16px_48px_-12px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.06)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:z-50 sm:mt-2 sm:w-[min(380px,calc(100vw-1rem))]'}
    >
      {/* Header */}
      <header className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-2.5">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications"
                aria-label="Search notifications"
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              type="button"
              onClick={() => { setSearchOpen(false); setQuery(''); }}
              aria-label="Close search"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Notifications</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-px text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && onMarkAllRead && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 inline-flex"
              >
                <Check size={13} /> Mark all as read
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search notifications"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              <Search size={14} />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close notifications"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
      </header>

      {/* Body */}
      <div className={embedded ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[min(480px,70vh)] overflow-y-auto'}>
        {loading && <div className="px-5 py-10 text-center text-sm text-slate-400">Loading notifications…</div>}
        {!loading && error && (
          <div className="m-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Bell size={28} className="mx-auto mb-2 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">
              {query ? `No notifications match “${query.trim()}”` : 'No notifications yet'}
            </p>
          </div>
        )}
        {!loading && !error && (
          <>
            {renderGroup('Today', today)}
            {renderGroup('Earlier', earlier)}
          </>
        )}
      </div>

      {footerLabel && onFooterClick && (
        <div className="border-t border-slate-100 px-3 py-1.5">
          <button
            type="button"
            onClick={onFooterClick}
            className="w-full rounded-lg py-1.5 text-center text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            {footerLabel}
          </button>
        </div>
      )}
    </Motion.section>
  );
};

export default NotificationPopover;
