// Legacy bootstrap block retained for reference.
// (Use the active block below.)

const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
require('./utils/registerTenantPlugin');
const dotenv = require('dotenv');
const cors = require('cors');
const { Server: SocketServer } = require('socket.io');
const jwt = require('jsonwebtoken');
let swaggerUi = null;
try {
  swaggerUi = require('swagger-ui-express');
} catch (_err) {
  swaggerUi = null;
}
const requestLogger = require('./middleware/requestLogger');
const tokenReplayTelemetry = require('./middleware/tokenReplayTelemetry');
const tenantResolver = require('./middleware/tenantResolver');
const { getRootDomain, isMainHostname, normalizeHostname, resolveSlug } = tenantResolver;
const { runWithTenant } = require('./utils/tenantContext');
const adminActionLogger = require('./middleware/adminActionLogger');
const rateLimit = require('./middleware/rateLimit');
const { logSecurityEvent } = require('./utils/securityEventLogger');
const { getClientIp } = require('./utils/request');
let swaggerDocument;

dotenv.config({ path: path.join(__dirname, '.env') });
const { bindConsoleToLogger, logger } = require('./utils/logger');
bindConsoleToLogger();
logger.info('Pino logger initialized');
// console.log(`[auth] JWT_EXPIRES_IN=${process.env.JWT_EXPIRES_IN || '24h (default)'}`);

const adminAuthRoutes = require('./routes/adminRoutes');
const adminFeedbackRoutes = require('./routes/adminFeedbackRoutes');
const teacherAuthRoutes = require('./routes/teacherRoute');
const teacherDashboardRoutes = require('./routes/teacherDashboardRoutes');
const staffAuthRoutes = require('./routes/staffRoutes');
const studentAuthRoutes = require('./routes/studentRoute');
const parentAuthRoutes = require('./routes/parentRoute');
const principalAuthRoutes = require('./routes/principalRoutes');
const unifiedAuthRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const adminUserManagementRoutes = require('./routes/adminUserManagement');
const subjectRouter = require("./routes/subjectRoute");
const examRouter = require("./routes/examRoute");
const feedbackRouter = require("./routes/feedbackRoute");
const assignmentRouter = require("./routes/assignmentRoute");
const behaviourRouter = require("./routes/behaviourRoute");
const progressRouter = require("./routes/progressRoute");
const aiLearningRouter = require("./routes/aiLearningRoute");
const studentAILearningRouter = require("./routes/studentAILearningRoute");
const learningPathRoutes = require("./routes/learningPathRoutes");
const alcoveRouter = require("./routes/alcoveRoute");
const meetingRouter = require("./routes/meetingRoute");
const studentObservationRouter = require("./routes/studentObservationRoutes");

