// Tunable constants for all student workflow triggers.
// Adjust these values without touching business logic.

module.exports = {
  // Mastery score bands (0-100)
  MASTERY: {
    CRITICAL:   40,   // below this → serve basic concept lesson
    LOW:        60,   // below this → revision + easy practice
    MID:        75,   // below this → medium quiz; at/above → unlock next node
    HIGH:       90,   // at/above → challenge questions + award badge
  },

  // Baseline quiz
  BASELINE: {
    QUESTIONS_PER_SUBJECT: 5,   // AI generates this many MCQs for baseline
    PASSING_SCORE_PCT:     60,  // student at/above this → starts at MID tier
  },

  // Spaced repetition SM-2 intervals (days per stage 0-4)
  SR_INTERVALS: [1, 3, 7, 14, 30],

  // Engagement / low-engagement detection
  ENGAGEMENT: {
    INACTIVITY_DAYS:   3,   // no quiz attempt in this many days → swap to Foundation tier
    DIFFICULTY_THRESHOLD: 40,  // mastery < this after N attempts → alert teacher
    DIFFICULTY_ATTEMPTS:  3,   // minimum attempts before triggering teacher alert
  },

  // Badge award
  BADGE: {
    MASTERY_THRESHOLD: 90,   // score must be >= this to auto-award a mastery badge
  },

  // Learning path completion report
  COMPLETION: {
    ALL_NODES_DONE: true,    // when all path nodes are 'done', fire progress report
  },
};
