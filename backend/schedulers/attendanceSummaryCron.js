/**
 * Attendance Summary Cron
 * Runs daily at 00:30 — refreshes every active student's stored academic-year
 * attendance (StudentUser.attendanceSummary). School days grow each day even
 * when no attendance is marked, so the stored percentage must be re-derived
 * daily; reads also refresh lazily via summarizeStudentAttendance().
 */

const cron = require('node-cron');
const logger = require('../utils/logger');

async function refreshAllAttendanceSummaries() {
  const StudentUser = require('../models/StudentUser');
  const { summarizeStudentAttendance } = require('../utils/sessionAttendance');
  const schoolIds = await StudentUser.distinct('schoolId', { status: 'Active', schoolId: { $ne: null } });
  let refreshed = 0;
  for (const schoolId of schoolIds) {
    try {
      // eslint-disable-next-line no-await-in-loop -- one school at a time keeps memory flat
      const students = await StudentUser.find({ schoolId, status: 'Active' })
        .select('_id schoolId attendance attendanceSummary')
        .lean();
      // eslint-disable-next-line no-await-in-loop
      const summaries = await summarizeStudentAttendance(students, { schoolId, awaitWrite: true });
      refreshed += summaries.size;
    } catch (err) {
      logger.error({ err, schoolId: String(schoolId) }, '[attendance-summary cron] school failed');
    }
  }
  logger.info({ refreshed, schools: schoolIds.length }, '[attendance-summary cron] done');
  return refreshed;
}

function startAttendanceSummaryScheduler() {
  cron.schedule('30 0 * * *', () => {
    refreshAllAttendanceSummaries().catch((err) => logger.error({ err }, '[attendance-summary cron] error'));
  });
}

module.exports = { refreshAllAttendanceSummaries, startAttendanceSummaryScheduler };
