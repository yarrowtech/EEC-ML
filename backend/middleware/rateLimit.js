const { getClientIp } = require('../utils/request');

const buckets = new Map();
const { logSecurityEvent } = require('../utils/securityEventLogger');

const getIpForLimit = (req, useForwardedFor = true) => {
  if (useForwardedFor) {
    return getClientIp(req) || 'unknown';
  }
  return req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress || 'unknown';
};

const getKey = (req, { useForwardedFor = true, keyGenerator } = {}) => {
  if (typeof keyGenerator === 'function') {
    return String(keyGenerator(req));
  }
  const ip = getIpForLimit(req, useForwardedFor);
  const routePath = `${req.baseUrl || ''}${req.path || req.originalUrl || ''}`;
  return `${ip}:${routePath}`;
};

const rateLimit = ({
  windowMs = 60 * 1000,
  max = 10,
  onLimit,
  useForwardedFor = true,
  keyGenerator,
  skip,
  skipSuccessfulRequests = false,
  skipFailedRequests = false,
  requestWasSuccessful = (_req, res) => res.statusCode < 400,
} = {}) => {
  return (req, res, next) => {
    if (typeof skip === 'function' && skip(req, res)) {
      return next();
    }

    const key = getKey(req, { useForwardedFor, keyGenerator });
    const now = Date.now();
    const entry = buckets.get(key) || { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    buckets.set(key, entry);

    const resetAt = Math.ceil((entry.start + windowMs) / 1000);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', resetAt);

    if (entry.count > max) {
      logSecurityEvent(req, {
        action: 'security.rate_limit_triggered',
        outcome: 'blocked',
        severity: 'medium',
        statusCode: 429,
        limiterKey: key,
        currentCount: entry.count,
        maxRequests: max,
        windowMs,
      });

      if (typeof onLimit === 'function') {
        try {
          onLimit({ req, res, key, windowMs, max, currentCount: entry.count });
        } catch (_err) {
          // Keep rate-limiter fail-safe.
        }
      }
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    if (skipSuccessfulRequests || skipFailedRequests) {
      let done = false;
      const maybeDecrement = () => {
        if (done) return;
        done = true;

        let successful = false;
        try {
          successful = Boolean(requestWasSuccessful(req, res));
        } catch (_err) {
          successful = res.statusCode < 400;
        }

        const shouldDecrement =
          (skipSuccessfulRequests && successful) ||
          (skipFailedRequests && !successful);

        if (!shouldDecrement) return;

        const latest = buckets.get(key);
        if (!latest) return;
        latest.count = Math.max(0, latest.count - 1);
        if (latest.count === 0) {
          buckets.delete(key);
          return;
        }
        buckets.set(key, latest);
      };

      res.on('finish', maybeDecrement);
      res.on('close', maybeDecrement);
    }

    return next();
  };
};

// Login/reset endpoints key on IP + route + username so unrelated accounts
// (or roles, on the shared unified login endpoint) don't exhaust one
// another's request budget just because they share an IP/NAT.
rateLimit.loginKeyGenerator = (req) => {
  const ip = getIpForLimit(req, true);
  const routePath = `${req.baseUrl || ''}${req.path || req.originalUrl || ''}`;
  const username = String(req?.body?.username || '').trim().toLowerCase();
  return `${ip}:${routePath}:${username || 'anonymous'}`;
};

module.exports = rateLimit;
