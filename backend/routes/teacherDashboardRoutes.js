const express = require('express');
const mongoose = require('mongoose');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const StudentProgress = require('../models/StudentProgress');
const Assignment = require('../models/Assignment');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const School = require('../models/School');
const TeacherUser = require('../models/TeacherUser');
const TeacherAttendance = require('../models/TeacherAttendance');
const TeacherLeave = require('../models/TeacherLeave');
const TeacherExpense = require('../models/TeacherExpense');
const TeacherAllocation = require('../models/TeacherAllocation');
const TeacherFeedback = require('../models/TeacherFeedback');
const SupportRequest = require('../models/SupportRequest');
const Notification = require('../models/Notification');

const router = express.Router();
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_LOOKUP = WEEK_DAYS.reduce((acc, day) => {
  acc[day.toLowerCase()] = day;
  return acc;
}, {});

const normalizeDayLabel = (value) => {
  if (!value) return null;
  return DAY_LOOKUP[String(value).trim().toLowerCase()] || null;
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value._id ? String(value._id) : null;
  return null;
};

const normalizeScopeText = (value) => String(value || '').trim().toLowerCase();

const buildTeacherScope = async ({ schoolId, campusId = null, teacherId }) => {
  if (!schoolId || !teacherId) return [];

  const allocationFilter = {
    schoolId,
    teacherId,
  };
  if (campusId) {
    allocationFilter.$or = [
      { campusId },
      { campusId: null },
      { campusId: { $exists: false } },
    ];
  }

  const allocations = await TeacherAllocation.find(allocationFilter)
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();

  const scopeMap = new Map();
  const addScope = (className, sectionName = '') => {
    const normalizedClass = normalizeScopeText(className);
    const normalizedSection = normalizeScopeText(sectionName);
    if (!normalizedClass) return;
    const key = `${normalizedClass}::${normalizedSection}`;
    if (!scopeMap.has(key)) {
      scopeMap.set(key, {
        className: normalizedClass,
        sectionName: normalizedSection,
      });
    }
  };

  allocations.forEach((allocation) => {
    addScope(allocation?.classId?.name, allocation?.sectionId?.name);
  });

  if (!scopeMap.size) {
    const timetableFilter = {
      schoolId,
      'entries.teacherId': teacherId,
    };
    if (campusId) {
      timetableFilter.campusId = campusId;
    }

    const timetables = await Timetable.find(timetableFilter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();

    timetables.forEach((timetable) => {
      const className = timetable?.classId?.name || '';
      const sectionName = timetable?.sectionId?.name || '';
      (timetable.entries || []).forEach((entry) => {
        if (String(entry?.teacherId || '') !== String(teacherId)) return;
        addScope(className, sectionName);
      });
    });
  }

  return Array.from(scopeMap.values());
};

const studentIsWithinScope = (student, scope = []) => {
  if (!Array.isArray(scope) || scope.length === 0) return false;
  const studentClass = normalizeScopeText(student?.grade || student?.className || '');
  const studentSection = normalizeScopeText(student?.section || student?.sectionName || '');
  return scope.some((item) => {
    if (studentClass !== normalizeScopeText(item?.className || '')) return false;
    const scopeSection = normalizeScopeText(item?.sectionName || '');
    if (!scopeSection) return true;
    return studentSection === scopeSection;
  });
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const toDateKey = (value = new Date()) => {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toTimeLabel = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const TIME_24H_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMinutesOfDay = (value) => {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return (hours * 60) + minutes;
};

const isLateCheckIn = (value, entryTime = '09:00', graceMinutes = 0) => {
  if (!value) return false;
  const date = new Date(value);
  const checkInMinutes = (date.getHours() * 60) + date.getMinutes();
  const grace = Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : 0;
  return checkInMinutes > (toMinutesOfDay(entryTime) + Math.max(0, grace));
};

const getSchoolAttendanceSettings = async (schoolId) => {
  const defaults = { entryTime: '09:00', exitTime: '17:00', graceMinutes: 0 };
  if (!schoolId) return defaults;
  const school = await School.findById(schoolId).select('teacherAttendanceSettings').lean();
  const entryTime = school?.teacherAttendanceSettings?.entryTime;
  const exitTime = school?.teacherAttendanceSettings?.exitTime;
  const graceMinutes = school?.teacherAttendanceSettings?.graceMinutes;
  return {
    entryTime: TIME_24H_RE.test(String(entryTime || '').trim()) ? String(entryTime).trim() : defaults.entryTime,
    exitTime: TIME_24H_RE.test(String(exitTime || '').trim()) ? String(exitTime).trim() : defaults.exitTime,
    graceMinutes: Number.isFinite(Number(graceMinutes)) ? Number(graceMinutes) : defaults.graceMinutes,
  };
};

const getSchoolLeaveSettings = async (schoolId) => {
  if (!schoolId) return { casualLeaveDays: 12 };
  const school = await School.findById(schoolId).select('teacherLeaveSettings').lean();
  const casualLeaveDays = Number.isFinite(Number(school?.teacherLeaveSettings?.casualLeaveDays))
    ? Number(school.teacherLeaveSettings.casualLeaveDays)
    : 12;
  return {
    casualLeaveDays: Math.max(0, Math.min(365, Math.round(casualLeaveDays))),
  };
};

const dateOnlyValue = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const countInclusiveDays = (startDate, endDate) => {
  const start = dateOnlyValue(startDate);
  const end = dateOnlyValue(endDate);
  if (!start || !end || end < start) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
};

const formatDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const buildMonthRange = (month) => {
  const fallback = new Date();
  const [yearStr, monthStr] = String(month || '').split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const base = Number.isInteger(year) && Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11
    ? new Date(year, monthIndex, 1)
    : new Date(fallback.getFullYear(), fallback.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    from: toDateKey(base),
    to: toDateKey(end),
    year: base.getFullYear(),
    monthIndex: base.getMonth(),
  };
};

const countWeekdaysInMonth = (year, monthIndex, upToDate = null) => {
  const start = new Date(year, monthIndex, 1);
  const end = upToDate || new Date(year, monthIndex + 1, 0);
  let weekdays = 0;
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) weekdays += 1;
  }
  return weekdays;
};

const toObjectIdVariants = (value) => {
  const variants = [];
  if (!value) return variants;
  variants.push(String(value));
  if (mongoose.Types.ObjectId.isValid(value)) {
    variants.push(new mongoose.Types.ObjectId(value));
  }
  return variants;
};

const formatTeacherComplaint = (doc) => ({
  id: doc._id,
  ticketNumber: doc.ticketNumber,
  title: doc.subject || 'Complaint',
  description: doc.message || '',
  status: doc.status || 'open',
  priority: doc.priority || 'low',
  category: doc.category || 'General',
  parentName: doc.requestDetails?.parentName || 'Parent',
  studentName: doc.requestDetails?.studentName || '',
  studentGrade: doc.requestDetails?.studentGrade || '',
  studentSection: doc.requestDetails?.studentSection || '',
  resolutionNotes: doc.resolutionNotes || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

router.get('/', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id;
    const teacher = teacherId
      ? await TeacherUser.findById(teacherId).select('name campusName campusType').lean()
      : null;

    const studentFilter = { schoolId };
    if (campusId) {
      studentFilter.campusId = campusId;
    }
    const scope = await buildTeacherScope({ schoolId, campusId, teacherId });
    const students = await StudentUser.find(studentFilter)
      .select('name grade section attendance')
      .lean();
    const scopedStudents = students.filter((student) => studentIsWithinScope(student, scope));
    const studentIds = scopedStudents.map((student) => student._id);

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    let attendanceMarked = 0;
    let attendancePresent = 0;

    scopedStudents.forEach((student) => {
      const todays = (student.attendance || []).filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= todayStart && entryDate <= todayEnd;
      });
      if (todays.length > 0) {
        attendanceMarked += 1;
        const hasPresent = todays.some((entry) => entry.status === 'present');
        if (hasPresent) {
          attendancePresent += 1;
        }
      }
    });

    const attendanceRate = attendanceMarked > 0
      ? Math.round((attendancePresent / attendanceMarked) * 1000) / 10
      : 0;

    const progressDocs = studentIds.length > 0
      ? await StudentProgress.find({ schoolId, studentId: { $in: studentIds } }).lean()
      : [];

    let pendingEvaluations = 0;
    const submissionItems = [];
    progressDocs.forEach((doc) => {
      (doc.submissions || []).forEach((submission) => {
        if (submission.status === 'submitted' || submission.status === 'late') {
          pendingEvaluations += 1;
        }
        if (submission.submittedAt) {
          submissionItems.push({
            studentId: doc.studentId,
            assignmentId: submission.assignmentId,
            submittedAt: submission.submittedAt,
            status: submission.status,
          });
        }
      });
    });

    const assignmentIds = [
      ...new Set(submissionItems.map((item) => String(item.assignmentId)).filter(Boolean)),
    ];
    const assignments = assignmentIds.length > 0
      ? await Assignment.find({ _id: { $in: assignmentIds } })
        .select('title subject dueDate')
        .lean()
      : [];
    const assignmentMap = new Map(assignments.map((a) => [String(a._id), a]));
    const studentMap = new Map(scopedStudents.map((s) => [String(s._id), s]));

    submissionItems.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const recentActivities = submissionItems.slice(0, 5).map((item, idx) => {
      const assignment = assignmentMap.get(String(item.assignmentId));
      const student = studentMap.get(String(item.studentId));
      const assignmentTitle = assignment?.title || 'Assignment';
      const studentName = student?.name || 'Student';
      const actionText = item.status === 'graded' ? 'graded' : 'submitted';
      return {
        id: `${item.assignmentId}-${idx}`,
        type: 'assignment',
        message: `${studentName} ${actionText} ${assignmentTitle}`,
        time: new Date(item.submittedAt).toISOString(),
        status: item.status,
      };
    });

    const performanceBucket = new Map();
    progressDocs.forEach((doc) => {
      (doc.progressMetrics || []).forEach((metric) => {
        if (!metric.subject) return;
        const key = metric.subject;
        const entry = performanceBucket.get(key) || { total: 0, count: 0 };
        entry.total += metric.averageScore || 0;
        entry.count += 1;
        performanceBucket.set(key, entry);
      });
    });
    const performanceMetrics = [...performanceBucket.entries()]
      .map(([subject, data]) => ({
        subject,
        average: data.count ? Math.round(data.total / data.count) : 0,
        trend: 'neutral',
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 4);

    const topStudents = progressDocs
      .map((doc) => {
        const metrics = doc.progressMetrics || [];
        const avg = metrics.length > 0
          ? Math.round(metrics.reduce((sum, m) => sum + (m.averageScore || 0), 0) / metrics.length)
          : 0;
        const student = studentMap.get(String(doc.studentId));
        const grade = student?.grade || '-';
        const section = student?.section ? `-${student.section}` : '';
        return {
          name: student?.name || 'Student',
          grade: `${grade}${section}`,
          score: avg,
          improvement: doc.improvementTrend || 'stable',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const timetables = teacherId
      ? await Timetable.find({
        schoolId,
        ...(campusId ? { campusId } : {}),
        'entries.teacherId': teacherId,
      }).lean()
      : [];

    const subjectIds = new Set();
    const classIds = new Set();
    const sectionIds = new Set();

    timetables.forEach((timetable) => {
      if (timetable.classId) classIds.add(String(timetable.classId));
      if (timetable.sectionId) sectionIds.add(String(timetable.sectionId));
      (timetable.entries || []).forEach((entry) => {
        if (String(entry.teacherId) !== String(teacherId)) return;
        const normalizedDay = normalizeDayLabel(entry.dayOfWeek);
        if (!normalizedDay) return;
        if (entry.subjectId) subjectIds.add(String(entry.subjectId));
      });
    });

    const subjectFilter = subjectIds.size ? { _id: { $in: [...subjectIds] } } : null;
    const classFilter = classIds.size ? { _id: { $in: [...classIds] } } : null;
    const sectionFilter = sectionIds.size ? { _id: { $in: [...sectionIds] } } : null;
    if (campusId) {
      if (subjectFilter) subjectFilter.campusId = campusId;
      if (classFilter) classFilter.campusId = campusId;
      if (sectionFilter) sectionFilter.campusId = campusId;
    }

    const [subjects, classes, sections] = await Promise.all([
      subjectFilter
        ? Subject.find(subjectFilter).select('name').lean()
        : [],
      classFilter
        ? ClassModel.find(classFilter).select('name').lean()
        : [],
      sectionFilter
        ? Section.find(sectionFilter).select('name classId').lean()
        : [],
    ]);

    const subjectMap = new Map(subjects.map((s) => [String(s._id), s.name]));
    const classMap = new Map(classes.map((c) => [String(c._id), c.name]));
    const sectionMap = new Map(sections.map((s) => [String(s._id), s.name]));

    const upcomingClasses = [];
    timetables.forEach((timetable) => {
      const className = classMap.get(String(timetable.classId)) || 'Class';
      const sectionName = timetable.sectionId
        ? sectionMap.get(String(timetable.sectionId)) || ''
        : '';
      const classLabel = sectionName ? `${className}-${sectionName}` : className;

      (timetable.entries || []).forEach((entry) => {
        if (String(entry.teacherId) !== String(teacherId)) return;
        const normalizedDay = normalizeDayLabel(entry.dayOfWeek);
        if (!normalizedDay) return;
        const subjectName = subjectMap.get(String(entry.subjectId)) || 'Subject';
        upcomingClasses.push({
          id: `${timetable._id}-${normalizedDay}-${entry.period}`,
          dayOfWeek: normalizedDay,
          subject: subjectName,
          class: classLabel,
          time: entry.startTime && entry.endTime
            ? `${entry.startTime} - ${entry.endTime}`
            : `Period ${entry.period}`,
          room: entry.room || 'TBA',
          status: 'upcoming',
        });
      });
    });
    upcomingClasses.sort((a, b) => {
      const dayDiff = WEEK_DAYS.indexOf(a.dayOfWeek) - WEEK_DAYS.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });

    const assignmentFilter = { schoolId, dueDate: { $gte: today } };
    if (campusId) {
      assignmentFilter.campusId = campusId;
    }
    const upcomingDeadlines = await Assignment.find(assignmentFilter)
      .sort({ dueDate: 1 })
      .limit(3)
      .select('title class subject dueDate')
      .lean();

    res.json({
      teacher: {
        name: teacher?.name || 'Teacher',
        campusName: teacher?.campusName || null,
        campusType: teacher?.campusType || null,
      },
      stats: {
        totalStudents: students.length,
        attendanceRate,
        pendingEvaluations,
        upcomingEvents: upcomingClasses.length,
      },
      upcomingClasses,
      recentActivities,
      performanceMetrics,
      topStudents,
      upcomingDeadlines: upcomingDeadlines.map((item) => ({
        title: item.title,
        class: item.class || '',
        subject: item.subject || '',
        dueDate: item.dueDate,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load dashboard data' });
  }
});

// Get teacher allocations (classes/sections/subjects)
router.get('/allocations', authTeacher, async (req, res) => {
  try {
    const isTeacherUser =
      String(req.user?.userType || '').toLowerCase() === 'teacher' ||
      String(req.user?.type || '').toLowerCase() === 'teacher' ||
      String(req.userType || '').toLowerCase() === 'teacher';
    if (!isTeacherUser) {
      return res.status(403).json({ error: 'Forbidden - not a teacher' });
    }
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    let items = await TeacherAllocation.find({
      schoolId,
      ...(campusId
        ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
        : {}),
      teacherId,
    })
      .populate('subjectId', 'name code classId')
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name classId')
      .sort({ createdAt: -1 })
      .lean();

    if (!items.length) {
      const timetableFilter = {
        schoolId,
        'entries.teacherId': teacherId,
        ...(campusId ? { campusId } : {}),
      };
      const timetables = await Timetable.find(timetableFilter)
        .populate('classId', 'name academicYearId')
        .populate('sectionId', 'name classId')
        .populate('entries.subjectId', 'name code classId')
        .lean();

      const map = new Map();
      timetables.forEach((tt) => {
        (tt.entries || []).forEach((entry) => {
          if (String(entry.teacherId) !== String(teacherId)) return;
          const classId = tt.classId || null;
          const sectionId = tt.sectionId || null;
          const subjectId = entry.subjectId || null;
          if (!classId || !sectionId || !subjectId) return;
          const key = `${classId._id}_${sectionId._id}_${subjectId._id}`;
          if (map.has(key)) return;
          map.set(key, {
            _id: key,
            classId,
            sectionId,
            subjectId,
          });
        });
      });
      items = Array.from(map.values());
    }

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load allocations' });
  }
});

router.get('/students', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;

    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId is required' });
    }

    const scope = await buildTeacherScope({ schoolId, campusId, teacherId });
    if (!scope.length) {
      return res.json({
        students: [],
        teacher: null,
        classes: [],
        sections: [],
      });
    }

    // Get teacher details to understand their assigned classes
    const teacher = await TeacherUser.findById(teacherId)
      .select('name className class grade sectionName section assignedClasses assignedSections classes sections')
      .lean();

    // Build student filter based on campus
    const studentFilter = { schoolId };
    if (campusId) {
      studentFilter.campusId = campusId;
    }

    // Fetch students
    const students = await StudentUser.find(studentFilter)
      .select('name username rollNumber grade section className sectionName campusId campusName attendance profilePic')
      .sort({ grade: 1, section: 1, rollNumber: 1 })
      .lean();

    // Format students with their class-section labels
    const formattedStudents = students
      .filter((student) => studentIsWithinScope(student, scope))
      .map((student) => {
        const className = student.className || student.grade || '';
        const sectionName = student.sectionName || student.section || '';
        const classLabel = sectionName ? `${className}-${sectionName}` : className;

        return {
          _id: student._id,
          name: student.name,
          username: student.username,
          rollNumber: student.rollNumber,
          grade: student.grade,
          section: student.section,
          className: student.className,
          sectionName: student.sectionName,
          classLabel,
          campusId: student.campusId,
          campusName: student.campusName,
          profilePic: student.profilePic,
          attendance: student.attendance || [],
        };
      });

    const classOptions = [...new Set(formattedStudents.map((student) => student.grade || student.className).filter(Boolean))];
    const sectionOptions = [...new Set(formattedStudents.map((student) => student.section || student.sectionName).filter(Boolean))];

    res.json({
      students: formattedStudents,
      teacher: teacher || null,
      classes: classOptions,
      sections: sectionOptions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load students' });
  }
});

router.post('/attendance', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const teacherId = req.user?.id || null;
    const { date, attendanceData } = req.body || {};

    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    if (!attendanceData || typeof attendanceData !== 'object') {
      return res.status(400).json({ error: 'attendanceData is required' });
    }

    const attendanceDate = new Date(date);
    const startOfDay = new Date(attendanceDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(attendanceDate);
    endOfDay.setHours(23, 59, 59, 999);

    const scope = await buildTeacherScope({ schoolId, campusId: req.campusId || req.user?.campusId || null, teacherId });
    if (!scope.length) {
      return res.status(403).json({ error: 'Attendance access denied. You are not allocated to any class/section.' });
    }

    // Update attendance for each student
    const updates = [];
    for (const [studentId, status] of Object.entries(attendanceData)) {
      if (!mongoose.isValidObjectId(studentId)) continue;
      if (!['present', 'absent'].includes(status)) continue;

      const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('grade section className sectionName campusId').lean();
      if (!student || !studentIsWithinScope(student, scope)) {
        return res.status(403).json({ error: 'One or more students are outside your assigned scope' });
      }

      updates.push(
        StudentUser.findByIdAndUpdate(
          studentId,
          {
            $pull: {
              attendance: {
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            }
          }
        ).then(() =>
          StudentUser.findByIdAndUpdate(
            studentId,
            {
              $push: {
                attendance: {
                  date: attendanceDate,
                  status: status,
                  markedBy: teacherId
                }
              }
            }
          )
        )
      );
    }

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Attendance saved successfully',
      count: updates.length,
      date: attendanceDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to save attendance' });
  }
});

router.get('/work-attendance', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { month } = req.query || {};

    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const range = buildMonthRange(month);
    const attendanceSettings = await getSchoolAttendanceSettings(schoolId);
    const query = {
      schoolId,
      teacherId,
      dateKey: { $gte: range.from, $lte: range.to },
    };
    if (campusId) query.campusId = campusId;

    const records = await TeacherAttendance.find(query).sort({ dateKey: -1 }).lean();
    const presentDays = records.filter((r) => Boolean(r.checkInAt)).length;
    const lateDays = records.filter((r) => isLateCheckIn(r.checkInAt, attendanceSettings.entryTime, attendanceSettings.graceMinutes)).length;

    const today = new Date();
    const sameMonthAsToday = today.getFullYear() === range.year && today.getMonth() === range.monthIndex;
    const upToDate = sameMonthAsToday ? today : null;
    const workingDays = countWeekdaysInMonth(range.year, range.monthIndex, upToDate);
    const absentDays = Math.max(workingDays - presentDays, 0);
    const attendanceRate = workingDays > 0
      ? Math.round(((presentDays + lateDays) / workingDays) * 100)
      : 0;

    const todayKey = toDateKey();
    const todayRecord = records.find((record) => record.dateKey === todayKey) || null;

    res.json({
      records: records.map((record) => ({
        id: record._id,
        date: record.dateKey,
        checkIn: toTimeLabel(record.checkInAt),
        checkOut: toTimeLabel(record.checkOutAt),
        status: record.status || (isLateCheckIn(record.checkInAt, attendanceSettings.entryTime, attendanceSettings.graceMinutes) ? 'Late' : 'Present'),
        workingMinutes: record.workingMinutes || 0,
      })),
      today: todayRecord
        ? {
          date: todayRecord.dateKey,
          checkIn: toTimeLabel(todayRecord.checkInAt),
          checkOut: toTimeLabel(todayRecord.checkOutAt),
          hasCheckedIn: Boolean(todayRecord.checkInAt),
          hasCheckedOut: Boolean(todayRecord.checkOutAt),
          status: todayRecord.status || (isLateCheckIn(todayRecord.checkInAt, attendanceSettings.entryTime, attendanceSettings.graceMinutes) ? 'Late' : 'Present'),
          workingMinutes: todayRecord.workingMinutes || 0,
        }
        : {
          date: todayKey,
          checkIn: '-',
          checkOut: '-',
          hasCheckedIn: false,
          hasCheckedOut: false,
          status: 'Absent',
          workingMinutes: 0,
        },
      settings: attendanceSettings,
      stats: {
        presentDays,
        lateDays,
        absentDays,
        attendanceRate,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load work attendance' });
  }
});

router.post('/work-attendance/check-in', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const now = new Date();
    const dateKey = toDateKey(now);
    const attendanceSettings = await getSchoolAttendanceSettings(schoolId);
    const existing = await TeacherAttendance.findOne({ schoolId, campusId: campusId || null, teacherId, dateKey });
    if (existing?.checkInAt) {
      return res.status(400).json({ error: 'Check-in already recorded for today' });
    }

    const status = isLateCheckIn(now, attendanceSettings.entryTime, attendanceSettings.graceMinutes) ? 'Late' : 'Present';
    const record = existing
      ? await TeacherAttendance.findByIdAndUpdate(
        existing._id,
        { $set: { checkInAt: now, status } },
        { new: true, runValidators: true }
      )
      : await TeacherAttendance.create({
        schoolId,
        campusId: campusId || null,
        teacherId,
        dateKey,
        checkInAt: now,
        status,
      });

    res.json({
      message: 'Check-in successful',
      record: {
        date: record.dateKey,
        checkIn: toTimeLabel(record.checkInAt),
        checkOut: toTimeLabel(record.checkOutAt),
        status: record.status,
        entryTime: attendanceSettings.entryTime,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to check in' });
  }
});

router.post('/work-attendance/check-out', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const now = new Date();
    const dateKey = toDateKey(now);
    const record = await TeacherAttendance.findOne({ schoolId, campusId: campusId || null, teacherId, dateKey });
    if (!record || !record.checkInAt) {
      return res.status(400).json({ error: 'Please check in first' });
    }
    if (record.checkOutAt) {
      return res.status(400).json({ error: 'Check-out already recorded for today' });
    }

    const workingMinutes = Math.max(Math.round((now.getTime() - new Date(record.checkInAt).getTime()) / 60000), 0);
    record.checkOutAt = now;
    record.workingMinutes = workingMinutes;
    await record.save();

    res.json({
      message: 'Check-out successful',
      record: {
        date: record.dateKey,
        checkIn: toTimeLabel(record.checkInAt),
        checkOut: toTimeLabel(record.checkOutAt),
        status: record.status,
        workingMinutes,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to check out' });
  }
});

router.get('/leave-requests', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const query = { schoolId, teacherId };
    if (campusId) query.campusId = campusId;
    if (req.query?.status) query.status = String(req.query.status);

    const [leaves, leavePolicy] = await Promise.all([
      TeacherLeave.find(query).sort({ createdAt: -1 }).lean(),
      getSchoolLeaveSettings(schoolId),
    ]);
    const casualUsedDays = leaves
      .filter((leave) => String(leave?.status || '').toLowerCase() === 'approved')
      .filter((leave) => String(leave?.type || '').trim().toLowerCase() === 'casual leave')
      .reduce((sum, leave) => sum + countInclusiveDays(leave.startDate, leave.endDate), 0);
    const casualAvailableDays = Math.max((leavePolicy.casualLeaveDays || 0) - casualUsedDays, 0);

    res.json({
      leaves: leaves.map((leave) => ({
        id: leave._id,
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
        reason: leave.reason,
        adminNote: leave.adminNote || '',
        createdAt: leave.createdAt,
      })),
      leavePolicy,
      leaveStats: {
        casualUsedDays,
        casualAvailableDays,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load leave requests' });
  }
});

router.post('/leave-requests', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { type, startDate, endDate, reason } = req.body || {};
    if (!type || !String(type).trim()) return res.status(400).json({ error: 'Leave type is required' });
    if (!startDate) return res.status(400).json({ error: 'Start date is required' });
    if (!endDate) return res.status(400).json({ error: 'End date is required' });
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }

    const normalizedType = String(type).trim();
    if (normalizedType.toLowerCase() === 'casual leave') {
      const [leavePolicy, approvedCasualLeaves] = await Promise.all([
        getSchoolLeaveSettings(schoolId),
        TeacherLeave.find({
          schoolId,
          teacherId,
          ...(campusId ? { campusId } : {}),
          status: 'Approved',
          type: { $regex: '^casual leave$', $options: 'i' },
        })
          .select('startDate endDate')
          .lean(),
      ]);
      const usedDays = approvedCasualLeaves.reduce((sum, leave) => sum + countInclusiveDays(leave.startDate, leave.endDate), 0);
      const requestedDays = countInclusiveDays(startDate, endDate);
      const availableDays = Math.max((leavePolicy.casualLeaveDays || 0) - usedDays, 0);
      if (requestedDays > availableDays) {
        return res.status(400).json({ error: `Casual leave balance exceeded. Available: ${availableDays} day(s)` });
      }
    }

    const teacher = await TeacherUser.findById(teacherId).select('name').lean();
    const created = await TeacherLeave.create({
      schoolId,
      campusId: campusId || null,
      teacherId,
      teacherName: teacher?.name || 'Teacher',
      type: normalizedType,
      startDate: String(startDate),
      endDate: String(endDate),
      reason: String(reason || '').trim(),
      status: 'Pending',
    });

    try {
      const teacherName = teacher?.name || 'Teacher';
      await Notification.create({
        schoolId,
        campusId: campusId || null,
        title: 'New Teacher Leave Request',
        message: `${teacherName} applied for ${normalizedType} from ${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}.`,
        audience: 'Admin',
        createdByType: 'teacher',
        createdByTeacherId: teacherId,
        createdByName: teacherName,
        type: 'general',
        typeLabel: 'Leave Request',
        priority: 'medium',
        category: 'general',
      });
    } catch (notifErr) {
      console.error('Failed to create teacher leave notification:', notifErr?.message || notifErr);
    }

    res.status(201).json({
      message: 'Leave request submitted successfully',
      leave: {
        id: created._id,
        type: created.type,
        startDate: created.startDate,
        endDate: created.endDate,
        status: created.status,
        reason: created.reason,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to submit leave request' });
  }
});

router.patch('/leave-requests/:id', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { id } = req.params || {};
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid leave request id' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const existing = await TeacherLeave.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Leave request not found' });
    if (existing.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending requests can be edited' });
    }

    const { type, startDate, endDate, reason } = req.body || {};
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }

    const nextType = type !== undefined ? String(type).trim() : String(existing.type || '').trim();
    const nextStartDate = startDate !== undefined ? String(startDate) : String(existing.startDate || '');
    const nextEndDate = endDate !== undefined ? String(endDate) : String(existing.endDate || '');
    if (nextType.toLowerCase() === 'casual leave') {
      const [leavePolicy, approvedCasualLeaves] = await Promise.all([
        getSchoolLeaveSettings(schoolId),
        TeacherLeave.find({
          schoolId,
          teacherId,
          ...(campusId ? { campusId } : {}),
          status: 'Approved',
          type: { $regex: '^casual leave$', $options: 'i' },
        })
          .select('startDate endDate')
          .lean(),
      ]);
      const usedDays = approvedCasualLeaves.reduce((sum, leave) => sum + countInclusiveDays(leave.startDate, leave.endDate), 0);
      const requestedDays = countInclusiveDays(nextStartDate, nextEndDate);
      const availableDays = Math.max((leavePolicy.casualLeaveDays || 0) - usedDays, 0);
      if (requestedDays > availableDays) {
        return res.status(400).json({ error: `Casual leave balance exceeded. Available: ${availableDays} day(s)` });
      }
    }

    if (type !== undefined) existing.type = String(type).trim();
    if (startDate !== undefined) existing.startDate = String(startDate);
    if (endDate !== undefined) existing.endDate = String(endDate);
    if (reason !== undefined) existing.reason = String(reason).trim();

    await existing.save();
    res.json({
      message: 'Leave request updated successfully',
      leave: {
        id: existing._id,
        type: existing.type,
        startDate: existing.startDate,
        endDate: existing.endDate,
        status: existing.status,
        reason: existing.reason,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update leave request' });
  }
});

router.delete('/leave-requests/:id', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { id } = req.params || {};
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid leave request id' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;

    const existing = await TeacherLeave.findOne(filter).lean();
    if (!existing) return res.status(404).json({ error: 'Leave request not found' });
    if (existing.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending requests can be deleted' });
    }

    await TeacherLeave.deleteOne({ _id: id });
    res.json({ message: 'Leave request deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to delete leave request' });
  }
});

router.get('/expenses', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const query = { schoolId, teacherId };
    if (campusId) query.campusId = campusId;
    if (req.query?.status) query.status = String(req.query.status).trim();

    const expenses = await TeacherExpense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();
    res.json({
      expenses: expenses.map((expense) => ({
        id: expense._id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description || '',
        date: expense.expenseDate,
        status: expense.status,
        receiptUrl: expense.receiptUrl || '',
        receiptName: expense.receiptName || '',
        adminNote: expense.adminNote || '',
        createdAt: expense.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load expenses' });
  }
});

router.post('/expenses', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { category, amount, description, date, receiptUrl, receiptName } = req.body || {};
    if (!category || !String(category).trim()) return res.status(400).json({ error: 'Category is required' });
    if (amount === undefined || amount === null || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    const expenseDate = date ? String(date) : toDateKey();

    const teacher = await TeacherUser.findById(teacherId).select('name').lean();
    const created = await TeacherExpense.create({
      schoolId,
      campusId: campusId || null,
      teacherId,
      teacherName: teacher?.name || 'Teacher',
      category: String(category).trim(),
      amount: Number(amount),
      description: String(description || '').trim(),
      expenseDate,
      status: 'Pending',
      receiptUrl: String(receiptUrl || '').trim(),
      receiptName: String(receiptName || '').trim(),
    });

    res.status(201).json({
      message: 'Expense submitted successfully',
      expense: {
        id: created._id,
        category: created.category,
        amount: created.amount,
        description: created.description,
        date: created.expenseDate,
        status: created.status,
        receiptUrl: created.receiptUrl,
        receiptName: created.receiptName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to submit expense' });
  }
});

router.patch('/expenses/:id', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { id } = req.params || {};
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid expense id' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;
    const existing = await TeacherExpense.findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    if (existing.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending expenses can be edited' });
    }

    const { category, amount, description, date, receiptUrl, receiptName } = req.body || {};
    if (amount !== undefined && Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }
    if (category !== undefined) existing.category = String(category).trim();
    if (amount !== undefined) existing.amount = Number(amount);
    if (description !== undefined) existing.description = String(description).trim();
    if (date !== undefined) existing.expenseDate = String(date);
    if (receiptUrl !== undefined) existing.receiptUrl = String(receiptUrl || '').trim();
    if (receiptName !== undefined) existing.receiptName = String(receiptName || '').trim();

    await existing.save();
    res.json({
      message: 'Expense updated successfully',
      expense: {
        id: existing._id,
        category: existing.category,
        amount: existing.amount,
        description: existing.description,
        date: existing.expenseDate,
        status: existing.status,
        receiptUrl: existing.receiptUrl,
        receiptName: existing.receiptName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update expense' });
  }
});

router.delete('/expenses/:id', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;
    const { id } = req.params || {};
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Invalid expense id' });

    const filter = { _id: id, schoolId, teacherId };
    if (campusId) filter.campusId = campusId;
    const existing = await TeacherExpense.findOne(filter).lean();
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    if (existing.status !== 'Pending') {
      return res.status(400).json({ error: 'Only pending expenses can be deleted' });
    }

    await TeacherExpense.deleteOne({ _id: id });
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to delete expense' });
  }
});

router.get('/routine', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    const teacherId = req.user?.id || null;

    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    if (!teacherId) {
      return res.status(400).json({ error: 'teacherId is required' });
    }

    // Build timetable filter - campusId is optional
    const timetableFilter = {
      schoolId,
      'entries.teacherId': teacherId,
    };

    if (campusId) {
      timetableFilter.campusId = campusId;
    }

    let timetables = await Timetable.find(timetableFilter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .lean();

    // Fallback for legacy records that may not have campusId set
    if (campusId && (!Array.isArray(timetables) || timetables.length === 0)) {
      const baseFilter = {
        schoolId,
        'entries.teacherId': teacherId,
      };
      timetables = await Timetable.find(baseFilter)
        .populate('classId', 'name')
        .populate('sectionId', 'name')
        .populate('entries.subjectId', 'name')
        .lean();
    }

    const schedule = {};
    const assignedClassLabels = new Set();
    WEEK_DAYS.forEach((day) => {
      schedule[day] = [];
    });

    timetables.forEach((tt) => {
      const className = tt.classId?.name || 'Class';
      const sectionName = tt.sectionId?.name || '';
      const classLabel = sectionName ? `${className}-${sectionName}` : className;
      assignedClassLabels.add(classLabel);

      (tt.entries || []).forEach((entry) => {
        if (extractId(entry.teacherId) !== String(teacherId)) return;
        const normalizedDay = normalizeDayLabel(entry.dayOfWeek);
        if (!normalizedDay || !schedule[normalizedDay]) return;

        schedule[normalizedDay].push({
          subject: entry.subjectId?.name || 'Subject',
          className,
          sectionName,
          classLabel,
          room: entry.room || 'TBA',
          startTime: entry.startTime || '',
          endTime: entry.endTime || '',
          period: entry.period || null,
        });
      });
    });

    WEEK_DAYS.forEach((day) => {
      schedule[day].sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.period && b.period) return a.period - b.period;
        return 0;
      });
    });

    // Fetch teacher profile for credential-based filtering on frontend
    const teacher = await TeacherUser.findById(teacherId)
      .select('name campusName subject department className class grade sectionName section assignedClasses assignedSections classes sections profilePic')
      .lean();

    // Fetch school info (name, address, logo) for PDF header
    const school = await School.findById(schoolId).select('name address logo').lean();

    res.json({
      schedule,
      teacher: {
        ...(teacher || {}),
        schoolName:    school?.name                 || '',
        schoolAddress: school?.address              || '',
        schoolLogo:    school?.logo?.secure_url     || '',
      },
      meta: {
        campusScoped:   Boolean(campusId),
        timetableCount: Array.isArray(timetables) ? timetables.length : 0,
        filterSource:   campusId ? 'campus' : 'school',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load teacher routine' });
  }
});

router.get('/feedback', authTeacher, async (req, res) => {
  // #swagger.tags = ['Teacher Dashboard']
  try {
    const teacherId = req.user?.id;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const filter = { teacherId, schoolId };
    const feedbackDocs = await TeacherFeedback.find(filter).sort({ createdAt: -1 }).lean();

    const totalFeedback = feedbackDocs.length;
    const ratingKeys = ['teaching_quality', 'communication', 'engagement', 'preparation', 'availability', 'fairness'];

    const stats = {
      totalFeedback,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      categoryAverages: ratingKeys.reduce((acc, key) => {
        acc[key] = { total: 0, count: 0, average: 0 };
        return acc;
      }, {}),
      latestFeedbackDate: null
    };

    if (totalFeedback > 0) {
      let overallSum = 0;
      feedbackDocs.forEach((doc, index) => {
        const computedOverall = (() => {
          if (Number.isFinite(Number(doc.overallRating))) return Number(doc.overallRating);
          const values = Object.values(doc.ratings || {})
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
          return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        })();
        overallSum += computedOverall;
        const rounded = Math.max(1, Math.min(5, Math.round(computedOverall || 0)));
        stats.ratingDistribution[rounded] += 1;
        ratingKeys.forEach((key) => {
          const value = Number(doc.ratings?.[key]);
          if (Number.isFinite(value)) {
            stats.categoryAverages[key].total += value;
            stats.categoryAverages[key].count += 1;
          }
        });
        if (index === 0 && doc.createdAt) {
          stats.latestFeedbackDate = doc.createdAt;
        }
      });
      stats.averageRating = overallSum / totalFeedback;
      ratingKeys.forEach((key) => {
        const entry = stats.categoryAverages[key];
        entry.average = entry.count ? entry.total / entry.count : 0;
      });
    }

    const feedback = feedbackDocs.map((doc) => ({
      id: doc._id,
      studentName: doc.isAnonymous ? 'Anonymous Student' : doc.studentName || 'Student',
      className: doc.className || '',
      sectionName: doc.sectionName || '',
      subjectName: doc.subjectName,
      ratings: doc.ratings || {},
      overallRating: Number(doc.overallRating) || 0,
      comments: doc.comments || '',
      createdAt: doc.createdAt,
      isAnonymous: Boolean(doc.isAnonymous)
    }));

    res.json({ stats, feedback });
  } catch (err) {
    console.error('Teacher feedback fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/complaints', authTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const teacher = await TeacherUser.findById(teacherId).select('name email').lean();
    if (!teacher) return res.status(404).json({ error: 'Teacher account not found' });

    const orConditions = [];
    const variants = toObjectIdVariants(teacherId);
    variants.forEach((variant) => {
      orConditions.push({ 'requestDetails.teacherId': variant });
    });
    if (teacher.email) {
      orConditions.push({ targetEmail: teacher.email });
    }
    if (!orConditions.length) {
      orConditions.push({ 'requestDetails.teacherId': teacherId });
    }

    const complaints = await SupportRequest.find({
      supportType: 'complaint',
      schoolId,
      $or: orConditions,
    })
      .sort({ createdAt: -1 })
      .lean();

    const stats = complaints.reduce(
      (acc, doc) => {
        acc.total += 1;
        if (doc.status === 'open') acc.open += 1;
        else if (doc.status === 'in_progress') acc.inProgress += 1;
        else if (doc.status === 'resolved') acc.resolved += 1;
        return acc;
      },
      { total: 0, open: 0, inProgress: 0, resolved: 0 }
    );

    res.json({
      stats,
      complaints: complaints.map(formatTeacherComplaint),
    });
  } catch (err) {
    console.error('Teacher complaints fetch error:', err);
    res.status(500).json({ error: err.message || 'Unable to load complaints' });
  }
});

router.put('/complaints/:id/status', authTeacher, async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const { id } = req.params;
    const { status, resolutionNotes } = req.body || {};
    const allowedStatuses = ['open', 'in_progress', 'resolved'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const teacher = await TeacherUser.findById(teacherId).select('name email').lean();
    if (!teacher) return res.status(404).json({ error: 'Teacher account not found' });

    const orConditions = [];
    const variants = toObjectIdVariants(teacherId);
    variants.forEach((variant) => orConditions.push({ 'requestDetails.teacherId': variant }));
    if (teacher.email) orConditions.push({ targetEmail: teacher.email });
    if (!orConditions.length) orConditions.push({ 'requestDetails.teacherId': teacherId });

    const complaint = await SupportRequest.findOne({
      _id: id,
      supportType: 'complaint',
      schoolId,
      $or: orConditions,
    });

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    complaint.status = status;
    if (typeof resolutionNotes === 'string') {
      complaint.resolutionNotes = resolutionNotes;
    }
    complaint.auditTrail = complaint.auditTrail || [];
    complaint.auditTrail.push({
      status,
      note: resolutionNotes || `Marked as ${status}`,
      changedBy: teacherId,
      changedByName: teacher.name || 'Teacher',
    });

    if (status === 'resolved') {
      complaint.resolvedBy = teacherId;
      complaint.resolvedByName = teacher.name || 'Teacher';
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    res.json(formatTeacherComplaint(complaint));
  } catch (err) {
    console.error('Teacher complaint update error:', err);
    res.status(500).json({ error: err.message || 'Unable to update complaint' });
  }
});

module.exports = router;
