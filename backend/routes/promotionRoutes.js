const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const PromotionHistory = require('../models/PromotionHistory');
const AuditLog = require('../models/AuditLog');
const AcademicYear = require('../models/AcademicYear');
const ClassModel = require('../models/Class');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const { syncAllocationGroupThreads, syncTimetableGroupThreads } = require('../utils/chatGroupProvisioning');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');

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

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildAcademicYearMatcher = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const match = raw.match(/(\d{4})\D+(\d{2,4})/);
  if (!match) {
    return new RegExp(`^\\s*${escapeRegex(raw)}\\s*$`, 'i');
  }

  const startYear = match[1];
  const endPart = match[2];
  const endYearFull =
    endPart.length === 2 ? `${startYear.slice(0, 2)}${endPart}` : endPart;
  const endYearShort = endYearFull.slice(-2);

  return new RegExp(
    `^\\s*${escapeRegex(startYear)}\\s*[-/]\\s*(?:${escapeRegex(endYearShort)}|${escapeRegex(endYearFull)})\\s*$`,
    'i'
  );
};

const buildPromotionStudentFilter = ({
  schoolId,
  campusId,
  fromClass,
  fromSection,
  fromAcademicYear,
}) => {
  const filter = {
    schoolId,
    isArchived: { $ne: true },
    grade: fromClass,
    status: { $nin: ['Leaving', 'Left', 'Expelled'] },
  };
  if (campusId) filter.campusId = campusId;
  if (fromSection) filter.section = fromSection;
  if (fromAcademicYear) {
    const matcher = buildAcademicYearMatcher(fromAcademicYear);
    if (matcher) filter.academicYear = matcher;
  }
  return filter;
};

// Students are often promoted right after a new academic year is created
// and marked active — at that point the "from" year selected in the UI
// can end up equal to the (not-yet-populated) *new* year rather than the
// year students are actually still tagged with. A strict match then finds
// nobody even though the class clearly has students. To avoid that trap,
// fall back to matching on class/section alone (ignoring the session)
// whenever the strict, session-scoped query comes back empty.
const findPromotionCandidates = async ({
  schoolId,
  campusId,
  fromClass,
  fromSection,
  fromAcademicYear,
  extraFilter = {},
  select,
}) => {
  const runQuery = async (filter) => {
    let query = StudentUser.find({ ...filter, ...extraFilter });
    if (select) query = query.select(select);
    return query.sort({ section: 1, roll: 1, name: 1 }).lean();
  };

  const strictFilter = buildPromotionStudentFilter({ schoolId, campusId, fromClass, fromSection, fromAcademicYear });
  let students = await runQuery(strictFilter);
  let academicYearRelaxed = false;

  if (students.length === 0 && fromAcademicYear) {
    const relaxedFilter = buildPromotionStudentFilter({ schoolId, campusId, fromClass, fromSection });
    const relaxed = await runQuery(relaxedFilter);
    if (relaxed.length > 0) {
      students = relaxed;
      academicYearRelaxed = true;
    }
  }

  return { students, academicYearRelaxed };
};

