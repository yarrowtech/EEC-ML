// Persists AI Tutor conversations locally so a student can revisit past chats
// (ChatGPT-style history list). Scoped per logged-in student via a token
// fingerprint so a shared/lab device doesn't mix one student's chats into
// another's history list.
const STORAGE_PREFIX = 'eec_tutor_chat_history_v1';
const MAX_CONVERSATIONS = 30;
const MAX_TITLE_LENGTH = 60;

const buildStorageKey = () => {
  try {
    const token = localStorage.getItem('token') || '';
    const scope = token ? `${token.slice(0, 8)}:${token.slice(-8)}` : 'anon';
    return `${STORAGE_PREFIX}:${scope}`;
  } catch {
    return `${STORAGE_PREFIX}:anon`;
  }
};

export const createConversationId = () =>
  `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const deriveConversationTitle = (messages) => {
  const firstUserMessage = (messages || []).find((m) => m?.role === 'user' && m.text);
  const text = String(firstUserMessage?.text || '').trim();
  if (!text) return 'New chat';
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH)}…` : text;
};

export const listTutorConversations = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(buildStorageKey()));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && c.id && Array.isArray(c.messages) && c.messages.length > 0)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  } catch {
    return [];
  }
};

export const saveTutorConversation = ({ id, messages, subjectTitle = '', topicTitle = '' }) => {
  if (!id || !Array.isArray(messages) || messages.length === 0) return;
  try {
    // Strip transient streaming/thinking flags — only persist settled messages.
    const cleanMessages = messages
      .filter((m) => m && !m.thinking && String(m.text || '').trim())
      .map((m) => ({ id: m.id, role: m.role, text: m.text, error: m.error || undefined }));
    if (cleanMessages.length === 0) return;

    const existing = listTutorConversations().filter((c) => c.id !== id);
    existing.unshift({
      id,
      title: deriveConversationTitle(cleanMessages),
      subjectTitle,
      topicTitle,
      messages: cleanMessages,
      updatedAt: Date.now(),
    });
    localStorage.setItem(buildStorageKey(), JSON.stringify(existing.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // storage unavailable (private mode / quota) — history is best-effort
  }
};

export const deleteTutorConversation = (id) => {
  try {
    const remaining = listTutorConversations().filter((c) => c.id !== id);
    localStorage.setItem(buildStorageKey(), JSON.stringify(remaining));
  } catch {
    // ignore
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
