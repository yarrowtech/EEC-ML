/**
 * Socket.IO server setup and event handlers.
 * Extracted from index.js to keep server bootstrap lean.
 */

const { Server: SocketServer } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const { runWithTenant } = require('../utils/tenantContext');
const { logger } = require('../utils/logger');
const {
  getPresenceSnapshot,
  markUserOnline,
  markUserOffline,
  notifyPresenceChange,
} = require('../utils/chatPresence');
const socketRegistry = require('../utils/socketRegistry');

const resolveOrganizationForSocket = async (decoded, hostname, tenantResolver) => {
  const { getRootDomain, isMainHostname, resolveSlug } = tenantResolver;
  const Organization = require('../models/Organization');
  const rootDomain = getRootDomain();

  if (!isMainHostname(hostname, rootDomain)) {
    const slug = resolveSlug(hostname, rootDomain);
    const org = await Organization.findOne(
      slug ? { slug, status: 'active' } : { customDomains: hostname, status: 'active' }
    ).lean();
    if (!org) throw new Error('Organization not found');
    if (!decoded.organizationId || String(decoded.organizationId) !== String(org._id)) {
      throw new Error('Organization mismatch');
    }
    return org;
  }

  if (decoded.organizationId || decoded.schoolId) {
    let org = decoded.organizationId
      ? await Organization.findOne({ _id: decoded.organizationId, status: 'active' }).lean()
      : null;
    if (!org && decoded.schoolId) {
      org = await Organization.findOne({ schoolId: decoded.schoolId, status: 'active' }).lean();
    }
    if (!org) throw new Error('Organization not found');
    const orgMatches = decoded.organizationId && String(decoded.organizationId) === String(org._id);
    const schoolMatches = decoded.schoolId && String(decoded.schoolId) === String(org.schoolId);
    if (!orgMatches && !schoolMatches) throw new Error('Organization mismatch');
    return org;
  }

  return null;
};

