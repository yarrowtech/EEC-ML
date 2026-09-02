import { describe, expect, it } from '@jest/globals';
import { getLocalMonthKey, mapAttendanceChildForDashboard } from '../attendanceViewModel';

describe('parent attendance view model', () => {
  it('uses the monthly summary on the dashboard instead of the all-time summary', () => {
    const child = mapAttendanceChildForDashboard({
      student: { _id: 'student-1', name: 'Asha' },
      summary: { attendancePercentage: 100, presentDays: 12, totalClasses: 12 },
      monthlySummary: { attendancePercentage: 0, presentDays: 0, totalClasses: 0 },
    });

    expect(child).toEqual(expect.objectContaining({
      _id: 'student-1',
      name: 'Asha',
      attendancePercentage: 0,
      presentDays: 0,
      totalDays: 0,
    }));
  });

  it('preserves valid zero values and defaults a missing monthly summary to zero', () => {
    expect(mapAttendanceChildForDashboard({ student: { name: 'Asha' } }))
      .toEqual(expect.objectContaining({ attendancePercentage: 0, presentDays: 0, totalDays: 0 }));
  });

  it('builds the selected month from local time', () => {
    expect(getLocalMonthKey(new Date(2026, 8, 2, 1, 30))).toBe('2026-09');
  });
});
