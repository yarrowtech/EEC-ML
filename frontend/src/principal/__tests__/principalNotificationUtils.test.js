import { getPrincipalModuleNotificationCount, normalizePrincipalPath, resolvePrincipalNotificationPath } from '../principalNotificationUtils';

describe('resolvePrincipalNotificationPath', () => {
  test('routes exam and holiday notices to Calendar', () => {
    expect(resolvePrincipalNotificationPath({ type: 'exam' })).toBe('/principal/calendar');
    expect(resolvePrincipalNotificationPath({ typeLabel: 'timetable_updated' })).toBe('/principal/calendar');
  });

  test('routes result notices to Academic Analytics', () => {
    expect(resolvePrincipalNotificationPath({ type: 'result' })).toBe('/principal/academics');
  });

  test('routes fee/finance text matches to Financial Dashboard', () => {
    expect(resolvePrincipalNotificationPath({ title: 'Fee payment overdue' })).toBe('/principal/finance');
  });

  test('falls back to the notifications inbox', () => {
    expect(resolvePrincipalNotificationPath({ title: 'Something unrelated' })).toBe('/principal/notifications');
  });
});

describe('normalizePrincipalPath', () => {
  test('drops a trailing slash', () => {
    expect(normalizePrincipalPath('/principal/finance/')).toBe('/principal/finance');
  });
});

describe('getPrincipalModuleNotificationCount', () => {
  const notifications = [
    { id: '1', type: 'exam' },
    { id: '2', type: 'result' },
    { id: '3', type: 'result' },
  ];

  test('counts only notifications resolving to the given module path', () => {
    expect(getPrincipalModuleNotificationCount(notifications, '/principal/calendar')).toBe(1);
    expect(getPrincipalModuleNotificationCount(notifications, '/principal/academics')).toBe(2);
  });

  test('excludes notifications already marked seen for that module', () => {
    expect(getPrincipalModuleNotificationCount(notifications, '/principal/academics', new Set(['2']))).toBe(1);
  });
});
