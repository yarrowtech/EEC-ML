const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const Timetable = require('../models/Timetable');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeacherUser = require('../models/TeacherUser');
const Room = require('../models/Room');
const {
  DEFAULT_DAYS,
  DEFAULT_PERIODS,
  initTracker,
  cloneTracker,
  generateTimetable,
} = require('../utils/timetableGenerator');
const { syncTimetableGroupThreads } = require('../utils/chatGroupProvisioning');

const router = express.Router();

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  if (!mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Invalid schoolId' });
    return null;
  }
  return schoolId;
};

const resolveCampusId = (req) => req.campusId || null;

const ensureSchoolAdmin = (req, res) => {
  if (req.isSuperAdmin) {
    res.status(403).json({ error: 'Only school admin can manage timetable routines' });
    return false;
  }
  return true;
};

const buildCampusFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) {
    filter.campusId = campusId;
  }
  return filter;
};

const resolveSectionId = (sectionId) => {
  if (!sectionId) return null;
  return mongoose.isValidObjectId(sectionId) ? sectionId : null;
};

const resolveDayOfWeek = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
};

const ensureClassExists = async (schoolId, campusId, classId) => {
  const classDoc = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
    .where({ _id: classId })
    .lean();
  return classDoc;
};

const ensureSectionExists = async (schoolId, campusId, classId, sectionId) => {
  if (!sectionId) return null;
  const sectionDoc = await Section.findOne(buildCampusFilter(schoolId, campusId))
    .where({ _id: sectionId, classId })
    .lean();
  return sectionDoc;
};

const extractIds = (entries, key) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => entry?.[key])
    .filter((id) => id && mongoose.isValidObjectId(id))
    .map((id) => String(id));
};

const ensureSubjectsExist = async (schoolId, campusId, classId, entries) => {
  const subjectIds = [...new Set(extractIds(entries, 'subjectId'))];
  if (subjectIds.length === 0) return true;
  const subjects = await Subject.find({
    _id: { $in: subjectIds },
    ...buildCampusFilter(schoolId, campusId),
  })
    .select('_id classId')
    .lean();
  if (subjects.length !== subjectIds.length) return false;
  if (classId) {
    const subjectClassIds = subjects
      .map((s) => (s.classId ? String(s.classId) : null))
      .filter(Boolean);
    if (subjectClassIds.some((id) => id !== String(classId))) {
      return false;
    }
  }
  return true;
};

const ensureTeachersExist = async (schoolId, campusId, entries) => {
  const teacherIds = [...new Set(extractIds(entries, 'teacherId'))];
  if (teacherIds.length === 0) return true;
  const teachers = await TeacherUser.find({
    _id: { $in: teacherIds },
    ...buildCampusFilter(schoolId, campusId),
  })
    .select('_id')
    .lean();
  return teachers.length === teacherIds.length;
};

const ensureRoomsExist = async (schoolId, campusId, entries) => {
  const roomIds = [...new Set(extractIds(entries, 'roomId'))];
  if (roomIds.length === 0) return new Map();
  const rooms = await Room.find({
    _id: { $in: roomIds },
    ...buildCampusFilter(schoolId, campusId),
  })
    .select('_id roomNumber')
    .lean();
  if (rooms.length !== roomIds.length) {
    return null;
  }
  const byId = new Map();
  rooms.forEach((room) => {
    byId.set(String(room._id), room);
  });
  return byId;
};

const normalizeEntriesWithRooms = (entries, roomMap) =>
  (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!entry?.roomId) {
      return entry;
    }
    const roomDoc = roomMap?.get(String(entry.roomId));
    if (!roomDoc) {
      return entry;
    }
    return {
      ...entry,
      roomId: roomDoc._id,
      room: roomDoc.roomNumber || entry.room || '',
    };
  });

