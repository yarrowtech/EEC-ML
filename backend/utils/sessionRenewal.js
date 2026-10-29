// Sliding ("stay signed in") sessions, Facebook-style: a user is only signed
// out when they press Logout, or after SESSION_TTL of complete inactivity.
//
// Every authenticated request whose token is older than RENEW_AFTER_SECONDS gets
// a freshly signed token (same claims, new expiry) in the X-Renewed-Token
// response header; the frontend swaps it into localStorage. GET
// /api/session/renew does the same on demand (app open, "Stay signed in").
//
// Route-level auth (role checks, tenant binding, ACCOUNT_BLOCKED, etc.) is
// untouched — renewal only extends the lifetime of a token that already verifies.
const jwt = require('jsonwebtoken');

const SESSION_TTL = process.env.JWT_SESSION_TTL || '60d';
const RENEW_AFTER_SECONDS = Number(process.env.JWT_RENEW_AFTER_SECONDS || 60 * 60);
const RENEWED_TOKEN_HEADER = 'X-Renewed-Token';

const readBearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const verify = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const reissue = (decoded) => {
  // Drop the registered time claims so jsonwebtoken stamps fresh ones.
  const { iat, exp, nbf, ...claims } = decoded;
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: SESSION_TTL });
};

// app.use(...) before the routes.
const slidingSession = (req, res, next) => {
  const token = readBearer(req);
  if (!token) return next();
  const decoded = verify(token);
  if (decoded && typeof decoded === 'object') {
    const ageSeconds = Math.floor(Date.now() / 1000) - Number(decoded.iat || 0);
    if (ageSeconds >= RENEW_AFTER_SECONDS) {
      res.setHeader(RENEWED_TOKEN_HEADER, reissue(decoded));
    }
  }
  return next();
};

// GET /api/session/renew — always returns a fresh token for a valid one.
const renewSessionHandler = (req, res) => {
  const token = readBearer(req);
  const decoded = token ? verify(token) : null;
  if (!decoded || typeof decoded !== 'object') {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
  return res.json({ success: true, data: { token: reissue(decoded) } });
};

module.exports = { slidingSession, renewSessionHandler, RENEWED_TOKEN_HEADER, SESSION_TTL };
