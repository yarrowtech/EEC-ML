// Role-based access for admin team members (sub-users of a school admin).
//
// Each module is one sidebar menu (or a group of related pages). A role grants a
// module at level "view" (read) or "edit" (read + write). The school owner admin
// (no accessRoleId) is never restricted.
//
// API rules decide what a team member may call:
//   scope 'all'   – GET needs view, writes need edit.
//   scope 'write' – GET is shared (lookups other pages need), writes need edit.
//   methods       – optional: the rule only applies to these HTTP methods.
// A request matching no rule is allowed for GET and denied for writes.

const MODULES = [
  {
    key: 'analytics', label: 'Analytics', section: 'Overview', paths: ['/admin/analytics'],
    rules: [
      { prefix: '/api/admin-analytics', scope: 'all' },
      { prefix: '/api/progress/analytics', scope: 'all' },
      { prefix: '/api/reports/summary', scope: 'all' },
    ],
  },
  {
    key: 'academics', label: 'Academic Setup', section: 'Academic Management', paths: ['/admin/academics', '/admin/subjects'],
    rules: [
      { prefix: '/api/academic', scope: 'write' },
      { prefix: '/api/subject', scope: 'write' },
      { prefix: '/api/teacher-allocations', scope: 'write' },
      { prefix: '/api/departments', scope: 'write' },
    ],
  },
  {
    key: 'teachers', label: 'Teachers Management', section: 'Academic Management', paths: ['/admin/teachers'],
    rules: [
      { prefix: '/api/teacher/auth', scope: 'write' },
      { prefix: '/api/admin/users/teachers', scope: 'write' },
      { prefix: '/api/admin/users/principals', scope: 'write' },
      { prefix: '/api/admin/users/teacher-attendance', scope: 'all' },
      { prefix: '/api/admin/users/teacher-leaves', scope: 'all' },
    ],
  },
  {
    key: 'teacherFeedback', label: 'Teacher Feedback', section: 'Academic Management', paths: ['/admin/teacher-feedback'],
    rules: [{ prefix: '/api/admin/feedback', scope: 'all' }],
  },
  {
    key: 'routines', label: 'Routine Management', section: 'Academic Management', paths: ['/admin/routines'],
    rules: [{ prefix: '/api/timetable', scope: 'write' }],
  },
  {
    key: 'exams', label: 'Exam Management', section: 'Academic Management', paths: ['/admin/examination'],
    rules: [{ prefix: '/api/exam', scope: 'write' }],
  },
  {
    key: 'admitCards', label: 'Admit Cards', section: 'Academic Management', paths: ['/admin/admit-cards'],
    rules: [],
  },
  {
    key: 'results', label: 'Result Management', section: 'Academic Management', paths: ['/admin/result'],
    rules: [{ prefix: '/api/exam/results', scope: 'write' }],
  },
  {
    key: 'reportCards', label: 'Report Cards', section: 'Academic Management', paths: ['/admin/report-cards'],
    rules: [{ prefix: '/api/reports/report-cards', scope: 'write' }],
  },
  {
    key: 'admissions', label: 'Admissions', section: 'Students', paths: ['/admin/admissions'],
    rules: [
      { prefix: '/api/admissions', scope: 'all' },
      // Admitting creates the student account through the enrolment endpoint.
      { prefix: '/api/student/auth/register', scope: 'write' },
    ],
  },
  {
    key: 'students', label: 'Students', section: 'Students', paths: ['/admin/students'],
    rules: [
      { prefix: '/api/student/auth', scope: 'write' },
      { prefix: '/api/admin/users/students', scope: 'write' },
      { prefix: '/api/admin/users/password-reset/reset', scope: 'write' },
      { prefix: '/api/nif', scope: 'write' },
      // The student profile shows the student's fee invoices (read only).
      { prefix: '/api/fees/invoices', scope: 'all', methods: ['GET'] },
    ],
  },
  {
    key: 'parents', label: 'Parents', section: 'Students', paths: ['/admin/parents'],
    rules: [
      { prefix: '/api/admin/users/parents', scope: 'write' },
      { prefix: '/api/admin/users/password-reset/reset', scope: 'write' },
    ],
  },
  {
    key: 'promotion', label: 'Student Promotion', section: 'Students', paths: ['/admin/promotion'],
    rules: [{ prefix: '/api/promotion', scope: 'all' }],
  },
  {
    key: 'leftStudents', label: 'Leave & Left Students', section: 'Students', paths: ['/admin/left-students'],
    rules: [{ prefix: '/api/promotion', scope: 'all' }],
  },
  {
    key: 'feesManage', label: 'Create Fees', section: 'Fees Management', paths: ['/admin/fees/manage'],
    rules: [{ prefix: '/api/fees', scope: 'all' }],
  },
  {
    key: 'feesCollection', label: 'Fees Collection', section: 'Fees Management', paths: ['/admin/fees/collection', '/admin/fees', '/admin/fees/student-details'],
    rules: [{ prefix: '/api/fees', scope: 'all' }],
  },
  {
    key: 'feeReceipts', label: 'Fee Receipts', section: 'Fees Management', paths: ['/admin/fees/receipts'],
    rules: [{ prefix: '/api/fees', scope: 'all' }],
  },
  {
    key: 'notices', label: 'Notices', section: 'Communication', paths: ['/admin/notices', '/admin/notices/view', '/admin/notices/post'],
    rules: [
      // Marking one's own notifications read stays open to everyone.
      { prefix: '/api/notifications', scope: 'write', methods: ['POST', 'DELETE'], exclude: ['/api/notifications/user', '/api/notifications/push'] },
      { prefix: '/api/notifications', scope: 'write', methods: ['PATCH'], exclude: ['/api/notifications/user'] },
    ],
  },
  {
    key: 'holidays', label: 'Holiday List', section: 'Communication', paths: ['/admin/holidays'],
    rules: [{ prefix: '/api/holidays', scope: 'write' }],
  },
  {
    key: 'communityWall', label: 'Community Wall', section: 'Communication', paths: ['/admin/community-wall'],
    rules: [],
  },
  {
    key: 'floorRooms', label: 'Floor & Rooms', section: 'Campus', paths: ['/admin/floor-rooms'],
    rules: [
      { prefix: '/api/academic/buildings', scope: 'write' },
      { prefix: '/api/academic/floors', scope: 'write' },
      { prefix: '/api/academic/rooms', scope: 'write' },
    ],
  },
  {
    key: 'hr', label: 'HR', section: 'Human Resources', paths: ['/admin/hr'],
    rules: [
      { prefix: '/api/admin/users/teacher-attendance', scope: 'all' },
      { prefix: '/api/admin/users/teacher-attendance-settings', scope: 'all' },
      { prefix: '/api/admin/users/teacher-expenses', scope: 'all' },
      { prefix: '/api/admin/users/teacher-leave-policy', scope: 'all' },
      { prefix: '/api/admin/users/teacher-leaves', scope: 'all' },
      { prefix: '/api/admin/users/staff', scope: 'all' },
    ],
  },
  {
    key: 'support', label: 'Support', section: 'Support', paths: ['/admin/support'],
    rules: [
      { prefix: '/api/support', scope: 'all' },
      { prefix: '/api/issues', scope: 'all' },
      { prefix: '/api/admin/users/password-reset', scope: 'all' },
    ],
  },
  {
    key: 'activityLog', label: 'Activity Log', section: 'Settings', paths: ['/admin/activity-log'],
    rules: [{ prefix: '/api/audit-logs', scope: 'all' }],
  },
  {
    key: 'settings', label: 'Profile & School', section: 'Settings', paths: ['/admin/settings'],
    rules: [
      { prefix: '/api/admin/auth/settings', scope: 'write' },
      { prefix: '/api/schools', scope: 'write' },
    ],
  },
  {
    key: 'paymentGateway', label: 'Payment Gateway', section: 'Settings', paths: ['/admin/settings/payment-gateway'],
    rules: [{ prefix: '/api/settings/payment', scope: 'all' }],
  },
];

