const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const Notification = require('../models/Notification');
const TeacherUser = require('../models/TeacherUser');
const TeacherAllocation = require('../models/TeacherAllocation');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

// Certificate upload — a single photo or PDF, capped at 2MB.
const CERTIFICATE_MAX_BYTES = 2 * 1024 * 1024;
const CERTIFICATE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
]);
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CERTIFICATE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (CERTIFICATE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'certificate'));
  },
}).single('certificate');

// Wraps the multer middleware so file-size / file-type errors return a clean
// 400/413 instead of bubbling to the generic error handler.
const withCertificate = (req, res, next) => certificateUpload(req, res, (err) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Certificate must be 2MB or smaller.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Certificate must be an image (JPG/PNG/WebP) or a PDF.' });
    }
    return res.status(400).json({ error: 'Certificate upload failed. Please try again.' });
  }
  return next(err);
});

const uploadCertificateFile = async (file, { studentId }) => {
  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: 'student_achievements',
    resource_type: 'auto',
    access_mode: 'public',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    context: { studentId: String(studentId || '') },
  });
  return result?.secure_url || '';
};

const normalize = (value = '') => String(value || '').trim();
const normalizeLower = (value = '') => normalize(value).toLowerCase();
const escapeRegexLiteral = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactCI = (value) => new RegExp(`^${escapeRegexLiteral(normalize(value))}$`, 'i');
// campusId filter that also matches school-level (null / missing) records, so a
// teacher scoped to a campus still resolves classes created without one.
const lenientCampusFilter = (campusId) => (
  campusId ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] } : {}
);

const buildClassCandidates = (rawClassName) => {
  const value = normalize(rawClassName);
  const candidates = new Set();
  if (!value) return [];
  candidates.add(value);
  const bare = value.replace(/^class\s+/i, '').trim();
  if (bare) {
    candidates.add(bare);
    candidates.add(`Class ${bare}`);
  }
  return Array.from(candidates);
};

const resolveClassTeacherAuthorization = async ({ schoolId, campusId, teacherId, student }) => {
  const classCandidates = buildClassCandidates(student.grade || student.className || student.class);
  const sectionName = normalize(student.section || student.sectionName);
  if (!classCandidates.length || !sectionName) {
    return { error: 'Student class/section is missing' };
  }

  const classDoc = await ClassModel.findOne({
    schoolId,
    ...lenientCampusFilter(campusId),
    // Case-insensitive so "5" ↔ "class 5" ↔ "Class 5" all resolve.
    name: { $in: classCandidates.map(exactCI) },
  }).select('_id name').lean();

  if (!classDoc) {
    return { error: 'Student class could not be resolved' };
  }

  const sectionDoc = await Section.findOne({
    schoolId,
    ...lenientCampusFilter(campusId),
    classId: classDoc._id,
    name: exactCI(sectionName),
  }).select('_id name').lean();

  if (!sectionDoc) {
    return { error: 'Student section could not be resolved' };
  }

  const allocation = await TeacherAllocation.findOne({
    schoolId,
    ...lenientCampusFilter(campusId),
    teacherId,
    classId: classDoc._id,
    sectionId: sectionDoc._id,
    // A no-subject allocation is the class-teacher record (matches how
    // utils/teacherAllocationScope treats it).
    $and: [{ $or: [{ isClassTeacher: true }, { subjectId: null }, { subjectId: { $exists: false } }] }],
  }).lean();

  if (!allocation) {
    return { error: 'Only the class teacher can manage achievements for this student', statusCode: 403 };
  }

  return { classDoc, sectionDoc, allocation };
};

const resolveLinkedParentIds = async ({ schoolId, campusId, student }) => {
  const studentName = normalize(student?.name);
  const guardianNames = [student?.fatherName, student?.motherName, student?.guardianName]
    .map((value) => normalize(value))
    .filter(Boolean);
  const parentFilter = {
    schoolId,
    ...(campusId ? { campusId } : {}),
    $or: [
      { childrenIds: student?._id },
      ...(studentName ? [{ children: studentName }] : []),
      ...(guardianNames.length ? [{ name: { $in: guardianNames } }] : []),
    ],
  };
  const parents = await ParentUser.find(parentFilter).select('_id').lean();
  return Array.from(new Set(parents.map((item) => String(item?._id)).filter(Boolean)));
};

