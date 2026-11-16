const jwt = require('jsonwebtoken');

// The admit-card QR carries a signed, non-expiring token identifying the
// student. Signed with a purpose-specific audience so it can never be used as
// a login token (and a login token can never be accepted as an admit QR).
const PREFIX = 'EEC-ADMIT:';
const AUDIENCE = 'eec-admit-card';

const signAdmitQr = (studentId, schoolId) => {
  if (!studentId || !process.env.JWT_SECRET) return '';
  const token = jwt.sign(
    { sid: String(studentId), sch: String(schoolId || '') },
    process.env.JWT_SECRET,
    { audience: AUDIENCE, noTimestamp: true }
  );
  return `${PREFIX}${token}`;
};

const verifyAdmitQr = (value) => {
  const raw = String(value || '').trim();
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const decoded = jwt.verify(raw.slice(PREFIX.length), process.env.JWT_SECRET, { audience: AUDIENCE });
    return decoded?.sid ? { studentId: decoded.sid, schoolId: decoded.sch || '' } : null;
  } catch {
    return null;
  }
};

module.exports = { signAdmitQr, verifyAdmitQr };
