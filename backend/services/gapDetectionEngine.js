/**
 * gapDetectionEngine.js
 * Traverses the curriculum map to find root-cause knowledge gaps.
 *
 * Algorithm:
 *  1. Load the student's mastery scores for the given subject.
 *  2. Load the CurriculumMap for the subject/class.
 *  3. For each topic with a low mastery score (< GAP_THRESHOLD), walk backwards
 *     through the ordered topic list — any earlier topic the student has not mastered
 *     is a prerequisite gap and the likely root cause.
 *  4. Produce a ranked list of root-cause topics and generate student insights.
 *  5. Notify the teacher when a student has 2+ root-cause gaps.
 */

const GAP_THRESHOLD   = 60; // mastery score below this is a gap
const NOTIFY_MIN_GAPS = 2;  // notify teacher only when this many root-cause gaps detected

async function detectGaps({ studentId, schoolId, subject, className }) {
  const MasteryScore   = require('../models/MasteryScore');
  const CurriculumMap  = require('../models/CurriculumMap');

  // Fetch all mastery scores for this student + subject
  const masteryDocs = await MasteryScore.find({ studentId, subject }).lean();
  const masteryByTitle = new Map(
    masteryDocs.map((d) => [d.topicTitle.toLowerCase().trim(), d.score])
  );

  // Load the curriculum map (class-level, ignore section for gap detection)
  const map = await CurriculumMap.findOne({
    schoolId,
    subject,
    ...(className ? { className } : {}),
  }).lean();

  if (!map || !map.topics?.length) return { gaps: [], rootCauses: [] };

  const sorted = [...map.topics].sort((a, b) => a.order - b.order);

  // Find weak topics (low mastery or never attempted)
  const weakTopics = sorted.filter((t) => {
    const score = masteryByTitle.get(t.title.toLowerCase().trim());
    return score == null || score < GAP_THRESHOLD;
  });

  // For each weak topic, find earlier topics that are also not mastered — root causes
  const rootCauseSet = new Set();
  const rootCauses   = [];

  for (const weak of weakTopics) {
    const prereqs = sorted.filter((t) => t.order < weak.order);
    for (const prereq of prereqs) {
      const score = masteryByTitle.get(prereq.title.toLowerCase().trim());
      if ((score == null || score < GAP_THRESHOLD) && !rootCauseSet.has(prereq.title)) {
        rootCauseSet.add(prereq.title);
        rootCauses.push({
          topicTitle:   prereq.title,
          order:        prereq.order,
          masteryScore: score ?? null,
          blockedTopics: weakTopics
            .filter((w) => w.order > prereq.order)
            .map((w) => w.title),
        });
      }
    }
  }

  return {
    gaps: weakTopics.map((t) => ({
      topicTitle:   t.title,
      order:        t.order,
      masteryScore: masteryByTitle.get(t.title.toLowerCase().trim()) ?? null,
    })),
    rootCauses: rootCauses.sort((a, b) => a.order - b.order),
  };
}

/**
 * Run gap detection after a mastery update and notify the teacher if warranted.
 * Called non-blocking from masteryEngine.runWorkflowTriggers.
 */
async function runGapDetection({ studentId, schoolId, subject, topicTitle }) {
  try {
    const StudentUser   = require('../models/StudentUser');
    const student = await StudentUser.findById(studentId).select('className grade sectionName name').lean();
    if (!student) return;

    const { gaps, rootCauses } = await detectGaps({
      studentId,
      schoolId,
      subject,
      className: student.className || student.grade || '',
    });

    if (rootCauses.length < NOTIFY_MIN_GAPS) return;

    // Store a student insight record summarising the gaps
    await storeStudentInsight({ studentId, schoolId, subject, gaps, rootCauses });

    // Notify teacher(s) who teach this subject to this student's class
    await notifyTeacher({ studentId, schoolId, subject, student, rootCauses });
  } catch (_) { /* non-critical — never throw from a side-effect */ }
}

async function storeStudentInsight({ studentId, schoolId, subject, gaps, rootCauses }) {
  try {
    const StudentInsight = require('../models/StudentInsight');
    const rootList = rootCauses.slice(0, 5).map((r) => r.topicTitle).join(', ');
    await StudentInsight.create({
      studentId,
      schoolId,
      insightType: 'gap_detection',
      subject,
      title:   `Knowledge gaps detected in ${subject}`,
      summary: `${gaps.length} weak topic(s). Root-cause prerequisites: ${rootList}.`,
      payload: { gaps, rootCauses },
    }).catch(() => {});
  } catch (_) {}
}

async function notifyTeacher({ studentId, schoolId, subject, student, rootCauses }) {
  try {
    const TeacherUser         = require('../models/TeacherUser');
    const NotificationService = require('../utils/notificationService');

    const teachers = await TeacherUser.find({
      schoolId,
      'assignedSubjects.subjectName': { $regex: new RegExp(subject, 'i') },
      'assignedSubjects.className':   { $regex: new RegExp(student.className || student.grade || '', 'i') },
    }).select('_id').lean();

    if (!teachers.length) return;

    const rootList = rootCauses.slice(0, 3).map((r) => r.topicTitle).join(', ');
    await NotificationService.createNotification({
      schoolId,
      title:    `📉 Knowledge Gap Detected: ${student.name || 'Student'} — ${subject}`,
      message:  `${student.name || 'A student'} (${student.className || ''} ${student.sectionName || ''}) has gaps in ${subject}. Root-cause topics: ${rootList}.`,
      audience: 'Specific',
      type:     'learning',
      priority: 'high',
      category: 'academic',
      targetUserIds: teachers.map((t) => t._id),
      relatedEntity: { entityType: 'gap_detection', entityId: studentId },
    });
  } catch (_) {}
}

module.exports = { detectGaps, runGapDetection };
