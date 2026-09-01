const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const ClassModel = require('../models/Class');
const AcademicYear = require('../models/AcademicYear');
const { generatePassword } = require('../utils/generator');
const { hashPasswordsBulk } = require('../utils/passwordHash');

const router = express.Router();

// In-memory store for bulk-import jobs. Large imports (100s of rows, each
// needing a password hash + a few DB round trips) can take minutes — far
// longer than a hosting platform's reverse-proxy request timeout (e.g.
// Render's ~100s) — so the endpoint kicks the work off in the background
// and the frontend polls /students/bulk/status/:jobId for progress instead
// of holding one long-lived HTTP request open.
const bulkImportJobs = new Map();
const BULK_IMPORT_JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

const pruneBulkImportJob = (jobId) => {
  setTimeout(() => bulkImportJobs.delete(jobId), BULK_IMPORT_JOB_TTL_MS).unref?.();
};

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

const resolveCampusId = (req) => req.campusId || req.admin?.campusId || null;

const escapeCsvCell = (value) => {
  const normalized = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const padNumber = (value, size = 3) => String(value).padStart(size, '0');
const normalizeOrgPrefix = (adminUsername) => {
  const normalized = String(adminUsername || '')
    .trim()
    .toUpperCase()
    .replace(/^EEC[-_]?/, '')
    .replace(/[^A-Z0-9-]/g, '');
  return normalized || 'SCH';
};
// Session code (2 digits) from the active academic year — stable across the
// calendar year, matches the single "Add Student" flow.
const deriveSessionCode = (yearDoc, fallbackYear) => {
  const name = String(yearDoc?.name || '').trim();
  const groups = name.match(/\d{2,4}/g);
  if (groups && groups.length) return groups[groups.length - 1].slice(-2).padStart(2, '0');
  const d = yearDoc?.endDate || yearDoc?.startDate;
  if (d && !Number.isNaN(new Date(d).getTime())) return String(new Date(d).getFullYear()).slice(-2);
  return String(fallbackYear || new Date().getFullYear()).slice(-2);
};
const resolveStudentPrefix = ({ adminUsername, sessionCode }) =>
  `${normalizeOrgPrefix(adminUsername)}-STD-${sessionCode}-`;
const resolveParentPrefix = ({ adminUsername, sessionCode }) =>
  `${normalizeOrgPrefix(adminUsername)}-PTA-${sessionCode}-`;

// Highest existing numeric suffix among ADM/<year>/#### admission numbers.
const getMaxAdmissionSeq = async ({ schoolId, campusId, admissionYear }) => {
  const prefix = `ADM/${admissionYear}/`;
  const filter = { schoolId, admissionNumber: { $regex: `^${escapeRegex(prefix)}\\d+$` } };
  if (campusId) filter.campusId = campusId;
  const rows = await StudentUser.find(filter).select('admissionNumber').lean();
  let max = 0;
  rows.forEach((r) => {
    const m = String(r?.admissionNumber || '').match(/(\d+)$/);
    const n = m ? Number(m[1]) : 0;
    if (Number.isFinite(n) && n > max) max = n;
  });
  return max;
};
const getMaxApplicationSeq = async ({ schoolId, campusId, admissionYear }) => {
  const prefix = `APP/${admissionYear}/`;
  const filter = { schoolId, applicationId: { $regex: `^${escapeRegex(prefix)}\\d+$` } };
  if (campusId) filter.campusId = campusId;
  const rows = await StudentUser.find(filter).select('applicationId').lean();
  let max = 0;
  rows.forEach((r) => {
    const m = String(r?.applicationId || '').match(/(\d+)$/);
    const n = m ? Number(m[1]) : 0;
    if (Number.isFinite(n) && n > max) max = n;
  });
  return max;
};
// Highest existing roll across all sections of a class for a session.
const getMaxRollForClass = async ({ schoolId, campusId, grade, academicYear }) => {
  if (!grade) return 0;
  const filter = { schoolId, grade, isArchived: { $ne: true } };
  if (campusId) filter.campusId = campusId;
  if (academicYear) filter.academicYear = academicYear;
  const rows = await StudentUser.find(filter).select('roll').lean();
  let max = 0;
  rows.forEach((r) => {
    const n = Number(r?.roll);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return Math.max(max, rows.length);
};

const resolveAdmissionDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const resolveAdmissionYear = (value) => {
  if (!value) return new Date().getFullYear();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().getFullYear();
  }
  return parsed.getFullYear();
};

const getNextStudentSequenceByPrefix = async ({ schoolId, campusId, prefix }) => {
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
  const filter = { schoolId, username: { $regex: regex } };
  if (campusId) filter.campusId = campusId;
  const users = await StudentUser.find(filter).select('username').lean();
  let maxSequence = 0;
  users.forEach((user) => {
    const value = String(user?.username || '');
    const match = value.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  });
  return maxSequence + 1;
};

const getNextParentSequenceByPrefix = async ({ schoolId, campusId, prefix }) => {
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
  const filter = { schoolId, username: { $regex: regex } };
  if (campusId) filter.campusId = campusId;
  const users = await ParentUser.find(filter).select('username').lean();
  let maxSequence = 0;
  users.forEach((user) => {
    const value = String(user?.username || '');
    const match = value.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  });
  return maxSequence + 1;
};

const normalizeClassLikeValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const classMatch = raw.match(/^class[\s\-_:]*([a-z0-9]+)$/i);
  if (classMatch?.[1]) return classMatch[1].toUpperCase();
  return raw;
};

const isNumericClassLabel = (value) => /^\d{1,2}$/.test(String(value || '').trim());
const normalizeLookupKey = (value) => normalizeClassLikeValue(value).toLowerCase();

const runBulkImportJob = async (jobId, { students, schoolId, campusId, admin, isSuperAdmin, campusName, campusType }) => {
  const job = bulkImportJobs.get(jobId);
  if (!job) return;

  try {
    const classDocs = await ClassModel.find({ schoolId }).select('name').lean();
    const classLookup = new Set(
      classDocs
        .map((item) => normalizeLookupKey(item?.name))
        .filter(Boolean)
    );

    // Session for the login-id code & auto numbers: the row's session name if it
    // matches a real year, else the school's active academic year.
    const activeYear = await AcademicYear.findOne({ schoolId, isActive: true }).lean();
    const yearByName = new Map();
    (await AcademicYear.find({ schoolId }).select('name startDate endDate').lean())
      .forEach((y) => yearByName.set(String(y.name || '').trim().toLowerCase(), y));

    const sequenceByPrefix = new Map();
    const parentSequenceByPrefix = new Map();
    const admissionSeqByYear = new Map(); // year -> next ADM sequence
    const applicationSeqByYear = new Map();
    const rollByClassSession = new Map(); // `${grade}::${session}` -> next roll
    const req = { admin, isSuperAdmin, body: { campusName, campusType } };
    const results = job.results;

    // ── Phase 1: allocate identifiers & build payloads ────────────────────
    // Runs sequentially (so the in-memory sequence counters stay collision
    // free) but does no per-row writes, so it is cheap. The expensive work —
    // password hashing and DB writes — happens in the concurrent phases below.
    const prepared = [];
    for (let i = 0; i < students.length; i += 1) {
      const row = students[i] || {};
      try {
        const admissionDate = resolveAdmissionDate(row.admissionDate) || new Date();
        const admissionYear = resolveAdmissionYear(admissionDate);
        const rowSessionName = String(row.academicYear || row.batchCode || '').trim();
        const sessionYearDoc = yearByName.get(rowSessionName.toLowerCase()) || activeYear || null;
        const resolvedSessionName = sessionYearDoc?.name || rowSessionName || activeYear?.name || '';
        const sessionCode = deriveSessionCode(sessionYearDoc, admissionYear);
        const prefix = resolveStudentPrefix({
          adminUsername: req.admin?.username,
          sessionCode,
        });

        if (!sequenceByPrefix.has(prefix)) {
          const nextSeq = await getNextStudentSequenceByPrefix({
            schoolId,
            campusId,
            prefix,
          });
          sequenceByPrefix.set(prefix, nextSeq);
        }
        const nextSequence = sequenceByPrefix.get(prefix);
        const username = `${prefix}${padNumber(nextSequence)}`;
        sequenceByPrefix.set(prefix, nextSequence + 1);

        const password = generatePassword();
        const normalizedCourse = normalizeClassLikeValue(row.class || row.course || row.grade || '');
        let normalizedGrade = normalizeClassLikeValue(row.class || row.grade || '');
        const normalizedSection = String(row.section || '').trim().toUpperCase();
        if (!normalizedGrade) {
          normalizedGrade = normalizedCourse;
        } else {
          const upperGrade = String(normalizedGrade).toUpperCase();
          const looksLikeSection = /^[A-Z]$/.test(upperGrade);
          const matchesSection = normalizedSection && upperGrade === normalizedSection;
          if ((looksLikeSection || matchesSection) && isNumericClassLabel(normalizedCourse)) {
            normalizedGrade = normalizedCourse;
          }
        }

        const incomingClass = String(row.class || row.course || row.grade || '').trim();
        const normalizedIncomingClass = normalizeLookupKey(normalizedGrade || normalizedCourse || incomingClass);
        if (!normalizedIncomingClass) {
          throw new Error('Class is required');
        }
        if (!classLookup.has(normalizedIncomingClass)) {
          throw new Error(`Class "${incomingClass || normalizedGrade || normalizedCourse}" is not created for this school`);
        }

        // Auto admission number (ADM/<year>/####) unless the row supplies one.
        let admissionNumber = String(row.admissionNumber || '').trim();
        if (!admissionNumber) {
          if (!admissionSeqByYear.has(admissionYear)) {
            admissionSeqByYear.set(admissionYear, await getMaxAdmissionSeq({ schoolId, campusId, admissionYear }));
          }
          const next = admissionSeqByYear.get(admissionYear) + 1;
          admissionSeqByYear.set(admissionYear, next);
          admissionNumber = `ADM/${admissionYear}/${padNumber(next, 4)}`;
        }

        // Auto application id (APP/<year>/####).
        let applicationId = String(row.applicationId || '').trim();
        if (!applicationId) {
          if (!applicationSeqByYear.has(admissionYear)) {
            applicationSeqByYear.set(admissionYear, await getMaxApplicationSeq({ schoolId, campusId, admissionYear }));
          }
          const nextApp = applicationSeqByYear.get(admissionYear) + 1;
          applicationSeqByYear.set(admissionYear, nextApp);
          applicationId = `APP/${admissionYear}/${padNumber(nextApp, 4)}`;
        }

        // Auto roll — continuous across all sections of the class for the session.
        let roll = row.roll ? Number(row.roll) : undefined;
        if (!roll && normalizedGrade) {
          const rk = `${normalizedGrade}::${resolvedSessionName}`;
          if (!rollByClassSession.has(rk)) {
            rollByClassSession.set(rk, await getMaxRollForClass({
              schoolId, campusId, grade: normalizedGrade, academicYear: resolvedSessionName,
            }));
          }
          const nextRoll = rollByClassSession.get(rk) + 1;
          rollByClassSession.set(rk, nextRoll);
          roll = nextRoll;
        }

        const payload = {
          username,
          studentCode: username,
          password,
          initialPassword: password,
          schoolId,
          campusId,
          campusName: req.isSuperAdmin ? req.body?.campusName : req.admin?.campusName,
          campusType: req.isSuperAdmin ? req.body?.campusType : req.admin?.campusType,
          name: row.name || 'Student',
          grade: normalizedGrade,
          section: row.section || '',
          roll,
          gender: String(row.gender || 'male').toLowerCase(),
          dob: row.dob || '',
          admissionDate,
          admissionNumber,
          admissionType: row.admissionType || 'New Admission',
          academicYear: resolvedSessionName || row.academicYear || row.batchCode || '',
          batchCode: row.batchCode || '',
          course: normalizedCourse,
          courseId: row.courseId || '',
          duration: row.duration || '',
          formNo: row.formNo || '',
          enrollmentNo: row.enrollmentNo || '',
          serialNo: row.serialNo || '',
          status: row.status || 'Active',
          approvalStatus: row.approvalStatus || 'Approved',
          applicationId,
          applicationDate: row.applicationDate || admissionDate.toISOString().slice(0, 10),
          remarks: row.remarks || '',
          mobile: row.mobile || '',
          email: row.email || '',
          address: row.address || '',
          birthPlace: row.birthPlace || '',
          caste: row.caste || '',
          aadharNumber: row.aadharNumber || row.aadhaarNumber || row.andhaarNumber || '',
          birthCertificateNo: row.birthCertificateNo || '',
          permanentAddress: row.permanentAddress || '',
          pinCode: row.pincode || row.pinCode || '',
          bloodGroup: row.bloodGroup || '',
          knownHealthIssues: row.knownHealthIssues || '',
          allergies: row.allergies || '',
          immunizationStatus: row.immunizationStatus || '',
          learningDisabilities: row.learningDisabilities || '',
          nationality: row.nationality || '',
          religion: row.religion || '',
          category: row.category || '',
          hasPreviousSchool: row.hasPreviousSchool || (row.previousSchoolName ? 'yes' : ''),
          previousSchoolName: row.previousSchoolName || '',
          previousClass: row.previousClass || '',
          previousPercentage: row.previousPercentage || '',
          transferCertificateNo: row.transferCertificateNo || '',
          transferCertificateDate: row.transferCertificateDate || '',
          reasonForLeaving: row.reasonForLeaving || '',
          guardianName: row.guardianName || '',
          guardianPhone: row.guardianPhone || '',
          guardianEmail: row.guardianEmail || '',
          guardianRelation: row.guardianRelation || '',
          fatherName: row.fatherName || '',
          fatherPhone: row.fatherPhone || '',
          fatherOccupation: row.fatherOccupation || '',
          motherName: row.motherName || '',
          motherPhone: row.motherPhone || '',
          motherOccupation: row.motherOccupation || '',
        };

        // Parent identity — allocated here so the concurrent write phase does
        // no awaits for username sequencing.
        const parentName =
          row.guardianName ||
          row.fatherName ||
          row.motherName ||
          (row.name ? `Parent of ${row.name}` : '');
        const parentMobile = row.guardianPhone || row.fatherPhone || row.motherPhone || '';
        const parentEmail = row.guardianEmail || '';
        let parent = null;
        if (parentName && (parentMobile || parentEmail)) {
          const parentPrefix = resolveParentPrefix({
            adminUsername: req.admin?.username,
            sessionCode,
          });
          if (!parentSequenceByPrefix.has(parentPrefix)) {
            parentSequenceByPrefix.set(
              parentPrefix,
              await getNextParentSequenceByPrefix({ schoolId, campusId, prefix: parentPrefix })
            );
          }
          parent = {
            name: parentName,
            mobile: parentMobile,
            email: parentEmail,
            prefix: parentPrefix,
            plainPassword: generatePassword(),
          };
        }

        prepared.push({ index: i, row, payload, prefix, parent });
      } catch (err) {
        results.failed += 1;
        results.errors.push({ index: i, message: err.message || 'Failed to import row' });
        job.processed += 1;
      }
    }

    // ── Phase 2: hash every password up front, in parallel across CPU cores ─
    const pwJobs = [];
    prepared.forEach((p) => {
      p.pwIndex = pwJobs.push(p.payload.password) - 1;
      if (p.parent) p.parent.pwIndex = pwJobs.push(p.parent.plainPassword) - 1;
    });
    const pwHashes = await hashPasswordsBulk(pwJobs, 10);
    prepared.forEach((p) => {
      // Pre-hashed: the model pre-save hook detects the bcrypt digest and skips
      // re-hashing, so this stays the student's real login password.
      p.payload.initialPassword = pwJobs[p.pwIndex];
      p.payload.password = pwHashes[p.pwIndex];
      if (p.parent) p.parent.passwordHash = pwHashes[p.parent.pwIndex];
    });

    // ── Phase 3: create students + link parents (concurrent, batched) ──────
    const CONCURRENCY = 12;
    // Same-parent operations run in series (a promise chain per contact) so two
    // rows sharing a guardian never race to create duplicate parent accounts.
    const parentChain = new Map();
    const parentKeyOf = (email, mobile) =>
      `${String(email || '').trim().toLowerCase()}|${String(mobile || '').trim()}`;

    const linkParent = async (studentUser, row, payload, parent) => {
      let parentUser = null;
      const parentLookupFilter = ParentUser.buildContactLookupFilter({
        email: parent.email,
        mobile: parent.mobile,
      });
      if (parentLookupFilter) {
        parentUser = await ParentUser.findOne({ schoolId, ...parentLookupFilter });
      }
      if (!parentUser) {
        const legacyPlainFilter = {
          schoolId,
          $or: [
            parent.email ? { email: parent.email } : null,
            parent.mobile ? { mobile: parent.mobile } : null,
          ].filter(Boolean),
        };
        if (legacyPlainFilter.$or.length) {
          parentUser = await ParentUser.findOne(legacyPlainFilter);
        }
      }
      if (!parentUser) {
        const parentPayload = {
          password: parent.passwordHash,
          initialPassword: parent.plainPassword,
          schoolId,
          campusId,
          name: parent.name,
          mobile: parent.mobile,
          email: parent.email,
          childrenIds: [studentUser._id],
          children: [row.name || payload.name],
          grade: [payload.grade || ''],
        };
        for (let attempt = 0; ; attempt += 1) {
          const nextParentSeq = parentSequenceByPrefix.get(parent.prefix);
          parentPayload.username = `${parent.prefix}${padNumber(nextParentSeq)}`;
          parentSequenceByPrefix.set(parent.prefix, nextParentSeq + 1);
          try {
            await ParentUser.create(parentPayload);
            break;
          } catch (createErr) {
            const isDuplicateUsername = createErr?.code === 11000 && createErr?.keyPattern?.username;
            if (!isDuplicateUsername || attempt >= 5) throw createErr;
          }
        }
      } else {
        const existingIds = new Set((parentUser.childrenIds || []).map((id) => String(id)));
        if (!existingIds.has(String(studentUser._id))) {
          parentUser.childrenIds = [...(parentUser.childrenIds || []), studentUser._id];
        }
        const existingChildren = new Set(parentUser.children || []);
        const childName = row.name || payload.name;
        if (childName && !existingChildren.has(childName)) {
          parentUser.children = [...(parentUser.children || []), childName];
        }
        const existingGrades = new Set(parentUser.grade || []);
        if (payload.grade && !existingGrades.has(payload.grade)) {
          parentUser.grade = [...(parentUser.grade || []), payload.grade];
        }
        await parentUser.save();
      }
    };

    const processPrepared = async ({ index, row, payload, prefix, parent }) => {
      try {
        let studentUser;
        for (let attempt = 0; ; attempt += 1) {
          try {
            studentUser = await StudentUser.create(payload);
            break;
          } catch (createErr) {
            const isDuplicateUsername = createErr?.code === 11000 && createErr?.keyPattern?.username;
            if (!isDuplicateUsername || attempt >= 5) throw createErr;
            const retrySequence = sequenceByPrefix.get(prefix);
            payload.username = `${prefix}${padNumber(retrySequence)}`;
            payload.studentCode = payload.username;
            sequenceByPrefix.set(prefix, retrySequence + 1);
          }
        }

        if (parent) {
          const key = parentKeyOf(parent.email, parent.mobile);
          const prev = parentChain.get(key) || Promise.resolve();
          const run = prev.then(() => linkParent(studentUser, row, payload, parent));
          parentChain.set(key, run.catch(() => {}));
          await run;
        }
        results.imported += 1;
      } catch (err) {
        results.failed += 1;
        results.errors.push({ index, message: err.message || 'Failed to import row' });
      } finally {
        job.processed += 1;
      }
    };

    for (let s = 0; s < prepared.length; s += CONCURRENCY) {
      await Promise.all(prepared.slice(s, s + CONCURRENCY).map(processPrepared));
    }

    job.status = 'completed';
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Unable to import students';
  } finally {
    job.finishedAt = Date.now();
    pruneBulkImportJob(jobId);
  }
};

router.post('/students/bulk', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const { students } = req.body || {};
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'students array is required' });
    }

    const jobId = crypto.randomUUID();
    bulkImportJobs.set(jobId, {
      schoolId: String(schoolId),
      status: 'processing',
      total: students.length,
      processed: 0,
      results: { imported: 0, failed: 0, errors: [] },
      createdAt: Date.now(),
    });

    runBulkImportJob(jobId, {
      students,
      schoolId,
      campusId,
      admin: req.admin,
      isSuperAdmin: req.isSuperAdmin,
      campusName: req.body?.campusName,
      campusType: req.body?.campusType,
    }).catch((err) => {
      const job = bulkImportJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err.message || 'Unable to import students';
        job.finishedAt = Date.now();
      }
    });

    return res.status(202).json({ jobId, total: students.length });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to import students' });
  }
});

