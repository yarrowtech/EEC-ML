const crypto = require('crypto');

/**
 * Restricts a route to server-to-server calls the backend makes to itself
 * (e.g. exam publish -> mastery re-assessment). Callers must send the shared
 * secret in the x-internal-secret header.
 */
const internalAuth = (req, res, next) => {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    console.error('INTERNAL_API_SECRET not configured in environment variables');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  const provided = req.headers['x-internal-secret'];
  if (!provided) {
    return res.status(401).json({ success: false, error: 'Internal secret is required' });
  }

  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(expected);
  const matches = providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!matches) {
    return res.status(401).json({ success: false, error: 'Invalid internal secret' });
  }

  next();
};

module.exports = internalAuth;
