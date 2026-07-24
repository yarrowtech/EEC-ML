/**
 * Learning Path Routes  –  /api/learning-paths
 *
 * Teacher endpoints (authTeacher):
 *   POST   /publish                          – publish / re-publish a path to a student
 *   GET    /teacher                          – all paths published by the logged-in teacher
 *   GET    /teacher/student/:studentId       – paths for one specific student
 *   PUT    /teacher/:pathId/node             – teacher marks a node done/active/locked
 *   DELETE /teacher/:pathId                  – archive (soft-delete) a published path
 *
 * Student endpoints (authStudentSoft):
 *   GET    /student                          – own published paths (token identifies student)
 *   PUT    /student/:pathId/node             – student marks an active node as done
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const authTeacher = require('../middleware/authTeacher');
const authStudentSoft = require('../middleware/authStudentSoft');
const TeacherLearningPath = require('../models/TeacherLearningPath');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');
const { logger } = require('../utils/logger');

// ─── helpers ────────────────────────────────────────────────────────────────

const recalcProgress = (nodes = []) => {
  if (!nodes.length) return 0;
  const done = nodes.filter((n) => n.status === 'done').length;
  return Math.round((done / nodes.length) * 100);
};

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── TEACHER ROUTES ─────────────────────────────────────────────────────────

/**
 * POST /api/learning-paths/publish
 * Body: { studentId, subject, focus, pace, notes, nodes[], cls }
 *
 * Creates a new path or replaces an existing published one for the same
 * teacher → student → subject combination.
 */
router.post('/publish', authTeacher, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId missing from token' });
    if (!teacherId) return res.status(400).json({ error: 'teacherId missing from token' });

    const { studentId, subject, focus, pace, notes, nodes = [], cls } = req.body;

    if (!studentId || !subject) {
      return res.status(400).json({ error: 'studentId and subject are required' });
    }
    if (!validateObjectId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return res.status(400).json({ error: 'nodes must be a non-empty array' });
    }

    // Verify the student belongs to this school
    const student = await StudentUser.findOne({ _id: studentId, schoolId })
      .select('name grade section className sectionName')
      .lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found in this school' });
    }

    const teacher = await TeacherUser.findById(teacherId).select('name').lean();
    const teacherName = teacher?.name || 'Teacher';
    const studentName = student.name || 'Student';

    const builtNodes = nodes.map((n, i) => ({
      idx: i,
      title: String(n.title || '').trim() || `Step ${i + 1}`,
      bloom: n.bloom || '',
      tier: ['blue', 'orange', 'purple', 'green'].includes(n.tier) ? n.tier : 'blue',
      hasLesson: Boolean(n.hasLesson),
      status: i === 0 ? 'active' : 'locked',
      completedAt: null,
    }));

    // Archive any existing published path for this teacher → student → subject
    await TeacherLearningPath.updateMany(
      { schoolId, teacherId, studentId, subject, status: 'published' },
      { $set: { status: 'archived' } }
    );

    const path = await TeacherLearningPath.create({
      schoolId,
      teacherId,
      teacherName,
      studentId,
      studentName,
      cls: cls || [student.grade || student.className, student.section || student.sectionName].filter(Boolean).join('-'),
      subject,
      focus: focus || subject,
      pace: pace || '1 week',
      notes: notes || '',
      nodes: builtNodes,
      progress: 0,
      status: 'published',
      publishedAt: new Date(),
    });

    logger.info({ pathId: path._id, teacherId, studentId, subject }, 'Learning path published');

    return res.status(201).json({
      success: true,
      message: `Learning path published to ${studentName}`,
      pathId: path._id,
    });
  } catch (err) {
    logger.error({ err }, 'Error publishing learning path');
    return res.status(500).json({ error: err.message || 'Failed to publish learning path' });
  }
});

/**
 * GET /api/learning-paths/teacher
 * Returns all paths published by the logged-in teacher, newest first.
 */
router.get('/teacher', authTeacher, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    const { status = 'published', studentId } = req.query;

    const filter = { schoolId, teacherId, status };
    if (studentId && validateObjectId(studentId)) filter.studentId = studentId;

    const paths = await TeacherLearningPath.find(filter)
      .sort({ publishedAt: -1 })
      .lean();

    return res.json({ success: true, paths });
  } catch (err) {
    logger.error({ err }, 'Error fetching teacher learning paths');
    return res.status(500).json({ error: 'Failed to fetch learning paths' });
  }
});

/**
 * GET /api/learning-paths/teacher/student/:studentId
 * Returns published paths for a specific student (teacher view).
 */
router.get('/teacher/student/:studentId', authTeacher, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    const { studentId } = req.params;

    if (!validateObjectId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const paths = await TeacherLearningPath.find({
      schoolId,
      teacherId,
      studentId,
      status: 'published',
    })
      .sort({ publishedAt: -1 })
      .lean();

    return res.json({ success: true, paths });
  } catch (err) {
    logger.error({ err }, 'Error fetching student learning paths (teacher view)');
    return res.status(500).json({ error: 'Failed to fetch learning paths' });
  }
});

