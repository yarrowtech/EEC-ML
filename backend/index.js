require('./utils/registerTenantPlugin');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

// ── Production guard (must run before anything else) ─────────────────────────
const assertProductionConfiguration = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const jwtSecret = String(process.env.JWT_SECRET || '');
  const paymentKey = String(process.env.PAYMENT_ENCRYPTION_KEY || '');
  const isPlaceholder = (v) => !v || v.includes('replace-with') || v.includes('change-me');
  if (isPlaceholder(jwtSecret) || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be a strong production secret of at least 32 characters');
  }
  if (isPlaceholder(paymentKey)) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must be configured in production');
  }
};
assertProductionConfiguration();

// ── Logger (bind before anything uses console) ────────────────────────────────
const { bindConsoleToLogger, logger } = require('./utils/logger');
bindConsoleToLogger();
logger.info('Pino logger initialized');

// ── Redis ─────────────────────────────────────────────────────────────────────
const { connectRedis, client: redisClient } = require('./utils/redisClient');
if (process.env.NODE_ENV !== 'test') connectRedis();

// ── Swagger (optional dep) ────────────────────────────────────────────────────
let swaggerUi = null;
try { swaggerUi = require('swagger-ui-express'); } catch { /* swagger is optional */ }
let swaggerDocument;
try {
  swaggerDocument = require('./swagger-output.json');
} catch {
  swaggerDocument = {
    openapi: '3.0.0',
    info: { title: 'Electronic Educare API', version: '1.0.0', description: 'Run `npm run swagger:gen` to generate.' },
    paths: {},
  };
}

// ── Infrastructure modules ────────────────────────────────────────────────────
const requestLogger = require('./middleware/requestLogger');
const tokenReplayTelemetry = require('./middleware/tokenReplayTelemetry');
const tenantResolver = require('./middleware/tenantResolver');
const adminActionLogger = require('./middleware/adminActionLogger');
const rateLimit = require('./middleware/rateLimit');
const { logSecurityEvent } = require('./utils/securityEventLogger');
const { getClientIp } = require('./utils/request');
const paymentWebhookController = require('./controllers/paymentWebhookController');
const { connectDatabase } = require('./config/database');
const { configureSocketServer } = require('./config/socketServer');
const registerRoutes = require('./routes/index');

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : null;
const allowLanOrigins = process.env.NODE_ENV !== 'production' && process.env.CORS_ALLOW_LAN === 'true';

if (!allowedOrigins || allowedOrigins.length === 0) {
  logger.warn('CORS_ORIGINS is not configured — all cross-origin browser requests will be rejected.');
}

const isPrivateLanOrigin = (origin) => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
      || /^10\./.test(hostname) || /^192\.168\./.test(hostname)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
      || /^f[cd][0-9a-f]{2}:/i.test(hostname) || /^fe80:/i.test(hostname);
  } catch { return false; }
};

const corsOrigin = (origin, callback) => {
  const allowed = !origin || Boolean(allowedOrigins && (
    allowedOrigins.includes(origin) || (allowLanOrigins && isPrivateLanOrigin(origin))
  ));
  return allowed ? callback(null, true) : callback(new Error('Not allowed by CORS'));
};

// ── Rate limiters ─────────────────────────────────────────────────────────────
const decodeBearerPayload = (req) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) return {};
  const decoded = jwt.decode(String(authHeader).slice('Bearer '.length).trim());
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
  windowMs, max,
  skip: (req) => req.method === 'OPTIONS',
  keyGenerator: (req) => rateLimitIdentity(req, bucket),
});

const limiters = {
  general: createApiLimiter('api:general', { windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS || 15 * 60 * 1000), max: Number(process.env.RATE_LIMIT_GENERAL_MAX || 2400) }),
  auth: createApiLimiter('api:auth', { windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000), max: Number(process.env.RATE_LIMIT_AUTH_MAX || 160) }),
  ai: createApiLimiter('api:ai', { windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS || 10 * 60 * 1000), max: Number(process.env.RATE_LIMIT_AI_MAX || 80) }),
  upload: createApiLimiter('api:upload', { windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || 15 * 60 * 1000), max: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 120) }),
  writeHeavy: createApiLimiter('api:write-heavy', { windowMs: Number(process.env.RATE_LIMIT_WRITE_HEAVY_WINDOW_MS || 15 * 60 * 1000), max: Number(process.env.RATE_LIMIT_WRITE_HEAVY_MAX || 360) }),
};

const requireOrganizationDomain = (req, res, next) => {
  if (req.organizationId) return next();
  return res.status(404).json({ error: 'Organization domain required' });
};

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY && TRUST_PROXY.trim().length > 0) {
  if (TRUST_PROXY === 'true') app.set('trust proxy', true);
  else if (TRUST_PROXY === 'false') app.set('trust proxy', false);
  else app.set('trust proxy', TRUST_PROXY);
}

app.use(cors({ origin: corsOrigin }));
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'cdn.jsdelivr.net', 'checkout.razorpay.com'],
      styleSrc: ["'self'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'res.cloudinary.com', '*.cloudinary.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(requestLogger);
app.use(tokenReplayTelemetry);
app.use('/api', limiters.general);

// Razorpay webhook must receive the raw body before express.json() parses it.
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentWebhookController);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  if (req.query) {
    const cleaned = mongoSanitize.sanitize({ ...req.query });
    Object.keys(req.query).forEach((k) => { delete req.query[k]; });
    Object.assign(req.query, cleaned);
  }
  next();
});
app.use(tenantResolver);

