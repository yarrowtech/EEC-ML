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
    priority = 'medium',
    category = 'general',
    targetUserIds = [],
    classId = null,
    sectionId = null,
    createdBy = null,
    relatedEntity = null,
    expiresAt = null
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
        priority,
        category,
        classId,
        sectionId,
        createdBy,
        relatedEntity: relatedEntity ? {
          entityType: relatedEntity.entityType,
          entityId: relatedEntity.entityId
        } : undefined,
        expiresAt
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
    const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'TBA';

    return await this.createNotification({
      schoolId,
      campusId,
      title: `New Assignment: ${assignment.title}`,
      message: `A new ${assignment.subject} assignment has been posted for ${assignment.class}. Due date: ${dueDate}`,
      audience: 'Student',
      type: 'assignment',
      priority: 'medium',
      category: 'academic',
      createdBy,
      relatedEntity: {
        entityType: 'assignment',
        entityId: assignment._id
      }
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
      className && `Class ${className}`,
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
