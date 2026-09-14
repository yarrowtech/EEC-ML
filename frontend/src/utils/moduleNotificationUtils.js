const notificationText = (notification) => (
  `${notification?.title || ''} ${notification?.message || ''} ${notification?.typeLabel || ''}`.toLowerCase()
);

const hasTerm = (text, terms) => terms.some((term) => text.includes(term));

// Prefer structured notification metadata. Text matching is only used for
// legacy records that predate relatedEntity/typeLabel; unknown notifications
// intentionally stay in the notification center instead of appearing on
// unrelated modules.
export const getStudentNotificationModule = (notification) => {
  const type = String(notification?.type || '').toLowerCase();
  const typeLabel = String(notification?.typeLabel || '').toLowerCase();
  const entity = String(notification?.relatedEntity?.entityType || '').toLowerCase();
  const text = notificationText(notification);

  if (entity === 'assignment' || type === 'assignment') return 'assignments';
  if (type === 'class_note' || hasTerm(typeLabel, ['class_note', 'class note', 'journal'])) return 'assignments-journal';
  if (hasTerm(typeLabel, ['attendance', 'substitute'])) return 'attendance';
  if (entity === 'exam' || type === 'exam') return 'exams';
  if (entity === 'result' || type === 'result') return 'results';
  if (entity === 'learning_path' || type === 'learning' || hasTerm(typeLabel, ['learning_path', 'learning path'])) return 'learning';
  if (entity === 'mastery_badge' || hasTerm(text, ['mastery badge', 'badge earned', 'achievement'])) return 'achievements';
  if (entity === 'mastery' || entity === 'gap_detection' || entity === 'at_risk') return 'mastery';
  if (hasTerm(typeLabel, ['timetable', 'routine', 'calendar'])) return 'routine';
  if (hasTerm(typeLabel, ['holiday'])) return 'holidays';
  if (hasTerm(typeLabel, ['meeting', 'parent', 'ptm'])) return 'meetings';
  if (hasTerm(typeLabel, ['feedback'])) return 'teacherfeedback';
  if (hasTerm(typeLabel, ['excuse', 'leave'])) return 'excuse-letter';
  if (hasTerm(typeLabel, ['complaint'])) return 'complaints';
  if (hasTerm(typeLabel, ['health'])) return 'health';
  if (hasTerm(typeLabel, ['wellbeing', 'mood'])) return 'wellbeing';
  if (hasTerm(typeLabel, ['chat', 'message'])) return 'chat';
  if (type === 'notice' || type === 'announcement') return 'noticeboard';
  if (hasTerm(text, ['class routine updated', 'weekly class routine'])) return 'routine';
  return null;
};

export const unreadNotifications = (notifications = []) => (
  (Array.isArray(notifications) ? notifications : []).filter((notification) => !notification?.isRead)
);

export const readModuleSeenState = (scope = 'student') => {
  try {
    const raw = localStorage.getItem(`moduleNotificationsSeen:${scope}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const writeModuleSeenState = (scope, state) => {
  try {
    localStorage.setItem(`moduleNotificationsSeen:${scope}`, JSON.stringify(state));
  } catch {
    // Private browsing or storage quota should not break navigation.
  }
};

export const notificationId = (notification) => String(
  notification?._id || notification?.id || ''
);

export const getStudentModuleNotificationCount = (
  notifications,
  moduleId,
  extraCount = 0,
  seenState = {},
  seenExtraCount = 0,
) => {
  const all = Array.isArray(notifications) ? notifications : [];
  const seenIds = new Set(Array.isArray(seenState?.[moduleId]) ? seenState[moduleId] : []);
  const matched = moduleId === 'notifications'
    ? all.filter((notification) => notificationId(notification) && !seenIds.has(notificationId(notification))).length
    : all.filter((notification) => (
      notificationId(notification)
      && !seenIds.has(notificationId(notification))
      && getStudentNotificationModule(notification) === moduleId
    )).length;
  const unseenExtraCount = moduleId === 'chat'
    ? Math.max(0, Number(extraCount) - Number(seenExtraCount || 0))
    : 0;
  return matched + unseenExtraCount;
};