const uploadRoutes = require("./routes/uploadRoutes");
const schoolRoutes = require("./routes/schoolRoutes");
const schoolRegistrationRoutes = require("./routes/schoolRegistrationRoutes");
const academicRoutes = require("./routes/academicRoutes");
const feeRoutes = require("./routes/feeRoutes");
const reportRoutes = require("./routes/reportRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const notificationRoutes = require("./routes/notificationRoutes");   
const auditLogRoutes = require("./routes/auditLogRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const supportRoutes = require('./routes/supportRoutes');
const issueRoutes = require('./routes/issueRoutes');
const teacherAllocationRoutes = require('./routes/teacherAllocationRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const excuseLetterRoutes = require('./routes/excuseLetterRoutes');
const nifStudentRoutes = require('./routes/nifStudentRoutes');
const lessonPlanRoutes = require('./routes/lessonPlanRoutes');
const aiTutorRoutes = require('./routes/aiTutorRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const achievementRoutes = require('./routes/achievementRoutes');
const teachingMaterialRoutes = require('./routes/teachingMaterialRoutes');
const studentMaterialRoutes = require('./routes/studentMaterialRoutes');
const practicePaperRoutes = require('./routes/practicePaperRoutes');
const practiceSectionRoutes = require('./routes/practiceSectionRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const paymentSettingsRoutes = require('./routes/paymentSettingsRoutes');
const paymentWebhookController = require('./controllers/paymentWebhookController');
const ChatThread = require('./models/ChatThread');
const ChatMessage = require('./models/ChatMessage');
const StudentUser = require('./models/StudentUser');
const TeacherUser = require('./models/TeacherUser');
const Principal = require('./models/Principal');
const Admin = require('./models/Admin');
const Organization = require('./models/Organization');
const { isStrongPassword } = require('./utils/passwordPolicy');
const principalDashboardRoutes = require('./routes/principalDashboardRoutes');
const { getPresenceSnapshot, markUserOnline, markUserOffline } = require('./utils/chatPresence');
const { syncAllocationGroupThreads } = require('./utils/chatGroupProvisioning');
const { startHolidayReminderScheduler } = require('./utils/holidayNotificationScheduler');
const { startTeacherFeedbackReminderScheduler } = require('./utils/teacherFeedbackReminderScheduler');

const fixChatThreadIndexes = async () => {
  try {
    const indexes = await ChatThread.collection.indexes();
    const hasLegacyGroupKeyIndex = indexes.some((idx) =>
      idx?.name === 'unique_group_thread_key' && idx?.sparse
    );

    if (hasLegacyGroupKeyIndex) {
      await ChatThread.collection.dropIndex('unique_group_thread_key');
      console.log('[chat] dropped legacy unique_group_thread_key sparse index');
    }

    await ChatThread.collection.createIndex(
      { schoolId: 1, campusId: 1, groupKey: 1 },
      {
        unique: true,
        name: 'unique_group_thread_key',
        partialFilterExpression: {
          threadType: 'group',
          groupKey: { $exists: true, $type: 'string', $ne: '' },
        },
      }
    );
  } catch (err) {
    console.error('[chat] failed to ensure chat thread indexes:', err.message);
  }
};


const seedSuperAdmin = async () => {
  const username = process.env.SUPER_ADMIN_USERNAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';
  if (!username || !password) {
    return;
  }
  if (!isStrongPassword(password)) {
    console.warn('Super admin seed password does not meet policy requirements.');
    return;
  }
  const normalizedUsername = String(username).trim();
  if (!normalizedUsername) {
    return;
  }
  try {
    const existing = await Admin.findOne({ username: normalizedUsername });
    if (existing) {
      existing.password = password;
      existing.name = name;
      existing.role = 'super_admin';
      existing.schoolId = null;
      await existing.save();
      console.log(`Updated super admin user: ${normalizedUsername}`);
      return;
    }
    const admin = new Admin({
      username: normalizedUsername,
      password,
      name,
      role: 'super_admin',
      schoolId: null,
    });
    await admin.save();
    console.log(`Seeded super admin user: ${normalizedUsername}`);
  } catch (err) {
    console.error('Failed to seed super admin user:', err.message);
  }
};

const ensureAdminRoles = async () => {
  try {
    await Admin.updateMany({ role: { $exists: false }, schoolId: { $ne: null } }, { $set: { role: 'admin' } });
    await Admin.updateMany({ role: { $exists: false }, schoolId: null }, { $set: { role: 'super_admin' } });
  } catch (err) {
    console.error('Failed to backfill admin roles:', err.message);
  }
};

const seedPrincipal = async () => {
  const principalEmail = process.env.PRINCIPAL_EMAIL;
  const principalPassword = process.env.PRINCIPAL_PASSWORD;
  const principalSchoolId = process.env.PRINCIPAL_SCHOOL_ID;
  if (!principalEmail || !principalPassword) {
    return;
  }
  const resolvedSchoolId =
    principalSchoolId && mongoose.isValidObjectId(principalSchoolId)
      ? principalSchoolId
      : null;
  if (!isStrongPassword(principalPassword)) {
    console.warn('Principal seed password does not meet policy requirements.');
    return;
  }
  const normalizedEmail = String(principalEmail).trim().toLowerCase();
  try {
    const existing = await Principal.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
    });
    if (existing) {
      existing.email = normalizedEmail;
      existing.username = normalizedEmail;
      existing.password = principalPassword;
      if (resolvedSchoolId) {
        existing.schoolId = resolvedSchoolId;
      }
      await existing.save();
      console.log(`Updated principal user: ${normalizedEmail}`);
      return;
    }

    const fallback = await Principal.findOne({});
    if (fallback) {
      fallback.email = normalizedEmail;
      fallback.username = normalizedEmail;
      fallback.password = principalPassword;
      if (resolvedSchoolId) {
        fallback.schoolId = resolvedSchoolId;
      }
      await fallback.save();
      console.log(`Reassigned principal user to: ${normalizedEmail}`);
      return;
    }

    const principal = new Principal({
      username: normalizedEmail,
      email: normalizedEmail,
      password: principalPassword,
      name: 'Principal',
      schoolId: resolvedSchoolId,
    });
    await principal.save();
    console.log(`Seeded principal user: ${normalizedEmail}`);
  } catch (err) {
    console.error('Failed to seed principal user:', err.message);
  }
};

const app = express();
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY && TRUST_PROXY.trim().length > 0) {
  if (TRUST_PROXY === 'true') app.set('trust proxy', true);
  else if (TRUST_PROXY === 'false') app.set('trust proxy', false);
  else app.set('trust proxy', TRUST_PROXY);
}

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : null;
const allowLanOrigins = process.env.NODE_ENV !== 'production'
  && process.env.CORS_ALLOW_LAN === 'true';

const isPrivateLanOrigin = (origin) => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
      || /^f[cd][0-9a-f]{2}:/i.test(hostname)
      || /^fe80:/i.test(hostname);
  } catch {
    return false;
  }
};

