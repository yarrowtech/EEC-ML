/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');

const AcademicYear = require('../models/AcademicYear');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeacherAllocation = require('../models/TeacherAllocation');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const StudentUser = require('../models/StudentUser');
const Building = require('../models/Building');
const Floor = require('../models/Floor');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const Exam = require('../models/Exam');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');

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
const resolveCampusScope = (req) => {
  const scope = String(req.query?.scope || '').trim().toLowerCase();
  if (scope === 'school') return null;
  return resolveCampusId(req);
};

const buildCampusFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) {
    filter.campusId = campusId;
  }
  return filter;
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const SENIOR_SECONDARY_STANDARDS = new Set([11, 12]);
const ALLOWED_CLASS_STREAMS = new Set(['science', 'commerce', 'arts', 'mixed']);
const parseStandard = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) return null;
  return Math.floor(parsed);
};
const sanitizeStandard = (value) => {
  const parsed = parseStandard(value);
  return parsed === null ? undefined : parsed;
};
const normalizeStream = (value) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized;
};

const validateClassStandardAndStream = ({ name, standard, stream }) => {
  let resolvedStandard = parseStandard(standard);
  if (resolvedStandard === null) {
    return { error: 'standard must be a number between 1 and 12' };
  }
  if (resolvedStandard === undefined) {
    const inferred = Number(String(name || '').trim());
    if (Number.isFinite(inferred) && inferred >= 1 && inferred <= 12) {
      resolvedStandard = Math.floor(inferred);
    }
  }

  const normalizedStream = normalizeStream(stream);
  if (normalizedStream && !ALLOWED_CLASS_STREAMS.has(normalizedStream)) {
    return { error: 'Invalid stream. Allowed values: science, commerce, arts, mixed' };
  }
  if (normalizedStream && !SENIOR_SECONDARY_STANDARDS.has(resolvedStandard)) {
    return { error: 'Stream can only be assigned to Class 11 or Class 12' };
  }

  return { standard: resolvedStandard, stream: normalizedStream };
};

const findDuplicateSection = async ({ schoolId, campusId, classId, name, excludeId = null }) => {
  const normalizedName = normalizeKey(name);
  if (!normalizedName) return null;

  const filter = {
    ...buildCampusFilter(schoolId, campusId),
    classId,
  };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const existingSections = await Section.find(filter).select('_id name').lean();
  return existingSections.find((item) => normalizeKey(item.name) === normalizedName) || null;
};

const findDuplicateClass = async ({ schoolId, campusId, academicYearId, name, stream, excludeId = null }) => {
  const normalizedName = normalizeKey(name);
  const normalizedStream = normalizeStream(stream) || '';
  if (!normalizedName) return null;

  // Scope by school + campus only. Academic year is compared in JS below so that
  // an "unscoped" class (no academicYearId) collides with a year-scoped class of
  // the same name — otherwise "Class 1" (no year) and "Class 1" (2025-26) can
  // both be created and both show up in the "all years" view.
  const filter = {
    schoolId,
    ...(campusId
      ? { campusId }
      : { $or: [{ campusId: null }, { campusId: { $exists: false } }] }),
  };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const targetYear = academicYearId ? String(academicYearId) : '';
  const existingClasses = await ClassModel.find(filter).select('_id name stream academicYearId').lean();
  return existingClasses.find((item) => {
    if (normalizeKey(item.name) !== normalizedName) return false;
    if ((normalizeStream(item.stream) || '') !== normalizedStream) return false;
    const itemYear = item.academicYearId ? String(item.academicYearId) : '';
    // Same academic year, or either side is unscoped → treat as a duplicate.
    return itemYear === targetYear || !itemYear || !targetYear;
  }) || null;
};

