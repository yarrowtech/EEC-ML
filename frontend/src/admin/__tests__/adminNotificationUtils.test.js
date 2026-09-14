import { getAdminModuleNotificationCount, normalizeAdminPath, resolveAdminNotificationPath } from '../adminNotificationUtils';

describe('resolveAdminNotificationPath', () => {
  test('routes leave requests to HR with the leaves tab deep link', () => {
    expect(resolveAdminNotificationPath({ title: 'New Teacher Leave Request' })).toBe('/admin/hr?tab=leaves');
  });

  test('routes support/issue lifecycle notices to Support', () => {
    expect(resolveAdminNotificationPath({ title: 'Support Request In Progress' })).toBe('/admin/support#recent-requests');
    expect(resolveAdminNotificationPath({ title: 'Issue Resolved' })).toBe('/admin/support#recent-requests');
  });

  test('routes structured exam/result/fee notifications by type', () => {
    expect(resolveAdminNotificationPath({ type: 'exam' })).toBe('/admin/examination');
    expect(resolveAdminNotificationPath({ type: 'result' })).toBe('/admin/result');
    expect(resolveAdminNotificationPath({ type: 'fee' })).toBe('/admin/fees/collection');
  });

  test('falls back to the notices inbox when nothing matches', () => {
    expect(resolveAdminNotificationPath({ title: 'Something unrelated', type: 'general' })).toBe('/admin/notices/view');
  });
});

describe('normalizeAdminPath', () => {
  test('strips query and hash so deep links match plain sidebar paths', () => {
    expect(normalizeAdminPath('/admin/hr?tab=leaves')).toBe(normalizeAdminPath('/admin/hr'));
    expect(normalizeAdminPath('/admin/support#recent-requests')).toBe(normalizeAdminPath('/admin/support'));
  });
});

describe('getAdminModuleNotificationCount', () => {
  const notifications = [
    { _id: '1', title: 'New Teacher Leave Request' },
    { _id: '2', type: 'exam' },
    { _id: '3', type: 'exam' },
  ];

  test('counts only notifications resolving to the given module path', () => {
    expect(getAdminModuleNotificationCount(notifications, '/admin/hr')).toBe(1);
    expect(getAdminModuleNotificationCount(notifications, '/admin/examination')).toBe(2);
    expect(getAdminModuleNotificationCount(notifications, '/admin/support')).toBe(0);
  });

  test('excludes notifications already marked seen for that module', () => {
    expect(getAdminModuleNotificationCount(notifications, '/admin/examination', new Set(['2']))).toBe(1);
  });
});