const isOriginAllowed = (origin) => (
  !origin
  || !allowedOrigins
  || allowedOrigins.length === 0
  || allowedOrigins.includes(origin)
  || (allowLanOrigins && isPrivateLanOrigin(origin))
);

const corsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
};

app.use(
  cors({
    origin: corsOrigin,
  })
);
app.use(requestLogger);
app.use(tokenReplayTelemetry);

const decodeBearerPayload = (req) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) return {};
  const token = String(authHeader).slice('Bearer '.length).trim();
  if (!token) return {};
  const decoded = jwt.decode(token);
  return decoded && typeof decoded === 'object' ? decoded : {};
};

const rateLimitIdentity = (req, bucket) => {
  const payload = decodeBearerPayload(req);
  const userId = payload.id || payload.sub || payload.userId || payload._id;
  if (userId) {
    const userType = payload.userType || payload.type || payload.role || 'user';
    const schoolId = payload.schoolId || 'global';
    const campusId = payload.campusId || 'main';
    return `${bucket}:user:${schoolId}:${campusId}:${userType}:${userId}`;
  }
  return `${bucket}:ip:${getClientIp(req) || req.ip || 'unknown'}`;
};

const createApiLimiter = (bucket, { windowMs, max }) => rateLimit({
  windowMs,
  max,
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: (req) => rateLimitIdentity(req, bucket),
});

const generalApiLimiter = createApiLimiter('api:general', {
  windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_GENERAL_MAX || 1200),
});
const authApiLimiter = createApiLimiter('api:auth', {
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 80),
});
const aiApiLimiter = createApiLimiter('api:ai', {
  windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS || 10 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_AI_MAX || 40),
});
const uploadApiLimiter = createApiLimiter('api:upload', {
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 60),
});
const writeHeavyApiLimiter = createApiLimiter('api:write-heavy', {
  windowMs: Number(process.env.RATE_LIMIT_WRITE_HEAVY_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_WRITE_HEAVY_MAX || 180),
});