router.get('/students/bulk/status/:jobId', adminAuth, (req, res) => {
  // #swagger.tags = ['Students']
  const schoolId = resolveSchoolId(req, res);
  if (!schoolId) return;

  const job = bulkImportJobs.get(req.params.jobId);
  if (!job || job.schoolId !== String(schoolId)) {
    return res.status(404).json({ error: 'Import job not found' });
  }

  return res.status(200).json({
    status: job.status,
    total: job.total,
    processed: job.processed,
    imported: job.results.imported,
    failed: job.results.failed,
    errors: job.status === 'completed' || job.status === 'failed' ? job.results.errors : [],
    error: job.error,
  });
});

router.get('/students/archived', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);

    const filter = { schoolId, isArchived: true };
    if (campusId) filter.campusId = campusId;

    const students = await StudentUser.find(filter).sort({ archivedAt: -1 }).lean();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load archived students' });
  }
});

router.get('/students/archived/export', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const filter = { schoolId, isArchived: true };
    if (campusId) filter.campusId = campusId;

    const students = await StudentUser.find(filter)
      .select('name course batchCode archivedAt status archivedPlacement')
      .sort({ archivedAt: -1 })
      .lean();
    const headers = ['Name', 'Course', 'Batch', 'Passed Out Year', 'Status', 'Archived At'];
    const rows = students.map((student) => [
      student.name || '',
      student.course || '',
      student.batchCode || '',
      student.archivedPlacement?.previousStatus === 'Passed Out' ? new Date(student.archivedAt).getFullYear() : '',
      student.status || 'Archived',
      student.archivedAt ? new Date(student.archivedAt).toISOString() : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="archived-students.csv"');
    return res.send(`\ufeff${csv}\r\n`);
  } catch (err) {
    return res.status(500).json({ error: 'Unable to export archived students' });
  }
});