const registerSocketEvents = (io, socket, ensureChatAccess) => {
  const { normalizeHostname } = require('../middleware/tenantResolver');
  const ChatThread = require('../models/ChatThread');
  const ChatMessage = require('../models/ChatMessage');

  const user = socket.user;
  const userId = user.id?.toString();

  const markThreadMessagesSeen = async ({ threadId, schoolId, campusId, currentUserId }) => {
    if (!threadId || !schoolId || !currentUserId) return;
    await ChatMessage.updateMany(
      {
        threadId,
        schoolId,
        ...(campusId ? { campusId } : {}),
        senderId: { $ne: currentUserId },
        'seenBy.userId': { $ne: currentUserId },
      },
      { $push: { seenBy: { userId: currentUserId, seenAt: new Date() } } }
    );
  };

  const emitTypingState = async ({ threadId, isTyping }) => {
    if (!threadId) return;
    const thread = await ChatThread.findOne({
      _id: threadId,
      schoolId: user.schoolId,
      ...(user.campusId ? { campusId: user.campusId } : {}),
      'participants.userId': userId,
    })
      .select('participants.userId participants.name')
      .lean();
    if (!thread) return;
    if (!(await ensureChatAccess({ user, schoolId: user.schoolId, campusId: user.campusId }, thread))) return;

    const myParticipant = (thread.participants || []).find(
      (p) => String(p?.userId || '') === userId
    );
    const fallbackName =
      socket.user?.name || socket.user?.fullName || socket.user?.username ||
      (socket.user?.email ? String(socket.user.email).split('@')[0] : '') ||
      socket.user?.userType || 'User';
    const userName = String(myParticipant?.name || fallbackName || 'User').trim();
    const payload = { threadId, userId, userName, isTyping: Boolean(isTyping) };
    for (const participant of thread.participants || []) {
      const participantId = String(participant?.userId || '');
      if (!participantId || participantId === userId) continue;
      io.to(`user:${participantId}`).emit('typing', payload);
    }
  };

  socket.join(`user:${userId}`);
  const presenceOnline = markUserOnline(userId);
  if (presenceOnline.changed) {
    notifyPresenceChange(io, { user, targetUserId: userId, online: true, lastSeen: presenceOnline.lastSeen });
  }

  socket.on('join-thread', async ({ threadId }) => {
    try {
      const thread = await ChatThread.findOne({
        _id: threadId,
        schoolId: user.schoolId,
        ...(user.campusId ? { campusId: user.campusId } : {}),
        'participants.userId': userId,
      }).lean();
      if (!thread) return;
      if (!(await ensureChatAccess({ user, schoolId: user.schoolId, campusId: user.campusId }, thread))) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      socket.join(`thread:${threadId}`);
      await ChatThread.updateOne(
        { _id: threadId, 'unreadCounts.userId': userId },
        { $set: { 'unreadCounts.$.count': 0 } }
      );
      const presenceMap = {};
      (thread.participants || []).forEach((p) => {
        const pid = String(p.userId || '');
        if (!pid) return;
        presenceMap[pid] = getPresenceSnapshot(pid);
      });
      socket.emit('presence-sync', { threadId, presence: presenceMap });
      await markThreadMessagesSeen({ threadId, schoolId: user.schoolId, campusId: user.campusId, currentUserId: userId });
      socket.to(`thread:${threadId}`).emit('message-seen', { threadId, userId });
    } catch { /* ignore */ }
  });

  socket.on('leave-thread', ({ threadId }) => {
    socket.leave(`thread:${threadId}`);
  });

  socket.on('send-message', async ({ threadId, text, encrypted }) => {
    try {
      const plainText = String(text || '').trim();
      const hasEncrypted =
        encrypted && typeof encrypted === 'object' &&
        String(encrypted.ciphertext || '').trim() &&
        String(encrypted.iv || '').trim() &&
        Array.isArray(encrypted.keys) && encrypted.keys.length > 0;
      if (!plainText && !hasEncrypted) return;

      const thread = await ChatThread.findOne({
        _id: threadId,
        schoolId: user.schoolId,
        ...(user.campusId ? { campusId: user.campusId } : {}),
        'participants.userId': userId,
      }).lean();
      if (!thread) return;
      if (!(await ensureChatAccess({ user, schoolId: user.schoolId, campusId: user.campusId }, thread))) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const myParticipant = thread.participants?.find((p) => p.userId?.toString() === userId);
      const senderName = myParticipant?.name || user.userType || 'User';

      const msg = await ChatMessage.create({
        threadId, senderId: userId, senderType: user.userType, senderName,
        text: plainText,
        encrypted: hasEncrypted
          ? {
              algorithm: String(encrypted.algorithm || 'AES-GCM'),
              iv: String(encrypted.iv || ''),
              ciphertext: String(encrypted.ciphertext || ''),
              keys: encrypted.keys
                .filter((k) => k && k.userId && k.wrappedKey)
                .map((k) => ({ userId: k.userId, wrappedKey: String(k.wrappedKey) })),
              version: String(encrypted.version || 'v1'),
            }
          : undefined,
        schoolId: user.schoolId,
        campusId: thread.campusId || user.campusId,
        seenBy: [{ userId, seenAt: new Date() }],
      });

      const bulkOps = thread.participants
        .filter((p) => p.userId?.toString() !== userId)
        .map((p) => ({
          updateOne: {
            filter: { _id: threadId, 'unreadCounts.userId': p.userId },
            update: { $inc: { 'unreadCounts.$.count': 1 } },
          },
        }));

      await Promise.all([
        ChatThread.updateOne(
          { _id: threadId },
          { $set: { lastMessage: msg.text || '[Encrypted message]', lastMessageAt: msg.createdAt, lastSenderId: userId } }
        ),
        bulkOps.length ? ChatThread.bulkWrite(bulkOps) : Promise.resolve(),
      ]);

      const payload = msg.toObject();
      socket.emit('message-sent', payload);
      io.to(`thread:${threadId}`).emit('new-message', payload);
      for (const p of thread.participants) {
        if (p.userId?.toString() === userId) continue;
        io.to(`user:${p.userId}`).emit('thread-updated', {
          threadId, lastMessage: msg.text || '[Encrypted message]',
          lastMessageAt: msg.createdAt, message: payload,
        });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('typing-start', ({ threadId }) => {
    emitTypingState({ threadId, isTyping: true }).catch(() => {});
  });

  socket.on('typing-stop', ({ threadId }) => {
    emitTypingState({ threadId, isTyping: false }).catch(() => {});
  });

  socket.on('mark-seen', async ({ threadId }) => {
    try {
      const thread = await ChatThread.findOne({
        _id: threadId,
        schoolId: user.schoolId,
        ...(user.campusId ? { campusId: user.campusId } : {}),
        'participants.userId': userId,
      }).lean();
      if (!thread || !(await ensureChatAccess({ user, schoolId: user.schoolId, campusId: user.campusId }, thread))) return;
      await ChatThread.updateOne(
        { _id: threadId, 'unreadCounts.userId': userId },
        { $set: { 'unreadCounts.$.count': 0 } }
      );
      await markThreadMessagesSeen({ threadId, schoolId: user.schoolId, campusId: user.campusId, currentUserId: userId });
      socket.to(`thread:${threadId}`).emit('message-seen', { threadId, userId });
    } catch { /* ignore */ }
  });

  // Live exam monitoring
  socket.on('exam-start', ({ examId }) => {
    if (!examId || user.role !== 'student') return;
    socket.join(`exam:${examId}`);
    io.to(`exam-monitor:${examId}`).emit('exam-taker-update', {
      examId, studentId: userId,
      studentName: user.name || user.username || 'Student',
      event: 'started', at: new Date().toISOString(),
    });
  });

  socket.on('exam-submit', ({ examId }) => {
    if (!examId || user.role !== 'student') return;
    socket.leave(`exam:${examId}`);
    io.to(`exam-monitor:${examId}`).emit('exam-taker-update', {
      examId, studentId: userId,
      studentName: user.name || user.username || 'Student',
      event: 'submitted', at: new Date().toISOString(),
    });
  });

  socket.on('join-exam-monitor', ({ examId }) => {
    if (!examId || !['teacher', 'admin', 'principal'].includes(user.role)) return;
    socket.join(`exam-monitor:${examId}`);
  });

  socket.on('leave-exam-monitor', ({ examId }) => {
    if (!examId) return;
    socket.leave(`exam-monitor:${examId}`);
  });

  socket.on('disconnect', () => {
    const presenceOffline = markUserOffline(userId);
    if (presenceOffline.changed) {
      notifyPresenceChange(io, { user, targetUserId: userId, online: false, lastSeen: presenceOffline.lastSeen });
    }
  });
};

/**
 * Creates and configures the Socket.IO server.
 *
 * @param {import('http').Server} httpServer
 * @param {Function} corsOrigin  - the same CORS origin callback used by Express
 * @param {object}  tenantResolver - the tenantResolver middleware module
 * @param {object}  redisClient   - the connected Redis client (may be null)
 * @returns {import('socket.io').Server}
 */
const configureSocketServer = (httpServer, corsOrigin, tenantResolver, redisClient) => {
  const io = new SocketServer(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
    connectTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  if (redisClient && process.env.REDIS_URL) {
    (async () => {
      try {
        const pubClient = redisClient.duplicate();
        const subClient = redisClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter enabled');
      } catch (err) {
        logger.warn({ err }, 'Socket.IO Redis adapter unavailable; falling back to in-process sockets');
      }
    })();
  }

  socketRegistry.set(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.campusId) return next(new Error('campusId required'));
      const rawHost = socket.handshake.headers.host || '';
      const { normalizeHostname } = tenantResolver;
      const hostname = normalizeHostname(rawHost.replace(/:\d+$/, ''));
      const organization = await resolveOrganizationForSocket(decoded, hostname, tenantResolver);
      socket.user = decoded;
      socket.organization = organization;
      return runWithTenant(organization, next);
    } catch (err) {
      return next(new Error(err.message || 'Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.use((_event, next) => runWithTenant(socket.organization, next));
    const chatRoutes = require('../routes/chatRoutes');
    const ensureChatAccess = chatRoutes.ensureChatAccessToThread || (async () => true);
    registerSocketEvents(io, socket, ensureChatAccess);
  });

  return io;
};

module.exports = { configureSocketServer };