const requireOrganizationDomain = (req, res, next) => {
  if (req.organizationId) return next();
  return res.status(404).json({ error: 'Organization domain required' });
};

app.use('/api', generalApiLimiter);
// Razorpay signs the exact request bytes; this must stay before express.json().
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentWebhookController);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(tenantResolver);

try {
  swaggerDocument = require('./swagger-output.json');
} catch (err) {
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'Electronic Educare API',
      version: '1.0.0',
      description: 'Swagger output not generated yet. Run `npm run swagger:gen`.',
    },
    paths: {},
  };
}

if (swaggerUi) {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        docExpansion: 'list',
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
      },
      customSiteTitle: 'Electronic Educare API Docs',
      customCss: '.swagger-ui .topbar { background-color: #0f172a; }',
    })
  );
  app.get('/api/docs.json', (_req, res) => {
    res.json(swaggerDocument);
  });
}

// Mongo connect
mongoose
  .connect(process.env.MONGODB_URL)
  .then(async () => {
    console.log('MongoDB Connected');
    await fixChatThreadIndexes();
    await ensureAdminRoles();
    await seedSuperAdmin();
    await seedPrincipal();
    startHolidayReminderScheduler();
    startTeacherFeedbackReminderScheduler();
    try {
      const stats = await syncAllocationGroupThreads();
      console.log(`[chat] allocation group sync complete: ${stats.createdOrUpdated}/${stats.scanned}`);
    } catch (err) {
      console.error('[chat] allocation group sync failed:', err.message);
    }
  })
  .catch((err) => console.log(err));

// Health
app.get("/", (req, res) => {
  // #swagger.tags = ['System']
  res.send("Welcome to the Electronic Educare API ..");
});
app.get("/health", (req, res) => {
  // #swagger.tags = ['System']
  res.json({ ok: true });
});