// Sanitize 5xx responses — never leak internal details to clients.
app.use((_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode >= 500 && payload && typeof payload === 'object') {
      const sanitized = { ...payload };
      if (Object.prototype.hasOwnProperty.call(sanitized, 'error')) sanitized.error = 'Internal server error';
      if (Object.prototype.hasOwnProperty.call(sanitized, 'message')) sanitized.message = 'Internal server error';
      return sendJson(sanitized);
    }
    return sendJson(payload);
  };
  next();
});

// Swagger UI
if (swaggerUi) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    swaggerOptions: { docExpansion: 'list', tagsSorter: 'alpha', operationsSorter: 'alpha', persistAuthorization: true, tryItOutEnabled: true, displayRequestDuration: true },
    customSiteTitle: 'Electronic Educare API Docs',
    customCss: '.swagger-ui .topbar { background-color: #0f172a; }',
  }));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerDocument));
}

// Health endpoints
app.get('/', (_req, res) => res.send('B2B Api is Running'));
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
registerRoutes(app, {
  generalApiLimiter: limiters.general,
  authApiLimiter: limiters.auth,
  aiApiLimiter: limiters.ai,
  uploadApiLimiter: limiters.upload,
  writeHeavyApiLimiter: limiters.writeHeavy,
  adminActionLogger,
  requireOrganizationDomain,
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const isMalformedJson = err instanceof SyntaxError && err?.status === 400 && 'body' in err;
  if (isMalformedJson) {
    logSecurityEvent(req, { action: 'security.malformed_json_payload', outcome: 'blocked', severity: 'medium', statusCode: 400, reason: err.message || 'Malformed JSON payload', parserType: 'express.json' });
    return res.status(400).json({ message: 'Malformed JSON payload' });
  }
  logger.error({ event: 'http_error', requestId: req?.requestId, traceId: req?.traceId, method: req?.method, path: req?.originalUrl, statusCode: err?.statusCode || err?.status || 500, err }, 'Unhandled API error');
  res.status(err.statusCode || err.status || 500).json({ message: err.message || 'Server error' });
});

// ── HTTP server + Socket.IO ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '::';
const httpServer = http.createServer(app);
// Long-running requests (e.g. large bulk student uploads processed row-by-row)
// need more than Node's 5-minute default before the socket is torn down.
httpServer.requestTimeout = 600000; // 10 minutes
httpServer.headersTimeout = 600000;
const io = configureSocketServer(httpServer, corsOrigin, tenantResolver, redisClient);
app.set('io', io);

// ── Database ──────────────────────────────────────────────────────────────────
connectDatabase().catch((err) => logger.error({ err }, 'MongoDB connection failed'));

// ── Keep-alive ────────────────────────────────────────────────────────────────
const KEEP_ALIVE_ENABLED = process.env.KEEP_ALIVE_ENABLED !== 'false';
const KEEP_ALIVE_INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 600000);

const getKeepAliveUrl = () => {
  if (process.env.KEEP_ALIVE_URL) return process.env.KEEP_ALIVE_URL;
  if (process.env.RENDER_EXTERNAL_URL) return new URL('/health', process.env.RENDER_EXTERNAL_URL).toString();
  if (HOST === '::') return `http://localhost:${PORT}/health`;
  if (HOST === '0.0.0.0') return `http://127.0.0.1:${PORT}/health`;
  return `http://${HOST}:${PORT}/health`;
};

const pingKeepAliveUrl = () => {
  const targetUrl = getKeepAliveUrl();
  try {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(parsedUrl, { method: 'GET', timeout: 10000 }, (res) => { res.resume(); });
    req.on('timeout', () => req.destroy(new Error('Keep-alive ping timed out')));
    req.on('error', (err) => { logger.warn({ err }, '[keep-alive] ping failed'); });
    req.end();
  } catch (err) {
    logger.warn({ err }, `[keep-alive] Invalid URL: ${targetUrl}`);
  }
};

const startServer = (host) => new Promise((resolve, reject) => {
  httpServer.listen(PORT, host, () => {
    logger.info(`Server running on ${host}:${PORT}`);
    if (KEEP_ALIVE_ENABLED && KEEP_ALIVE_INTERVAL_MS > 0) {
      pingKeepAliveUrl();
      setInterval(pingKeepAliveUrl, KEEP_ALIVE_INTERVAL_MS).unref();
    }
    resolve();
  });
  httpServer.once('error', reject);
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRNOTAVAIL' && HOST === '::') {
    logger.warn('[server] IPv6 bind unavailable — retrying on 0.0.0.0');
    setTimeout(() => startServer('0.0.0.0').catch((e) => { logger.error({ err: e }, '[server] IPv4 fallback failed'); process.exitCode = 1; }), 250);
    return;
  }
  throw err;
});

startServer(HOST).catch((err) => {
  logger.error({ err }, '[server] Startup failed');
  process.exitCode = 1;
});
