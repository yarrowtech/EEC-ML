/**
 * Central route registry. Keeps index.js clean by grouping all app.use()
 * mounts in one place, organized by domain.
 */

const paymentWebhookController = require('../controllers/paymentWebhookController');

module.exports = function registerRoutes(app, { generalApiLimiter, authApiLimiter, aiApiLimiter, uploadApiLimiter, writeHeavyApiLimiter, adminActionLogger, requireOrganizationDomain } = {}) {
  // Razorpay webhook must receive the raw body before express.json() is applied.
  // This registration lives in index.js before body parsing, so this function
  // only mounts the HTTP-standard routes that come after body parsing.

  // ── Auth ────────────────────────────────────────────────────────────────────
  app.use('/api/admin/auth', authApiLimiter, adminActionLogger, require('./adminRoutes'));
  app.use('/api/admin/feedback', adminActionLogger, require('./adminFeedbackRoutes'));
  app.use('/api/teacher/auth', requireOrganizationDomain, authApiLimiter, require('./teacherRoute'));
  app.use('/api/staff/auth', requireOrganizationDomain, authApiLimiter, require('./staffRoutes'));
  app.use('/api/student/auth', requireOrganizationDomain, authApiLimiter, require('./studentRoute'));
  app.use('/api/parent/auth', requireOrganizationDomain, authApiLimiter, require('./parentRoute'));
  app.use('/api/principal/auth', requireOrganizationDomain, authApiLimiter, require('./principalRoutes'));
  app.use('/api/auth', authApiLimiter, require('./authRoutes'));

  // ── User management ─────────────────────────────────────────────────────────
  app.use('/api/admin/users', writeHeavyApiLimiter, adminActionLogger, require('./adminUserManagement'));
  app.use('/api/promotion', writeHeavyApiLimiter, require('./promotionRoutes'));
  app.use('/api/schools', writeHeavyApiLimiter, adminActionLogger, require('./schoolRoutes'));
  app.use('/api/school-registration', authApiLimiter, require('./schoolRegistrationRoutes'));
  app.use('/api/departments', require('./departmentRoutes'));
  // Student management + long-running bulk jobs whose status the browser polls
  // every ~1-2s. The strict `authApiLimiter` (meant for brute-force login
  // protection, shared per-IP with every /api/*/auth route) throttled a single
  // admin session's polling to 429s, which surfaced as "Unable to load admin
  // profile" toasts elsewhere. This is routine data traffic, not auth — the
  // global `/api` general limiter (applied in index.js) still covers it.
  app.use('/api/nif', require('./nifStudentRoutes'));

  // ── Academic ─────────────────────────────────────────────────────────────────
  app.use('/api/teacher/dashboard', requireOrganizationDomain, require('./teacherDashboardRoutes'));
  app.use('/api/principal', requireOrganizationDomain, require('./principalDashboardRoutes'));
  app.use('/api/attendance', require('./attendanceRoutes'));
  app.use('/api/academic', writeHeavyApiLimiter, require('./academicRoutes'));
  app.use('/api/subject', require('./subjectRoute'));
  app.use('/api/exam', require('./examRoute'));
  app.use('/api/assignment', require('./assignmentRoute'));
  app.use('/api/behaviour', require('./behaviourRoute'));
  app.use('/api/progress', require('./progressRoute'));
  app.use('/api/timetable', writeHeavyApiLimiter, require('./timetableRoutes'));
  app.use('/api/holidays', require('./holidayRoutes'));
  app.use('/api/lesson-plans', writeHeavyApiLimiter, require('./lessonPlanRoutes'));
  app.use('/api/observations', require('./studentObservationRoutes'));
  app.use('/api/rubrics', require('./rubricRoutes'));
  app.use('/api/mock-exam', require('./mockExamRoutes'));
  app.use('/api/curriculum-map', require('./curriculumMapRoutes'));
  app.use('/api/teacher-allocations', writeHeavyApiLimiter, require('./teacherAllocationRoutes'));
  app.use('/api/teacher-analytics', require('./teacherAnalyticsRoutes'));
  app.use('/api/excuse-letters', require('./excuseLetterRoutes'));
  app.use('/api/meeting', require('./meetingRoute'));

  // ── Student portal ───────────────────────────────────────────────────────────
  app.use('/api/student/materials', require('./studentMaterialRoutes'));
  app.use('/api/student', require('./student'));
  app.use('/api/student-dashboard', require('./studentDashboardRoutes'));
  app.use('/api/parent-dashboard', require('./parentDashboardRoutes'));
  app.use('/api/alcove', require('./alcoveRoute'));

  // ── AI / Learning ────────────────────────────────────────────────────────────
  app.use('/api/ai-learning', aiApiLimiter, require('./aiLearningRoute'));
  app.use('/api/student-ai-learning', aiApiLimiter, require('./studentAILearningRoute'));
  app.use('/api/learning-paths', writeHeavyApiLimiter, require('./learningPathRoutes'));
  app.use('/api/ai-tutor', aiApiLimiter, require('./aiTutorRoutes'));
  app.use('/api/ai-teacher', aiApiLimiter, require('./aiTeacherRoutes'));
  app.use('/api/spaced-repetition', require('./spacedRepetitionRoutes'));
  app.use('/api/mastery', require('./masteryRoutes'));
  app.use('/api/recommendations', require('./recommendationRoutes'));
  app.use('/api/engagement', require('./engagementRoutes'));
  app.use('/api/ml', require('./mlRoutes'));
  app.use('/api/practice', require('./practiceRoutes'));
  app.use('/api/practice-papers', writeHeavyApiLimiter, require('./practicePaperRoutes'));
  app.use('/api/practice-sections', writeHeavyApiLimiter, require('./practiceSectionRoutes'));
  app.use('/api/teaching-materials', uploadApiLimiter, require('./teachingMaterialRoutes'));
  app.use('/api/reading-assessment', require('./readingAssessmentRoutes'));
  app.use('/api/writing-assessment', require('./writingAssessmentRoutes'));
  app.use('/api/external-resources', require('./externalResourceRoutes'));
  app.use('/api/achievements', require('./achievementRoutes'));

  // ── Finance ──────────────────────────────────────────────────────────────────
  app.use('/api/fees', require('./feeRoutes'));
  app.use('/api/settings/payment', writeHeavyApiLimiter, adminActionLogger, require('./paymentSettingsRoutes'));

  // ── Comms / Notifications ────────────────────────────────────────────────────
  app.use('/api/chat', require('./chatRoutes'));
  app.use('/api/notifications', require('./notificationRoutes'));
  app.use('/api/feedback', require('./feedbackRoute'));
  app.use('/api/wellbeing', writeHeavyApiLimiter, require('./wellbeingRoute'));

  // ── Reporting / Audit ────────────────────────────────────────────────────────
  app.use('/api/reports', writeHeavyApiLimiter, require('./reportRoutes'));
  app.use('/api/audit-logs', require('./auditLogRoutes'));
  app.use('/api/admin-analytics', require('./adminAnalyticsRoutes'));
  app.use('/api/baseline', require('./baselineRoutes'));

  // ── Platform admin ───────────────────────────────────────────────────────────
  app.use('/api/super-admin', writeHeavyApiLimiter, adminActionLogger, require('./superAdminRoutes'));
  app.use('/api/support', writeHeavyApiLimiter, adminActionLogger, require('./supportRoutes'));
  app.use('/api/issues', writeHeavyApiLimiter, adminActionLogger, require('./issueRoutes'));

  // ── Uploads / Organization ───────────────────────────────────────────────────
  app.use('/api/uploads', uploadApiLimiter, require('./uploadRoutes'));
  app.use('/api', require('./organizationRoutes'));
};