/**
 * PUT /api/learning-paths/teacher/:pathId/node
 * Body: { nodeIdx, status }  — teacher can set any status on any node.
 */
router.put('/teacher/:pathId/node', authTeacher, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    const { pathId } = req.params;
    const { nodeIdx, status } = req.body;

    if (!validateObjectId(pathId)) return res.status(400).json({ error: 'Invalid pathId' });
    if (typeof nodeIdx !== 'number') return res.status(400).json({ error: 'nodeIdx must be a number' });
    if (!['active', 'locked', 'done'].includes(status)) {
      return res.status(400).json({ error: 'status must be active | locked | done' });
    }

    const path = await TeacherLearningPath.findOne({ _id: pathId, schoolId, teacherId });
    if (!path) return res.status(404).json({ error: 'Learning path not found' });

    if (!path.nodes[nodeIdx]) {
      return res.status(400).json({ error: `Node index ${nodeIdx} does not exist` });
    }

    path.nodes[nodeIdx].status = status;
    if (status === 'done') {
      path.nodes[nodeIdx].completedAt = new Date();
      if (path.nodes[nodeIdx + 1] && path.nodes[nodeIdx + 1].status === 'locked') {
        path.nodes[nodeIdx + 1].status = 'active';
      }
    }

    path.progress = recalcProgress(path.nodes);
    await path.save();

    return res.json({ success: true, progress: path.progress, nodes: path.nodes });
  } catch (err) {
    logger.error({ err }, 'Error updating learning path node (teacher)');
    return res.status(500).json({ error: 'Failed to update node' });
  }
});

/**
 * DELETE /api/learning-paths/teacher/:pathId
 * Soft-deletes (archives) a published path.
 */
router.delete('/teacher/:pathId', authTeacher, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    const { pathId } = req.params;

    if (!validateObjectId(pathId)) return res.status(400).json({ error: 'Invalid pathId' });

    const path = await TeacherLearningPath.findOne({ _id: pathId, schoolId, teacherId });
    if (!path) return res.status(404).json({ error: 'Learning path not found' });

    path.status = 'archived';
    await path.save();

    return res.json({ success: true, message: 'Learning path unpublished' });
  } catch (err) {
    logger.error({ err }, 'Error archiving learning path');
    return res.status(500).json({ error: 'Failed to unpublish learning path' });
  }
});

// ─── STUDENT ROUTES ─────────────────────────────────────────────────────────

/**
 * GET /api/learning-paths/student
 * Returns all published paths for the authenticated student.
 */
router.get('/student', authStudentSoft, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const studentId = req.userId;
    const schoolId = req.schoolId;

    if (!studentId) return res.status(401).json({ error: 'Student ID missing from token' });

    const paths = await TeacherLearningPath.find({
      studentId,
      schoolId,
      status: 'published',
    })
      .sort({ publishedAt: -1 })
      .lean();

    return res.json({ success: true, paths });
  } catch (err) {
    logger.error({ err }, 'Error fetching student learning paths');
    return res.status(500).json({ error: 'Failed to fetch learning paths' });
  }
});

/**
 * PUT /api/learning-paths/student/:pathId/node
 * Body: { nodeIdx }  — student marks the active node as done.
 * Only the currently 'active' node can be completed by the student.
 */
router.put('/student/:pathId/node', authStudentSoft, async (req, res) => {
  // #swagger.tags = ['Learning Paths']
  try {
    const studentId = req.userId;
    const schoolId = req.schoolId;
    const { pathId } = req.params;
    const { nodeIdx } = req.body;

    if (!studentId) return res.status(401).json({ error: 'Student ID missing from token' });
    if (!validateObjectId(pathId)) return res.status(400).json({ error: 'Invalid pathId' });
    if (typeof nodeIdx !== 'number') return res.status(400).json({ error: 'nodeIdx must be a number' });

    const path = await TeacherLearningPath.findOne({
      _id: pathId,
      studentId,
      schoolId,
      status: 'published',
    });
    if (!path) return res.status(404).json({ error: 'Learning path not found' });

    const node = path.nodes[nodeIdx];
    if (!node) return res.status(400).json({ error: `Node index ${nodeIdx} does not exist` });
    if (node.status !== 'active') {
      return res.status(400).json({ error: 'Only the active node can be marked complete' });
    }

    path.nodes[nodeIdx].status = 'done';
    path.nodes[nodeIdx].completedAt = new Date();

    // Unlock the next node
    if (path.nodes[nodeIdx + 1]) {
      path.nodes[nodeIdx + 1].status = 'active';
    }

    path.progress = recalcProgress(path.nodes);
    await path.save();

    return res.json({ success: true, progress: path.progress, nodes: path.nodes });
  } catch (err) {
    logger.error({ err }, 'Error completing learning path node (student)');
    return res.status(500).json({ error: 'Failed to update progress' });
  }
});

module.exports = router;
