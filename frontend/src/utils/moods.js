// Moods a student can pick in their diary ("Today I feel"). Shared by the
// student diary and the teacher Health & Wellbeing page so both show the same
// names and emojis. Older entries (Happy, Neutral, Curious, Challenged, Excited)
// are all still in the list.
export const MOOD_GROUPS = [
  { label: 'Good', tone: 'good', moods: [['Happy', '😊'], ['Excited', '🎉'], ['Proud', '🤩'], ['Grateful', '🙏'], ['Calm', '😌'], ['Confident', '😎'], ['Loved', '🥰']] },
  { label: 'Okay', tone: 'okay', moods: [['Neutral', '😐'], ['Curious', '🤔'], ['Challenged', '💪'], ['Tired', '😴'], ['Bored', '🥱'], ['Confused', '😕']] },
  { label: 'Tough', tone: 'tough', moods: [['Worried', '😟'], ['Nervous', '😬'], ['Stressed', '😫'], ['Sad', '😢'], ['Lonely', '🥺'], ['Angry', '😠'], ['Sick', '🤒']] },
];

export const MOOD_OPTIONS = MOOD_GROUPS.flatMap((g) => g.moods.map(([m]) => m));
export const MOOD_EMOJIS = Object.fromEntries(MOOD_GROUPS.flatMap((g) => g.moods));
const MOOD_TONE = Object.fromEntries(MOOD_GROUPS.flatMap((g) => g.moods.map(([m]) => [m, g.tone])));

export const moodEmoji = (mood) => MOOD_EMOJIS[mood] || MOOD_EMOJIS.Neutral;
/** 'good' | 'okay' | 'tough' — lets the teacher page colour a mood at a glance. */
export const moodTone = (mood) => MOOD_TONE[mood] || 'okay';

// 0–100 score per mood, used for the teacher's Mood % (and the mood part of Behaviour).
const MOOD_SCORE = {
  Happy: 95, Excited: 95, Proud: 95, Loved: 95, Grateful: 90, Confident: 90, Calm: 85,
  Curious: 75, Neutral: 65, Challenged: 60, Tired: 50, Bored: 50, Confused: 45,
  Worried: 35, Nervous: 35, Stressed: 30, Lonely: 25, Sad: 20, Sick: 25, Angry: 20,
};
export const moodScore = (mood) => MOOD_SCORE[mood] ?? 65;
