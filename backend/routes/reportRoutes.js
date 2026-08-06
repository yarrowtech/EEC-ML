const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const authStudent = require('../middleware/authStudent');
const authParent = require('../middleware/authParent');

const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const FeeInvoice = require('../models/FeeInvoice');
const ExamResult = require('../models/ExamResult');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
const School = require('../models/School');
const ReportCardTemplate = require('../models/ReportCardTemplate');
const Exam = require('../models/Exam');
const ExamGroup = require('../models/ExamGroup');
const TeacherAllocation = require('../models/TeacherAllocation');
const Principal = require('../models/Principal');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();

const REPORT_CARD_DEFAULTS = {
  title: 'Report Card',
  subtitle: 'Academic Performance Report',
  schoolNameOverride: '',
  logoUrlOverride: '',
  schoolAddressLine: '',
  schoolContactLine: '',
  accentColor: '#1f2937',
  showPageBorder: true,
  watermarkText: '',
  footerNote: 'This is a computer-generated report card.',
  signatureLabel: 'Class Teacher',
  principalLabel: 'Principal',
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const computeGrade = (percentage) => {
  if (!Number.isFinite(percentage)) return '';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || req.user?.schoolId || null;
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

const resolveCampusId = (req) => req.campusId || req.user?.campusId || null;

const buildStudentScopeFilter = ({ schoolId, campusId }) => ({
  schoolId,
  ...(campusId ? { campusId } : {}),
  isArchived: { $ne: true },
});

const resolveTemplate = async ({ schoolId, campusId }) => {
  let template = null;
  if (campusId) {
    template = await ReportCardTemplate.findOne({
      schoolId,
      $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }],
    })
      .sort({ campusId: -1, updatedAt: -1 })
      .lean();
  } else {
    template = await ReportCardTemplate.findOne({ schoolId, campusId: null }).lean();
  }

  const school = await School.findById(schoolId)
    .select('name logo address contactPhone contactEmail officialEmail campuses')
    .lean();
  const campusAddress =
    (Array.isArray(school?.campuses) &&
      (school.campuses.find((campus) => String(campus?._id || '') === String(campusId || ''))?.address ||
        school.campuses.find((campus) => String(campus?.campusType || '').toLowerCase() === 'main')?.address ||
        school.campuses.find((campus) => String(campus?.address || '').trim())?.address)) ||
    '';
  const campusContactPhone =
    (Array.isArray(school?.campuses) &&
      (school.campuses.find((campus) => String(campus?._id || '') === String(campusId || ''))?.contactPhone ||
        school.campuses.find((campus) => String(campus?.contactPhone || '').trim())?.contactPhone)) ||
    '';
  const schoolName = template?.schoolNameOverride || school?.name || '';
  const schoolAddressLine = template?.schoolAddressLine || school?.address || campusAddress || '';
  const schoolContactLine =
    template?.schoolContactLine ||
    [school?.contactPhone, campusContactPhone, school?.contactEmail, school?.officialEmail]
      .filter(Boolean)
      .join(' | ');
  const logoUrl = template?.logoUrlOverride || school?.logo?.secure_url || school?.logo?.url || '';

  return {
    ...REPORT_CARD_DEFAULTS,
    ...(template || {}),
    schoolName,
    schoolAddressLine,
    schoolContactLine,
    logoUrl,
  };
};

