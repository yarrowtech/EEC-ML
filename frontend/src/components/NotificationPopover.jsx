/* eslint-disable react/prop-types */
import React, { useRef } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';

const NotificationRow = ({ notification, index, formatTime, onOpen, onDismiss }) => {
  const draggedRef = useRef(false);
  const id = String(notification?._id || notification?.id || '');
  const isRead = Boolean(notification?.isRead);

  return (
    <Motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, height: 0, marginBottom: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.2), duration: 0.28, ease: [0.2, 0.9, 0.3, 1] }}
      className="overflow-hidden"
    >
      <Motion.button
        type="button"
        drag={id && onDismiss ? 'x' : false}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={() => { draggedRef.current = true; }}
        onDragEnd={(_event, info) => {
          if (info.offset.x < -50 || info.velocity.x < -500) onDismiss?.(id);
          window.setTimeout(() => { draggedRef.current = false; }, 0);
        }}
        onClick={() => {
          if (!draggedRef.current) onOpen?.(notification);
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Delete' || event.key === 'Backspace') && id && onDismiss) {
            event.preventDefault();
            onDismiss(id);
          }
        }}
        whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.82)' }}
        whileTap={{ scale: 0.99 }}
        aria-label={`${notification?.title || 'Notification'}. Swipe left to dismiss.`}
        className="mx-2 flex w-[calc(100%-1rem)] touch-pan-y items-start gap-3 rounded-xl border border-white/70 bg-white/50 px-4 py-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.01)] backdrop-blur-sm"
      >
        <span className={`mt-2 size-1.5 shrink-0 rounded-full bg-violet-500 transition-opacity ${isRead ? 'opacity-0' : 'opacity-100'}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[0.84rem] font-semibold tracking-[-0.01em] text-[#0b0e1a]">
              {notification?.title || 'Notification'}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[0.6rem] font-medium uppercase tracking-[0.02em] text-[#8e9aaf]">
              {formatTime?.(notification?.createdAt) || ''}
            </span>
          </span>
          {notification?.message && (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-[1.4] text-[#6f7a8c]">
              {notification.message}
            </span>
          )}
        </span>
      </Motion.button>
    </Motion.div>
  );
};

const NotificationPopover = ({
  notifications = [],
  unreadCount = 0,
  loading = false,
  error = '',
  onMarkAllRead,
  onOpenNotification,
  onDismissNotification,
  formatTime,
  footerLabel = '',
  onFooterClick,
}) => (
  <Motion.section
    initial={{ opacity: 0, y: 14, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.985 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    role="dialog"
    aria-label="Notifications"
    data-testid="notification-popover"
    className="absolute right-0 top-full z-50 mt-2 w-[min(420px,calc(100vw-1rem))] overflow-hidden rounded-3xl border border-white/80 bg-white/60 pb-2 pt-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.03)] backdrop-blur-2xl saturate-[1.8]"
  >
    <header className="flex items-center justify-between border-b border-black/[0.03] px-5 pb-4">
      <div className="flex items-center gap-2">
        <Bell size={15} className="text-violet-500" />
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-[#0b0e1a]">Notifications</h2>
        {unreadCount > 0 && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{unreadCount}</span>}
      </div>
      {notifications.length > 0 && (
        <button type="button" onClick={onMarkAllRead} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#8e9aaf] transition hover:bg-black/[0.02] hover:text-[#0b0e1a]">
          <CheckCheck size={12} /> Mark all read
        </button>
      )}
    </header>

    <div className="max-h-[min(420px,65vh)] space-y-0.5 overflow-y-auto py-1">
      {loading && <div className="px-5 py-8 text-center text-sm text-[#8e9aaf]">Loading notifications…</div>}
      {!loading && error && <div className="mx-3 my-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && notifications.length === 0 && (
        <div className="px-5 py-9 text-center">
          <Bell size={25} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">No notifications yet</p>
        </div>
      )}
      <AnimatePresence initial>
        {!loading && !error && notifications.map((notification, index) => (
          <NotificationRow
            key={String(notification?._id || notification?.id || `${notification?.title}-${index}`)}
            notification={notification}
            index={index}
            formatTime={formatTime}
            onOpen={onOpenNotification}
            onDismiss={onDismissNotification}
          />
        ))}
      </AnimatePresence>
    </div>

    {footerLabel && (
      <div className="border-t border-black/[0.03] px-4 pt-2">
        <button type="button" onClick={onFooterClick} className="w-full rounded-xl py-2 text-center text-xs font-semibold text-violet-600 transition hover:bg-white/70 hover:text-violet-700">
          {footerLabel}
        </button>
      </div>
    )}
    {notifications.length > 0 && <p className="px-5 pt-1 text-center text-[10px] text-[#a4adbb] sm:hidden">Swipe left to remove</p>}
  </Motion.section>
);

export default NotificationPopover;
