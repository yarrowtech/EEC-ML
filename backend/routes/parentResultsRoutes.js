const express = require('express');
const authParent = require('../middleware/authParent');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const { studentExamResultsHandler } = require('./examRoute');
const { studentResultsHandler } = require('./studentRoute');

const router = express.Router();

/**
 * Parent → child scope. Verifies `?studentId=` is one of the signed-in parent's
 * children, then runs the student's own handler as that child so the parent
 * sees exactly what the student sees (published results only).
 */
const asLinkedChild = async (req, res, next) => {
  try {
    const studentId = String(req.query?.studentId || '').trim();
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    const parent = await ParentUser.findById(req.user.id).select('childrenIds children').lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    let linked = Array.isArray(parent.childrenIds)
      && parent.childrenIds.some((id) => String(id) === studentId);
    if (!linked && Array.isArray(parent.children) && parent.children.length) {
      // Legacy parents linked by child name only.
      const child = await StudentUser.findById(studentId).select('name').lean();
      linked = Boolean(child) && parent.children.some((n) => String(n || '').trim() === String(child.name || '').trim());
    }
    if (!linked) return res.status(403).json({ error: 'Student not linked to parent account' });

    req.parentId = req.user.id;
    req.user = { ...req.user, id: studentId, _id: studentId };
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to resolve child' });
  }
};

// GET /api/parent/results/exams?studentId=…        → same shape as /api/exam/results/me
router.get('/exams', authParent, asLinkedChild, studentExamResultsHandler);
// GET /api/parent/results/assignments?studentId=…  → same shape as /api/student/auth/results
router.get('/assignments', authParent, asLinkedChild, studentResultsHandler);

module.exports = router;
