const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const StudentProgress = require('../models/StudentProgress');
const StudentUser = require('../models/StudentUser');
const Assignment = require('../models/Assignment');
const AcademicYear = require('../models/AcademicYear');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');
const {
  allowedSubjectsForStudent,
  buildTeacherAllocationScope,
  scopeAllowsRequest,
  studentIsWithinTeacherScope,
} = require('../utils/teacherAllocationScope');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toGradeVariants = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const variants = new Set([raw]);
  const noClassPrefix = raw.replace(/^class\s*/i, '').trim();
  if (noClassPrefix) {
    variants.add(noClassPrefix);
    variants.add(`Class ${noClassPrefix}`);
  }

  const num = noClassPrefix.match(/\d+/)?.[0];
  if (num) {
    variants.add(num);
    variants.add(`Class ${num}`);
  }

  return Array.from(variants).filter(Boolean);
};

const applyGradeAndSectionFilter = (studentFilter, { grade, section }) => {
  if (grade) {
    const gradePatterns = toGradeVariants(grade).map(
      (item) => new RegExp(`^${escapeRegex(item)}$`, 'i')
    );
    if (gradePatterns.length) {
      studentFilter.grade = { $in: gradePatterns };
    }
  }

  if (section) {
    studentFilter.section = new RegExp(`^${escapeRegex(String(section).trim())}$`, 'i');
  }
};

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || req.user?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  return schoolId;
};

const isTeacherRequest = (req) => (
  String(req.user?.userType || req.user?.type || req.userType || '').toLowerCase() === 'teacher'
);

const loadVisibleStudents = async (req, res, { grade, section, subject, academicYearId } = {}) => {
  const schoolId = resolveSchoolId(req, res);
  if (!schoolId) return null;

  const studentFilter = { schoolId, status: 'Active' };
  if (req.campusId) studentFilter.campusId = req.campusId;
  applyGradeAndSectionFilter(studentFilter, { grade, section });

  if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
    const year = await AcademicYear.findOne({ _id: academicYearId, schoolId }).select('name').lean();
    if (year?.name) {
      studentFilter.academicYear = new RegExp(`^${escapeRegex(year.name.trim())}$`, 'i');
    }
  }

  const students = await StudentUser.find(studentFilter)
    .select('name grade section roll academicYear campusId')
    .lean();
  if (!isTeacherRequest(req)) return { schoolId, students, scope: null };

  const scope = await buildTeacherAllocationScope({
    schoolId,
    campusId: req.campusId || null,
    teacherId: req.user?.id,
  });
  if (!scope.length) return { schoolId, students: [], scope };
  if ((grade || section || subject) && !scopeAllowsRequest(scope, { grade, section, subject })) {
    res.status(403).json({ error: 'Requested progress data is outside your assigned class, section, or subject.' });
    return null;
  }

  return {
    schoolId,
    students: students.filter((student) => studentIsWithinTeacherScope(student, scope)),
    scope,
  };
};

const filterMetricsForScope = ({ metrics = [], student, subject = '', scope = null }) => {
  const requestedSubject = String(subject || '').trim().toLowerCase();
  const allowedSubjects = scope ? allowedSubjectsForStudent(student, scope) : null;
  return (metrics || []).filter((metric) => {
    const metricSubject = String(metric?.subject || '').trim().toLowerCase();
    if (requestedSubject && metricSubject !== requestedSubject) return false;
    return allowedSubjects === null || allowedSubjects.has(metricSubject);
  });
};

