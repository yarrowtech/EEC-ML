// Persists AI Tutor conversations to the student's account on the backend so
// chat history follows them across devices — localStorage is per-browser and
// can't do that, which is exactly the bug this file used to have.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MAX_TITLE_LENGTH = 60;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

export const createConversationId = () =>
  `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const deriveConversationTitle = (messages) => {
  const firstUserMessage = (messages || []).find((m) => m?.role === 'user' && m.text);
  const text = String(firstUserMessage?.text || '').trim();
  if (!text) return 'New chat';
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH)}…` : text;
};

const normalizeConversation = (raw) => ({
  id: String(raw?.clientId || raw?._id || ''),
  title: raw?.title || 'New chat',
  subjectTitle: raw?.subjectTitle || '',
  topicTitle: raw?.topicTitle || '',
  messages: Array.isArray(raw?.messages) ? raw.messages : [],
  updatedAt: raw?.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
});

export const listTutorConversations = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const res = await fetch(`${API_BASE}/api/student/auth/tutor-conversations`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (Array.isArray(data?.conversations) ? data.conversations : [])
      .map(normalizeConversation)
      .filter((c) => c.id && c.messages.length > 0);
  } catch {
    return [];
  }
};

export const saveTutorConversation = async ({ id, messages, subjectTitle = '', topicTitle = '' }) => {
  if (!id || !Array.isArray(messages) || messages.length === 0) return null;
  try {
    // Strip transient streaming/thinking flags — only persist settled messages.
    const cleanMessages = messages
      .filter((m) => m && !m.thinking && String(m.text || '').trim())
      .map((m) => ({ id: m.id, role: m.role, text: m.text, error: m.error || undefined }));
    if (cleanMessages.length === 0) return null;

    const token = localStorage.getItem('token');
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/student/auth/tutor-conversations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        title: deriveConversationTitle(cleanMessages),
        subjectTitle,
        topicTitle,
        messages: cleanMessages,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.conversation ? normalizeConversation(data.conversation) : null;
  } catch {
    // network hiccup — history save is best-effort, must not disrupt the chat
    return null;
  }
};

export const deleteTutorConversation = async (id) => {
  try {
    const token = localStorage.getItem('token');
    if (!token || !id) return;
    await fetch(`${API_BASE}/api/student/auth/tutor-conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    // ignore — best-effort
  }
};

export const formatConversationAge = (at) => {
  const ms = Date.now() - Number(at || 0);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