const resolveClassAndSection = async ({ schoolId, campusId, classId, sectionId }) => {
  let classDoc = null;
  let sectionDoc = null;

  if (classId) {
    if (!mongoose.isValidObjectId(classId)) {
      return { error: 'Invalid classId' };
    }
    classDoc = await ClassModel.findOne({
      _id: classId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();
    if (!classDoc) return { error: 'Class not found' };
  }

  if (sectionId) {
    if (!mongoose.isValidObjectId(sectionId)) {
      return { error: 'Invalid sectionId' };
    }
    sectionDoc = await Section.findOne({
      _id: sectionId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();
    if (!sectionDoc) return { error: 'Section not found' };
  }

  if (classDoc && sectionDoc && String(sectionDoc.classId) !== String(classDoc._id)) {
    return { error: 'Section does not belong to selected class' };
  }

  return { classDoc, sectionDoc };
};

const resolveAcademicYear = async ({ schoolId, academicYearId, academicYear }) => {
  if (academicYearId) {
    if (!mongoose.isValidObjectId(academicYearId)) {
      return { error: 'Invalid academicYearId' };
    }
    const yearDoc = await AcademicYear.findOne({ _id: academicYearId, schoolId }).lean();
    if (!yearDoc) return { error: 'Academic year not found' };
    return { yearDoc, academicYearName: yearDoc.name || '' };
  }
  return { yearDoc: null, academicYearName: String(academicYear || '').trim() };
};

const withinAcademicYear = (examDate, yearDoc) => {
  if (!yearDoc) return true;
  const parsedDate = toDateValue(examDate);
  // Legacy/partial exam rows may not have a date; do not exclude them from
  // report generation solely due to missing date.
  if (!parsedDate) return true;
  const start = toDateValue(yearDoc.startDate);
  const end = toDateValue(yearDoc.endDate);
  if (start && parsedDate < start) return false;
  if (end && parsedDate > end) return false;
  return true;
};

const buildReportCards = async ({
  schoolId,
  campusId,
  students,
  className,
  sectionName,
  academicYearName,
  yearDoc,
  includeUnpublished,
  examIds,
}) => {
  if (!students.length) return [];
  const studentIds = students.map((student) => student._id);
  const scopedExamIds = Array.isArray(examIds) && examIds.length > 0 ? examIds : null;
  const results = await ExamResult.find({
    schoolId,
    ...(campusId ? { campusId } : {}),
    studentId: { $in: studentIds },
    ...(scopedExamIds ? { examId: { $in: scopedExamIds } } : {}),
    ...(includeUnpublished ? {} : { published: true }),
  })
    .populate('examId', 'title subject term date marks grade section classId sectionId')
    .sort({ createdAt: -1 })
    .lean();

  const byStudent = new Map();
  results.forEach((result) => {
    const key = String(result.studentId);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(result);
  });

  return students.map((student) => {
    const studentResults = byStudent.get(String(student._id)) || [];
    const subjectMap = new Map();
    const examItems = [];

    studentResults.forEach((result) => {
      const exam = result.examId || {};
      const examClassName = String(exam.grade || '').trim();
      const examSectionName = String(exam.section || '').trim();

      if (className && normalizeKey(examClassName) && normalizeKey(examClassName) !== normalizeKey(className)) {
        return;
      }
      if (
        sectionName &&
        normalizeKey(examSectionName) &&
        normalizeKey(examSectionName) !== normalizeKey(sectionName)
      ) {
        return;
      }
      // If caller already scoped to an explicit exam set (e.g. selected completed
      // exam group), do not additionally drop rows by academic-year date window.
      // Legacy year ranges/dates can otherwise hide valid completed results.
      if (!scopedExamIds && yearDoc && !withinAcademicYear(exam.date, yearDoc)) {
        return;
      }
      const subjectName = String(exam.subject || 'Subject').trim() || 'Subject';
      const obtained = Number(result.marks || 0);
      const maxMarks = Number(exam.marks || 0);
      const percentage = maxMarks > 0 ? (obtained / maxMarks) * 100 : 0;

      const existing = subjectMap.get(subjectName) || {
        name: subjectName,
        obtained: 0,
        maxMarks: 0,
        examCount: 0,
      };
      existing.obtained += obtained;
      existing.maxMarks += maxMarks;
      existing.examCount += 1;
      subjectMap.set(subjectName, existing);

      examItems.push({
        examName: exam.title || 'Exam',
        subject: subjectName,
        term: exam.term || '',
        date: exam.date || result.createdAt,
        obtainedMarks: obtained,
        totalMarks: maxMarks,
        percentage: Math.round(percentage),
        grade: String(result.grade || '').trim() || computeGrade(percentage),
        status: result.status || 'pass',
        remarks: result.remarks || '',
      });
    });

    const subjects = Array.from(subjectMap.values())
      .map((item) => {
        const percentage = item.maxMarks > 0 ? (item.obtained / item.maxMarks) * 100 : 0;
        return {
          name: item.name,
          obtainedMarks: item.obtained,
          totalMarks: item.maxMarks,
          percentage: Math.round(percentage),
          grade: computeGrade(percentage),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalObtained = subjects.reduce((sum, subject) => sum + Number(subject.obtainedMarks || 0), 0);
    const totalMarks = subjects.reduce((sum, subject) => sum + Number(subject.totalMarks || 0), 0);
    const overallPercentage = totalMarks > 0 ? (totalObtained / totalMarks) * 100 : 0;

    return {
      studentId: student._id,
      studentName: student.name || 'Student',
      studentCode: student.studentCode || '',
      username: student.username || '',
      admissionNumber: student.admissionNumber || '',
      roll: student.roll || '',
      grade: student.grade || '',
      section: student.section || '',
      academicYear: academicYearName || student.academicYear || '',
      totals: {
        obtainedMarks: totalObtained,
        totalMarks,
        percentage: Math.round(overallPercentage * 100) / 100,
        grade: computeGrade(overallPercentage),
        promoted: totalMarks > 0 ? overallPercentage >= 50 : null,
      },
      subjects,
      exams: examItems.sort((a, b) => {
        const d1 = toDateValue(a.date)?.getTime() || 0;
        const d2 = toDateValue(b.date)?.getTime() || 0;
        return d2 - d1;
      }),
      generatedAt: new Date(),
    };
  });
};

router.get('/summary', adminAuth, async (req, res) => {
  // #swagger.tags = ['Reports']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    const [studentCount, teacherCount, parentCount] = await Promise.all([
      StudentUser.countDocuments({ schoolId, status: 'Active' }),
      TeacherUser.countDocuments({ schoolId }),
      ParentUser.countDocuments({ schoolId }),
    ]);

    const feeTotals = await FeeInvoice.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId) } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          balanceAmount: { $sum: '$balanceAmount' },
        },
      },
    ]);

    const fee = feeTotals[0] || { totalAmount: 0, paidAmount: 0, balanceAmount: 0 };

    const attendanceTotals = await StudentUser.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId),
          status: 'Active',
        },
      },
      { $unwind: { path: '$attendance', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          totalMarked: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$attendance.status', 'present'] }, 1, 0],
            },
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ['$attendance.status', 'absent'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const attendance = attendanceTotals[0] || { totalMarked: 0, present: 0, absent: 0 };

    res.json({
      users: { students: studentCount, teachers: teacherCount, parents: parentCount },
      fees: fee,
      attendance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report-cards/template', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const template = await resolveTemplate({ schoolId, campusId });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/report-cards/template', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const payload = req.body || {};
    const updates = {
      title: String(payload.title || REPORT_CARD_DEFAULTS.title).trim(),
      subtitle: String(payload.subtitle || REPORT_CARD_DEFAULTS.subtitle).trim(),
      schoolNameOverride: String(payload.schoolNameOverride || '').trim(),
      logoUrlOverride: String(payload.logoUrlOverride || '').trim(),
      schoolAddressLine: String(payload.schoolAddressLine || '').trim(),
      schoolContactLine: String(payload.schoolContactLine || '').trim(),
      accentColor: String(payload.accentColor || REPORT_CARD_DEFAULTS.accentColor).trim(),
      showPageBorder: payload.showPageBorder !== undefined ? Boolean(payload.showPageBorder) : true,
      watermarkText: String(payload.watermarkText || '').trim(),
      footerNote: String(payload.footerNote || REPORT_CARD_DEFAULTS.footerNote).trim(),
      signatureLabel: String(payload.signatureLabel || REPORT_CARD_DEFAULTS.signatureLabel).trim(),
      principalLabel: String(payload.principalLabel || REPORT_CARD_DEFAULTS.principalLabel).trim(),
    };

    await ReportCardTemplate.findOneAndUpdate(
      { schoolId, campusId: campusId || null },
      {
        schoolId,
        campusId: campusId || null,
        ...updates,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const template = await resolveTemplate({ schoolId, campusId });
    res.json({ message: 'Report card template saved', template });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const resolveSignatories = async ({ schoolId, campusId, classId, sectionId }) => {
  let classTeacherName = '';
  if (classId && sectionId) {
    const allocation = await TeacherAllocation.findOne({
      schoolId,
      ...(campusId ? { campusId } : {}),
      classId,
      sectionId,
      isClassTeacher: true,
    })
      .populate('teacherId', 'name')
      .lean();
    classTeacherName = String(allocation?.teacherId?.name || '').trim();
  }

  const principalFilter = campusId
    ? {
        schoolId,
        $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }],
      }
    : { schoolId };

  const principal = await Principal.findOne(principalFilter)
    .sort({ updatedAt: -1, createdAt: -1 })
    .select('name')
    .lean();

  return { classTeacherName, principalName: String(principal?.name || '').trim() };
};

router.get('/report-cards/signatories', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { classId, sectionId } = req.query || {};

    const scope = await resolveClassAndSection({ schoolId, campusId, classId, sectionId });
    if (scope.error) return res.status(400).json({ error: scope.error });

    const { classTeacherName, principalName } = await resolveSignatories({
      schoolId,
      campusId,
      classId: scope.classDoc?._id || null,
      sectionId: scope.sectionDoc?._id || null,
    });

    return res.json({
      classTeacherName,
      principalName,
      className: scope.classDoc?.name || '',
      sectionName: scope.sectionDoc?.name || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/report-cards/bulk', adminAuth, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const {
      classId,
      sectionId,
      academicYearId,
      academicYear,
      includeUnpublished = false,
      examGroupId,
    } = req.body || {};

    const [scope, yearResult] = await Promise.all([
      resolveClassAndSection({ schoolId, campusId, classId, sectionId }),
      resolveAcademicYear({ schoolId, academicYearId, academicYear }),
    ]);

    if (scope.error) return res.status(400).json({ error: scope.error });
    if (yearResult.error) return res.status(400).json({ error: yearResult.error });

    const className = scope.classDoc?.name || '';
    const sectionName = scope.sectionDoc?.name || '';
    const academicYearName = yearResult.academicYearName || '';
    let selectedExamGroup = null;
    let selectedExamIds = null;
    if (examGroupId) {
      if (!mongoose.isValidObjectId(examGroupId)) {
        return res.status(400).json({ error: 'Invalid examGroupId' });
      }
      selectedExamGroup = await ExamGroup.findOne({
        _id: examGroupId,
        schoolId,
        ...(campusId ? { campusId } : {}),
      })
        .select('_id title term classId sectionId grade section')
        .lean();
      if (!selectedExamGroup) {
        return res.status(404).json({ error: 'Exam group not found' });
      }
      const groupClassMatches =
        !scope.classDoc ||
        String(selectedExamGroup.classId || '') === String(scope.classDoc._id || '') ||
        normalizeKey(selectedExamGroup.grade) === normalizeKey(scope.classDoc.name);
      if (!groupClassMatches) {
        return res.status(400).json({ error: 'Selected exam group does not belong to selected class' });
      }
      const groupSectionMatches =
        !scope.sectionDoc ||
        String(selectedExamGroup.sectionId || '') === String(scope.sectionDoc._id || '') ||
        normalizeKey(selectedExamGroup.section) === normalizeKey(scope.sectionDoc.name);
      if (!groupSectionMatches) {
        return res.status(400).json({ error: 'Selected exam group does not belong to selected section' });
      }
      const groupedExams = await Exam.find({
        schoolId,
        ...(campusId ? { campusId } : {}),
        groupId: selectedExamGroup._id,
      })
        .select('_id')
        .lean();
      selectedExamIds = groupedExams.map((exam) => exam._id);
    }

    const studentFilter = buildStudentScopeFilter({ schoolId, campusId });
    if (className) studentFilter.grade = className;
    if (sectionName) studentFilter.section = sectionName;
    if (academicYearName) {
      studentFilter.academicYear = { $regex: escapeRegex(academicYearName), $options: 'i' };
    }

    const students = await StudentUser.find(studentFilter)
      .select('name roll grade section academicYear admissionNumber username studentCode')
      .sort({ roll: 1, name: 1 })
      .lean();

    const [template, reportCards] = await Promise.all([
      resolveTemplate({ schoolId, campusId }),
      buildReportCards({
        schoolId,
        campusId,
        students,
        className,
        sectionName,
        academicYearName,
        yearDoc: yearResult.yearDoc,
        includeUnpublished: Boolean(includeUnpublished),
        examIds: selectedExamIds,
      }),
    ]);

    res.json({
      template,
      filters: {
        classId: classId || '',
        sectionId: sectionId || '',
        examGroupId: selectedExamGroup?._id || '',
        examGroupTitle: selectedExamGroup?.title || '',
        className,
        sectionName,
        academicYearId: academicYearId || '',
        academicYear: academicYearName,
        includeUnpublished: Boolean(includeUnpublished),
      },
      meta: {
        totalStudents: students.length,
        generatedCards: reportCards.length,
      },
      reportCards,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/report-cards/me', authStudent, async (req, res) => {
  try {
    logStudentPortalEvent(req, {
      feature: 'results',
      action: 'report_card.fetch',
      targetType: 'student',
      targetId: req.user?.id,
      examGroupId: req.query?.examGroupId || undefined,
    });
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { examGroupId } = req.query || {};

    const student = await StudentUser.findOne({
      _id: req.user.id,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name roll grade section academicYear admissionNumber username studentCode')
      .lean();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const className = String(student.grade || '').trim();
    const sectionName = String(student.section || '').trim();
    const studentAcademicYearName = String(student.academicYear || '').trim();

    // Schools recreate Class docs with the same name each academic year (e.g. "5"
    // exists for 2025-2026, 2026-2027, ...). Without scoping to the student's own
    // year, ClassModel.findOne can resolve to a stale year's class, which then
    // filters out the student's actual current-year exam groups/results below.
    let studentYearDoc = studentAcademicYearName
      ? await AcademicYear.findOne({ schoolId, name: studentAcademicYearName })
          .select('_id name')
          .lean()
      : null;
    if (!studentYearDoc) {
      studentYearDoc = await AcademicYear.findOne({ schoolId, isActive: true })
        .select('_id name')
        .lean();
    }

    let classDoc = null;
    if (className) {
      const classQuery = {
        schoolId,
        ...(campusId ? { campusId } : {}),
        name: className,
      };
      if (studentYearDoc?._id) {
        classDoc = await ClassModel.findOne({ ...classQuery, academicYearId: studentYearDoc._id })
          .select('_id name')
          .lean();
      }
      if (!classDoc) {
        classDoc = await ClassModel.findOne(classQuery)
          .sort({ createdAt: -1 })
          .select('_id name')
          .lean();
      }
    }
    const sectionDoc = classDoc?._id && sectionName
      ? await Section.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          classId: classDoc._id,
          name: sectionName,
        })
          .select('_id name')
          .lean()
      : null;

    const groupFilter = {
      schoolId,
      ...(campusId ? { campusId } : {}),
      status: { $regex: '^completed$', $options: 'i' },
      ...(classDoc?._id ? { classId: classDoc._id } : {}),
      ...(sectionDoc?._id ? { sectionId: sectionDoc._id } : {}),
    };

    const completedExamGroups = await ExamGroup.find(groupFilter)
      .select('_id title term status startDate endDate classId sectionId')
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    let selectedExamGroup = null;
    if (examGroupId) {
      if (!mongoose.isValidObjectId(examGroupId)) {
        return res.status(400).json({ error: 'Invalid examGroupId' });
      }
      selectedExamGroup = completedExamGroups.find((group) => String(group._id) === String(examGroupId)) || null;
      if (!selectedExamGroup) {
        return res.status(404).json({ error: 'Selected exam group is not available for this student' });
      }
    } else {
      selectedExamGroup = completedExamGroups[0] || null;
    }

    let selectedExamIds = null;
    if (selectedExamGroup?._id) {
      const groupedExams = await Exam.find({
        schoolId,
        ...(campusId ? { campusId } : {}),
        groupId: selectedExamGroup._id,
      })
        .select('_id')
        .lean();
      selectedExamIds = groupedExams.map((exam) => exam._id);
    }

    const [baseTemplate, cards, signatories] = await Promise.all([
      resolveTemplate({ schoolId, campusId }),
      buildReportCards({
        schoolId,
        campusId,
        students: [student],
        className: className || '',
        sectionName: sectionName || '',
        academicYearName: student.academicYear || '',
        yearDoc: null,
        includeUnpublished: false,
        examIds: selectedExamIds,
      }),
      resolveSignatories({
        schoolId,
        campusId,
        classId: classDoc?._id || null,
        sectionId: sectionDoc?._id || null,
      }),
    ]);

    // Prefer the student's actual class teacher / school principal over the
    // admin-configured template defaults, which are a single school-wide value
    // and often left blank ("Class Teacher"/"Principal" placeholder text).
    const template = {
      ...baseTemplate,
      signatureLabel: signatories.classTeacherName || baseTemplate.signatureLabel,
      principalLabel: signatories.principalName || baseTemplate.principalLabel,
    };

    const reportCard = cards[0]
      ? {
          ...cards[0],
          term: selectedExamGroup?.title || cards[0].term || '',
        }
      : null;

    res.json({
      template,
      reportCard,
      examGroups: completedExamGroups.map((group) => ({
        _id: group._id,
        title: group.title || '',
        term: group.term || '',
        status: group.status || '',
        startDate: group.startDate || null,
        endDate: group.endDate || null,
      })),
      selectedExamGroupId: selectedExamGroup?._id || '',
      selectedExamGroupTitle: selectedExamGroup?.title || '',
    });
    logStudentPortalEvent(req, {
      feature: 'results',
      action: 'report_card.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: reportCard ? 1 : 0,
      examGroupId: selectedExamGroup?._id || undefined,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'results',
      action: 'report_card.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
      examGroupId: req.query?.examGroupId || undefined,
    });
    res.status(500).json({ error: err.message });
  }
});

router.get('/report-cards/parent', authParent, async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const studentId = req.query?.studentId;

    const parent = await ParentUser.findOne({ _id: req.user.id, schoolId })
      .select('childrenIds children')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const scopeFilter = buildStudentScopeFilter({ schoolId, campusId });
    let students = [];

    if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
      students = await StudentUser.find({
        ...scopeFilter,
        _id: { $in: parent.childrenIds },
      })
        .select('name roll grade section academicYear admissionNumber username studentCode')
        .sort({ roll: 1, name: 1 })
        .lean();
    } else if (Array.isArray(parent.children) && parent.children.length > 0) {
      const childNames = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
      if (childNames.length > 0) {
        students = await StudentUser.find({
          ...scopeFilter,
          name: { $in: childNames },
        })
          .select('name roll grade section academicYear admissionNumber username studentCode')
          .sort({ roll: 1, name: 1 })
          .lean();
      }
    }

    if (studentId) {
      students = students.filter((student) => String(student._id) === String(studentId));
      if (!students.length) {
        return res.status(404).json({ error: 'Student not linked to parent account' });
      }
    }

    const [template, reportCards] = await Promise.all([
      resolveTemplate({ schoolId, campusId }),
      buildReportCards({
        schoolId,
        campusId,
        students,
        className: '',
        sectionName: '',
        academicYearName: '',
        yearDoc: null,
        includeUnpublished: false,
      }),
    ]);

    res.json({ template, reportCards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
