const { dispatchTeacherFeedbackReminders } = require('./teacherFeedbackNotify');

const DEFAULT_INTERVAL_MS = Number(process.env.TEACHER_FEEDBACK_REMINDER_CHECK_INTERVAL_MS || 60 * 60 * 1000); // hourly: timely auto-close + reminders

const startTeacherFeedbackReminderScheduler = () => {
  const runOnce = async () => {
    try {
      const stats = await dispatchTeacherFeedbackReminders();
      console.log(`[teacher-feedback-reminder] scanned=${stats.scanned}, created=${stats.created}, autoClosed=${stats.autoClosed || 0}`);
    } catch (err) {
      console.error(`[teacher-feedback-reminder] failed: ${err.message}`);
    }
  };

  runOnce();

  const intervalMs = Number.isFinite(DEFAULT_INTERVAL_MS) && DEFAULT_INTERVAL_MS > 0
    ? DEFAULT_INTERVAL_MS
    : 6 * 60 * 60 * 1000;

  const timer = setInterval(runOnce, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  console.log(`[teacher-feedback-reminder] scheduler started. intervalMs=${intervalMs}`);
};

module.exports = {
  startTeacherFeedbackReminderScheduler,
};
