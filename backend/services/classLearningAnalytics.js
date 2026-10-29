const { forecastScores, summarizeEvidence } = require('./learningEvidenceService');
const DAY = 86400000;

// Published exam results as % of full marks, oldest first, per student.
async function examPercentsByStudent(students, schoolId) {
  const results = await require('../models/ExamResult').find({
    schoolId, studentId: { $in: students.map((s) => s._id) }, published: true, status: { $ne: 'absent' },
  }).populate('examId', 'marks date').lean();
  const byStudent = new Map();
  results.forEach((r) => {
    const max = Number(r.examId?.marks) || 0;
    if (max <= 0) return;
    const key = String(r.studentId);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push({
      when: new Date(r.examId?.date || r.createdAt || 0).getTime(),
      pct: Math.max(0, Math.min(100, (Number(r.marks) || 0) / max * 100)),
    });
  });
  byStudent.forEach((list) => list.sort((a, b) => a.when - b.when));
  return byStudent;
}

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

async function forecastClass(students, schoolId) {
  const [events, examsByStudent] = await Promise.all([
    require('../models/MasteryEvent').find({ schoolId, studentId: { $in: students.map((s) => s._id) },
      createdAt: { $gte: new Date(Date.now() - 31 * DAY) } }).lean(),
    examPercentsByStudent(students, schoolId),
  ]);
  return students.map((student) => {
    // Exam fallback when practice evidence is too thin: recent average over the
    // last 6 exams, and trend = newer half minus older half (needs 2+ exams).
    const exams = (examsByStudent.get(String(student._id)) || []).slice(-6).map((e) => e.pct);
    const examAvg = exams.length ? Math.round(mean(exams)) : null;
    const half = Math.floor(exams.length / 2);
    const examTrend = exams.length >= 2 ? Math.round(mean(exams.slice(exams.length - half)) - mean(exams.slice(0, half))) : null;
    const evidence = events.filter((e) => String(e.studentId) === String(student._id));
    const estimate = forecastScores(evidence);
    const risk = summarizeEvidence(evidence);
    const attendance = (student.attendance || []).filter((a) => new Date(a.date) >= new Date(Date.now() - 7 * DAY));
    const attPct7d = attendance.length ? Math.round(attendance.filter((a) => a.status === 'present').length / attendance.length * 100) : null;
    const signals = [];
    const score = estimate.predictedScore ?? risk.recentAvg;
    if (score != null && score < 60) signals.push({ type: estimate.predictedScore != null ? 'projected_score' : 'score',
      severity: score < 40 ? 'critical' : 'high', value: Math.round(score) });
    if (attPct7d != null && attPct7d < 75) signals.push({ type: 'attendance', severity: attPct7d < 60 ? 'critical' : 'high', value: attPct7d });
    const profilePic = typeof student.profilePic === 'string' ? student.profilePic : (student.profilePic?.secure_url || student.profilePic?.url || null);
    // Weekly score change implied by the regression (points per 7 days); falls
    // back to the exam trend so the column is not blank for most students.
    const trend7d = estimate.slopePerDay != null ? Math.round(estimate.slopePerDay * 7) : examTrend;
    const trendSource = estimate.slopePerDay != null ? 'practice' : examTrend != null ? 'exams' : null;
    const recentAvg = risk.recentAvg != null ? Math.round(risk.recentAvg) : examAvg;
    const recentAvgSource = risk.recentAvg != null ? 'practice' : examAvg != null ? 'exams' : null;
    return { studentId: student._id, name: student.name, roll: student.roll, grade: student.grade, section: student.section, profilePic, trend7d,
      forecastLevel: signals.some((s) => s.severity === 'critical') ? 'critical' : signals.length ? 'high' :
        estimate.status === 'insufficient_data' ? 'insufficient_data' : 'low',
      estimate, signals, attPct7d, avgScore7d: recentAvg, avgScoreSource: recentAvgSource, trendSource,
      examCount: exams.length, practiceDays: estimate.sampleDays || 0, totalAttPct: null, examCount7d: risk.sampleCount };
  });
}

function aggregateMisconceptions(records, studentCount) {
  const groups = new Map();
  for (const record of records) {
    const concepts = record.missingConcepts?.length ? record.missingConcepts : [record.topicTitle || record.questionText || record.subject];
    for (const concept of new Set(concepts.filter(Boolean))) {
      const key = record.subject + '::' + concept;
      if (!groups.has(key)) groups.set(key, { topic: concept, subject: record.subject, question: record.questionText || '',
        students: new Set(), answers: new Map(), sources: new Set(), errorTypes: new Set() });
      const g = groups.get(key), sid = String(record.studentId), answer = record.studentAnswer || '(not recorded)';
      g.students.add(sid); g.sources.add(record.source); g.errorTypes.add(record.errorType || 'Concept');
      if (!g.answers.has(answer)) g.answers.set(answer, new Set());
      g.answers.get(answer).add(sid);
    }
  }
  return [...groups.values()].map((g) => ({ topic: g.topic, subject: g.subject, question: g.question,
    totalWrong: g.students.size, pct: studentCount ? Math.round(g.students.size / studentCount * 100) : 0,
    sources: [...g.sources], errorTypes: [...g.errorTypes],
    topWrongAnswers: [...g.answers].map(([answer, ids]) => ({ answer, count: ids.size,
      pct: studentCount ? Math.round(ids.size / studentCount * 100) : 0 })).sort((a, b) => b.count - a.count).slice(0, 3),
  })).filter((g) => g.totalWrong >= 2).sort((a, b) => b.totalWrong - a.totalWrong).slice(0, 30);
}

async function classMisconceptions(students, schoolId, subject) {
  const filter = { schoolId, studentId: { $in: students.map((s) => s._id) }, ...(subject ? { subject } : {}) };
  const [errors, events] = await Promise.all([
    require('../models/ErrorRecord').find(filter).lean(),
    require('../models/MasteryEvent').find({ ...filter, 'metadata.missingConcepts.0': { $exists: true } }).lean(),
  ]);
  return aggregateMisconceptions([...errors, ...events.map((e) => ({ ...e, ...e.metadata }))], students.length);
}

module.exports = { forecastClass, classMisconceptions, aggregateMisconceptions };