const normalizeSubjectPlan = ({
  subjects,
  teacherPool,
  assignTeachers,
}) => {
  const poolBySubject = {};
  teacherPool.forEach((teacher) => {
    if (!teacher.subject) return;
    const key = String(teacher.subject).trim().toLowerCase();
    if (!poolBySubject[key]) poolBySubject[key] = [];
    poolBySubject[key].push(teacher);
  });

  return subjects.map((subject, index) => {
    const subjectName = subject.name || subject.label || subject.subjectName || '';
    const subjectKey = subjectName.toLowerCase();
    const candidates = poolBySubject[subjectKey] || [];
    const assignedTeacher = subject.teacherId
      ? teacherPool.find((t) => String(t._id) === String(subject.teacherId))
      : (assignTeachers ? candidates[0] : null);

    return {
      key: subject.subjectId ? String(subject.subjectId) : `subject-${index}-${subjectName}`,
      subjectId: subject.subjectId || subject._id || null,
      name: subjectName,
      teacherId: assignedTeacher?._id || null,
      weeklyCount: subject.weeklyCount,
      maxPerDay: subject.maxPerDay,
      isLab: Boolean(subject.isLab),
      preferMorning: Boolean(subject.preferMorning),
      afterBreakOnly: Boolean(subject.afterBreakOnly),
      avoidLastPeriod: subject.avoidLastPeriod !== false,
      room: subject.room || '',
    };
  });
};

const buildEntriesFromGrid = (grid) => {
  const entries = [];
  Object.entries(grid).forEach(([day, periods]) => {
    periods.forEach((periodSlot) => {
      if (periodSlot.isBreak || !periodSlot.entry) return;
      const subject = periodSlot.entry;
      entries.push({
        dayOfWeek: day,
        period: periodSlot.period,
        subjectId: subject.subjectId || undefined,
        teacherId: subject.teacherId || undefined,
        startTime: periodSlot.startTime,
        endTime: periodSlot.endTime,
        room: subject.room || '',
      });
    });
  });
  return entries;
};

const addExistingToTracker = (tracker, timetables) => {
  timetables.forEach((timetable) => {
    (timetable.entries || []).forEach((entry) => {
      if (!entry.teacherId || !entry.dayOfWeek || !entry.period) return;
      const day = entry.dayOfWeek;
      const periodIndex = (entry.period || 1) - 1;
      if (Number.isNaN(periodIndex)) return;
      if (!tracker.teacherDayPeriods[entry.teacherId]) {
        tracker.teacherDayPeriods[entry.teacherId] = {};
        tracker.teacherDayCounts[entry.teacherId] = {};
      }
      if (!tracker.teacherDayPeriods[entry.teacherId][day]) {
        tracker.teacherDayPeriods[entry.teacherId][day] = new Set();
        tracker.teacherDayCounts[entry.teacherId][day] = 0;
      }
      tracker.teacherDayPeriods[entry.teacherId][day].add(periodIndex);
      tracker.teacherDayCounts[entry.teacherId][day] += 1;
    });
  });
};