const createAchievementNotifications = async ({
  schoolId,
  campusId,
  teacherId,
  teacherName,
  student,
  achievementTitle,
  achievementCategory,
}) => {
  const studentName = normalize(student?.name) || 'Student';
  const safeTeacherName = normalize(teacherName) || 'Class Teacher';
  const safeCategory = normalize(achievementCategory) || 'Achievement';
  const sharedMeta = {
    schoolId,
    campusId: campusId || null,
    createdByType: 'teacher',
    createdByTeacherId: teacherId,
    createdByName: safeTeacherName,
    type: 'announcement',
    typeLabel: 'Achievement',
    priority: 'medium',
    category: 'academic',
    className: normalize(student?.grade),
    sectionName: normalize(student?.section),
  };

  const notifications = [
    {
      ...sharedMeta,
      title: 'New Achievement Unlocked',
      message: `New achievement unlocked: "${achievementTitle}" (${safeCategory}).`,
      audience: 'Student',
      targetUserIds: [student._id],
    },
  ];

  const parentIds = await resolveLinkedParentIds({ schoolId, campusId, student });
  if (parentIds.length) {
    notifications.push({
      ...sharedMeta,
      title: 'Your Child Got an Achievement',
      message: `${studentName} got an achievement: "${achievementTitle}" (${safeCategory}).`,
      audience: 'Parent',
      targetUserIds: parentIds,
    });
  }

  if (notifications.length) {
    await Notification.insertMany(notifications, { ordered: false });
  }
};

router.get('/teacher/list', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    const campusId = req.campusId || null;
    const teacherId = req.teacher?.id || req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const session = normalize(req.query?.session);
    const className = normalize(req.query?.className);
    const section = normalize(req.query?.section);
    const studentId = normalize(req.query?.studentId);

    const allocations = await TeacherAllocation.find({
      schoolId,
      ...lenientCampusFilter(campusId),
      teacherId,
      $and: [{ $or: [{ isClassTeacher: true }, { subjectId: null }, { subjectId: { $exists: false } }] }],
    })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();

    // Expand each allocation into "class N" / "N" tolerant pairs so they match
    // StudentUser.grade ("5") against the Class doc name ("class 5").
    const allocationPairs = allocations.flatMap((item) => {
      const section = normalizeLower(item?.sectionId?.name);
      return buildClassCandidates(item?.classId?.name)
        .map((candidate) => ({ className: normalizeLower(candidate), sectionName: section }));
    });

    const studentFilter = {
      schoolId,
      ...(campusId ? { campusId } : {}),
      ...(studentId && mongoose.isValidObjectId(studentId) ? { _id: studentId } : {}),
    };
    const students = await StudentUser.find(studentFilter)
      .select('name grade section academicYear achievements')
      .sort({ name: 1 })
      .lean();

    const filteredStudents = students.filter((student) => {
      const studentSession = normalizeLower(student?.academicYear);
      const studentClassValue = normalize(student?.grade || student?.className || student?.class);
      const studentSectionValue = normalizeLower(student?.section || student?.sectionName);
      const studentClassCandidates = buildClassCandidates(studentClassValue).map((v) => normalizeLower(v));
      const hasAllocation = allocationPairs.some((pair) =>
        pair.sectionName === studentSectionValue &&
        studentClassCandidates.includes(pair.className)
      );
      if (!hasAllocation) return false;
      if (session && studentSession !== normalizeLower(session)) return false;
      if (className && !studentClassCandidates.includes(normalizeLower(className))) return false;
      if (section && studentSectionValue !== normalizeLower(section)) return false;
      return true;
    });

    const achievements = filteredStudents.flatMap((student) => {
      const items = Array.isArray(student.achievements) ? student.achievements : [];
      return items.map((achievement) => ({
        studentId: student._id,
        studentName: student.name || 'Student',
        className: student.grade || '',
        sectionName: student.section || '',
        achievementId: achievement?._id,
        title: achievement?.title || '',
        date: achievement?.date || null,
        description: achievement?.description || '',
        category: achievement?.category || 'Academic',
        certificateUrl: achievement?.certificateUrl || '',
        awardType: achievement?.awardType || '',
      }));
    });

    achievements.sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
    res.json({ achievements });
  } catch (err) {
    console.error('Teacher achievement list error:', err);
    res.status(500).json({ error: err.message || 'Unable to load achievements' });
  }
});

