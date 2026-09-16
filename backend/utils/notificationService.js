const Notification = require('../models/Notification');

class NotificationService {
  /**
   * Create a notification with consistent structure
   */
  static async createNotification({
    schoolId,
    campusId = null,
    title,
    message,
    audience = 'All',
    type = 'general',
    typeLabel = '',
    priority = 'medium',
    category = 'general',
    targetUserIds = [],
    classId = null,
    sectionId = null,
    submissionId = null,
    createdBy = null,
    relatedEntity = null,
    expiresAt = null,
    kind = 'notification',
    eventType = '',
    targetRole = ''
  }) {
    try {
      const notification = await Notification.create({
        schoolId,
        campusId,
        title,
        message,
        audience,
        targetUserIds: Array.isArray(targetUserIds) ? targetUserIds : [],
        type,
        typeLabel,
        priority,
        category,
        classId,
        sectionId,
        submissionId,
        createdBy,
        relatedEntity: relatedEntity ? {
          entityType: relatedEntity.entityType,
          entityId: relatedEntity.entityId
        } : undefined,
        expiresAt,
        kind,
        eventType,
        targetRole
      });

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Create assignment notification
   */
  static async notifyAssignmentCreated({ schoolId, campusId, assignment, createdBy }) {
    // Only that class/section's students — never the whole school — and only
    // once per assignment however many times it is saved or re-activated.
    const { EVENTS, notify } = require('../services/communicationService');
    let classId = assignment?.classId || null;
    if (!classId && assignment?.class) {
      const ClassModel = require('../models/Class');
      const cls = await ClassModel.findOne({ schoolId, name: assignment.class }).select('_id').lean();
      classId = cls?._id || null;
    }
    if (!classId) return { created: 0, skipped: 0 };
    let sectionId = assignment?.sectionId || null;
    if (!sectionId && assignment?.section) {
      const Section = require('../models/Section');
      const sec = await Section.findOne({ schoolId, classId, name: assignment.section }).select('_id').lean();
      sectionId = sec?._id || null;
    }
    const due = assignment.dueDate ? ` Due: ${new Date(assignment.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.` : '';
    return notify({
      schoolId, campusId, createdBy,
      eventType: EVENTS.ASSIGNMENT_CREATED,
      entityType: 'assignment', entityId: assignment._id,
      category: 'academic', priority: 'medium',
      target: { classSections: [{ classId, sectionId }], includeParents: false },
      data: { id: String(assignment._id) },
      student: () => ({
        title: `New Assignment: ${assignment.title}`,
        message: `A new ${assignment.subject || ''} assignment "${assignment.title}" has been posted for your class.${due}`.replace(/s+/g, ' '),
      }),
    });
  }

  /**
   * Notify the assignment owner when a student submits work.
   * The notification is targeted to that teacher so it cannot appear in
   * another teacher's portal or as a generic school-wide notification.
   */
  static async notifyAssignmentSubmitted({ schoolId, campusId, assignment, student, submissionId = null }) {
    const studentName = student?.name || 'A student';
    const assignmentLabel = assignment?.title || 'an assignment';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `New submission: ${assignmentLabel}`,
      message: `${studentName} submitted ${assignmentLabel}. Open Evaluate Submissions to review it.`,
      audience: 'Teacher',
      type: 'assignment',
      typeLabel: 'assignment_submission',
      priority: 'high',
      category: 'academic',
      targetUserIds: assignment?.teacherId ? [assignment.teacherId] : [],
      classId: assignment?.classId || null,
      sectionId: assignment?.sectionId || null,
      submissionId,
      relatedEntity: {
        entityType: 'assignment',
        entityId: assignment?._id,
      },
    });
  }

