import { getSuperAdminNavCounts } from '../superAdminNotificationUtils';

describe('getSuperAdminNavCounts', () => {
  test('counts pending requests, open issues, and unresolved feedback', () => {
    const counts = getSuperAdminNavCounts({
      requests: [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }],
      issues: [{ status: 'open' }, { status: 'investigating' }, { status: 'resolved' }],
      feedbackItems: [{ status: 'open' }, { status: 'resolved' }],
    });

    expect(counts['/super-admin/requests']).toBe(2);
    expect(counts['/super-admin/issues']).toBe(2);
    expect(counts['/super-admin/feedback']).toBe(1);
  });

  test('defaults to zero counts when given no data', () => {
    expect(getSuperAdminNavCounts()).toEqual({
      '/super-admin/requests': 0,
      '/super-admin/issues': 0,
      '/super-admin/feedback': 0,
    });
  });
});
