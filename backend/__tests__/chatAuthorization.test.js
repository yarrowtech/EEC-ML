const chatRoutes = require('../routes/chatRoutes');

describe('chat cohort authorization', () => {
  const shareCohort = chatRoutes.studentsShareChatCohort;

  test('allows students in the same grade and section', () => {
    expect(shareCohort(
      { grade: 'Class 5', section: 'A', academicYear: '2025-26' },
      { grade: 'class 5', section: 'a', academicYear: '2025-2026' },
    )).toBe(true);
  });

  test('rejects a student in another section or grade', () => {
    expect(shareCohort(
      { grade: 'Class 5', section: 'A' },
      { grade: 'Class 5', section: 'B' },
    )).toBe(false);
    expect(shareCohort(
      { grade: 'Class 5', section: 'A' },
      { grade: 'Class 6', section: 'A' },
    )).toBe(false);
  });

  test('rejects a different academic year when both profiles provide one', () => {
    expect(shareCohort(
      { grade: 'Class 5', section: 'A', academicYear: '2025-26' },
      { grade: 'Class 5', section: 'A', academicYear: '2026-27' },
    )).toBe(false);
  });
});
