/**
 * recommendationEngine.js
 * Recommends the next topic a student should study, based on:
 *   1. Current mastery scores per topic in the curriculum map
 *   2. CurriculumMap ordering (next unmastered topic in sequence)
 *   3. Gap detection results (prioritise root-cause gaps)
 *   4. Spaced repetition due dates (surface overdue reviews)
 *
 * Returns an explainable recommendation the student can accept or skip.
 */

const MASTERY_TARGET = 75; // topics below this are "not yet mastered"

/**
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.schoolId
 * @param {string} params.subject
 * @param {string} [params.className]
 * @returns {Promise<{ recommendation: object|null }>}
 */
async function recommendNextTopic({ studentId, schoolId, subject, className }) {
  const MasteryScore              = require('../models/MasteryScore');
  const CurriculumMap             = require('../models/CurriculumMap');
  const SpacedRepetitionSchedule  = require('../models/SpacedRepetitionSchedule');
  const StudentInsight            = require('../models/StudentInsight');

  const [masteryDocs, map, dueReviews, latestGap] = await Promise.all([
    MasteryScore.find({ studentId, schoolId, subject }).lean(),
    CurriculumMap.findOne({
      schoolId,
      subject,
      ...(className ? { className } : {}),
    }).lean(),
    SpacedRepetitionSchedule.find({
      studentId, schoolId, subject,
      nextReviewDate: { $lte: new Date() },
    }).sort({ nextReviewDate: 1 }).limit(3).lean(),
    StudentInsight.findOne({
      studentId, schoolId,
      insightType: 'gap_detection',
      subject,
    }).sort({ generatedAt: -1 }).lean(),
  ]);

  const masteryByTitle = new Map(
    masteryDocs.map((d) => [d.topicTitle.toLowerCase().trim(), d.score])
  );

  // Priority 1: Spaced repetition — overdue review
  if (dueReviews.length) {
    const due = dueReviews[0];
    return {
      recommendation: {
        type: 'spaced_repetition',
        topicTitle: due.topicTitle,
        chapterTitle: due.chapterTitle,
        subject,
        reason: `You haven't reviewed "${due.topicTitle}" in a while. Quick review to keep it fresh!`,
        score: due.lastScore ?? null,
        action: 'review',
        explainability: `Your last review was ${_daysSince(due.lastReviewedAt)} days ago. Spaced repetition says it's time.`,
      },
    };
  }

  // Priority 2: Root-cause prerequisite gap from gap detection
  if (latestGap?.payload?.rootCauses?.length) {
    const rootCause = latestGap.payload.rootCauses[0];
    return {
      recommendation: {
        type: 'gap_fill',
        topicTitle: rootCause.topicTitle,
        chapterTitle: '',
        subject,
        reason: `You need to strengthen "${rootCause.topicTitle}" first — it's blocking ${rootCause.blockedTopics?.slice(0, 2).join(' and ')}.`,
        score: rootCause.masteryScore ?? null,
        action: 'learn',
        explainability: `Gap detection found this topic as a prerequisite gap. Fixing it unblocks ${rootCause.blockedTopics?.length ?? 0} later topics.`,
      },
    };
  }

  // Priority 3: Next unmastered topic in curriculum sequence
  if (map?.topics?.length) {
    const sorted = [...map.topics].sort((a, b) => a.order - b.order);
    for (const topic of sorted) {
      const score = masteryByTitle.get(topic.title.toLowerCase().trim());
      if (score == null || score < MASTERY_TARGET) {
        return {
          recommendation: {
            type: 'next_in_sequence',
            topicTitle: topic.title,
            chapterTitle: '',
            subject,
            reason: score == null
              ? `"${topic.title}" is next in the curriculum and you haven't started it yet.`
              : `Your score in "${topic.title}" is ${score}% — a bit more practice will push you past the mastery target.`,
            score: score ?? null,
            action: score == null ? 'learn' : 'practice',
            explainability: `Based on the curriculum map for ${subject}, "${topic.title}" is the next topic in sequence (order ${topic.order}).`,
          },
        };
      }
    }

    // All topics mastered — recommend the weakest one for revision
    const weakest = masteryDocs
      .filter((d) => d.topicTitle)
      .sort((a, b) => a.score - b.score)[0];
    if (weakest) {
      return {
        recommendation: {
          type: 'revision',
          topicTitle: weakest.topicTitle,
          chapterTitle: weakest.chapterTitle,
          subject,
          reason: `All topics are above the mastery target. "${weakest.topicTitle}" has the lowest score — great for revision.`,
          score: weakest.score,
          action: 'review',
          explainability: `You've mastered all topics in this subject. Revising the weakest one keeps knowledge sharp.`,
        },
      };
    }
  }

  return { recommendation: null };
}

/**
 * Batch recommendations across all subjects for a student.
 */
async function recommendAcrossSubjects({ studentId, schoolId }) {
  const MasteryScore = require('../models/MasteryScore');
  const subjects = await MasteryScore.distinct('subject', { studentId, schoolId });
  const results = await Promise.allSettled(
    subjects.map((subject) => recommendNextTopic({ studentId, schoolId, subject }))
  );
  return results
    .filter((r) => r.status === 'fulfilled' && r.value.recommendation)
    .map((r) => r.value.recommendation);
}

function _daysSince(date) {
  if (!date) return '?';
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

module.exports = { recommendNextTopic, recommendAcrossSubjects };