  /**
   * Create exam notification
   */
  static async notifyExamScheduled({ schoolId, campusId, exam, createdBy }) {
    const examDate = exam.date ? new Date(exam.date).toLocaleDateString() : 'TBA';
    const examTime = exam.time || '';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `Exam Scheduled: ${exam.title}`,
      message: `${exam.subject} exam has been scheduled for ${examDate} ${examTime}. Venue: ${exam.venue || 'TBA'}`,
      audience: 'All',
      type: 'exam',
      typeLabel: 'exam_scheduled',
      priority: 'high',
      category: 'academic',
      createdBy,
      relatedEntity: {
        entityType: 'exam',
        entityId: exam._id
      }
    });
  }

  /**
   * Create the "exam scheduled" heads-up notice fired the moment an exam
   * group is created for a class/section — before any subjects are added —
   * distinct from notifyExamRoutinePublished, which fires later once the
   * admin publishes the full subject-wise routine.
   */
  static async notifyExamGroupCreated({ schoolId, campusId = null, group, createdBy = null }) {
    const className = group.classId?.name || group.grade || '';
    const sectionName = group.sectionId?.name || group.section || '';
    const scopeLabel = [
      className && (/^class\b/i.test(String(className).trim()) ? String(className).trim() : `Class ${className}`),
      sectionName && `Section ${sectionName}`,
    ].filter(Boolean).join(', ');
    const dateRange = group.startDate
      ? ` starting from ${group.startDate}${group.endDate && group.endDate !== group.startDate ? ` to ${group.endDate}` : ''}`
      : '';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `Exam Scheduled: ${group.title}`,
      message: `${group.title}${scopeLabel ? ` for ${scopeLabel}` : ''} has been scheduled${dateRange}.`,
      audience: 'All',
      // Teachers get one consolidated notice per exam title instead of this
      // per-class copy (see upsertTeacherExamScheduledNotice in
      // examRoute.js) — this typeLabel lets the /user notifications query
      // skip it for teachers so they don't see it once per class/section.
      typeLabel: 'exam_scheduled_class',
      kind: 'notice',
      eventType: 'EXAM_CREATED',
      targetRole: 'all',
      type: 'exam',
      priority: 'medium',
      category: 'academic',
      classId: group.classId?._id || group.classId || null,
      sectionId: group.sectionId?._id || group.sectionId || null,
      createdBy,
      relatedEntity: { entityType: 'exam', entityId: group._id },
    });
  }

  /**
   * Create (or update, on republish) the consolidated exam-routine notice for
   * a published exam group — one notice with the full subject-wise schedule
   * table and the routine PDF attached, instead of a notice per subject.
   */
  static async notifyExamRoutinePublished({
    schoolId,
    campusId = null,
    group,
    examRoutine = [],
    attachment = null,
    createdBy = null,
    existingNoticeId = null,
  }) {
    const className = group.classId?.name || group.grade || '';
    const sectionName = group.sectionId?.name || group.section || '';
    const scopeLabel = [
      className && (/^class\b/i.test(String(className).trim()) ? String(className).trim() : `Class ${className}`),
      sectionName && `Section ${sectionName}`,
    ].filter(Boolean).join(', ');
    const subjectCount = examRoutine.length;
    const dateRange = group.startDate
      ? ` from ${group.startDate}${group.endDate && group.endDate !== group.startDate ? ` to ${group.endDate}` : ''}`
      : '';

    const fields = {
      schoolId,
      campusId,
      title: `Exam Routine Published: ${group.title}`,
      message: `The exam routine for ${group.title}${scopeLabel ? ` (${scopeLabel})` : ''} has been published. ${subjectCount} subject exam${subjectCount !== 1 ? 's' : ''} scheduled${dateRange}. See the full schedule below.`,
      audience: 'All',
      // Teachers get their own consolidated notice instead (one per exam
      // title covering every class, see upsertTeacherRoutinePublishedNotice
      // in examRoute.js) — this typeLabel lets the /user notifications query
      // skip this per-class copy for teachers so they don't see it twice.
      typeLabel: 'exam_routine_published_class',
      kind: 'notice',
      eventType: 'EXAM_ROUTINE_PUBLISHED',
      targetRole: 'all',
      type: 'exam',
      priority: 'high',
      category: 'academic',
      classId: group.classId?._id || group.classId || null,
      sectionId: group.sectionId?._id || group.sectionId || null,
      className,
      sectionName,
      createdBy,
      relatedEntity: { entityType: 'exam', entityId: group.firstExamId || group._id },
      examRoutine,
      attachments: attachment ? [attachment] : [],
    };

    if (existingNoticeId) {
      const updated = await Notification.findByIdAndUpdate(existingNoticeId, fields, { new: true });
      if (updated) return updated;
    }
    return await Notification.create(fields);
  }

  /**
   * Create fee reminder notification
   */
  static async notifyFeeReminder({ schoolId, campusId, invoice, createdBy }) {
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'soon';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `Fee Reminder: ${invoice.title || 'Fee Payment'}`,
      message: `Fee payment of Rs. ${invoice.balanceAmount || invoice.totalAmount} is due ${dueDate}. Please pay on time to avoid late fees.`,
      audience: 'Student',
      type: 'fee',
      typeLabel: 'fee_reminder',
      priority: 'high',
      category: 'general',
      createdBy,
      relatedEntity: {
        entityType: 'fee',
        entityId: invoice._id
      }
    });
  }

  /**
   * One class/section-wide notice (students, parents and staff of that
   * class via audience 'All' + classId/sectionId). `dedupeKey` makes it an
   * upsert: the same event for the same class/section updates the existing
   * notice (e.g. adding subjects, re-publishing) instead of creating another.
   */
  static async upsertClassNotice({ dedupeKey, fields }) {
    // Create via Notification.create so the model's post-save hook fires the
    // web push + realtime event for a new notice; an existing one is updated
    // quietly (no second push for the same event).
    const existing = await Notification.findOne({ dedupeKey }).select('_id').lean();
    if (existing) {
      return Notification.findByIdAndUpdate(existing._id, { $set: fields }, { new: true });
    }
    try {
      return await Notification.create({ ...fields, dedupeKey });
    } catch (err) {
      if (err?.code === 11000) { // created concurrently — update that one instead
        return Notification.findOneAndUpdate({ dedupeKey }, { $set: fields }, { new: true });
      }
      throw err;
    }
  }

  /**
   * "Exam scheduled" notice for an exam created outside an exam group —
   * one per class/section/exam title, listing its subjects, instead of one
   * per subject per teacher.
   */
  static async notifyClassExamScheduled({ schoolId, campusId = null, exam, subjects = [], createdBy = null }) {
    require('../services/examCommunication')
      .notifyExamCreated({ schoolId, campusId, entity: exam, entityType: 'exam', subjects, createdBy })
      .catch((err) => console.error('Failed to send exam-created notifications:', err.message));
    const className = exam.classId?.name || exam.grade || '';
    const sectionName = exam.sectionId?.name || exam.section || '';
    const title = String(exam.title || 'Exam').trim();
    const scope = [className && (/^class\b/i.test(String(className).trim()) ? String(className).trim() : `Class ${className}`), sectionName && `Section ${sectionName}`].filter(Boolean).join(', ');
    const subjectText = subjects.length ? ` Subjects: ${subjects.join(', ')}.` : '';
    return this.upsertClassNotice({
      dedupeKey: `exam-scheduled:${schoolId}:${campusId || 'x'}:${exam.classId?._id || exam.classId}:${exam.sectionId?._id || exam.sectionId}:${title.toLowerCase()}`,
      fields: {
        schoolId,
        campusId,
        title: `Exam Scheduled: ${title}`,
        message: `${title}${scope ? ` for ${scope}` : ''} has been scheduled.${subjectText}`,
        audience: 'All',
        type: 'exam',
        typeLabel: 'exam_scheduled_class',
        kind: 'notice',
        eventType: 'EXAM_CREATED',
        targetRole: 'all',
        priority: 'medium',
        category: 'exam',
        classId: exam.classId?._id || exam.classId || null,
        sectionId: exam.sectionId?._id || exam.sectionId || null,
        className,
        sectionName,
        createdBy,
        relatedEntity: { entityType: 'exam', entityId: exam._id },
      },
    });
  }

  /**
   * "Results published" notice — one per class/section per exam title, seen by
   * that class's students, their parents and its teachers.
   */
  static async notifyClassResultsPublished({
    schoolId, campusId = null, classId, sectionId, className = '', sectionName = '', examTitle = '', groupId = null, createdBy = null,
  }) {
    require('../services/examCommunication')
      .notifyResultsPublished({ schoolId, campusId, classId, sectionId, examTitle, entityId: groupId, createdBy })
      .catch((err) => console.error('Failed to send result notifications:', err.message));
    const scope = [className && (/^class\b/i.test(String(className).trim()) ? String(className).trim() : `Class ${className}`), sectionName && `Section ${sectionName}`].filter(Boolean).join(', ');
    const label = examTitle ? `${examTitle} results` : 'Examination results';
    return this.upsertClassNotice({
      dedupeKey: `results-published:${schoolId}:${campusId || 'x'}:${classId}:${sectionId}:${String(examTitle || groupId || '').toLowerCase()}`,
      fields: {
        schoolId,
        campusId,
        title: `Results Published${examTitle ? `: ${examTitle}` : ''}${scope ? ` - ${scope}` : ''}`,
        message: `${label}${scope ? ` for ${scope}` : ''} have been published. Students and parents can now view the results.`,
        audience: 'All',
        type: 'result',
        typeLabel: 'result_published_class',
        kind: 'notice',
        eventType: 'RESULT_PUBLISHED',
        targetRole: 'all',
        priority: 'high',
        category: 'exam',
        classId: classId || null,
        sectionId: sectionId || null,
        className,
        sectionName,
        createdBy,
        relatedEntity: groupId ? { entityType: 'result', entityId: groupId } : undefined,
      },
    });
  }

  /**
   * Notify every class/section covered by a set of just-published results —
   * one notice per (class, section, exam title). Used by bulk publish, single
   * publish, class publish and the scheduled auto-publish.
   */
  static async notifyResultsPublishedForResults({ schoolId, campusId = null, resultIds = [], createdBy = null }) {
    if (!resultIds.length) return [];
    const ExamResult = require('../models/ExamResult');
    const Exam = require('../models/Exam');
    const ExamGroup = require('../models/ExamGroup');
    const examIds = await ExamResult.distinct('examId', { _id: { $in: resultIds } });
    const exams = await Exam.find({ _id: { $in: examIds } })
      .select('title classId sectionId grade section groupId campusId')
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();
    const groupIds = [...new Set(exams.map((e) => String(e.groupId || '')).filter(Boolean))];
    const groups = groupIds.length ? await ExamGroup.find({ _id: { $in: groupIds } }).select('title').lean() : [];
    const groupTitle = new Map(groups.map((g) => [String(g._id), g.title]));

    const seen = new Map();
    exams.forEach((e) => {
      const classId = e.classId?._id || e.classId;
      const sectionId = e.sectionId?._id || e.sectionId;
      const examTitle = groupTitle.get(String(e.groupId || '')) || e.title || '';
      const key = `${classId}:${sectionId}:${examTitle.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, {
          classId, sectionId, examTitle,
          className: e.classId?.name || e.grade || '',
          sectionName: e.sectionId?.name || e.section || '',
          groupId: e.groupId || null,
          campusId: campusId || e.campusId || null,
        });
      }
    });
    return Promise.all([...seen.values()].map((s) => this.notifyClassResultsPublished({ schoolId, createdBy, ...s })));
  }

  /**
   * Create result published notification
   */
  static async notifyResultPublished({ schoolId, campusId, grade, section, createdBy }) {
    const sectionText = section ? ` Section ${section}` : '';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `Results Published - ${grade}${sectionText}`,
      message: `The examination results for ${grade}${sectionText} have been published. Please check your results.`,
      audience: 'Student',
      type: 'result',
      typeLabel: 'result_published',
      priority: 'high',
      category: 'academic',
      createdBy
    });
  }

  /**
   * Notify students that their assignment marks have been published by the teacher
   */
  static async notifyMarksPublished({ schoolId, campusId, assignment, studentIds, createdBy }) {
    return await this.createNotification({
      schoolId,
      campusId,
      title: `Marks Published: ${assignment.title}`,
      message: `Your marks for the ${assignment.subject} assignment "${assignment.title}" have been published. Check your submissions to see your score and feedback.`,
      audience: 'Specific',
      type: 'result',
      typeLabel: 'assignment_result',
      priority: 'high',
      category: 'academic',
      targetUserIds: Array.isArray(studentIds) ? studentIds : [],
      createdBy,
      relatedEntity: {
        entityType: 'assignment',
        entityId: assignment._id,
      },
    });
  }

  /**
   * Notify a student that a new personalised learning path has been published
   */
  static async notifyLearningPathPublished({ schoolId, campusId, studentId, subject, teacherName, createdBy }) {
    return await this.createNotification({
      schoolId,
      campusId,
      title: `New Learning Path: ${subject}`,
      message: `${teacherName || 'Your teacher'} has published a personalised learning path for you in ${subject}. Open your Learning Hub to get started.`,
      audience: 'Specific',
      type: 'general',
      typeLabel: 'learning_path',
      priority: 'high',
      category: 'academic',
      targetUserIds: [studentId],
      createdBy,
    });
  }

  /**
   * Create parent-teacher meeting notification
   */
  static async notifyParentMeetingScheduled({ schoolId, campusId, meeting, createdBy }) {
    const meetingDate = meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleDateString() : 'TBA';
    const meetingTime = meeting.meetingTime || '';

    return await this.createNotification({
      schoolId,
      campusId: null,
      title: `Parent-Teacher Meeting Scheduled`,
      message: `A meeting has been scheduled with your child's teacher on ${meetingDate} at ${meetingTime}. Topic: ${meeting.topic}. Type: ${meeting.meetingType}.`,
      audience: 'Parent',
      targetUserIds: meeting?.parentId ? [meeting.parentId] : [],
      type: 'announcement',
      typeLabel: 'parent_teacher_meeting',
      priority: 'high',
      category: 'general',
      createdBy,
      relatedEntity: null
    });
  }

  /**
   * Notify students & parents of a class/section that its weekly routine changed.
   */
  static async notifyTimetableUpdated({ schoolId, campusId, classId, sectionId, className = '', sectionName = '', createdBy = null }) {
    const scope = className
      ? `${className}${sectionName ? ` - ${sectionName}` : ''}`
      : 'your class';
    return await this.createNotification({
      schoolId,
      campusId: campusId || null,
      title: 'Class Routine Updated',
      message: `The weekly class routine for ${scope} has been updated. Open Class Routine to see the latest timetable.`,
      audience: 'All',
      type: 'general',
      typeLabel: 'timetable_updated',
      priority: 'medium',
      category: 'academic',
      classId: classId || null,
      sectionId: sectionId || null,
      createdBy,
      relatedEntity: null
    });
  }
}

module.exports = NotificationService;
