// Remembers the last place a student was learning (hub tab, subject topic,
// practice paper, tutor chat) so the Learning hub can offer a Continue card.
const STORAGE_KEY = 'eec_last_learning_activity_v1';

export const saveLearningActivity = ({ path, label, detail = '' }) => {
  if (!path || !label) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, label, detail, at: Date.now() }));
  } catch {
    // storage unavailable (private mode) — continuity is best-effort
  }
};

export const getLearningActivity = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || typeof parsed.path !== 'string' || !parsed.label) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearLearningActivity = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const formatActivityAge = (at) => {
  const ms = Date.now() - Number(at || 0);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};