router.post('/teacher/upload', authTeacher, withCertificate, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    const campusId = req.campusId || null;
    const teacherId = req.teacher?.id || req.user?.id || null;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const studentId = req.body?.studentId;
    const title = normalize(req.body?.title);
    const dateValue = req.body?.date;
    const description = normalize(req.body?.description);
    const category = normalize(req.body?.category) || 'Academic';

    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!dateValue) {
      return res.status(400).json({ error: 'Achievement date is required' });
    }

    const achievementDate = new Date(dateValue);
    if (Number.isNaN(achievementDate.getTime())) {
      return res.status(400).json({ error: 'Invalid achievement date' });
    }

    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const authz = await resolveClassTeacherAuthorization({ schoolId, campusId, teacherId, student });
    if (authz?.error) {
      return res.status(authz.statusCode || 400).json({ error: authz.error });
    }

    const teacherDoc = await TeacherUser.findById(teacherId).select('name').lean();
    const teacherDisplayName = normalize(teacherDoc?.name || req.teacher?.name || req.teacher?.username);

    let certificateUrl = '';
    if (req.file) {
      try {
        certificateUrl = await uploadCertificateFile(req.file, { studentId });
      } catch (uploadErr) {
        console.error('Achievement certificate upload error:', uploadErr);
        return res.status(502).json({ error: 'Could not upload the certificate. Please try again.' });
      }
    }

    student.achievements = Array.isArray(student.achievements) ? student.achievements : [];
    const achievement = {
      title,
      date: achievementDate,
      description,
      category: ['Academic', 'Extra-Curricular', 'Sports', 'Other'].includes(category) ? category : 'Academic',
      awardType: certificateUrl ? 'Certificate' : 'Achievement',
      issuer: teacherDisplayName ? `Class Teacher - ${teacherDisplayName}` : 'Class Teacher',
      ...(certificateUrl ? { certificateUrl } : {}),
    };
    student.achievements.push(achievement);
    await student.save();

    try {
      await createAchievementNotifications({
        schoolId,
        campusId,
        teacherId,
        teacherName: teacherDisplayName,
        student,
        achievementTitle: title,
        achievementCategory: achievement.category,
      });
    } catch (notificationErr) {
      console.error('Achievement notification creation error:', notificationErr);
    }

    const created = student.achievements[student.achievements.length - 1];
    res.status(201).json({
      message: 'Achievement uploaded successfully',
      achievement: created,
    });
  } catch (err) {
    console.error('Teacher achievement upload error:', err);
    res.status(500).json({ error: err.message || 'Unable to upload achievement' });
  }
});

router.delete('/teacher/:studentId/:achievementId', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    const campusId = req.campusId || null;
    const teacherId = req.teacher?.id || req.user?.id || null;
    const studentId = req.params?.studentId;
    const achievementId = req.params?.achievementId;

    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }
    if (!achievementId || !mongoose.isValidObjectId(achievementId)) {
      return res.status(400).json({ error: 'Valid achievementId is required' });
    }

    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const authz = await resolveClassTeacherAuthorization({ schoolId, campusId, teacherId, student });
    if (authz?.error) {
      return res.status(authz.statusCode || 400).json({ error: authz.error });
    }

    const list = Array.isArray(student.achievements) ? student.achievements : [];
    const index = list.findIndex((item) => String(item?._id) === String(achievementId));
    if (index === -1) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    list.splice(index, 1);
    student.achievements = list;
    await student.save();

    res.json({ message: 'Achievement deleted successfully' });
  } catch (err) {
    console.error('Teacher achievement delete error:', err);
    res.status(500).json({ error: err.message || 'Unable to delete achievement' });
  }
});

router.put('/teacher/:studentId/:achievementId', authTeacher, withCertificate, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    const campusId = req.campusId || null;
    const teacherId = req.teacher?.id || req.user?.id || null;
    const studentId = req.params?.studentId;
    const achievementId = req.params?.achievementId;

    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }
    if (!achievementId || !mongoose.isValidObjectId(achievementId)) {
      return res.status(400).json({ error: 'Valid achievementId is required' });
    }

    const title = normalize(req.body?.title);
    const dateValue = req.body?.date;
    const description = normalize(req.body?.description);
    const category = normalize(req.body?.category) || 'Academic';

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!dateValue) {
      return res.status(400).json({ error: 'Achievement date is required' });
    }
    const achievementDate = new Date(dateValue);
    if (Number.isNaN(achievementDate.getTime())) {
      return res.status(400).json({ error: 'Invalid achievement date' });
    }

    const student = await StudentUser.findOne({
      _id: studentId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const authz = await resolveClassTeacherAuthorization({ schoolId, campusId, teacherId, student });
    if (authz?.error) {
      return res.status(authz.statusCode || 400).json({ error: authz.error });
    }

    const list = Array.isArray(student.achievements) ? student.achievements : [];
    const index = list.findIndex((item) => String(item?._id) === String(achievementId));
    if (index === -1) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    list[index].title = title;
    list[index].date = achievementDate;
    list[index].description = description;
    list[index].category = ['Academic', 'Extra-Curricular', 'Sports', 'Other'].includes(category) ? category : 'Academic';

    if (req.file) {
      try {
        const newUrl = await uploadCertificateFile(req.file, { studentId });
        if (newUrl) {
          list[index].certificateUrl = newUrl;
          if (!list[index].awardType || list[index].awardType === 'Achievement') {
            list[index].awardType = 'Certificate';
          }
        }
      } catch (uploadErr) {
        console.error('Achievement certificate upload error:', uploadErr);
        return res.status(502).json({ error: 'Could not upload the certificate. Please try again.' });
      }
    } else if (String(req.body?.removeCertificate) === 'true') {
      list[index].certificateUrl = '';
    }

    student.achievements = list;
    await student.save();

    const updated = student.achievements.find((item) => String(item?._id) === String(achievementId)) || null;
    res.json({ message: 'Achievement updated successfully', achievement: updated });
  } catch (err) {
    console.error('Teacher achievement update error:', err);
    res.status(500).json({ error: err.message || 'Unable to update achievement' });
  }
});

module.exports = router;
