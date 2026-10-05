import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { decryptChatMessage } from '../utils/chatE2EE';
import { AUTH_LOGOUT_EVENT } from '../utils/authSession';
import { parentApiJson } from './parentApi';

// Portal-wide WhatsApp-style alerts for incoming chat messages. Listens on the
// user's socket room for `thread-updated` (emitted for every new message) and
// shows an in-app toast instantly, plus a system notification when the tab is
// hidden. Skips the conversation the parent currently has open.

const resolveApiBaseUrl = () => {
  const configured = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '');
  return 'http://localhost:5000';
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

const playPing = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch { /* autoplay blocked — silent toast is fine */ }
};

const renderMessageToast = (t, name, text, onOpen) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => { toast.dismiss(t.id); onOpen(); }}
    onKeyDown={(e) => { if (e.key === 'Enter') { toast.dismiss(t.id); onOpen(); } }}
    className={`${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'} flex w-[340px] max-w-[calc(100vw-32px)] cursor-pointer items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xl transition`}
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white">
      {initials(name)}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-gray-900">{name}</span>
        <span className="shrink-0 text-[10px] text-emerald-600">now</span>
      </div>
      <p className="truncate text-xs text-gray-600">{text}</p>
    </div>
    <button
      type="button"
      aria-label="Dismiss"
      onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
      className="shrink-0 rounded-full px-1.5 text-gray-400 hover:bg-gray-100"
    >
      ×
    </button>
  </div>
);

export const useChatMessageNotifier = ({ navigate }) => {
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [unreadTotal, setUnreadTotal] = useState(0);

  // ParentChat owns the exact per-thread counts while it is mounted.
  useEffect(() => {
    const onUnread = (e) => setUnreadTotal(Math.max(0, Number(e?.detail?.total) || 0));
    window.addEventListener('parent-chat-unread', onUnread);
    return () => window.removeEventListener('parent-chat-unread', onUnread);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || localStorage.getItem('userType') !== 'Parent') return undefined;

    let myId = localStorage.getItem('parent_chat_me_id_v1') || '';
    parentApiJson('/api/chat/me').then((me) => { if (me?.id) myId = String(me.id); }).catch(() => {});
    parentApiJson('/api/chat/threads')
      .then((threads) => {
        if (!Array.isArray(threads)) return;
        setUnreadTotal(threads.reduce((sum, t) => sum + (Number(t?.unreadCount) || 0), 0));
      })
      .catch(() => {});

    const socket = io(resolveApiBaseUrl(), { auth: { token }, transports: ['websocket', 'polling'] });

    socket.on('thread-updated', async ({ threadId, lastMessage, message }) => {
      if (!message || message.isEdited || String(message.senderId) === String(myId)) return;
      const onChatPage = window.location.pathname.startsWith('/parents/chat');
      // On the chat screen ParentChat re-broadcasts the exact total itself.
      if (!onChatPage) setUnreadTotal((n) => n + 1);
      if (onChatPage && window.__parentActiveChatThreadId === String(threadId) && !document.hidden) return;

      let text = lastMessage;
      try {
        text = await decryptChatMessage({ message, myId }) || lastMessage;
      } catch { /* keep placeholder */ }
      const name = message.senderName || 'New message';
      const preview = text || 'New message';
      const open = () => navigateRef.current?.('/parents/chat', { state: { threadId } });

      playPing();
      toast.custom((t) => renderMessageToast(t, name, preview, open), {
        id: `chat-${threadId}`, // collapse bursts from the same chat into one toast
        duration: 5000,
        position: 'top-right',
      });

      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(name, { body: preview, tag: `chat-${threadId}`, renotify: true, icon: '/favicon.ico' });
          n.onclick = () => { window.focus(); open(); n.close(); };
        } catch { /* some browsers require a service worker */ }
      }
    });

    const disconnect = () => socket.disconnect();
    window.addEventListener(AUTH_LOGOUT_EVENT, disconnect);
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, disconnect);
      socket.disconnect();
    };
  }, []);

  return unreadTotal;
};