router.put('/students/:id/archive', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { id } = req.params || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const existing = await StudentUser.findOne(filter);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found', message: 'Student not found' });
    }

    if (!existing.isArchived) {
      existing.archivedPlacement = {
        grade: existing.grade || '',
        section: existing.section || '',
        roll: Number.isFinite(Number(existing.roll)) ? Number(existing.roll) : null,
        previousStatus: existing.status || 'Active',
      };
      existing.isArchived = true;
      existing.archivedAt = new Date();
      existing.grade = '';
      existing.section = '';
      existing.roll = undefined;
      existing.status = 'Archived';
      await existing.save();
    }

    res.json({ ok: true, student: existing.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to archive student', message: err.message || 'Unable to archive student' });
  }
});

router.patch('/students/:id/unarchive', adminAuth, async (req, res) => {
  // #swagger.tags = ['Students']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = resolveCampusId(req);
    const { id } = req.params || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const filter = { _id: id, schoolId };
    if (campusId) filter.campusId = campusId;

    const existing = await StudentUser.findOne(filter);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found', message: 'Student not found' });
    }

    const archivedPlacement = existing.archivedPlacement || {};
    const restoreGrade = String(archivedPlacement.grade || '').trim();
    const restoreSection = String(archivedPlacement.section || '').trim();
    const hasRestoreRoll = archivedPlacement.roll !== null && archivedPlacement.roll !== undefined && archivedPlacement.roll !== '';
    const restoreRoll = hasRestoreRoll ? Number(archivedPlacement.roll) : null;

    if (restoreGrade && restoreSection && Number.isFinite(restoreRoll)) {
      const conflictFilter = {
        _id: { $ne: existing._id },
        schoolId,
        grade: restoreGrade,
        section: restoreSection,
        roll: restoreRoll,
        isArchived: { $ne: true },
      };
      if (campusId) conflictFilter.campusId = campusId;
      const conflictStudent = await StudentUser.findOne(conflictFilter).select('name').lean();
      if (conflictStudent) {
        return res.status(409).json({
          error: `Seat already occupied in ${restoreGrade}-${restoreSection} (roll ${restoreRoll})`,
          message: `Cannot restore: roll ${restoreRoll} in class ${restoreGrade} section ${restoreSection} is already assigned to ${conflictStudent.name || 'another student'}.`,
        });
      }
    }

    existing.isArchived = false;
    existing.archivedAt = null;
    existing.grade = restoreGrade;
    existing.section = restoreSection;
    existing.roll = Number.isFinite(restoreRoll) ? restoreRoll : undefined;
    existing.status = archivedPlacement.previousStatus || 'Active';
    existing.archivedPlacement = undefined;
    await existing.save();

    res.json({ ok: true, student: existing.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to restore student', message: err.message || 'Unable to restore student' });
  }
});

module.exports = router;
