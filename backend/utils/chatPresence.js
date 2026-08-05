const ChatThread = require('../models/ChatThread');
const presenceStore = new Map();

const getPresenceSnapshot = (userId) => {
  const key = String(userId || '');
  const entry = presenceStore.get(key);
  if (!entry) {
    return { online: false, lastSeen: null };
  }
  return {
    online: entry.count > 0,
    lastSeen: entry.lastSeen || null,
  };
};

const markUserOnline = (userId) => {
  const key = String(userId || '');
  if (!key) return { changed: false, online: false, lastSeen: null };
  const existing = presenceStore.get(key) || { count: 0, lastSeen: null };
  existing.count += 1;
  presenceStore.set(key, existing);
  return {
    changed: existing.count === 1,
    online: true,
    lastSeen: existing.lastSeen || null,
  };
};

const markUserOffline = (userId) => {
  const key = String(userId || '');
  if (!key) return { changed: false, online: false, lastSeen: null };
  const existing = presenceStore.get(key);
  if (!existing) {
    return { changed: false, online: false, lastSeen: null };
  }
  existing.count = Math.max(0, (existing.count || 1) - 1);
  if (existing.count === 0) {
    existing.lastSeen = new Date();
    presenceStore.set(key, existing);
    return { changed: true, online: false, lastSeen: existing.lastSeen };
  }
  presenceStore.set(key, existing);
  return { changed: false, online: true, lastSeen: existing.lastSeen || null };
};

const notifyPresenceChange = async (io, { user, targetUserId, online, lastSeen }) => {
  if (!io || !user || !targetUserId) return;

  try {
    const threads = await ChatThread.find({
      schoolId: user.schoolId,
      ...(user.campusId ? { campusId: user.campusId } : {}),
      'participants.userId': targetUserId,
    })
      .select('_id participants')
      .lean();

    const notified = new Set();
    threads.forEach((thread) => {
      (thread.participants || []).forEach((participant) => {
        const pid = String(participant.userId || '');
        if (!pid || pid === String(targetUserId) || notified.has(pid)) return;
        notified.add(pid);
        io.to(`user:${pid}`).emit('presence-update', {
          userId: String(targetUserId),
          online,
          lastSeen,
        });
      });
    });
  } catch {
    // ignore presence fan-out issues
  }
};

module.exports = {
  getPresenceSnapshot,
  markUserOnline,
  markUserOffline,
  notifyPresenceChange,
};
