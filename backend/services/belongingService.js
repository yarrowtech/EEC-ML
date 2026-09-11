/**
 * belongingService.js
 * Social / belonging dimension: measures a student's participation in the
 * peer community (Alcove — the problem-sharing board), as a proxy for social
 * connectedness that pure academic engagement metrics (time-on-material,
 * quiz attempts) can't see. A student who is behaviourally engaged but never
 * posts, comments, or reacts may still be socially isolated from classmates.
 *
 * Posts/comments are counted within the lookback window; likes are not
 * timestamped per-entry on AlcovePost.likedBy, so like counts reflect
 * all-time community standing rather than a rolling window.
 */
const WEIGHTS = { posts: 0.35, comments: 0.25, likesGiven: 0.15, likesReceived: 0.25 };

function bandFromScore(score) {
  if (score < 20) return 'isolated';
  if (score < 40) return 'low';
  if (score < 70) return 'moderate';
  return 'active';
}

async function computeStudentBelongingScore({ schoolId, studentId, sinceDays = 30 }) {
  const AlcovePost = require('../models/AlcovePost');
  const AlcoveComment = require('../models/AlcoveComment');
  const since = new Date(Date.now() - sinceDays * 86400000);
  const actorKey = `student:${String(studentId)}`;

  const [postsAuthored, commentsAuthored, ownPosts, likesGivenCount] = await Promise.all([
    AlcovePost.countDocuments({ schoolId, authorUserId: String(studentId), isStudentPosted: true, createdAt: { $gte: since } }),
    AlcoveComment.countDocuments({ schoolId, authorId: String(studentId), authorType: 'student', createdAt: { $gte: since } }),
    AlcovePost.find({ schoolId, authorUserId: String(studentId), isStudentPosted: true }).select('likedBy').lean(),
    AlcovePost.countDocuments({ schoolId, likedBy: actorKey }),
  ]);

  const likesReceived = ownPosts.reduce((sum, p) => sum + (Array.isArray(p.likedBy) ? p.likedBy.length : 0), 0);

  const postsScore = Math.min(100, postsAuthored * 20) * WEIGHTS.posts;
  const commentsScore = Math.min(100, commentsAuthored * 10) * WEIGHTS.comments;
  const givenScore = Math.min(100, likesGivenCount * 5) * WEIGHTS.likesGiven;
  const receivedScore = Math.min(100, likesReceived * 10) * WEIGHTS.likesReceived;
  const belongingScore = Math.round(postsScore + commentsScore + givenScore + receivedScore);

  return {
    belongingScore,
    band: bandFromScore(belongingScore),
    postsAuthored, commentsAuthored, likesGiven: likesGivenCount, likesReceived,
    sinceDays,
  };
}

// Teacher-facing view: students ranked lowest-first so socially disengaged
// students (no posts/comments/reactions) surface at the top.
async function getClassBelongingSummary({ schoolId, studentIds, sinceDays = 30 }) {
  const results = await Promise.allSettled(
    studentIds.map(async (studentId) => ({
      studentId,
      ...(await computeStudentBelongingScore({ schoolId, studentId, sinceDays })),
    }))
  );
  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => a.belongingScore - b.belongingScore);
}

module.exports = { computeStudentBelongingScore, getClassBelongingSummary, bandFromScore };
