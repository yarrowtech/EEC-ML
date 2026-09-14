import { notificationId } from '../utils/moduleNotificationUtils';

export const normalizePrincipalPath = (path) => {
  const sanitized = String(path || '').replace(/\/+$/, '');
  return sanitized || '/principal';
};

// Notifications are normalized (see PrincipalDashboard's normalizeNotifications)
// before reaching here, so structured `type`/`typeLabel`/`relatedEntity` fields
// are preferred; title text matching only backstops ad hoc alerts.
export const resolvePrincipalNotificationPath = (notification) => {
  const title = String(notification?.title || '').toLowerCase();
  const typeLabel = String(notification?.typeLabel || '').toLowerCase();
  const type = String(notification?.type || '').toLowerCase();
  const entity = String(notification?.relatedEntity?.entityType || '').toLowerCase();
  const blob = `${title} ${typeLabel} ${type}`;

  if (typeLabel.includes('holiday') || typeLabel.includes('timetable') || typeLabel.includes('routine')) return '/principal/calendar';
  if (type === 'exam' || entity === 'exam' || typeLabel.includes('exam')) return '/principal/calendar';
  if (type === 'result' || entity === 'result' || typeLabel.includes('result')) return '/principal/academics';
  if (typeLabel.includes('meeting') || typeLabel.includes('ptm')) return '/principal/communications';
  if (blob.includes('finance') || blob.includes('fee') || blob.includes('payment')) return '/principal/finance';
  if (blob.includes('staff') || blob.includes('teacher') || blob.includes('leave') || blob.includes('hr')) return '/principal/staff';
  if (blob.includes('academic') || blob.includes('curriculum')) return '/principal/academics';
  if (blob.includes('student') || blob.includes('attendance')) return '/principal/students';
  return '/principal/notifications';
};

export const getPrincipalModuleNotificationCount = (notifications, path, seenIds) => {
  const target = normalizePrincipalPath(path);
  const seen = seenIds instanceof Set ? seenIds : new Set(Array.isArray(seenIds) ? seenIds : []);
  return (Array.isArray(notifications) ? notifications : []).filter((notification) => {
    const id = notificationId(notification);
    if (!id || seen.has(id)) return false;
    return normalizePrincipalPath(resolvePrincipalNotificationPath(notification)) === target;
  }).length;
};
