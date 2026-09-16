import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { decryptChatMessage } from '../utils/chatE2EE';
import { subscribeSocketEvent } from './useCommunityWallUnread';

// Portal-wide alerts for incoming chat messages (teacher and student portals; the parent
// portal has its own in parents/useChatMessageNotifier). The server emits `thread-updated`
// to each recipient for every new message: we show a toast instantly, a system notification
// when the tab is hidden, and skip the conversation that's already open on screen.
// With the site closed, the server's web push covers it instead.
export const CHAT_MESSAGE_EVENT = 'chat:new-message';

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
  } catch { /* autoplay blocked — a silent toast is fine */ }
};

const MessageToast = ({ t, name, text, onOpen }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => { toast.dismiss(t.id); onOpen(); }}
    onKeyDown={(e) => { if (e.key === 'Enter') { toast.dismiss(t.id); onOpen(); } }}
    className={`${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'} flex w-[340px] max-w-[calc(100vw-32px)] cursor-pointer items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-2xl transition`}
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white">
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

const usePortalChatNotifier = ({ navigate, chatPath, isChatPath, meStorageKey }) => {
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!localStorage.getItem('token')) return undefined;
    const onThreadUpdated = async ({ threadId, lastMessage, message } = {}) => {
      const myId = localStorage.getItem(meStorageKey) || '';
      if (!message || message.isEdited || (myId && String(message.senderId) === String(myId))) return;
      window.dispatchEvent(new CustomEvent(CHAT_MESSAGE_EVENT, { detail: { threadId } }));
      const viewingThisChat = isChatPath(window.location.pathname)
        && window.__chatActiveThreadId === String(threadId) && !document.hidden;
      if (viewingThisChat) return;

      let text = lastMessage;
      try {
        text = await decryptChatMessage({ message, myId }) || lastMessage;
      } catch { /* keep the placeholder */ }
      const name = message.senderName || 'New message';
      const preview = text || 'New message';
      const open = () => navigateRef.current?.(`${chatPath}?thread=${threadId}`);

      playPing();
      toast.custom((t) => <MessageToast t={t} name={name} text={preview} onOpen={open} />, {
        id: `chat-${threadId}`, // collapse bursts from one chat into a single toast
        duration: 5000,
        position: 'top-right',
      });

      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(name, { body: preview, tag: `chat-${threadId}`, renotify: true, icon: '/favicon.ico' });
          n.onclick = () => { window.focus(); open(); n.close(); };
        } catch { /* some browsers only allow notifications through a service worker */ }
      }
    };
    return subscribeSocketEvent('thread-updated', onThreadUpdated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatPath, meStorageKey]);
};

export default usePortalChatNotifier;
