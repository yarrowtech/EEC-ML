const WeeklyStudyPlan = require('../models/WeeklyStudyPlan');
const MasteryScore = require('../models/MasteryScore');
const { recommendAcrossSubjects } = require('./recommendationEngine');

function startOfWeek(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  return value;
}

async function generateWeeklyStudyPlan({ studentId, schoolId, weekStart = startOfWeek() }) {
  const start = startOfWeek(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const [scores, recommendations] = await Promise.all([
    MasteryScore.find({ studentId, schoolId }).sort({ score: 1 }).limit(12).lean(),
    recommendAcrossSubjects({ studentId, schoolId }),
  ]);
  const tasks = [];
  const seen = new Set();
  const addTask = (item, day, action, reason) => {
    const key = `${item.subject}:${item.topicTitle}`.toLowerCase();
    if (!item.subject || !item.topicTitle || seen.has(key) || tasks.length >= 7) return;
    seen.add(key);
    tasks.push({ day, subject: item.subject, topicTitle: item.topicTitle, action, reason });
  };
  recommendations.slice(0, 3).forEach((item, index) => addTask(item, index + 1, item.action === 'review' ? 'review' : 'practice', item.reason || 'Recommended from current progress.'));
  scores.filter((item) => item.score < 60).slice(0, 3).forEach((item, index) => addTask(item, index + 4, 'learn', `Mastery is ${item.score}%. Strengthen this topic with a focused lesson.`));
  scores.filter((item) => item.score >= 60 && item.score < 75).slice(0, 2).forEach((item, index) => addTask(item, index + 6, 'practice', `Mastery is ${item.score}%. Practise to reach the mastery target.`));
  return WeeklyStudyPlan.findOneAndUpdate(
    { studentId, schoolId, weekStart: start },
    { $set: { weekEnd: end, tasks, status: 'active', generatedFrom: ['mastery', 'gaps', 'recommendations'] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

module.exports = { generateWeeklyStudyPlan, startOfWeek };
