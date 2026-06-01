const { logStudentPortalEvent } = require('../utils/studentPortalLogger');

const PORTAL_ROUTE_PREFIXES = [
  '/api/student',
  '/api/parent',
  '/api/teacher',
  '/api/admin',
  '/api/attendance',
  '/api/assignment',
  '/api/practice',
  '/api/reports',
  '/api/holidays',
  '/api/notifications',
  '/api/chat',
  '/api/fees',
  '/api/meeting',
  '/api/observations',
  '/api/excuse-letters',
  '/api/lesson-plans',
  '/api/academic',
  '/api/timetable',
  '/api/teacher-allocations',
  '/api/schools',
  '/api/school-registration',
  '/api/support',
  '/api/issues',
  '/api/promotion',
];

const isPortalPath = (path) => PORTAL_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));

const isAuthPath = (path) =>
  path.startsWith('/api/student/auth') ||
  path.startsWith('/api/parent/auth') ||
  path.startsWith('/api/teacher/auth') ||
  path.startsWith('/api/admin/auth') ||
  path.startsWith('/api/principal/auth') ||
  path.startsWith('/api/staff/auth') ||
  path === '/api/auth' ||
  path.startsWith('/api/auth/');

const methodToAction = (method) => {
  const normalized = String(method || '').toUpperCase();
  if (normalized === 'GET') return 'request.fetch';
  if (normalized === 'POST') return 'request.create';
  if (normalized === 'PUT' || normalized === 'PATCH') return 'request.update';
  if (normalized === 'DELETE') return 'request.delete';
  return 'request.completed';
};

const portalActionLogger = (req, res, next) => {
  res.on('finish', () => {
    const path = String(req?.originalUrl || '');
    if (!isPortalPath(path) || isAuthPath(path) || req?._portalEventLogged) {
      return;
    }

    logStudentPortalEvent(req, {
      action: methodToAction(req?.method),
      outcome: res.statusCode >= 400 ? 'failure' : 'success',
      statusCode: res.statusCode,
      force: true,
    });
  });

  next();
};

module.exports = portalActionLogger;