const MODULE_KEYS = new Set(MODULES.map((m) => m.key));

// Always open to a signed-in team member (own profile, uploads, push, etc.).
const ALWAYS_ALLOWED = ['/api/admin/auth/profile', '/api/admin/auth/switch-to-teacher', '/api/uploads', '/api/notifications/user', '/api/notifications/push'];
// Only the school owner admin may call these.
const OWNER_ONLY = ['/api/admin/team', '/api/admin/users/create-user', '/api/admin/users/bulk-create-users', '/api/admin/users/bulk-import-csv'];

const DEFAULT_ROLES = [
  {
    name: 'Admission Department',
    description: 'Admissions, students and parents',
    permissions: [['admissions', 'edit'], ['students', 'edit'], ['parents', 'edit'], ['promotion', 'view'], ['leftStudents', 'view']],
  },
  {
    name: 'Finance',
    description: 'Fees, collections, receipts and payments',
    permissions: [['feesManage', 'edit'], ['feesCollection', 'edit'], ['feeReceipts', 'edit'], ['analytics', 'view'], ['students', 'view']],
  },
  {
    name: 'HR',
    description: 'Staff, attendance, leaves and expenses',
    permissions: [['hr', 'edit'], ['teachers', 'view']],
  },
  {
    name: 'Support',
    description: 'Support requests and password resets',
    permissions: [['support', 'edit'], ['students', 'view'], ['parents', 'view'], ['notices', 'view']],
  },
];

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