// Get progress for all students.
// authTeacher accepts both admin and teacher tokens (see middleware/authTeacher),
// so the teacher analytics portal can read class progress without a 403 falling
// back to empty metrics. Scoping stays by schoolId + grade/section query params.
router.get('/students', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const { grade, section, subject } = req.query;
    const visible = await loadVisibleStudents(req, res, { grade, section, subject });
    if (!visible) return;
    const { schoolId, students, scope } = visible;
    const studentIds = students.map(student => student._id);
    const progressData = await StudentProgress.find({ studentId: { $in: studentIds }, schoolId }).lean();
    const progressByStudent = new Map(progressData.map((progress) => [String(progress.studentId), progress]));

    // A student remains visible before their first StudentProgress document exists.
    const response = students.map((student) => {
      const progress = progressByStudent.get(String(student._id)) || {};
      return {
        ...progress,
        _id: progress._id || null,
        studentId: student,
        progressMetrics: filterMetricsForScope({
          metrics: progress.progressMetrics || [],
          student,
          subject,
          scope,
        }),
        submissions: progress.submissions || [],
        overallGrade: progress.overallGrade || null,
        improvementTrend: progress.improvementTrend || 'stable',
      };
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed progress for a specific student
router.get('/student/:studentId', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId } = req.params;

    if (isTeacherRequest(req)) {
      const student = await StudentUser.findOne({ _id: studentId, schoolId })
        .select('grade section className sectionName')
        .lean();
      const scope = await buildTeacherAllocationScope({
        schoolId,
        campusId: req.campusId || null,
        teacherId: req.user?.id,
      });
      if (!student || !studentIsWithinTeacherScope(student, scope)) {
        return res.status(403).json({ error: 'Student is outside your assigned scope' });
      }
    }

    const progress = await StudentProgress.findOne({ studentId, schoolId })
      .populate('studentId', 'name grade section roll email mobile')
      .populate('submissions.assignmentId', 'title subject dueDate marks')
      .lean();

    if (!progress) {
      return res.status(404).json({ error: 'Student progress not found' });
    }

    res.status(200).json(progress);
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update student submission score and feedback
router.put('/submission/:studentId/:assignmentId', adminAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId, assignmentId } = req.params;
    const { score, feedback, status } = req.body;

    let progress = await StudentProgress.findOne({ studentId, schoolId });
    
    if (!progress) {
      // Create new progress record if doesn't exist
      progress = new StudentProgress({ studentId, schoolId, submissions: [] });
    }

    // Find existing submission or create new one
    const submissionIndex = progress.submissions.findIndex(
      sub => sub.assignmentId.toString() === assignmentId
    );

    if (submissionIndex >= 0) {
      // Update existing submission
      progress.submissions[submissionIndex].score = score;
      progress.submissions[submissionIndex].feedback = feedback;
      progress.submissions[submissionIndex].status = status || 'graded';
    } else {
      // Add new submission
      progress.submissions.push({
        assignmentId,
        score,
        feedback,
        status: status || 'graded'
      });
    }

    await progress.save();
    await recalculateProgressMetrics(studentId, schoolId);

    res.status(200).json({ message: 'Submission updated successfully' });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Teacher grading endpoint (uses same logic as admin)
router.put('/submission/grade/:studentId/:assignmentId', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId, assignmentId } = req.params;
    const { score, feedback, status } = req.body;

    const studentFilter = { _id: studentId, schoolId };
    if (req.campusId) studentFilter.campusId = req.campusId;
    const student = await StudentUser.findOne(studentFilter)
      .select('grade section className sectionName')
      .lean();
    const scope = await buildTeacherAllocationScope({
      schoolId,
      campusId: req.campusId || null,
      teacherId: req.user?.id,
    });
    if (!student || !studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'Student is outside your assigned scope' });
    }

    let progress = await StudentProgress.findOne({ studentId, schoolId });

    if (!progress) {
      progress = new StudentProgress({ studentId, schoolId, submissions: [] });
    }

    const submissionIndex = progress.submissions.findIndex(
      sub => sub.assignmentId.toString() === assignmentId
    );

    if (submissionIndex >= 0) {
      progress.submissions[submissionIndex].score = score;
      progress.submissions[submissionIndex].feedback = feedback;
      progress.submissions[submissionIndex].status = status || 'graded';
    } else {
      progress.submissions.push({
        assignmentId,
        score,
        feedback,
        status: status || 'graded'
      });
    }

    await progress.save();
    await recalculateProgressMetrics(studentId, schoolId);

    res.status(200).json({ message: 'Submission graded successfully' });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get class performance analytics
// authTeacher accepts admin + teacher tokens; both the admin dashboard and the
// teacher analytics portal call this.
router.get('/analytics', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const { grade, section, subject, academicYearId } = req.query;
    const visible = await loadVisibleStudents(req, res, { grade, section, subject, academicYearId });
    if (!visible) return;
    const { schoolId, students, scope } = visible;
    const studentIds = students.map(student => student._id);

    const progressData = await StudentProgress.find({ studentId: { $in: studentIds }, schoolId })
      .lean();
    const studentMap = new Map(students.map((student) => [String(student._id), student]));

    // Calculate analytics
    const analytics = {
      totalStudents: students.length,
      averageScore: 0,
      gradeDistribution: { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0, 'F': 0 },
      subjectPerformance: {},
      attendanceRate: 0,
      improvementTrends: { improving: 0, stable: 0, declining: 0 }
    };

    if (progressData.length > 0) {
      let totalScore = 0;
      let totalAttendance = 0;
      let scoreCount = 0;
      let attendanceCount = 0;

      progressData.forEach(progress => {
        // Grade distribution
        if (progress.overallGrade) {
          analytics.gradeDistribution[progress.overallGrade]++;
        }

        // Improvement trends
        const trend = ['improving', 'stable', 'declining'].includes(progress.improvementTrend)
          ? progress.improvementTrend
          : 'stable';
        analytics.improvementTrends[trend]++;

        // Subject performance and attendance
        const student = studentMap.get(String(progress.studentId));
        filterMetricsForScope({ metrics: progress.progressMetrics, student, subject, scope }).forEach(metric => {
            if (metric.averageScore > 0) {
              totalScore += metric.averageScore;
              scoreCount++;
            }
            
            if (metric.attendanceRate > 0) {
              totalAttendance += metric.attendanceRate;
              attendanceCount++;
            }

            if (!analytics.subjectPerformance[metric.subject]) {
              analytics.subjectPerformance[metric.subject] = {
                averageScore: 0,
                studentCount: 0,
                totalScore: 0
              };
            }
            
            analytics.subjectPerformance[metric.subject].totalScore += metric.averageScore;
            analytics.subjectPerformance[metric.subject].studentCount++;
        });
      });

      // Calculate averages
      analytics.averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
      analytics.attendanceRate = attendanceCount > 0 ? Math.round(totalAttendance / attendanceCount) : 0;

      // Calculate subject averages
      Object.keys(analytics.subjectPerformance).forEach(subj => {
        const perf = analytics.subjectPerformance[subj];
        perf.averageScore = perf.studentCount > 0 ? Math.round(perf.totalScore / perf.studentCount) : 0;
        delete perf.totalScore; // Remove temporary field
      });
    }

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Recalculate progress metrics for a student
async function recalculateProgressMetrics(studentId, schoolId) {
  try {
    const progress = await StudentProgress.findOne({ studentId, schoolId });
    const student = await StudentUser.findOne({ _id: studentId, schoolId });
    
    if (!progress || !student) return;

    // Get all assignments for calculation
    const assignments = await Assignment.find({ schoolId }).lean();
    
    // Group submissions by subject
    const subjectMetrics = {};
    
    progress.submissions.forEach(submission => {
      const assignment = assignments.find(a => a._id.toString() === submission.assignmentId.toString());
      if (!assignment) return;

      const subject = assignment.subject;
      if (!subjectMetrics[subject]) {
        subjectMetrics[subject] = {
          totalScore: 0,
          scoreCount: 0,
          totalAssignments: 0,
          completedAssignments: 0
        };
      }

      subjectMetrics[subject].totalAssignments++;
      if (submission.score !== undefined && submission.score !== null) {
        subjectMetrics[subject].totalScore += submission.score;
        subjectMetrics[subject].scoreCount++;
        subjectMetrics[subject].completedAssignments++;
      }
    });

    // Calculate attendance rate from student attendance data
    const attendanceBySubject = {};
    if (student.attendance && student.attendance.length > 0) {
      student.attendance.forEach(att => {
        const subject = att.subject || 'General';
        if (!attendanceBySubject[subject]) {
          attendanceBySubject[subject] = { present: 0, total: 0 };
        }
        attendanceBySubject[subject].total++;
        if (att.status === 'present') {
          attendanceBySubject[subject].present++;
        }
      });
    }

    // Update progress metrics
    progress.progressMetrics = Object.keys(subjectMetrics).map(subject => {
      const metrics = subjectMetrics[subject];
      const attendance = attendanceBySubject[subject] || { present: 0, total: 0 };
      
      return {
        subject,
        averageScore: metrics.scoreCount > 0 ? Math.round(metrics.totalScore / metrics.scoreCount) : 0,
        totalAssignments: metrics.totalAssignments,
        completedAssignments: metrics.completedAssignments,
        attendanceRate: attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0,
        lastUpdated: new Date()
      };
    });

    // Calculate overall grade based on average score
    const overallAverage = progress.progressMetrics.reduce((sum, metric) => sum + metric.averageScore, 0) / progress.progressMetrics.length;
    progress.overallGrade = calculateGrade(overallAverage);

    progress.lastUpdated = new Date();
    await progress.save();
  } catch (error) {
    console.error('Error recalculating metrics:', error);
  }
}

function calculateGrade(average) {
  if (average >= 97) return 'A+';
  if (average >= 93) return 'A';
  if (average >= 89) return 'B+';
  if (average >= 85) return 'B';
  if (average >= 81) return 'C+';
  if (average >= 77) return 'C';
  if (average >= 70) return 'D';
  return 'F';
}

module.exports = router;
