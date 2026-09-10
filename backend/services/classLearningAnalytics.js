const { forecastScores, summarizeEvidence } = require('./learningEvidenceService');
const DAY = 86400000;

async function forecastClass(students, schoolId) {
  const events = await require('../models/MasteryEvent').find({ schoolId, studentId: { $in: students.map((s) => s._id) },
    createdAt: { $gte: new Date(Date.now() - 31 * DAY) } }).lean();
  return students.map((student) => {
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
    return { studentId: student._id, name: student.name, roll: student.roll, grade: student.grade, section: student.section,
      forecastLevel: signals.some((s) => s.severity === 'critical') ? 'critical' : signals.length ? 'high' :
        estimate.status === 'insufficient_data' ? 'insufficient_data' : 'low',
      estimate, signals, attPct7d, avgScore7d: risk.recentAvg, totalAttPct: null, examCount7d: risk.sampleCount };
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
