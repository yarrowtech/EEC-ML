const express = require('express');
const router = express.Router();
const StudentUser = require('../models/StudentUser');
const TeacherAllocation = require('../models/TeacherAllocation');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const auth = require('../middleware/authStudent');
const multer = require('multer');
const { logger } = require('../utils/logger');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');
const { getJson, setJson } = require('../utils/redisClient');
const { getStudentSubjectsCacheKey } = require('../utils/studentSubjectsCache');

// Setup multer for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024 } });
const ALLOWED_PROFILE_PIC_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// POST request to update student profile
router.post('/profile/update', auth, upload.single('profilePic'), async (req, res) => {
  // #swagger.tags = ['Student Profile']
  try {
    logStudentPortalEvent(req, {
      feature: 'profile',
      action: 'profile_update.submit',
      targetType: 'student',
      targetId: req.user?.id,
      hasProfilePic: Boolean(req.file),
    });
    const updates = { ...(req.body || {}) };
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    // Handle profilePic if included
    if (req.file) {
      if (!ALLOWED_PROFILE_PIC_MIME_TYPES.has(req.file.mimetype)) {
        return res.status(400).json({ error: 'Only JPEG, PNG, WEBP, or GIF images are allowed' });
      }
      updates.profilePic = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Do not overwrite DOB with empty value from form submits.
    if (Object.prototype.hasOwnProperty.call(updates, 'dob')) {
      const dobValue = String(updates.dob || '').trim();
      if (!dobValue) {
        delete updates.dob;
      } else {
        updates.dob = dobValue;
      }
    }

    const updatedStudent = await StudentUser.findOneAndUpdate(
      { _id: req.user.id, schoolId },
      updates,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Profile updated successfully', student: updatedStudent });
    logStudentPortalEvent(req, {
      feature: 'profile',
      action: 'profile_update.submit',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'profile',
      action: 'profile_update.submit',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  // #swagger.tags = ['Student Profile']
  try {
    logStudentPortalEvent(req, {
      feature: 'profile',
      action: 'profile.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const student = await StudentUser.findOne({ _id: req.user.id, schoolId }).select('-password');
    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'profile',
        action: 'profile.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
    logStudentPortalEvent(req, {
      feature: 'profile',
      action: 'profile.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'profile',
      action: 'profile.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET allocated subjects for the logged-in student
router.get('/allocated-subjects', auth, async (req, res) => {
  // #swagger.tags = ['Student Profile']
  try {
    logStudentPortalEvent(req, {
      feature: 'tryouts',
      action: 'allocated_subjects.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const campusId = req.campusId || req.user?.campusId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    // Get student details
    const student = await StudentUser.findOne({ _id: req.user.id, schoolId }).select('grade section');
    if (!student) {
      logStudentPortalEvent(req, {
        feature: 'tryouts',
        action: 'allocated_subjects.fetch',
        outcome: 'not_found',
        statusCode: 404,
        targetType: 'student',
        targetId: req.user?.id,
      });
      return res.status(404).json({ error: 'Student not found' });
    }

    // Find class and section by name
    const classDoc = await Class.findOne({ schoolId, name: student.grade });
    const sectionDoc = await Section.findOne({ schoolId, name: student.section });

    if (!classDoc || !sectionDoc) {
      logStudentPortalEvent(req, {
        feature: 'tryouts',
        action: 'allocated_subjects.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: 0,
      });
      return res.json({ subjects: [] });
    }

    // The key is scoped to the tenant, school, campus, class, section, and
    // authenticated student. Never use a shared key for this private response.
    const cacheKey = await getStudentSubjectsCacheKey({
      organizationId: req.organizationId,
      schoolId,
      campusId,
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      studentId: req.user.id,
    });
    const cachedResponse = await getJson(cacheKey);
    if (cachedResponse) {
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Cache', 'HIT');
      logStudentPortalEvent(req, {
        feature: 'tryouts',
        action: 'allocated_subjects.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: req.user?.id,
        resultCount: cachedResponse.subjects?.length || 0,
        cache: 'hit',
      });
      return res.json(cachedResponse);
    }

    // Find all teacher allocations for this class/section
    const allocations = await TeacherAllocation.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      subjectId: { $ne: null }
    })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean();

    // Extract unique subjects with teacher info
    const subjectMap = new Map();
    allocations.forEach(allocation => {
      if (allocation.subjectId) {
        const subjectId = allocation.subjectId._id.toString();
        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            _id: allocation.subjectId._id,
            name: allocation.subjectId.name,
            code: allocation.subjectId.code,
            teachers: []
          });
        }
        if (allocation.teacherId) {
          subjectMap.get(subjectId).teachers.push({
            id: allocation.teacherId._id,
            name: allocation.teacherId.name
          });
        }
      }
    });

    const subjects = Array.from(subjectMap.values());
    const response = { subjects };

    // A short TTL limits staleness. Allocation writes bump the scope version.
    await setJson(cacheKey, response, 60);

    res.set('Cache-Control', 'private, no-store');
    res.set('X-Cache', 'MISS');
    res.json(response);
    logStudentPortalEvent(req, {
      feature: 'tryouts',
      action: 'allocated_subjects.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: subjects.length,
      cache: 'miss',
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'tryouts',
      action: 'allocated_subjects.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    (req.log || logger).error({ err, studentId: req.user?.id }, 'Error fetching allocated subjects');
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;