// Auth & core routes (unchanged)
app.use('/api/admin/users', writeHeavyApiLimiter, adminActionLogger, adminUserManagementRoutes);
app.use('/api/promotion', writeHeavyApiLimiter, promotionRoutes);
app.use('/api/admin/auth', authApiLimiter, adminActionLogger, adminAuthRoutes);
app.use('/api/admin/feedback', adminActionLogger, adminFeedbackRoutes);
app.use('/api/teacher/auth', requireOrganizationDomain, authApiLimiter, teacherAuthRoutes);
app.use('/api/teacher/dashboard', requireOrganizationDomain, teacherDashboardRoutes);
app.use('/api/staff/auth', requireOrganizationDomain, authApiLimiter, staffAuthRoutes);
app.use('/api/student/auth', requireOrganizationDomain, authApiLimiter, studentAuthRoutes);
app.use('/api/parent/auth', requireOrganizationDomain, authApiLimiter, parentAuthRoutes);
app.use('/api/principal/auth', requireOrganizationDomain, authApiLimiter, principalAuthRoutes);
app.use('/api/auth', authApiLimiter, unifiedAuthRoutes);
app.use('/api/principal', requireOrganizationDomain, principalDashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/student/materials', studentMaterialRoutes);
app.use('/api/student', require('./routes/student'));
app.use('/api/subject', subjectRouter);
app.use('/api/exam', examRouter);
app.use('/api/assignment', assignmentRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/behaviour', behaviourRouter);
app.use('/api/progress', progressRouter);
app.use('/api/ai-learning', aiApiLimiter, aiLearningRouter);
app.use('/api/student-ai-learning', aiApiLimiter, studentAILearningRouter);
app.use('/api/learning-paths', writeHeavyApiLimiter, learningPathRoutes);
app.use('/api/alcove', alcoveRouter);
app.use('/api/meeting', meetingRouter);
app.use('/api/observations', studentObservationRouter);



app.use('/api/schools', writeHeavyApiLimiter, adminActionLogger, schoolRoutes);
app.use('/api/school-registration', authApiLimiter, schoolRegistrationRoutes);
app.use('/api/academic', writeHeavyApiLimiter, academicRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/settings/payment', writeHeavyApiLimiter, adminActionLogger, paymentSettingsRoutes);
app.use('/api/reports', writeHeavyApiLimiter, reportRoutes);
app.use('/api/timetable', writeHeavyApiLimiter, timetableRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/super-admin', writeHeavyApiLimiter, adminActionLogger, superAdminRoutes);
app.use('/api/support', writeHeavyApiLimiter, adminActionLogger, supportRoutes);
app.use('/api/issues', writeHeavyApiLimiter, adminActionLogger, issueRoutes);
app.use('/api/teacher-allocations', writeHeavyApiLimiter, teacherAllocationRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/excuse-letters', excuseLetterRoutes);
app.use('/api/nif', authApiLimiter, nifStudentRoutes);
app.use('/api/lesson-plans', writeHeavyApiLimiter, lessonPlanRoutes);
app.use('/api/ai-tutor', aiApiLimiter, aiTutorRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/teaching-materials', uploadApiLimiter, teachingMaterialRoutes);
app.use('/api/practice-papers', writeHeavyApiLimiter, practicePaperRoutes);
app.use('/api/practice-sections', writeHeavyApiLimiter, practiceSectionRoutes);

app.use("/api/uploads", uploadApiLimiter, uploadRoutes);
app.use('/api', organizationRoutes);


app.use((err, req, res, _next) => {
  const isMalformedJson = err instanceof SyntaxError && err?.status === 400 && 'body' in err;
  if (isMalformedJson) {
    logSecurityEvent(req, {
      action: 'security.malformed_json_payload',
      outcome: 'blocked',
      severity: 'medium',
      statusCode: 400,
      reason: err.message || 'Malformed JSON payload',
      parserType: 'express.json',
    });
    return res.status(400).json({ message: 'Malformed JSON payload' });
  }

  logger.error({
    event: 'http_error',
    requestId: req?.requestId || undefined,
    traceId: req?.traceId || undefined,
    method: req?.method,
    path: req?.originalUrl,
    statusCode: err?.statusCode || err?.status || 500,
    err,
  }, 'Unhandled API error');
  res.status(err.statusCode || err.status || 500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '::';
const httpServer = http.createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// Socket.io auth middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.campusId) return next(new Error('campusId required'));
    const rawHost = socket.handshake.headers.host || '';
    const hostname = normalizeHostname(rawHost.replace(/:\d+$/, ''));
    const rootDomain = getRootDomain();
    let organization = null;

    if (!isMainHostname(hostname, rootDomain)) {
      const slug = resolveSlug(hostname, rootDomain);
      organization = await Organization.findOne(
        slug ? { slug, status: 'active' } : { customDomains: hostname, status: 'active' }
      ).lean();
      if (!organization) return next(new Error('Organization not found'));
      if (!decoded.organizationId || String(decoded.organizationId) !== String(organization._id)) {
        return next(new Error('Organization mismatch'));
      }
    } else if (decoded.organizationId || decoded.schoolId) {
      organization = decoded.organizationId
        ? await Organization.findOne({ _id: decoded.organizationId, status: 'active' }).lean()
        : null;
      if (!organization && decoded.schoolId) {
        organization = await Organization.findOne({ schoolId: decoded.schoolId, status: 'active' }).lean();
      }
      if (!organization) return next(new Error('Organization not found'));
      const organizationMatches = decoded.organizationId
        && String(decoded.organizationId) === String(organization._id);
      const schoolMatches = decoded.schoolId
        && String(decoded.schoolId) === String(organization.schoolId);
      if (!organizationMatches && !schoolMatches) {
        return next(new Error('Organization mismatch'));
      }
    }

    socket.user = decoded;
    socket.organization = organization;
    return runWithTenant(organization, next);
  } catch {
    return next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.use((_event, next) => runWithTenant(socket.organization, next));
  const user = socket.user;
  const userId = user.id?.toString();

  const notifyPresenceChange = async ({ targetUserId, online, lastSeen }) => {
    if (!targetUserId) return;
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

  const markThreadMessagesSeenSocket = async ({ threadId, schoolId, campusId, currentUserId }) => {
    if (!threadId || !schoolId || !currentUserId) return;
    await ChatMessage.updateMany(
      {
        threadId,
        schoolId,
        ...(campusId ? { campusId } : {}),
        senderId: { $ne: currentUserId },
        'seenBy.userId': { $ne: currentUserId },
      },
      {
        $push: { seenBy: { userId: currentUserId, seenAt: new Date() } },
      }
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

    const myParticipant = (thread.participants || []).find(
      (participant) => String(participant?.userId || '') === userId
    );
    const fallbackName =
      socket.user?.name ||
      socket.user?.fullName ||
      socket.user?.username ||
      (socket.user?.email ? String(socket.user.email).split('@')[0] : '') ||
      socket.user?.userType ||
      'User';
    const userName = String(myParticipant?.name || fallbackName || 'User').trim();
    const payload = { threadId, userId, userName, isTyping: Boolean(isTyping) };
    for (const participant of thread.participants || []) {
      const participantId = String(participant?.userId || '');
      if (!participantId || participantId === userId) continue;
      io.to(`user:${participantId}`).emit('typing', payload);
    }
  };

  // Join personal room for direct notifications
  socket.join(`user:${userId}`);
  const presenceOnline = markUserOnline(userId);
  if (presenceOnline.changed) {
    notifyPresenceChange({
      targetUserId: userId,
      online: true,
      lastSeen: presenceOnline.lastSeen,
    });
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
      socket.join(`thread:${threadId}`);

      // Mark as read when joining
      await ChatThread.updateOne(
        { _id: threadId, 'unreadCounts.userId': userId },
        { $set: { 'unreadCounts.$.count': 0 } }
      );
      const presenceMap = {};
      (thread.participants || []).forEach((participant) => {
        const pid = String(participant.userId || '');
        if (!pid) return;
        presenceMap[pid] = getPresenceSnapshot(pid);
      });
      socket.emit('presence-sync', { threadId, presence: presenceMap });
      await markThreadMessagesSeenSocket({
        threadId,
        schoolId: user.schoolId,
        campusId: user.campusId,
        currentUserId: userId,
      });
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
        encrypted &&
        typeof encrypted === 'object' &&
        String(encrypted.ciphertext || '').trim() &&
        String(encrypted.iv || '').trim() &&
        Array.isArray(encrypted.keys) &&
        encrypted.keys.length > 0;
      if (!plainText && !hasEncrypted) return;

      const thread = await ChatThread.findOne({
        _id: threadId,
        schoolId: user.schoolId,
        ...(user.campusId ? { campusId: user.campusId } : {}),
        'participants.userId': userId,
      }).lean();

      if (!thread) return;

      const myParticipant = thread.participants?.find(p => p.userId?.toString() === userId);
      const senderName = myParticipant?.name || user.userType || 'User';

      const msg = await ChatMessage.create({
        threadId,
        senderId: userId,
        senderType: user.userType,
        senderName,
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

      // Update thread and increment unread for others
      const bulkOps = [];
      for (const p of thread.participants) {
        if (p.userId?.toString() === userId) continue;
        bulkOps.push({
          updateOne: {
            filter: { _id: threadId, 'unreadCounts.userId': p.userId },
            update: { $inc: { 'unreadCounts.$.count': 1 } },
          },
        });
      }

      await Promise.all([
        ChatThread.updateOne(
          { _id: threadId },
          {
            $set: {
              lastMessage: msg.text || '[Encrypted message]',
              lastMessageAt: msg.createdAt,
              lastSenderId: userId
            }
          }
        ),
        bulkOps.length ? ChatThread.bulkWrite(bulkOps) : Promise.resolve(),
      ]);

      const payload = msg.toObject();

      // Broadcast to thread room
      io.to(`thread:${threadId}`).emit('new-message', payload);

      // Notify other participants who may not be in the room
      for (const p of thread.participants) {
        if (p.userId?.toString() === userId) continue;
        io.to(`user:${p.userId}`).emit('thread-updated', {
          threadId,
          lastMessage: msg.text || '[Encrypted message]',
          lastMessageAt: msg.createdAt,
          message: payload,
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
      await ChatThread.updateOne(
        { _id: threadId, 'unreadCounts.userId': userId },
        { $set: { 'unreadCounts.$.count': 0 } }
      );
      await markThreadMessagesSeenSocket({
        threadId,
        schoolId: user.schoolId,
        campusId: user.campusId,
        currentUserId: userId,
      });
      socket.to(`thread:${threadId}`).emit('message-seen', { threadId, userId });
    } catch { /* ignore */ }
  });

  socket.on('disconnect', () => {
    const presenceOffline = markUserOffline(userId);
    if (presenceOffline.changed) {
      notifyPresenceChange({
        targetUserId: userId,
        online: false,
        lastSeen: presenceOffline.lastSeen,
      });
    }
  });
});

const KEEP_ALIVE_ENABLED = process.env.KEEP_ALIVE_ENABLED !== 'false';
const KEEP_ALIVE_INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 600000);

const getDefaultHealthUrl = () => {
  if (HOST === '::') return `http://localhost:${PORT}/health`;
  if (HOST === '0.0.0.0') return `http://127.0.0.1:${PORT}/health`;
  return `http://${HOST}:${PORT}/health`;
};

const getKeepAliveUrl = () => {
  if (process.env.KEEP_ALIVE_URL) return process.env.KEEP_ALIVE_URL;
  if (process.env.RENDER_EXTERNAL_URL) {
    return new URL('/health', process.env.RENDER_EXTERNAL_URL).toString();
  }
  return getDefaultHealthUrl();
};

const pingKeepAliveUrl = () => {
  const targetUrl = getKeepAliveUrl();

  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(parsedUrl, { method: 'GET', timeout: 10000 }, (res) => {
      // Drain response data so sockets close/reuse correctly.
      res.resume();
    });

    req.on('timeout', () => req.destroy(new Error('Keep-alive ping timed out')));
    req.on('error', (err) => {
      console.error(`[keep-alive] Ping failed: ${err.message}`);
    });
    req.end();
  } catch (err) {
    console.error(`[keep-alive] Invalid URL: ${targetUrl}. ${err.message}`);
  }
};

const startServer = (host) => {
  httpServer.listen(PORT, host, () => {
    console.log(`Server running on ${host}:${PORT}`);

    if (KEEP_ALIVE_ENABLED && KEEP_ALIVE_INTERVAL_MS > 0) {
      pingKeepAliveUrl();
      const keepAliveTimer = setInterval(pingKeepAliveUrl, KEEP_ALIVE_INTERVAL_MS);
      keepAliveTimer.unref();
      console.log(
        `[keep-alive] Enabled. Interval=${KEEP_ALIVE_INTERVAL_MS}ms, URL=${getKeepAliveUrl()}`
      );
    }
  });
};

httpServer.on('error', (err) => {
  // If IPv6 host is unavailable on this machine, retry with IPv4 bind.
  if (err && err.code === 'EADDRNOTAVAIL' && HOST === '::') {
    console.warn('[server] IPv6 bind unavailable. Retrying on 0.0.0.0');
    setTimeout(() => startServer('0.0.0.0'), 250);
    return;
  }
  throw err;
});

startServer(HOST);
