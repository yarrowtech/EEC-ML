const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const StudentProgress = require('../models/StudentProgress');
const StudentUser = require('../models/StudentUser');
const Assignment = require('../models/Assignment');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');

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

// Get progress for all students
router.get('/students', adminAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { grade, section, subject } = req.query;
    
    let studentFilter = { schoolId, status: 'Active' };
    applyGradeAndSectionFilter(studentFilter, { grade, section });

    const students = await StudentUser.find(studentFilter).select('name grade section roll');
    const studentIds = students.map(student => student._id);

    let progressQuery = { studentId: { $in: studentIds }, schoolId };
    
    const progressData = await StudentProgress.find(progressQuery)
      .populate('studentId', 'name grade section roll')
      .lean();

    // Filter by subject if specified
    let filteredData = progressData;
    if (subject) {
      filteredData = progressData.map(progress => ({
        ...progress,
        progressMetrics: progress.progressMetrics.filter(metric => metric.subject === subject)
      }));
    }

    res.status(200).json(filteredData);
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detailed progress for a specific student
router.get('/student/:studentId', adminAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId } = req.params;

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

    if (req.campusId) {
      const campusStudent = await StudentUser.findOne({
        _id: studentId,
        schoolId,
        campusId: req.campusId,
      }).select('_id');
      if (!campusStudent) {
        return res.status(403).json({ error: 'Student not in your campus' });
      }
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
router.get('/analytics', adminAuth, async (req, res) => {
  // #swagger.tags = ['Progress']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { grade, section, subject, academicYearId } = req.query;

    let studentFilter = { schoolId, status: 'Active' };
    applyGradeAndSectionFilter(studentFilter, { grade, section });

    if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
      studentFilter.academicYear = academicYearId;
    }

    const students = await StudentUser.find(studentFilter);
    const studentIds = students.map(student => student._id);

    const progressData = await StudentProgress.find({ studentId: { $in: studentIds }, schoolId })
      .populate('studentId', 'name grade section');

    // Calculate analytics
    let analytics = {
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
        analytics.improvementTrends[progress.improvementTrend]++;

        // Subject performance and attendance
        progress.progressMetrics.forEach(metric => {
          if (!subject || metric.subject === subject) {
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
          }
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