const normalizePermissions = (list) => {
  const map = {};
  (Array.isArray(list) ? list : []).forEach((p) => {
    const key = String(p?.key || '');
    const level = p?.level === 'edit' ? 'edit' : p?.level === 'view' ? 'view' : null;
    if (MODULE_KEYS.has(key) && level) map[key] = level;
  });
  return map;
};

// permissions: { key: 'view' | 'edit' }. Returns { allowed, reason }.
const checkAccess = (method, rawPath, permissions) => {
  const path = String(rawPath || '').split('?')[0].replace(/\/+$/, '') || '/';
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());
  if (OWNER_ONLY.some((p) => matchesPrefix(path, p))) return { allowed: false, reason: 'Only the school admin can do this' };
  if (ALWAYS_ALLOWED.some((p) => matchesPrefix(path, p))) return { allowed: true };

  const owners = [];
  MODULES.forEach((m) => {
    m.rules.forEach((r) => {
      if (!matchesPrefix(path, r.prefix)) return;
      if (r.methods && !r.methods.includes(String(method).toUpperCase())) return;
      if (r.exclude?.some((x) => matchesPrefix(path, x))) return;
      owners.push({ key: m.key, scope: r.scope });
    });
  });

  if (!owners.length) {
    return isRead ? { allowed: true } : { allowed: false, reason: 'Your role does not allow this action' };
  }
  if (isRead) {
    const needsView = owners.filter((o) => o.scope === 'all');
    if (!needsView.length) return { allowed: true };
    return needsView.some((o) => permissions[o.key])
      ? { allowed: true }
      : { allowed: false, reason: 'Your role does not have access to this section' };
  }
  return owners.some((o) => permissions[o.key] === 'edit')
    ? { allowed: true }
    : { allowed: false, reason: 'Your role has view-only access here' };
};

const allowedPaths = (permissions) => [...new Set(MODULES.filter((m) => permissions[m.key]).flatMap((m) => m.paths))];

module.exports = {
  MODULES,
  DEFAULT_ROLES,
  checkAccess,
  normalizePermissions,
  allowedPaths,
  publicModules: () => MODULES.map(({ key, label, section }) => ({ key, label, section })),
};
