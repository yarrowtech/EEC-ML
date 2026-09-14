import { notificationId } from '../utils/moduleNotificationUtils';

// Strips query/hash before comparing against plain ADMIN_MENU_ITEMS paths —
// resolveAdminNotificationPath below intentionally keeps deep links (e.g.
// "?tab=leaves") for click-to-navigate, so matching must ignore them.
export const normalizeAdminPath = (path) => {
  const sanitized = String(path || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return sanitized || '/admin';
};

// Prefer structured notification metadata (type/typeLabel/relatedEntity);
// title text matching only covers the admin-facing alerts that are created
// ad hoc (support/issue lifecycle, leave requests, attendance summaries)
// without a dedicated typeLabel. Anything unmatched still reaches the bell
// dropdown, it just won't light up a specific sidebar module.
export const resolveAdminNotificationPath = (notification) => {
  const title = String(notification?.title || '').toLowerCase();
  const typeLabel = String(notification?.typeLabel || '').toLowerCase();
  const type = String(notification?.type || '').toLowerCase();
  const entity = String(notification?.relatedEntity?.entityType || '').toLowerCase();

  if (typeLabel.includes('leave') || title.includes('leave request')) return '/admin/hr?tab=leaves';
  if (
    title.includes('support request') ||
    title.includes('issue in progress') ||
    title.includes('issue resolved')
  ) return '/admin/support#recent-requests';
  if (typeLabel.includes('attendance') || title.includes('attendance')) return '/admin/attendance';
  if (title.includes('uploaded results') || type === 'result' || entity === 'result') return '/admin/result';
  if (type === 'exam' || entity === 'exam' || typeLabel.includes('exam')) return '/admin/examination';
  if (typeLabel.includes('timetable') || typeLabel.includes('routine')) return '/admin/routines';
  if (type === 'fee' || entity === 'fee') return '/admin/fees/collection';
  if (typeLabel.includes('feedback')) return '/admin/teacher-feedback';
  if (typeLabel.includes('holiday')) return '/admin/holidays';
  if (title.includes('promotion')) return '/admin/promotion';
  if (entity === 'assignment' || type === 'assignment') return '/admin/students';
  if (entity === 'mastery' || entity === 'gap_detection' || entity === 'at_risk') return '/admin/analytics';
  return '/admin/notices/view';
};

export const getAdminModuleNotificationCount = (notifications, path, seenIds) => {
  const target = normalizeAdminPath(path);
  const seen = seenIds instanceof Set ? seenIds : new Set(Array.isArray(seenIds) ? seenIds : []);
  return (Array.isArray(notifications) ? notifications : []).filter((notification) => {
    const id = notificationId(notification);
    if (!id || seen.has(id)) return false;
    return normalizeAdminPath(resolveAdminNotificationPath(notification)) === target;
  }).length;
};
