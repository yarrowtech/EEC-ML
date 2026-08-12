const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const { isStrongPassword } = require('../utils/passwordPolicy');
const { syncAllocationGroupThreads } = require('../utils/chatGroupProvisioning');
const { startHolidayReminderScheduler } = require('../utils/holidayNotificationScheduler');
const { startTeacherFeedbackReminderScheduler } = require('../utils/teacherFeedbackReminderScheduler');
const { sendSpacedRepetitionNudges } = require('../services/engagementScorer');

const fixChatThreadIndexes = async () => {
  const ChatThread = require('../models/ChatThread');
  try {
    const indexes = await ChatThread.collection.indexes();
    const hasLegacyGroupKeyIndex = indexes.some(
      (idx) => idx?.name === 'unique_group_thread_key' && idx?.sparse
    );
    if (hasLegacyGroupKeyIndex) {
      await ChatThread.collection.dropIndex('unique_group_thread_key');
      logger.info('[chat] dropped legacy unique_group_thread_key sparse index');
    }
    await ChatThread.collection.createIndex(
      { schoolId: 1, campusId: 1, groupKey: 1 },
      {
        unique: true,
        name: 'unique_group_thread_key',
        partialFilterExpression: {
          threadType: 'group',
          groupKey: { $exists: true, $type: 'string', $ne: '' },
        },
      }
    );
  } catch (err) {
    logger.error({ err }, '[chat] failed to ensure chat thread indexes');
  }
};

const ensureAdminRoles = async () => {
  const Admin = require('../models/Admin');
  try {
    await Admin.updateMany(
      { role: { $exists: false }, schoolId: { $ne: null } },
      { $set: { role: 'admin' } }
    );
    await Admin.updateMany(
      { role: { $exists: false }, schoolId: null },
      { $set: { role: 'super_admin' } }
    );
  } catch (err) {
    logger.error({ err }, 'Failed to backfill admin roles');
  }
};

const seedSuperAdmin = async () => {
  const Admin = require('../models/Admin');
  const username = process.env.SUPER_ADMIN_USERNAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';
  if (!username || !password) return;
  if (!isStrongPassword(password)) {
    logger.warn('Super admin seed password does not meet policy requirements.');
    return;
  }
  const normalizedUsername = String(username).trim();
  if (!normalizedUsername) return;
  try {
    const existing = await Admin.findOne({ username: normalizedUsername });
    if (existing) {
      if (process.env.RESET_SUPER_ADMIN_PASSWORD === 'true') {
        existing.password = password;
      }
      existing.name = name;
      existing.role = 'super_admin';
      existing.schoolId = null;
      await existing.save();
      logger.info(`Updated super admin user: ${normalizedUsername}`);
      return;
    }
    const admin = new Admin({ username: normalizedUsername, password, name, role: 'super_admin', schoolId: null });
    await admin.save();
    logger.info(`Seeded super admin user: ${normalizedUsername}`);
  } catch (err) {
    logger.error({ err }, 'Failed to seed super admin user');
  }
};

const seedPrincipal = async () => {
  const Principal = require('../models/Principal');
  const principalEmail = process.env.PRINCIPAL_EMAIL;
  const principalPassword = process.env.PRINCIPAL_PASSWORD;
  const principalSchoolId = process.env.PRINCIPAL_SCHOOL_ID;
  if (!principalEmail || !principalPassword) return;
  const resolvedSchoolId =
    principalSchoolId && mongoose.isValidObjectId(principalSchoolId) ? principalSchoolId : null;
  if (!isStrongPassword(principalPassword)) {
    logger.warn('Principal seed password does not meet policy requirements.');
    return;
  }
  const normalizedEmail = String(principalEmail).trim().toLowerCase();
  try {
    const existing = await Principal.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedEmail }],
    });
    if (existing) {
      existing.email = normalizedEmail;
      existing.username = normalizedEmail;
      existing.password = principalPassword;
      if (resolvedSchoolId) existing.schoolId = resolvedSchoolId;
      await existing.save();
      logger.info(`Updated principal user: ${normalizedEmail}`);
      return;
    }
    const fallback = await Principal.findOne({});
    if (fallback) {
      fallback.email = normalizedEmail;
      fallback.username = normalizedEmail;
      fallback.password = principalPassword;
      if (resolvedSchoolId) fallback.schoolId = resolvedSchoolId;
      await fallback.save();
      logger.info(`Reassigned principal user to: ${normalizedEmail}`);
      return;
    }
    const principal = new Principal({
      username: normalizedEmail,
      email: normalizedEmail,
      password: principalPassword,
      name: 'Principal',
      schoolId: resolvedSchoolId,
    });
    await principal.save();
    logger.info(`Seeded principal user: ${normalizedEmail}`);
  } catch (err) {
    logger.error({ err }, 'Failed to seed principal user');
  }
};

const startSchedulers = () => {
  startHolidayReminderScheduler();
  startTeacherFeedbackReminderScheduler();
  if (process.env.NODE_ENV !== 'test') {
    const { startSchedulers: startSpacedRepSchedulers } = require('../schedulers/spacedRepetitionCron');
    startSpacedRepSchedulers();
  }
  const runSpacedRepNudges = () => {
    sendSpacedRepetitionNudges(null).catch((err) =>
      logger.error({ err }, '[spaced-rep] nudge scheduler error')
    );
  };
  runSpacedRepNudges();
  setInterval(runSpacedRepNudges, 24 * 60 * 60 * 1000);
};

const connectDatabase = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  logger.info('MongoDB Connected');
  await fixChatThreadIndexes();
  await ensureAdminRoles();
  await seedSuperAdmin();
  await seedPrincipal();
  startSchedulers();
  try {
    const stats = await syncAllocationGroupThreads();
    logger.info(`[chat] allocation group sync complete: ${stats.createdOrUpdated}/${stats.scanned}`);
  } catch (err) {
    logger.error({ err }, '[chat] allocation group sync failed');
  }
};

module.exports = { connectDatabase };