const toSafePercentage = (value, fallback = 50) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const resolveAcademicYearForPromotion = async ({ schoolId, toAcademicYear }) => {
  if (toAcademicYear) {
    const matcher = buildAcademicYearMatcher(toAcademicYear);
    const exact = await AcademicYear.findOne({
      schoolId,
      ...(matcher ? { name: matcher } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();
    if (exact) return exact;
  }

  return AcademicYear.findOne({ schoolId, isActive: true })
    .sort({ createdAt: -1 })
    .lean();
};

const resolveClassForPromotion = async ({ schoolId, campusId, toClass, academicYearId }) => {
  if (!toClass) return null;
  const classNameMatcher = new RegExp(`^${escapeRegex(String(toClass).trim())}$`, 'i');
  const baseFilter = {
    schoolId,
    name: classNameMatcher,
    ...(campusId ? { campusId } : {}),
  };

  if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
    const scoped = await ClassModel.findOne({
      ...baseFilter,
      academicYearId,
    })
      .select('_id name academicYearId')
      .lean();
    if (scoped) return scoped;
  }

  return ClassModel.findOne(baseFilter)
    .sort({ createdAt: -1 })
    .select('_id name academicYearId')
    .lean();
};

const autoGeneratePromotionFees = async ({
  schoolId,
  campusId,
  toClass,
  toAcademicYear,
  promotedStudentIds = [],
}) => {
  const ids = (Array.isArray(promotedStudentIds) ? promotedStudentIds : []).filter((id) =>
    mongoose.isValidObjectId(id)
  );
  if (ids.length === 0) return { created: 0, skipped: 0, reason: 'no_students' };

  const targetAcademicYear = await resolveAcademicYearForPromotion({ schoolId, toAcademicYear });
  if (!targetAcademicYear?._id) {
    return { created: 0, skipped: ids.length, reason: 'academic_year_not_found' };
  }

  const classDoc = await resolveClassForPromotion({
    schoolId,
    campusId,
    toClass,
    academicYearId: targetAcademicYear._id,
  });
  if (!classDoc?._id) {
    return { created: 0, skipped: ids.length, reason: 'class_not_found' };
  }

  const structure = await FeeStructure.findOne({
    schoolId,
    classId: classDoc._id,
    academicYearId: targetAcademicYear._id,
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();
  if (!structure) {
    return { created: 0, skipped: ids.length, reason: 'fee_structure_not_found' };
  }

  const students = await StudentUser.find({
    _id: { $in: ids },
    schoolId,
    ...(campusId ? { campusId } : {}),
    grade: toClass,
    isArchived: { $ne: true },
    status: { $nin: ['Leaving', 'Left', 'Expelled'] },
  })
    .select('_id grade section')
    .lean();
  if (students.length === 0) {
    return { created: 0, skipped: ids.length, reason: 'no_matching_students' };
  }

  const studentIds = students.map((student) => student._id);
  const existingInvoices = await FeeInvoice.find({
    schoolId,
    feeStructureId: structure._id,
    studentId: { $in: studentIds },
  })
    .select('studentId')
    .lean();
  const existingSet = new Set(existingInvoices.map((item) => String(item.studentId)));

  const priorInvoices = await FeeInvoice.find({
    schoolId,
    studentId: { $in: studentIds },
  })
    .select('studentId')
    .lean();
  const priorInvoiceSet = new Set(priorInvoices.map((item) => String(item.studentId)));

  const invoicesToCreate = students
    .filter((student) => !existingSet.has(String(student._id)))
    .map((student) => {
      const snapshots = buildInvoiceSnapshotsForStudent({
        structure,
        hasPriorInvoice: priorInvoiceSet.has(String(student._id)),
      });
      return {
        schoolId,
        academicYearId: structure.academicYearId || targetAcademicYear._id,
        classId: structure.classId,
        className: student.grade || classDoc.name || structure.className || String(toClass || ''),
        section: student.section || '',
        studentId: student._id,
        feeStructureId: structure._id,
        title: structure.name || `Fee Invoice - ${String(toClass || '').trim()}`,
        totalAmount: snapshots.totalAmount,
        paidAmount: 0,
        balanceAmount: snapshots.totalAmount,
        discountAmount: 0,
        discountNote: '',
        lateFeeRuleSnapshot: {
          amount: normalizeAmount(structure?.lateFeeAmount),
        },
        lateFeeAmountApplied: 0,
        feeHeadsSnapshot: snapshots.feeHeadsSnapshot,
        installmentsSnapshot: snapshots.installmentsSnapshot,
        status: 'due',
      };
    });

  if (invoicesToCreate.length > 0) {
    await FeeInvoice.insertMany(invoicesToCreate);
  }

  return {
    created: invoicesToCreate.length,
    skipped: students.length - invoicesToCreate.length,
    structureId: structure._id,
    academicYearId: targetAcademicYear._id,
  };
};

const computeResultSummaryByStudent = async ({ schoolId, campusId, studentIds }) => {
  const ids = (Array.isArray(studentIds) ? studentIds : []).filter((id) => mongoose.isValidObjectId(id));
  if (ids.length === 0) return new Map();

  const results = await ExamResult.find({
    schoolId,
    ...(campusId ? { campusId } : {}),
    studentId: { $in: ids },
    published: true,
  })
    .populate('examId', 'marks')
    .lean();

  const byStudent = new Map();
  results.forEach((result) => {
    const studentId = String(result?.studentId || '');
    if (!studentId) return;
    const totalMarks = Number(result?.examId?.marks || 0);
    const obtainedMarks = Number(result?.marks || 0);
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) return;
    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, { totalMarks: 0, obtainedMarks: 0, resultCount: 0 });
    }
    const current = byStudent.get(studentId);
    current.totalMarks += totalMarks;
    current.obtainedMarks += Number.isFinite(obtainedMarks) ? obtainedMarks : 0;
    current.resultCount += 1;
  });

  return byStudent;
};

const writeAuditLog = async ({
  schoolId,
  actorId,
  action,
  entity,
  entityId,
  meta,
}) => {
  try {
    await AuditLog.create({
      schoolId,
      actorId: actorId || null,
      actorType: 'Admin',
      action,
      entity,
      entityId: entityId || null,
      meta: meta || {},
    });
  } catch (auditErr) {
    console.error('Audit log write failed:', auditErr?.message || auditErr);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/promotion/preview
// Returns students that match the filter criteria (for preview before promotion)
// Body: { fromClass, fromSection?, fromAcademicYear? }
// ─────────────────────────────────────────────────────────────
router.post('/preview', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { fromClass, fromSection, fromAcademicYear } = req.body;
    if (!fromClass) {
      return res.status(400).json({ error: 'fromClass is required' });
    }

    const { students, academicYearRelaxed } = await findPromotionCandidates({
      schoolId,
      campusId,
      fromClass,
      fromSection,
      fromAcademicYear,
      select: '_id name grade section roll academicYear studentCode status email mobile',
    });

    res.json({ students, count: students.length, academicYearRelaxed });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to preview students' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/promotion/preview-marks
// Returns students with aggregated marks and eligibility by threshold
// Body: { fromClass, fromSection?, fromAcademicYear?, minPercentage? }
// ─────────────────────────────────────────────────────────────
router.post('/preview-marks', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { fromClass, fromSection, fromAcademicYear, minPercentage = 50 } = req.body || {};
    if (!fromClass) {
      return res.status(400).json({ error: 'fromClass is required' });
    }

    const threshold = toSafePercentage(minPercentage, 50);
    const { students, academicYearRelaxed } = await findPromotionCandidates({
      schoolId,
      campusId,
      fromClass,
      fromSection,
      fromAcademicYear,
      select: '_id name grade section roll academicYear studentCode status email mobile',
    });

    const summaryByStudent = await computeResultSummaryByStudent({
      schoolId,
      campusId,
      studentIds: students.map((student) => student._id),
    });

    const withMarks = students.map((student) => {
      const summary = summaryByStudent.get(String(student._id)) || {
        totalMarks: 0,
        obtainedMarks: 0,
        resultCount: 0,
      };
      const percentage =
        Number(summary.totalMarks) > 0
          ? Math.round((Number(summary.obtainedMarks) / Number(summary.totalMarks)) * 10000) / 100
          : 0;
      const eligible = Number(summary.totalMarks) > 0 && percentage >= threshold;
      return {
        ...student,
        marksSummary: {
          obtainedMarks: Number(summary.obtainedMarks) || 0,
          totalMarks: Number(summary.totalMarks) || 0,
          resultCount: Number(summary.resultCount) || 0,
          percentage,
          eligible,
        },
      };
    });

    const ranked = [...withMarks].sort((a, b) => {
      const diff = Number(b?.marksSummary?.percentage || 0) - Number(a?.marksSummary?.percentage || 0);
      if (diff !== 0) return diff;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });

    const eligibleIds = ranked
      .filter((student) => student?.marksSummary?.eligible)
      .map((student) => student._id);

    res.json({
      students: ranked,
      eligibleIds,
      minPercentage: threshold,
      count: ranked.length,
      eligibleCount: eligibleIds.length,
      ineligibleCount: ranked.length - eligibleIds.length,
      academicYearRelaxed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to preview marks-based promotion' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/promotion/execute
// Executes the promotion — updates grade/section on selected students
// Body: {
//   studentIds: [...],
//   toClass: 'Class 6',
//   toSection?: 'A',
//   toAcademicYear?: '2025-26',
//   fromClass, fromSection?, fromAcademicYear?,
//   type: 'bulk' | 'manual' | 'marks',
//   notes?: ''
// }
// ─────────────────────────────────────────────────────────────
router.post('/execute', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const {
      studentIds,
      toClass,
      toSection,
      toAcademicYear,
      fromClass,
      fromSection,
      fromAcademicYear,
      type = 'manual',
      notes = '',
      marksConfig = {},
    } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds array is required' });
    }
    if (!toClass) {
      return res.status(400).json({ error: 'toClass is required' });
    }

    const validIds = studentIds.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid student IDs provided' });
    }

    const buildExecuteEligibleFilter = (includeAcademicYear) => {
      const filter = {
        _id: { $in: validIds },
        schoolId,
        isArchived: { $ne: true },
        status: { $nin: ['Leaving', 'Left', 'Expelled'] },
      };
      if (campusId) filter.campusId = campusId;
      if (fromClass) filter.grade = fromClass;
      if (fromSection) filter.section = fromSection;
      if (includeAcademicYear && fromAcademicYear) {
        const matcher = buildAcademicYearMatcher(fromAcademicYear);
        if (matcher) filter.academicYear = matcher;
      }
      return filter;
    };

    // Same relaxation as /preview: if the strict session match finds
    // nobody (e.g. the selected "from" year doesn't match what's stored
    // on these students yet), fall back to class/section alone so the
    // students the admin already picked in preview still get promoted.
    let eligibleStudents = await StudentUser.find(buildExecuteEligibleFilter(true)).select('_id').lean();
    let academicYearRelaxed = false;
    if (eligibleStudents.length === 0 && fromAcademicYear) {
      const relaxed = await StudentUser.find(buildExecuteEligibleFilter(false)).select('_id').lean();
      if (relaxed.length > 0) {
        eligibleStudents = relaxed;
        academicYearRelaxed = true;
      }
    }
    if (eligibleStudents.length === 0) {
      return res.status(400).json({ error: 'No eligible students found for promotion' });
    }
    const eligibleIds = eligibleStudents.map((s) => s._id);
    let finalPromoteIds = eligibleIds;
    let marksThreshold = null;
    let marksIneligibleCount = 0;
    const marksSummaryByStudent = new Map();

    if (type === 'marks') {
      marksThreshold = toSafePercentage(marksConfig?.minPercentage, 50);
      const summaryByStudent = await computeResultSummaryByStudent({
        schoolId,
        campusId,
        studentIds: eligibleIds,
      });
      eligibleIds.forEach((id) => {
        const summary = summaryByStudent.get(String(id)) || { totalMarks: 0, obtainedMarks: 0, resultCount: 0 };
        const percentage =
          Number(summary.totalMarks) > 0
            ? (Number(summary.obtainedMarks) / Number(summary.totalMarks)) * 100
            : 0;
        const passed = Number(summary.totalMarks) > 0 && percentage >= marksThreshold;
        marksSummaryByStudent.set(String(id), {
          ...summary,
          percentage,
          passed,
        });
      });
      finalPromoteIds = eligibleIds.filter((id) => marksSummaryByStudent.get(String(id))?.passed);
      marksIneligibleCount = eligibleIds.length - finalPromoteIds.length;
      if (finalPromoteIds.length === 0) {
        return res.status(400).json({ error: 'No students meet the marks criteria for promotion' });
      }
    }

    // Build the update payload
    const updateFields = { grade: toClass };
    if (toSection) updateFields.section = toSection;
    if (toAcademicYear) {
      updateFields.academicYear = toAcademicYear;
      updateFields.batchCode = toAcademicYear;
    }

    const updateResult = await StudentUser.updateMany(
      { _id: { $in: finalPromoteIds }, schoolId },
      { $set: updateFields }
    );

    if (type === 'marks' && updateResult.modifiedCount > 0) {
      const promotedStudents = await StudentUser.find({
        _id: { $in: finalPromoteIds },
        schoolId,
      })
        .select('_id name section academicYear')
        .lean();

      const grouped = new Map();
      promotedStudents.forEach((student) => {
        const sectionKey = String(student?.section || '');
        const yearKey = String(student?.academicYear || '');
        const key = `${sectionKey}__${yearKey}`;
        if (!grouped.has(key)) {
          grouped.set(key, { section: sectionKey, academicYear: yearKey, students: [] });
        }
        grouped.get(key).students.push(student);
      });

      for (const group of grouped.values()) {
        const baseFilter = {
          schoolId,
          grade: toClass,
          section: group.section,
          isArchived: { $ne: true },
          status: { $nin: ['Leaving', 'Left', 'Expelled'] },
          _id: { $nin: group.students.map((student) => student._id) },
        };
        if (campusId) baseFilter.campusId = campusId;
        if (group.academicYear) {
          baseFilter.academicYear = group.academicYear;
        } else if (toAcademicYear) {
          baseFilter.academicYear = toAcademicYear;
        }

        const existing = await StudentUser.find(baseFilter).select('roll').lean();
        const maxExistingRoll = existing.reduce((max, student) => {
          const roll = Number(student?.roll);
          if (!Number.isFinite(roll)) return max;
          return Math.max(max, roll);
        }, 0);

        const ranked = [...group.students].sort((a, b) => {
          const pa = Number(marksSummaryByStudent.get(String(a._id))?.percentage || 0);
          const pb = Number(marksSummaryByStudent.get(String(b._id))?.percentage || 0);
          if (pb !== pa) return pb - pa;
          return String(a?.name || '').localeCompare(String(b?.name || ''));
        });

        for (let i = 0; i < ranked.length; i += 1) {
          await StudentUser.updateOne(
            { _id: ranked[i]._id, schoolId },
            { $set: { roll: maxExistingRoll + i + 1 } }
          );
        }
      }
    }

    try {
      await syncTimetableGroupThreads({ schoolId, campusId: campusId || null });
      await syncAllocationGroupThreads({ schoolId, campusId: campusId || null });
    } catch (syncErr) {
      console.error('Promotion chat-group sync failed:', syncErr?.message || syncErr);
    }

    // Record promotion history
    const history = await PromotionHistory.create({
      schoolId,
      campusId: campusId || null,
      fromClass: fromClass || '',
      toClass,
      fromSection: fromSection || null,
      toSection: toSection || null,
      fromAcademicYear: fromAcademicYear || null,
      toAcademicYear: toAcademicYear || null,
      studentIds: finalPromoteIds,
      studentCount: updateResult.modifiedCount,
      type,
      promotedBy: req.admin?._id || null,
      notes,
    });

    const skippedCount = validIds.length - finalPromoteIds.length;
    let feeResult = {
      created: 0,
      skipped: 0,
      reason: 'no_promotion',
    };
    if (updateResult.modifiedCount > 0) {
      feeResult = await autoGeneratePromotionFees({
        schoolId,
        campusId,
        toClass,
        toAcademicYear,
        promotedStudentIds: finalPromoteIds,
      });
    }

    res.json({
      success: true,
      promoted: updateResult.modifiedCount,
      matched: finalPromoteIds.length,
      skipped: skippedCount,
      marksIneligible: marksIneligibleCount,
      marksThreshold,
      feeInvoicesCreated: feeResult.created,
      feeInvoicesSkipped: feeResult.skipped,
      feeInvoiceReason: feeResult.reason || null,
      historyId: history._id,
      message: `${updateResult.modifiedCount} student(s) promoted to ${toClass}${toSection ? ' - ' + toSection : ''}`,
      academicYearRelaxed,
    });

    await writeAuditLog({
      schoolId,
      actorId: req.admin?._id || req.admin?.id,
      action: 'promotion.execute',
      entity: 'PromotionHistory',
      entityId: history._id,
      meta: {
        fromClass: fromClass || null,
        toClass,
        fromSection: fromSection || null,
        toSection: toSection || null,
        fromAcademicYear: fromAcademicYear || null,
        toAcademicYear: toAcademicYear || null,
        requestedCount: validIds.length,
        matchedCount: finalPromoteIds.length,
        promotedCount: updateResult.modifiedCount,
        skippedCount,
        feeInvoicesCreated: feeResult.created,
        feeInvoicesSkipped: feeResult.skipped,
        feeInvoiceReason: feeResult.reason || null,
        type,
        marksThreshold,
        marksIneligibleCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to execute promotion' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/promotion/history
// Returns promotion history for the school/campus
// ─────────────────────────────────────────────────────────────
router.get('/history', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const filter = { schoolId };
    if (campusId) filter.campusId = campusId;

    const history = await PromotionHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load history' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/promotion/leaving-students
// Returns students with status Leaving or Left
// Query: classFilter?, sectionFilter?
// ─────────────────────────────────────────────────────────────
router.get('/leaving-students', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const filter = {
      schoolId,
      status: { $in: ['Leaving', 'Left'] },
    };
    if (campusId) filter.campusId = campusId;

    const { classFilter, sectionFilter } = req.query;
    if (classFilter) filter.grade = classFilter;
    if (sectionFilter) filter.section = sectionFilter;

    const students = await StudentUser.find(filter)
      .select(
        '_id name grade section roll academicYear studentCode status email mobile fatherName guardianPhone reasonForLeaving transferCertificateNo transferCertificateDate remarks updatedAt'
      )
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ students, count: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load leaving students' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/promotion/mark-leaving
// Mark one or more students as "Leaving"
// Body: {
//   studentIds: [...],
//   leavingDate?,
//   reasonForLeaving?,
//   transferCertificateNo?,
//   transferCertificateDate?,
//   remarks?
// }
// ─────────────────────────────────────────────────────────────
router.post('/mark-leaving', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const {
      studentIds,
      leavingDate,
      reasonForLeaving,
      transferCertificateNo,
      transferCertificateDate,
      remarks,
    } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds array is required' });
    }
    if (!reasonForLeaving) {
      return res.status(400).json({ error: 'reasonForLeaving is required' });
    }

    const validIds = studentIds.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid student IDs provided' });
    }

    const updateFields = { status: 'Leaving' };
    if (reasonForLeaving) updateFields.reasonForLeaving = reasonForLeaving;
    if (transferCertificateNo) updateFields.transferCertificateNo = transferCertificateNo;
    // Use explicit TC date if provided, fall back to leaving date
    if (transferCertificateDate) {
      updateFields.transferCertificateDate = transferCertificateDate;
    } else if (leavingDate) {
      updateFields.transferCertificateDate = leavingDate;
    }
    // Store leaving date + remarks in remarks field for reference
    const remarksNote = [
      leavingDate ? `Leaving Date: ${leavingDate}` : '',
      remarks || '',
    ]
      .filter(Boolean)
      .join(' | ');
    if (remarksNote) updateFields.remarks = remarksNote;

    const result = await StudentUser.updateMany(
      {
        _id: { $in: validIds },
        schoolId,
        ...(campusId ? { campusId } : {}),
        isArchived: { $ne: true },
        status: { $nin: ['Left', 'Expelled'] },
      },
      { $set: updateFields }
    );

    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `${result.modifiedCount} student(s) marked as leaving`,
    });

    await writeAuditLog({
      schoolId,
      actorId: req.admin?._id || req.admin?.id,
      action: 'student.mark_leaving',
      entity: 'StudentUser',
      meta: {
        studentIds: validIds,
        updatedCount: result.modifiedCount,
        leavingDate: leavingDate || null,
        reasonForLeaving,
        transferCertificateNo: transferCertificateNo || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark students as leaving' });
  }
});

// PUT /api/promotion/mark-left/:id
// Finalize a leaving student to Left
router.put('/mark-left/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const student = await StudentUser.findOne({
      _id: id,
      schoolId,
      ...(campusId ? { campusId } : {}),
      isArchived: { $ne: true },
    }).select('_id name status').lean();

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (student.status === 'Left') {
      return res.json({
        success: true,
        student: { _id: student._id, name: student.name, status: 'Left' },
        message: `${student.name} is already marked as Left`,
      });
    }
    if (student.status !== 'Leaving') {
      return res.status(400).json({ error: 'Only students in Leaving status can be marked as Left' });
    }

    const updated = await StudentUser.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      { $set: { status: 'Left' } },
      { new: true }
    ).select('_id name grade section status');

    res.json({
      success: true,
      student: updated,
      message: `${updated.name} marked as Left`,
    });

    await writeAuditLog({
      schoolId,
      actorId: req.admin?._id || req.admin?.id,
      action: 'student.mark_left',
      entity: 'StudentUser',
      entityId: updated._id,
      meta: {
        studentName: updated.name,
        fromStatus: 'Leaving',
        toStatus: 'Left',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark student as Left' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/promotion/restore-student/:id
// Restore a leaving student back to Active
// ─────────────────────────────────────────────────────────────
router.put('/restore-student/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const student = await StudentUser.findOneAndUpdate(
      { _id: id, schoolId },
      {
        $set: {
          status: 'Active',
          reasonForLeaving: '',
          transferCertificateNo: '',
          transferCertificateDate: '',
          remarks: '',
        },
      },
      { new: true }
    ).select('name grade section status');

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, student, message: `${student.name} restored to Active` });

    await writeAuditLog({
      schoolId,
      actorId: req.admin?._id || req.admin?.id,
      action: 'student.restore_active',
      entity: 'StudentUser',
      entityId: student._id,
      meta: {
        studentName: student.name,
        toStatus: 'Active',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to restore student' });
  }
});

module.exports = router;