const generateInvoicesForAcademicYear = async ({ schoolId, campusId, academicYearId }) => {
  const classFilter = buildCampusFilter(schoolId, campusId);
  const classDocs = await ClassModel.find(classFilter).select('_id name campusId').lean();
  if (classDocs.length === 0) {
    return { created: 0, skipped: 0, classes: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const classDoc of classDocs) {
    const structure = await FeeStructure.findOne({
      schoolId,
      classId: classDoc._id,
      academicYearId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!structure) {
      continue;
    }

    const studentFilter = {
      schoolId,
      grade: classDoc.name,
      isArchived: false,
    };
    if (classDoc.campusId) {
      studentFilter.campusId = classDoc.campusId;
    } else if (campusId) {
      studentFilter.campusId = campusId;
    }

    const students = await StudentUser.find(studentFilter)
      .select('_id name grade section')
      .lean();
    if (students.length === 0) {
      continue;
    }

    const studentIds = students.map((student) => student._id);
    const existingInvoices = await FeeInvoice.find({
      schoolId,
      feeStructureId: structure._id,
      studentId: { $in: studentIds },
    })
      .select('studentId')
      .lean();
    const existingSet = new Set(existingInvoices.map((inv) => String(inv.studentId)));
    const priorInvoices = await FeeInvoice.find({
      schoolId,
      studentId: { $in: studentIds },
    })
      .select('studentId')
      .lean();
    const priorInvoiceSet = new Set(priorInvoices.map((inv) => String(inv.studentId)));

    const invoicesToCreate = students
      .filter((student) => !existingSet.has(String(student._id)))
      .map((student) => {
        const snapshots = buildInvoiceSnapshotsForStudent({
          structure,
          hasPriorInvoice: priorInvoiceSet.has(String(student._id)),
        });
        return {
          schoolId,
          academicYearId,
          classId: structure.classId,
          className: student.grade || classDoc.name || structure.className || '',
          section: student.section || '',
          studentId: student._id,
          feeStructureId: structure._id,
          title: structure.name || 'Fee Invoice',
          totalAmount: snapshots.totalAmount,
          paidAmount: 0,
          balanceAmount: snapshots.totalAmount,
          discountAmount: 0,
          discountNote: '',
          feeHeadsSnapshot: snapshots.feeHeadsSnapshot,
          installmentsSnapshot: snapshots.installmentsSnapshot,
          status: 'due',
        };
      });

    if (invoicesToCreate.length > 0) {
      await FeeInvoice.insertMany(invoicesToCreate);
      created += invoicesToCreate.length;
    }
    skipped += students.length - invoicesToCreate.length;
  }

  return { created, skipped, classes: classDocs.length };
};

// Academic Years
// Active academic year — accessible by both teachers and admins
router.get('/active-year', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const activeYear = await AcademicYear.findOne({ schoolId, isActive: true }).select('_id name startDate endDate').lean();
    if (!activeYear) return res.status(404).json({ error: 'No active academic year found' });
    res.json(activeYear);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All academic years for teacher-facing dropdowns
router.get('/teacher/years', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const items = await AcademicYear.find({ schoolId })
      .select('_id name startDate endDate isActive')
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const YEAR_STATUS_OPTIONS = new Set(['upcoming', 'active', 'archived']);

// Reconciles the descriptive `status` label with the real `isActive` flag —
// callers may send either (or both); isActive always wins for "active".
const resolveYearStatusFields = ({ status, isActive }) => {
  if (status !== undefined && !YEAR_STATUS_OPTIONS.has(status)) {
    throw new Error('Status must be Upcoming, Active or Archived');
  }
  const resolvedIsActive = Boolean(isActive);
  // A year can only carry the "active" label if it's actually the isActive
  // year — otherwise it silently downgrades to "upcoming" instead of showing
  // "Active" while isActive stays false (which broke isActive-gated checks
  // like the Class 11/12 stream setup).
  const resolvedStatus = resolvedIsActive
    ? 'active'
    : (status === 'active' ? 'upcoming' : (status || 'upcoming'));
  return { isActive: resolvedIsActive, status: resolvedStatus };
};

router.post('/years', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { name, startDate, endDate, isActive, status } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Academic year name is required' });
    }
    const statusFields = resolveYearStatusFields({ status, isActive });

    const created = await AcademicYear.create({
      schoolId,
      name: String(name).trim(),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      ...statusFields,
    });
    if (created.isActive) {
      await AcademicYear.updateMany(
        { schoolId, _id: { $ne: created._id } },
        { $set: { isActive: false } }
      );
      await AcademicYear.updateMany(
        { schoolId, _id: { $ne: created._id }, status: 'active' },
        { $set: { status: 'archived' } }
      );
      try {
        await generateInvoicesForAcademicYear({
          schoolId,
          campusId: resolveCampusId(req),
          academicYearId: created._id,
        });
      } catch (err) {
        console.error('Invoice generation failed for new academic year:', err.message);
      }
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/years', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const items = await AcademicYear.find({ schoolId }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/years/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    const { name, startDate, endDate, isActive, status } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Academic year name is required' });
    }
    const statusFields = resolveYearStatusFields({ status, isActive });

    // Verify ownership
    const existing = await AcademicYear.findOne({ _id: id, schoolId }).lean();
    if (!existing) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    const updated = await AcademicYear.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        ...statusFields,
      },
      { new: true, runValidators: true }
    ).lean();

    if (updated.isActive) {
      await AcademicYear.updateMany(
        { schoolId, _id: { $ne: updated._id } },
        { $set: { isActive: false } }
      );
      await AcademicYear.updateMany(
        { schoolId, _id: { $ne: updated._id }, status: 'active' },
        { $set: { status: 'archived' } }
      );
      try {
        await generateInvoicesForAcademicYear({
          schoolId,
          campusId: resolveCampusId(req),
          academicYearId: updated._id,
        });
      } catch (err) {
        console.error('Invoice generation failed for academic year update:', err.message);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/years/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    // Verify ownership
    const existing = await AcademicYear.findOne({ _id: id, schoolId }).lean();
    if (!existing) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Check for dependent classes
    const dependentClasses = await ClassModel.countDocuments({
      schoolId,
      academicYearId: id,
      ...(campusId ? { campusId } : {}),
    });

    if (dependentClasses > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${dependentClasses} class(es) are linked to this academic year`,
        dependentCount: dependentClasses,
      });
    }

    await AcademicYear.findByIdAndDelete(id);
    res.json({ ok: true, message: 'Academic year deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/years/:id/copy-setup', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const targetYearId = req.params?.id;
    if (!mongoose.isValidObjectId(targetYearId)) {
      return res.status(400).json({ error: 'Invalid target academic year ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const scopeFilter = buildCampusFilter(schoolId, campusId);

    const targetYear = await AcademicYear.findOne({ _id: targetYearId, schoolId }).lean();
    if (!targetYear) {
      return res.status(404).json({ error: 'Target academic year not found' });
    }

    const requestedSourceYearId = String(req.body?.sourceYearId || '').trim();
    let sourceYearId = requestedSourceYearId;
    if (sourceYearId && !mongoose.isValidObjectId(sourceYearId)) {
      return res.status(400).json({ error: 'Invalid source academic year ID' });
    }

    if (!sourceYearId) {
      const candidateYears = await AcademicYear.find({
        schoolId,
        _id: { $ne: targetYearId },
      })
        .sort({ endDate: -1, startDate: -1, createdAt: -1 })
        .lean();

      for (const year of candidateYears) {
        const classCount = await ClassModel.countDocuments({
          ...scopeFilter,
          academicYearId: year._id,
        });
        if (classCount > 0) {
          sourceYearId = String(year._id);
          break;
        }
      }
    }

    if (!sourceYearId) {
      return res.status(400).json({ error: 'No source academic year with classes found to copy from' });
    }
    if (String(sourceYearId) === String(targetYearId)) {
      return res.status(400).json({ error: 'Source and target academic years must be different' });
    }

    const sourceYear = await AcademicYear.findOne({ _id: sourceYearId, schoolId }).lean();
    if (!sourceYear) {
      return res.status(404).json({ error: 'Source academic year not found' });
    }

    const sourceClasses = await ClassModel.find({
      ...scopeFilter,
      academicYearId: sourceYear._id,
    })
      .sort({ order: 1, name: 1 })
      .lean();

    if (!sourceClasses.length) {
      return res.status(400).json({ error: 'Source academic year has no classes to copy' });
    }

    const sourceClassIds = sourceClasses.map((item) => item._id);
    const targetClasses = await ClassModel.find({
      ...scopeFilter,
      academicYearId: targetYear._id,
    }).lean();

    const classIdMap = new Map();
    let classesCreated = 0;
    let classesSkipped = 0;

    for (const sourceClass of sourceClasses) {
      const sourceStandard = sanitizeStandard(sourceClass.standard);
      const sourceStream = normalizeStream(sourceClass.stream);
      const existingClass = targetClasses.find(
        (item) => {
          const targetStandard = sanitizeStandard(item.standard);
          const targetStream = normalizeStream(item.stream);
          if (sourceStandard && sourceStream) {
            return targetStandard === sourceStandard && targetStream === sourceStream;
          }
          return String(item.name || '').trim().toLowerCase() === String(sourceClass.name || '').trim().toLowerCase();
        }
      );
      if (existingClass) {
        classIdMap.set(String(sourceClass._id), existingClass._id);
        classesSkipped += 1;
        continue;
      }

      const createdClass = await ClassModel.create({
        schoolId,
        campusId: campusId || null,
        academicYearId: targetYear._id,
        name: sourceClass.name,
        order: Number.isFinite(Number(sourceClass.order)) ? Number(sourceClass.order) : 0,
        standard: sanitizeStandard(sourceClass.standard),
        stream: normalizeStream(sourceClass.stream),
      });
      classIdMap.set(String(sourceClass._id), createdClass._id);
      targetClasses.push(createdClass.toObject ? createdClass.toObject() : createdClass);
      classesCreated += 1;
    }

    const sourceSections = await Section.find({
      ...scopeFilter,
      classId: { $in: sourceClassIds },
    }).lean();

    const targetClassIds = Array.from(classIdMap.values());
    const targetSections = targetClassIds.length
      ? await Section.find({
          ...scopeFilter,
          classId: { $in: targetClassIds },
        }).lean()
      : [];

    const sectionIdMap = new Map();
    let sectionsCreated = 0;
    let sectionsSkipped = 0;

    for (const sourceSection of sourceSections) {
      const mappedClassId = classIdMap.get(String(sourceSection.classId));
      if (!mappedClassId) continue;

      const existingSection = targetSections.find(
        (item) =>
          String(item.classId) === String(mappedClassId) &&
          String(item.name || '').trim().toLowerCase() === String(sourceSection.name || '').trim().toLowerCase()
      );

      if (existingSection) {
        sectionIdMap.set(String(sourceSection._id), existingSection._id);
        sectionsSkipped += 1;
        continue;
      }

      const createdSection = await Section.create({
        schoolId,
        campusId: campusId || null,
        classId: mappedClassId,
        name: sourceSection.name,
      });
      sectionIdMap.set(String(sourceSection._id), createdSection._id);
      targetSections.push(createdSection.toObject ? createdSection.toObject() : createdSection);
      sectionsCreated += 1;
    }

    const sourceSubjects = await Subject.find({
      ...scopeFilter,
      classId: { $in: sourceClassIds },
    }).lean();

    const targetSubjects = targetClassIds.length
      ? await Subject.find({
          ...scopeFilter,
          classId: { $in: targetClassIds },
        }).lean()
      : [];

    const subjectIdMap = new Map();
    let subjectsCreated = 0;
    let subjectsSkipped = 0;

    for (const sourceSubject of sourceSubjects) {
      const mappedClassId = classIdMap.get(String(sourceSubject.classId));
      if (!mappedClassId) continue;
      const sourceSubjectStream = normalizeStream(sourceSubject.stream);

      const existingSubject = targetSubjects.find(
        (item) =>
          String(item.classId) === String(mappedClassId) &&
          String(item.name || '').trim().toLowerCase() === String(sourceSubject.name || '').trim().toLowerCase() &&
          normalizeStream(item.stream) === sourceSubjectStream
      );

      if (existingSubject) {
        subjectIdMap.set(String(sourceSubject._id), existingSubject._id);
        subjectsSkipped += 1;
        continue;
      }

      const createdSubject = await Subject.create({
        schoolId,
        campusId: campusId || null,
        classId: mappedClassId,
        name: sourceSubject.name,
        code: sourceSubject.code || '',
        stream: normalizeStream(sourceSubject.stream),
      });
      subjectIdMap.set(String(sourceSubject._id), createdSubject._id);
      targetSubjects.push(createdSubject.toObject ? createdSubject.toObject() : createdSubject);
      subjectsCreated += 1;
    }

    const sourceClassTeacherAllocations = await TeacherAllocation.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      isClassTeacher: true,
      classId: { $in: sourceClassIds },
    }).lean();

    const targetClassTeacherAllocations = await TeacherAllocation.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      isClassTeacher: true,
      classId: { $in: targetClassIds },
    }).lean();

    let classTeachersCreated = 0;
    let classTeachersSkipped = 0;

    for (const sourceAllocation of sourceClassTeacherAllocations) {
      const mappedClassId = classIdMap.get(String(sourceAllocation.classId));
      const mappedSectionId = sectionIdMap.get(String(sourceAllocation.sectionId));
      if (!mappedClassId || !mappedSectionId) continue;

      const exists = targetClassTeacherAllocations.some(
        (item) =>
          String(item.teacherId) === String(sourceAllocation.teacherId) &&
          String(item.classId) === String(mappedClassId) &&
          String(item.sectionId) === String(mappedSectionId) &&
          item.isClassTeacher === true
      );

      if (exists) {
        classTeachersSkipped += 1;
        continue;
      }

      const createdAllocation = await TeacherAllocation.create({
        schoolId,
        campusId: campusId || null,
        teacherId: sourceAllocation.teacherId,
        subjectId: null,
        classId: mappedClassId,
        sectionId: mappedSectionId,
        isClassTeacher: true,
        notes: sourceAllocation.notes || '',
      });
      targetClassTeacherAllocations.push(
        createdAllocation.toObject ? createdAllocation.toObject() : createdAllocation
      );
      classTeachersCreated += 1;
    }

    return res.json({
      ok: true,
      sourceYear: { id: sourceYear._id, name: sourceYear.name },
      targetYear: { id: targetYear._id, name: targetYear.name },
      classes: { created: classesCreated, skipped: classesSkipped, totalSource: sourceClasses.length },
      sections: { created: sectionsCreated, skipped: sectionsSkipped, totalSource: sourceSections.length },
      subjects: { created: subjectsCreated, skipped: subjectsSkipped, totalSource: sourceSubjects.length },
      classTeachers: {
        created: classTeachersCreated,
        skipped: classTeachersSkipped,
        totalSource: sourceClassTeacherAllocations.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to copy academic setup' });
  }
});

// Classes
router.post('/classes', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { name, academicYearId, order, standard, stream } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Class name is required' });
    }
    if (!academicYearId) {
      return res.status(400).json({ error: 'An academic year is required to add a class' });
    }
    if (!mongoose.isValidObjectId(academicYearId)) {
      return res.status(400).json({ error: 'Invalid academicYearId' });
    }
    const validatedClassMeta = validateClassStandardAndStream({ name, standard, stream });
    if (validatedClassMeta.error) {
      return res.status(400).json({ error: validatedClassMeta.error });
    }
    const yearExists = await AcademicYear.findOne({ _id: academicYearId, schoolId }).lean();
    if (!yearExists) {
      return res.status(404).json({ error: 'Academic year not found for this school' });
    }
    if (validatedClassMeta.stream && !yearExists.isActive) {
      return res.status(400).json({ error: 'Class 11/12 stream setup is allowed only in the active academic year' });
    }

    const duplicateClass = await findDuplicateClass({
      schoolId,
      campusId,
      academicYearId,
      name,
      stream: validatedClassMeta.stream,
    });
    if (duplicateClass) {
      return res.status(409).json({ error: 'A class with this name already exists for the selected campus and academic year' });
    }

    const created = await ClassModel.create({
      schoolId,
      campusId: campusId || null,
      name: String(name).trim(),
      academicYearId,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
      standard: validatedClassMeta.standard,
      stream: validatedClassMeta.stream,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/classes', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const items = await ClassModel.find(buildCampusFilter(schoolId, resolveCampusScope(req)))
      .sort({ order: 1, name: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/classes/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { name, academicYearId, order, standard, stream } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Class name is required' });
    }
    if (academicYearId && !mongoose.isValidObjectId(academicYearId)) {
      return res.status(400).json({ error: 'Invalid academicYearId' });
    }
    const validatedClassMeta = validateClassStandardAndStream({ name, standard, stream });
    if (validatedClassMeta.error) {
      return res.status(400).json({ error: validatedClassMeta.error });
    }
    let yearExists = null;
    if (academicYearId) {
      yearExists = await AcademicYear.findOne({ _id: academicYearId, schoolId }).lean();
      if (!yearExists) {
        return res.status(404).json({ error: 'Academic year not found for this school' });
      }
    }
    if (validatedClassMeta.stream && !academicYearId) {
      return res.status(400).json({ error: 'academicYearId is required for Class 11/12 stream setup' });
    }
    if (validatedClassMeta.stream && yearExists && !yearExists.isActive) {
      return res.status(400).json({ error: 'Class 11/12 stream setup is allowed only in the active academic year' });
    }

    // Verify ownership
    const existing = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const duplicateClass = await findDuplicateClass({
      schoolId,
      campusId,
      academicYearId: academicYearId || null,
      name,
      stream: validatedClassMeta.stream,
      excludeId: id,
    });
    if (duplicateClass) {
      return res.status(409).json({ error: 'A class with this name already exists for the selected campus and academic year' });
    }

    const updated = await ClassModel.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        academicYearId: academicYearId || undefined,
        order: Number.isFinite(Number(order)) ? Number(order) : 0,
        standard: validatedClassMeta.standard,
        stream: validatedClassMeta.stream,
        ...(campusId ? { campusId } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/classes/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    const { cascade } = req.query;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    // Verify ownership
    const existing = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Count dependent records
    const dependentSections = await Section.countDocuments({
      schoolId,
      classId: id,
      ...(campusId ? { campusId } : {}),
    });
    const dependentSubjects = await Subject.countDocuments({
      schoolId,
      classId: id,
      ...(campusId ? { campusId } : {}),
    });

    if ((dependentSections > 0 || dependentSubjects > 0) && cascade !== 'true') {
      return res.status(409).json({
        error: `Cannot delete: ${dependentSections} section(s) and ${dependentSubjects} subject(s) are linked to this class`,
        dependentSections,
        dependentSubjects,
        hint: 'Use cascade=true to delete all dependent records',
      });
    }

    // Perform cascading delete if requested
    if (cascade === 'true') {
      await Section.deleteMany({
        schoolId,
        classId: id,
        ...(campusId ? { campusId } : {}),
      });
      await Subject.deleteMany({
        schoolId,
        classId: id,
        ...(campusId ? { campusId } : {}),
      });
    }

    await ClassModel.findByIdAndDelete(id);
    res.json({
      ok: true,
      message: 'Class deleted successfully',
      deletedSections: cascade === 'true' ? dependentSections : 0,
      deletedSubjects: cascade === 'true' ? dependentSubjects : 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sections
router.post('/sections', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { name, classId } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }
    const classDoc = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: classId })
      .lean();
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found for this school' });
    }
    const duplicateSection = await findDuplicateSection({ schoolId, campusId, classId, name });
    if (duplicateSection) {
      return res.status(409).json({ error: 'Section name already exists for this class' });
    }

    const created = await Section.create({
      schoolId,
      campusId: campusId || null,
      classId,
      name: String(name).trim(),
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/sections', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const filter = buildCampusFilter(schoolId, resolveCampusScope(req));
    if (req.query.classId && mongoose.isValidObjectId(req.query.classId)) {
      filter.classId = req.query.classId;
    }
    const items = await Section.find(filter).sort({ name: 1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sections/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { name, classId } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }
    const classDoc = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: classId })
      .lean();
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found for this school' });
    }

    // Verify ownership
    const existing = await Section.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }
    const duplicateSection = await findDuplicateSection({
      schoolId,
      campusId,
      classId,
      name,
      excludeId: id,
    });
    if (duplicateSection) {
      return res.status(409).json({ error: 'Section name already exists for this class' });
    }

    const updated = await Section.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        classId,
        ...(campusId ? { campusId } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/sections/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    // Verify ownership
    const existing = await Section.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }

    await Section.findByIdAndDelete(id);
    res.json({ ok: true, message: 'Section deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Subjects
router.post('/subjects', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { name, code, classId, stream } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Subject name is required' });
    }
    if (classId && !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }
    const normalizedStream = normalizeStream(stream);
    if (normalizedStream && !ALLOWED_CLASS_STREAMS.has(normalizedStream)) {
      return res.status(400).json({ error: 'Invalid stream. Allowed values: science, commerce, arts, mixed' });
    }
    let resolvedSubjectStream = normalizedStream;
    if (classId) {
      const classDoc = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
        .where({ _id: classId })
        .lean();
      if (!classDoc) {
        return res.status(404).json({ error: 'Class not found for this school' });
      }
      const classStandard = parseStandard(classDoc.standard);
      const classStream = normalizeStream(classDoc.stream);
      if (classStream && resolvedSubjectStream && classStream !== resolvedSubjectStream) {
        return res.status(400).json({ error: 'Subject stream must match class stream' });
      }
      if (resolvedSubjectStream && !SENIOR_SECONDARY_STANDARDS.has(classStandard)) {
        return res.status(400).json({ error: 'Subject stream can only be used for Class 11 or Class 12' });
      }
      if (classStream) {
        resolvedSubjectStream = classStream;
      }
    }

    const created = await Subject.create({
      schoolId,
      campusId: campusId || null,
      classId: classId || undefined,
      name: String(name).trim(),
      code: code ? String(code).trim() : undefined,
      stream: resolvedSubjectStream,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/subjects', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const filter = buildCampusFilter(schoolId, resolveCampusId(req));
    if (req.query.classId && mongoose.isValidObjectId(req.query.classId)) {
      filter.classId = req.query.classId;
    }
    const items = await Subject.find(filter).sort({ name: 1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/subjects/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { name, code, classId, stream } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Subject name is required' });
    }
    if (classId && !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }
    const normalizedStream = normalizeStream(stream);
    if (normalizedStream && !ALLOWED_CLASS_STREAMS.has(normalizedStream)) {
      return res.status(400).json({ error: 'Invalid stream. Allowed values: science, commerce, arts, mixed' });
    }
    let resolvedSubjectStream = normalizedStream;
    if (classId) {
      const classDoc = await ClassModel.findOne(buildCampusFilter(schoolId, campusId))
        .where({ _id: classId })
        .lean();
      if (!classDoc) {
        return res.status(404).json({ error: 'Class not found for this school' });
      }
      const classStandard = parseStandard(classDoc.standard);
      const classStream = normalizeStream(classDoc.stream);
      if (classStream && resolvedSubjectStream && classStream !== resolvedSubjectStream) {
        return res.status(400).json({ error: 'Subject stream must match class stream' });
      }
      if (resolvedSubjectStream && !SENIOR_SECONDARY_STANDARDS.has(classStandard)) {
        return res.status(400).json({ error: 'Subject stream can only be used for Class 11 or Class 12' });
      }
      if (classStream) {
        resolvedSubjectStream = classStream;
      }
    }

    // Verify ownership
    const existing = await Subject.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const updated = await Subject.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        code: code ? String(code).trim() : undefined,
        classId: classId || undefined,
        stream: resolvedSubjectStream,
        ...(campusId ? { campusId } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/subjects/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    // Verify ownership
    const existing = await Subject.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    await Subject.findByIdAndDelete(id);
    res.json({ ok: true, message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Buildings
router.post('/buildings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { name, code, order } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Building name is required' });
    }
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'Building code is required' });
    }

    const created = await Building.create({
      schoolId,
      campusId: campusId || null,
      name: String(name).trim(),
      code: String(code).trim().toUpperCase(),
      key: normalizeKey(name),
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
    });
    res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Building name/code already exists' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get('/buildings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusScope(req);
    const items = await Building.find(buildCampusFilter(schoolId, campusId))
      .sort({ order: 1, name: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/buildings/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const existing = await Building.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const floors = await Floor.find({ schoolId, ...(campusId ? { campusId } : {}), buildingId: id })
      .select('_id')
      .lean();
    const floorIds = floors.map((f) => f._id);
    const linkedRoomIds = floorIds.length > 0
      ? await Room.find({ schoolId, ...(campusId ? { campusId } : {}), floorId: { $in: floorIds } })
          .select('_id')
          .lean()
      : [];
    const roomIds = linkedRoomIds.map((room) => room._id);

    if (roomIds.length > 0) {
      const [usedInExam, usedInTimetable] = await Promise.all([
        Exam.findOne({ schoolId, ...(campusId ? { campusId } : {}), roomId: { $in: roomIds } })
          .select('_id')
          .lean(),
        Timetable.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          'entries.roomId': { $in: roomIds },
        })
          .select('_id')
          .lean(),
      ]);
      if (usedInExam || usedInTimetable) {
        return res.status(409).json({ error: 'Cannot delete building: one or more rooms are in use' });
      }
    }

    await Promise.all([
      Room.deleteMany({ schoolId, ...(campusId ? { campusId } : {}), buildingId: id }),
      Floor.deleteMany({ schoolId, ...(campusId ? { campusId } : {}), buildingId: id }),
      Building.findByIdAndDelete(id),
    ]);
    res.json({ ok: true, message: 'Building deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Floors
router.post('/floors', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { buildingId, name, floorCode, order } = req.body || {};
    if (!buildingId || !mongoose.isValidObjectId(buildingId)) {
      return res.status(400).json({ error: 'Valid buildingId is required' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Floor name is required' });
    }
    if (!floorCode || !String(floorCode).trim()) {
      return res.status(400).json({ error: 'Floor code is required' });
    }

    const building = await Building.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: buildingId })
      .lean();
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const created = await Floor.create({
      schoolId,
      campusId: campusId || null,
      buildingId,
      name: String(name).trim(),
      key: normalizeKey(name),
      floorCode: String(floorCode).trim().toUpperCase(),
      codeKey: normalizeKey(floorCode),
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
    });
    const payload = await Floor.findById(created._id)
      .populate('buildingId', 'name code order isActive')
      .lean();
    res.status(201).json(payload);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Floor name/code already exists in this building' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get('/floors', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusScope(req);
    const filter = buildCampusFilter(schoolId, campusId);
    if (req.query.buildingId && mongoose.isValidObjectId(req.query.buildingId)) {
      filter.buildingId = req.query.buildingId;
    }
    const items = await Floor.find(filter)
      .populate('buildingId', 'name code order isActive')
      .sort({ order: 1, name: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/floors/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid floor ID' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { buildingId, name, floorCode, order, isActive } = req.body || {};

    const existing = await Floor.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const nextBuildingId = buildingId || existing.buildingId;
    if (!mongoose.isValidObjectId(nextBuildingId)) {
      return res.status(400).json({ error: 'Valid buildingId is required' });
    }
    const building = await Building.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: nextBuildingId })
      .lean();
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    const nextName = name === undefined ? existing.name : String(name).trim();
    const nextFloorCode = floorCode === undefined ? existing.floorCode : String(floorCode).trim().toUpperCase();
    if (!nextName) {
      return res.status(400).json({ error: 'Floor name is required' });
    }
    if (!nextFloorCode) {
      return res.status(400).json({ error: 'Floor code is required' });
    }

    const updated = await Floor.findByIdAndUpdate(
      id,
      {
        buildingId: nextBuildingId,
        name: nextName,
        key: normalizeKey(nextName),
        floorCode: nextFloorCode,
        codeKey: normalizeKey(nextFloorCode),
        order: Number.isFinite(Number(order)) ? Number(order) : (existing.order || 0),
        ...(isActive === undefined ? {} : { isActive: Boolean(isActive) }),
      },
      { new: true, runValidators: true }
    )
      .populate('buildingId', 'name code order isActive')
      .lean();
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Floor name/code already exists in this building' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete('/floors/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid floor ID' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const existing = await Floor.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const linkedRoomIds = await Room.find(buildCampusFilter(schoolId, campusId))
      .where({ floorId: id })
      .select('_id')
      .lean();

    if (linkedRoomIds.length > 0) {
      const roomIds = linkedRoomIds.map((room) => room._id);
      const [usedInExam, usedInTimetable] = await Promise.all([
        Exam.findOne({ schoolId, ...(campusId ? { campusId } : {}), roomId: { $in: roomIds } })
          .select('_id')
          .lean(),
        Timetable.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          'entries.roomId': { $in: roomIds },
        })
          .select('_id')
          .lean(),
      ]);
      if (usedInExam || usedInTimetable) {
        return res.status(409).json({ error: 'Cannot delete floor: one or more rooms are in use' });
      }
    }

    await Promise.all([
      Room.deleteMany({ schoolId, ...(campusId ? { campusId } : {}), floorId: id }),
      Floor.findByIdAndDelete(id),
    ]);
    res.json({ ok: true, message: 'Floor deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rooms
router.post('/rooms', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { floorId, roomNumber, label } = req.body || {};
    if (!floorId || !mongoose.isValidObjectId(floorId)) {
      return res.status(400).json({ error: 'Valid floorId is required' });
    }
    if (!roomNumber || !String(roomNumber).trim()) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const floor = await Floor.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: floorId })
      .lean();
    if (!floor) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const created = await Room.create({
      schoolId,
      campusId: campusId || null,
      buildingId: floor.buildingId,
      floorId,
      roomNumber: String(roomNumber).trim(),
      roomKey: normalizeKey(roomNumber),
      label: label ? String(label).trim() : '',
    });

    const payload = await Room.findById(created._id)
      .populate({
        path: 'floorId',
        select: 'name floorCode order isActive buildingId',
        populate: { path: 'buildingId', select: 'name code' },
      })
      .lean();
    res.status(201).json(payload);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Room already exists on this floor' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.get('/rooms', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusScope(req);
    const filter = buildCampusFilter(schoolId, campusId);
    if (req.query.floorId && mongoose.isValidObjectId(req.query.floorId)) {
      filter.floorId = req.query.floorId;
    }
    if (req.query.buildingId && mongoose.isValidObjectId(req.query.buildingId)) {
      filter.buildingId = req.query.buildingId;
    }

    const items = await Room.find(filter)
      .populate({
        path: 'floorId',
        select: 'name floorCode order isActive buildingId',
        populate: { path: 'buildingId', select: 'name code' },
      })
      .sort({ roomNumber: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rooms/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { floorId, roomNumber, label, isActive } = req.body || {};

    const existing = await Room.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const nextFloorId = floorId || existing.floorId;
    if (!mongoose.isValidObjectId(nextFloorId)) {
      return res.status(400).json({ error: 'Valid floorId is required' });
    }
    const floor = await Floor.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: nextFloorId })
      .lean();
    if (!floor) {
      return res.status(404).json({ error: 'Floor not found' });
    }

    const nextRoomNumber = roomNumber === undefined ? existing.roomNumber : String(roomNumber).trim();
    if (!nextRoomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const updated = await Room.findByIdAndUpdate(
      id,
      {
        floorId: nextFloorId,
        buildingId: floor.buildingId,
        roomNumber: nextRoomNumber,
        roomKey: normalizeKey(nextRoomNumber),
        ...(label === undefined ? {} : { label: String(label || '').trim() }),
        ...(isActive === undefined ? {} : { isActive: Boolean(isActive) }),
      },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'floorId',
        select: 'name floorCode order isActive buildingId',
        populate: { path: 'buildingId', select: 'name code' },
      })
      .lean();

    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'Room already exists on this floor' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.delete('/rooms/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const existing = await Room.findOne(buildCampusFilter(schoolId, campusId))
      .where({ _id: id })
      .lean();
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [usedInExam, usedInTimetable] = await Promise.all([
      Exam.findOne({ schoolId, ...(campusId ? { campusId } : {}), roomId: id }).select('_id').lean(),
      Timetable.findOne({
        schoolId,
        ...(campusId ? { campusId } : {}),
        'entries.roomId': id,
      }).select('_id').lean(),
    ]);

    if (usedInExam || usedInTimetable) {
      return res.status(409).json({ error: 'Cannot delete room: room is in use in exam/routine' });
    }

    await Room.findByIdAndDelete(id);
    res.json({ ok: true, message: 'Room deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/hierarchy', adminAuth, async (req, res) => {
  // #swagger.tags = ['Academics']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const [yearDocs, classDocs, sectionDocs] = await Promise.all([
      AcademicYear.find({ schoolId }).sort({ createdAt: -1 }).lean(),
      ClassModel.find(buildCampusFilter(schoolId, campusId))
        .sort({ order: 1, name: 1 })
        .lean(),
      Section.find(buildCampusFilter(schoolId, campusId)).sort({ name: 1 }).lean(),
    ]);

    const UNASSIGNED = 'unassigned';

    const sectionsByClass = sectionDocs.reduce((acc, section) => {
      const key = section.classId ? section.classId.toString() : UNASSIGNED;
      if (!acc[key]) acc[key] = [];
      acc[key].push(section);
      return acc;
    }, {});

    const classesByYear = classDocs.reduce((acc, cls) => {
      const key = cls.academicYearId ? cls.academicYearId.toString() : UNASSIGNED;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        ...cls,
        sections: sectionsByClass[cls._id.toString()] || [],
      });
      return acc;
    }, {});

    const hierarchy = yearDocs.map((year) => ({
      ...year,
      classes: classesByYear[year._id.toString()] || [],
    }));

    res.json({
      hierarchy,
      years: yearDocs,
      classes: classDocs,
      sections: sectionDocs,
      unassignedClasses: classesByYear[UNASSIGNED] || [],
      unassignedSections: sectionsByClass[UNASSIGNED] || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