// Create or update timetable (admin only)
router.post('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);
    const { classId, sectionId, academicYearId, entries } = req.body || {};
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }
    if (sectionId && !mongoose.isValidObjectId(sectionId)) {
      return res.status(400).json({ error: 'Invalid sectionId' });
    }
    if (academicYearId && !mongoose.isValidObjectId(academicYearId)) {
      return res.status(400).json({ error: 'Invalid academicYearId' });
    }
    const classDoc = await ensureClassExists(schoolId, campusId, classId);
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found for this school' });
    }
    if (sectionId) {
      const sectionDoc = await ensureSectionExists(schoolId, campusId, classId, sectionId);
      if (!sectionDoc) {
        return res.status(404).json({ error: 'Section not found for this class' });
      }
    }
    if (!(await ensureSubjectsExist(schoolId, campusId, classId, entries))) {
      return res.status(400).json({ error: 'Invalid subject selection' });
    }
    if (!(await ensureTeachersExist(schoolId, campusId, entries))) {
      return res.status(400).json({ error: 'Invalid teacher selection' });
    }
    const roomMap = await ensureRoomsExist(schoolId, campusId, entries);
    if (roomMap === null) {
      return res.status(400).json({ error: 'Invalid room selection' });
    }
    const normalizedEntries = normalizeEntriesWithRooms(entries, roomMap);

    const resolvedAcademicYearId = academicYearId || classDoc.academicYearId || undefined;

    const payload = {
      schoolId,
      campusId: campusId || null,
      classId,
      sectionId: resolveSectionId(sectionId) || undefined,
      academicYearId: resolvedAcademicYearId,
      entries: normalizedEntries,
    };

    const updated = await Timetable.findOneAndUpdate(
      {
        ...buildCampusFilter(schoolId, campusId),
        classId,
        sectionId: resolveSectionId(sectionId),
        ...(resolvedAcademicYearId ? { academicYearId: resolvedAcademicYearId } : {}),
      },
      payload,
      { new: true, upsert: true }
    );
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create or update timetable entries for a single day
router.post('/day', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);
    const { classId, sectionId, dayOfWeek, entries, academicYearId } = req.body || {};

    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }
    if (academicYearId && !mongoose.isValidObjectId(academicYearId)) {
      return res.status(400).json({ error: 'Invalid academicYearId' });
    }

    const normalizedDay = resolveDayOfWeek(dayOfWeek);
    if (!normalizedDay) {
      return res.status(400).json({ error: 'dayOfWeek is required' });
    }

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }
    if (entries.length === 0) {
      return res.status(400).json({ error: 'entries cannot be empty for day update' });
    }
    const classDoc = await ensureClassExists(schoolId, campusId, classId);
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found for this school' });
    }
    if (sectionId) {
      const sectionDoc = await ensureSectionExists(schoolId, campusId, classId, sectionId);
      if (!sectionDoc) {
        return res.status(404).json({ error: 'Section not found for this class' });
      }
    }
    if (!(await ensureSubjectsExist(schoolId, campusId, classId, entries))) {
      return res.status(400).json({ error: 'Invalid subject selection' });
    }
    if (!(await ensureTeachersExist(schoolId, campusId, entries))) {
      return res.status(400).json({ error: 'Invalid teacher selection' });
    }
    const roomMap = await ensureRoomsExist(schoolId, campusId, entries);
    if (roomMap === null) {
      return res.status(400).json({ error: 'Invalid room selection' });
    }

    const normalizedSectionId = resolveSectionId(sectionId);
    const resolvedAcademicYearId = academicYearId || classDoc.academicYearId || undefined;
    const dayEntries = normalizeEntriesWithRooms(entries, roomMap).map((entry) => ({
      ...entry,
      dayOfWeek: normalizedDay,
    }));

    const existing = await Timetable.findOne({
      ...buildCampusFilter(schoolId, campusId),
      classId,
      sectionId: normalizedSectionId,
      ...(resolvedAcademicYearId ? { academicYearId: resolvedAcademicYearId } : {}),
    });

    if (!existing) {
      const created = await Timetable.create({
        schoolId,
        campusId: campusId || null,
        classId,
        sectionId: normalizedSectionId || undefined,
        academicYearId: resolvedAcademicYearId,
        entries: dayEntries,
      });
      await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });
      return res.json(created);
    }

    const remainingEntries = (existing.entries || []).filter(
      (entry) => entry.dayOfWeek !== normalizedDay
    );
    existing.entries = [...remainingEntries, ...dayEntries];
    await existing.save();
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete timetable entries for a single day
router.delete('/day', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const body = req.body || {};
    const query = req.query || {};
    const classId = body.classId || query.classId;
    const sectionId = body.sectionId || query.sectionId;
    const dayOfWeek = body.dayOfWeek || query.dayOfWeek;
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }

    const normalizedDay = resolveDayOfWeek(dayOfWeek);
    if (!normalizedDay) {
      return res.status(400).json({ error: 'dayOfWeek is required' });
    }

    const normalizedSectionId = resolveSectionId(sectionId);
    const existing = await Timetable.findOne({
      ...buildCampusFilter(schoolId, campusId),
      classId,
      sectionId: normalizedSectionId,
    });

    if (!existing) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    const remainingEntries = (existing.entries || []).filter(
      (entry) => entry.dayOfWeek !== normalizedDay
    );

    if (remainingEntries.length === 0) {
      await Timetable.findByIdAndDelete(existing._id);
      await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });
      return res.json({ message: 'Day removed and timetable deleted', deleted: true });
    }

    existing.entries = remainingEntries;
    await existing.save();
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json({ message: 'Day removed', deleted: false, timetable: existing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get timetable
router.get('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);
    const { classId, sectionId } = req.query || {};
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }
    const filter = { ...buildCampusFilter(schoolId, campusId), classId };
    filter.sectionId = resolveSectionId(sectionId);

    const timetable = await Timetable.findOne(filter).lean();
    if (!timetable) {
      return res.status(404).json({ error: 'Timetable not found' });
    }
    res.json(timetable);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all timetables for school
router.get('/all', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const timetables = await Timetable.find(buildCampusFilter(schoolId, campusId))
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .populate('entries.teacherId', 'name')
      .populate({
        path: 'entries.roomId',
        select: 'roomNumber floorId',
        populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
      })
      .lean();

    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get teacher's schedule
router.get('/teacher/:teacherId', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const { teacherId } = req.params;
    if (!mongoose.isValidObjectId(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacherId' });
    }

    const timetables = await Timetable.find({
      ...buildCampusFilter(schoolId, campusId),
      'entries.teacherId': teacherId
    })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .populate('entries.teacherId', 'name')
      .populate({
        path: 'entries.roomId',
        select: 'roomNumber floorId',
        populate: { path: 'floorId', select: 'name floorCode buildingId', populate: { path: 'buildingId', select: 'name code' } },
      })
      .lean();

    res.json(timetables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all timetables for the school (all class routines)
router.delete('/all', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const result = await Timetable.deleteMany(buildCampusFilter(schoolId, campusId));
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json({ message: 'All routines deleted successfully', deletedCount: result.deletedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete timetable
router.delete('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid timetable ID' });
    }

    const deleted = await Timetable.findOneAndDelete({
      _id: id,
      ...buildCampusFilter(schoolId, campusId),
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Timetable not found' });
    }
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json({ message: 'Timetable deleted successfully', deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Validate conflicts
router.post('/validate-conflicts', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const { classId, sectionId, entries, excludeTimetableId } = req.body || {};

    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }

    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries must be an array' });
    }
    const classDoc = await ensureClassExists(schoolId, campusId, classId);
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found for this school' });
    }
    if (sectionId) {
      const sectionDoc = await ensureSectionExists(schoolId, campusId, classId, sectionId);
      if (!sectionDoc) {
        return res.status(404).json({ error: 'Section not found for this class' });
      }
    }
    if (!(await ensureSubjectsExist(schoolId, campusId, classId, entries))) {
      return res.status(400).json({ error: 'Invalid subject selection' });
    }
    if (!(await ensureTeachersExist(schoolId, campusId, entries))) {
      return res.status(400).json({ error: 'Invalid teacher selection' });
    }
    const roomMap = await ensureRoomsExist(schoolId, campusId, entries);
    if (roomMap === null) {
      return res.status(400).json({ error: 'Invalid room selection' });
    }
    const normalizedEntries = normalizeEntriesWithRooms(entries, roomMap);

    // Helper function to check if two time ranges overlap
    const timesOverlap = (start1, end1, start2, end2) => {
      return start1 < end2 && start2 < end1;
    };

    // Fetch all existing timetables for this school (excluding current if editing)
    const filter = buildCampusFilter(schoolId, campusId);
    if (excludeTimetableId && mongoose.isValidObjectId(excludeTimetableId)) {
      filter._id = { $ne: excludeTimetableId };
    }

    const existingTimetables = await Timetable.find(filter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('entries.teacherId', 'name')
      .lean();

    const conflicts = [];

    // Check each entry for conflicts
    normalizedEntries.forEach((entry, index) => {
      if (!entry.teacherId || !entry.dayOfWeek || !entry.startTime || !entry.endTime) {
        return;
      }

      // Check against all existing timetables
      existingTimetables.forEach(tt => {
        tt.entries.forEach(existingEntry => {
          // Teacher conflict check
          if (existingEntry.teacherId &&
              existingEntry.teacherId._id.toString() === entry.teacherId.toString() &&
              existingEntry.dayOfWeek === entry.dayOfWeek &&
              timesOverlap(entry.startTime, entry.endTime, existingEntry.startTime, existingEntry.endTime)) {
            conflicts.push({
              type: 'teacher',
              entryIndex: index,
              teacher: existingEntry.teacherId.name,
              teacherId: existingEntry.teacherId._id,
              day: entry.dayOfWeek,
              time: `${entry.startTime} - ${entry.endTime}`,
              conflictingClass: tt.classId.name,
              conflictingSection: tt.sectionId?.name || 'N/A',
              message: `Teacher ${existingEntry.teacherId.name} is already scheduled in ${tt.classId.name}${tt.sectionId ? '-' + tt.sectionId.name : ''} at ${entry.startTime}-${entry.endTime} on ${entry.dayOfWeek}`
            });
          }

          // Room conflict check
          if ((entry.roomId || entry.room) &&
              (existingEntry.roomId || existingEntry.room) &&
              String(existingEntry.roomId || existingEntry.room) === String(entry.roomId || entry.room) &&
              existingEntry.dayOfWeek === entry.dayOfWeek &&
              timesOverlap(entry.startTime, entry.endTime, existingEntry.startTime, existingEntry.endTime)) {
            conflicts.push({
              type: 'room',
              entryIndex: index,
              room: entry.room || existingEntry.room || '',
              roomId: entry.roomId || null,
              day: entry.dayOfWeek,
              time: `${entry.startTime} - ${entry.endTime}`,
              conflictingClass: tt.classId.name,
              conflictingSection: tt.sectionId?.name || 'N/A',
              message: `Room ${entry.room} is already booked for ${tt.classId.name}${tt.sectionId ? '-' + tt.sectionId.name : ''} at ${entry.startTime}-${entry.endTime} on ${entry.dayOfWeek}`
            });
          }
        });
      });
    });

    res.json({
      hasConflicts: conflicts.length > 0,
      conflicts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-generate routine
router.post('/auto-generate', adminAuth, async (req, res) => {
  // #swagger.tags = ['Timetable']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!ensureSchoolAdmin(req, res)) return;
    const campusId = resolveCampusId(req);

    const {
      classId,
      sectionId,
      classes,
      subjects: inputSubjects,
      days,
      periods,
      options,
      overwriteExisting = true,
      academicYearId,
    } = req.body || {};

    const classTargets = [];
    if (Array.isArray(classes) && classes.length > 0) {
      classes.forEach((item) => {
        if (item?.classId && mongoose.isValidObjectId(item.classId)) {
          classTargets.push({
            classId: item.classId,
            sectionId: resolveSectionId(item.sectionId),
            subjects: item.subjects || null,
          });
        }
      });
    } else if (classId && mongoose.isValidObjectId(classId)) {
      classTargets.push({
        classId,
        sectionId: resolveSectionId(sectionId),
        subjects: inputSubjects || null,
      });
    } else {
      const allClasses = await ClassModel.find(buildCampusFilter(schoolId, campusId)).lean();
      allClasses.forEach((cls) => {
        classTargets.push({ classId: cls._id, sectionId: null, subjects: null });
      });
    }

    if (classTargets.length === 0) {
      return res.status(400).json({ error: 'No valid class targets provided.' });
    }

    const teacherPool = await TeacherUser.find(buildCampusFilter(schoolId, campusId))
      .select('_id subject name')
      .lean();

    const existingTimetables = await Timetable.find(buildCampusFilter(schoolId, campusId)).lean();
    const shouldOverwrite = (timetable) =>
      classTargets.some((target) => {
        const classMatch = String(target.classId) === String(timetable.classId);
        if (!classMatch) return false;
        if (!target.sectionId) return true;
        return String(target.sectionId) === String(timetable.sectionId || '');
      });

    const preservedTimetables = overwriteExisting
      ? existingTimetables.filter((tt) => !shouldOverwrite(tt))
      : existingTimetables;

    const globalTracker = initTracker();
    addExistingToTracker(globalTracker, preservedTimetables);

    const results = [];
    const errors = [];

    for (const target of classTargets) {
      const targetClass = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
        .where({ _id: target.classId })
        .lean();
      if (!targetClass) {
        errors.push({ classId: target.classId, error: 'Class not found' });
        continue;
      }

      const targetSections = [];
      if (target.sectionId) {
        const sectionDoc = await ensureSectionExists(schoolId, campusId, target.classId, target.sectionId);
        if (!sectionDoc) {
          errors.push({
            classId: target.classId,
            className: targetClass?.name || '',
            sectionId: target.sectionId,
            error: 'Section not found',
          });
          continue;
        }
        targetSections.push(sectionDoc);
      } else {
        const sections = await Section.find(buildCampusFilter(schoolId, campusId))
          .where({ classId: target.classId })
          .lean();
        if (sections.length === 0) {
          targetSections.push(null);
        } else {
          targetSections.push(...sections);
        }
      }

      const subjectDocs = Array.isArray(target.subjects) && target.subjects.length > 0
        ? target.subjects
        : await Subject.find(buildCampusFilter(schoolId, campusId))
            .where({ classId: target.classId })
            .lean();

      if (!subjectDocs || subjectDocs.length === 0) {
        errors.push({
          classId: target.classId,
          className: targetClass?.name || '',
          error: 'No subjects found for class',
        });
        continue;
      }

      for (const sectionDoc of targetSections) {
        const trackerCopy = cloneTracker(globalTracker);
        const normalizedSubjects = normalizeSubjectPlan({
          subjects: subjectDocs,
          teacherPool,
          assignTeachers: false,
        });

        const { grid, tracker, error } = generateTimetable({
          subjects: normalizedSubjects,
          days: Array.isArray(days) && days.length > 0 ? days : DEFAULT_DAYS,
          periods: Array.isArray(periods) && periods.length > 0 ? periods : DEFAULT_PERIODS,
          options,
          tracker: trackerCopy,
        });

        if (error) {
          errors.push({
            classId: target.classId,
            className: targetClass?.name || '',
            sectionId: sectionDoc?._id || null,
            sectionName: sectionDoc?.name || '',
            error,
          });
          continue;
        }

        const entries = buildEntriesFromGrid(grid);
        const payload = {
          schoolId,
          campusId: campusId || null,
          classId: target.classId,
          sectionId: sectionDoc?._id || undefined,
          academicYearId: academicYearId || undefined,
          entries,
        };

        const updated = await Timetable.findOneAndUpdate(
          { ...buildCampusFilter(schoolId, campusId), classId: target.classId, sectionId: sectionDoc?._id || null },
          payload,
          { new: true, upsert: true }
        );

        results.push({
          classId: target.classId,
          className: targetClass?.name || '',
          sectionId: sectionDoc?._id || null,
          sectionName: sectionDoc?.name || '',
          entries: entries.length,
          timetableId: updated._id,
        });

        globalTracker.teacherDayPeriods = tracker.teacherDayPeriods;
        globalTracker.teacherDayCounts = tracker.teacherDayCounts;
      }
    }
    await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });

    res.json({
      generated: results,
      errors,
      totalGenerated: results.length,
      totalErrors: errors.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
