// Report-card payloads from /api/reports/report-cards/parent are shared with the
// admin/student views and occasionally omit collections when a student has no
// published data yet. Normalising here keeps every consumer crash-safe.
export const normalizeReportCard = (card = {}) => ({
  ...card,
  studentName: card.studentName || 'Student',
  subjects: Array.isArray(card.subjects) ? card.subjects : [],
  exams: Array.isArray(card.exams) ? card.exams : [],
  totals: card.totals || {
    percentage: 0,
    obtainedMarks: 0,
    totalMarks: 0,
    grade: '—',
  },
});
