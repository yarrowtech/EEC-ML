const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const AdmissionSession = require('../models/AdmissionSession');
const AdmissionApplication = require('../models/AdmissionApplication');
const AdmissionCounter = require('../models/AdmissionCounter');
const School = require('../models/School');
const ClassModel = require('../models/Class');
const Organization = require('../models/Organization');
const Admin = require('../models/Admin');
const AcademicYear = require('../models/AcademicYear');
const { getTenantContext } = require('../utils/tenantContext');
const Section = require('../models/Section');
const StudentUser = require('../models/StudentUser');
const multer = require('multer');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

const router = express.Router();

const toDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Open = active and today falls within its dates (end date inclusive).
const sessionState = (session, now = new Date()) => {
  const today = toDay(now);
  if (!session.isActive) return 'inactive';
  if (today < toDay(session.startDate)) return 'upcoming';
  if (today > toDay(session.endDate)) return 'closed';
  return 'open';
};

const adminSchool = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Valid schoolId is required' });
    return null;
  }
  return schoolId;
};

const readSessionBody = (body = {}) => {
  const title = String(body.title || '').trim();
  const startDate = toDay(body.startDate);
  const endDate = toDay(body.endDate);
  if (!title) return { error: 'Title is required' };
  if (!startDate || !endDate) return { error: 'Valid start and end dates are required' };
  if (endDate < startDate) return { error: 'End date cannot be before the start date' };
  const classes = Array.isArray(body.classes) ? body.classes.map((c) => String(c).trim()).filter(Boolean) : [];
  return {
    data: {
      title,
      academicYear: String(body.academicYear || '').trim(),
      description: String(body.description || '').trim(),
      classes,
      seats: readSeats(body.seats, classes),
      startDate,
      endDate,
      isActive: Boolean(body.isActive),
    },
  };
};

const readSeats = (list, classes) => {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(classes);
  return list
    .map((x) => ({ className: String(x?.className || '').trim(), capacity: Math.max(0, Math.floor(Number(x?.capacity) || 0)) }))
    .filter((x) => x.className && x.capacity > 0 && (!allowed.size || allowed.has(x.className)));
};

// Admitted applications per session + class: these occupy seats.
const loadAdmittedCounts = async (sessionIds) => {
  if (!sessionIds.length) return new Map();
  const rows = await AdmissionApplication.aggregate([
    { $match: { sessionId: { $in: sessionIds.map((id) => new mongoose.Types.ObjectId(String(id))) }, status: 'admitted' } },
    { $group: { _id: { sessionId: '$sessionId', className: '$applyingForClass' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [`${r._id.sessionId}|${r._id.className}`, r.count]));
};

const classSeatsFor = (session, admitted) => {
  const capacityByClass = new Map((session.seats || []).map((x) => [x.className, x.capacity]));
  const names = session.classes?.length ? session.classes : [...capacityByClass.keys()];
  return names.map((className) => {
    const capacity = capacityByClass.get(className) || 0;
    const filled = admitted.get(`${session._id}|${className}`) || 0;
    return { className, capacity, filled, available: capacity ? Math.max(0, capacity - filled) : null, full: capacity > 0 && filled >= capacity };
  });
};

// "full" = every class has a seat limit and all of them are taken.
const withState = (session, admitted = new Map()) => {
  const classSeats = classSeatsFor(session, admitted);
  let state = sessionState(session);
  if (state === 'open' && classSeats.length && classSeats.every((c) => c.full)) state = 'full';
  return { ...session, classSeats, state };
};

// ── Admin ────────────────────────────────────────────────────────────────────

router.get('/admin/sessions', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    const [sessions, counts, classes, years, sections] = await Promise.all([
      AdmissionSession.find({ schoolId }).sort({ startDate: -1 }).lean(),
      AdmissionApplication.aggregate([
        { $match: { schoolId: new mongoose.Types.ObjectId(String(schoolId)) } },
        { $group: { _id: '$sessionId', count: { $sum: 1 } } },
      ]),
      ClassModel.find({ schoolId }).select('name').sort({ name: 1 }).lean(),
      AcademicYear.find({ schoolId, status: { $ne: 'archived' } }).select('name status startDate').lean(),
      Section.find({ schoolId }).select('classId name').lean(),
    ]);
    const admitted = await loadAdmittedCounts(sessions.map((x) => x._id));
    const classNameById = new Map(classes.map((c) => [String(c._id), c.name]));
    const sectionsByClass = {};
    sections.forEach((sec) => {
      const name = classNameById.get(String(sec.classId));
      if (!name) return;
      sectionsByClass[name] = [...new Set([...(sectionsByClass[name] || []), sec.name])].sort();
    });
    // Upcoming years first (latest start first), then the active one.
    const rank = { upcoming: 0, active: 1 };
    const academicYears = years
      .sort((a, b) => (rank[a.status] ?? 2) - (rank[b.status] ?? 2)
        || new Date(b.startDate || 0) - new Date(a.startDate || 0))
      .map((y) => ({ name: y.name, status: y.status }));
    const countBySession = new Map(counts.map((c) => [String(c._id), c.count]));
    const school = await School.findById(schoolId).select("name").lean();
    const slug = school ? publicSchool(school, (await loadBranding([schoolId])).get(String(schoolId))).slug : String(schoolId);
    return res.json({
      schoolId: String(schoolId),
      slug,
      classOptions: [...new Set(classes.map((c) => c.name).filter(Boolean))],
      academicYears,
      sectionsByClass,
      sessions: sessions.map((s) => ({ ...withState(s, admitted), applicationCount: countBySession.get(String(s._id)) || 0 })),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/admin/sessions', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    const { data, error } = readSessionBody(req.body);
    if (error) return res.status(400).json({ error });
    const created = await AdmissionSession.create({ ...data, schoolId });
    return res.status(201).json(withState(created.toObject()));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/admin/sessions/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { data, error } = readSessionBody(req.body);
    if (error) return res.status(400).json({ error });
    const updated = await AdmissionSession.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: data }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(withState(updated));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/sessions/:id/active', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await AdmissionSession.findOneAndUpdate(
      { _id: req.params.id, schoolId },
      { $set: { isActive: Boolean(req.body?.isActive) } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    return res.json(withState(updated));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/admin/sessions/:id', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const applications = await AdmissionApplication.countDocuments({ schoolId, sessionId: req.params.id });
    if (applications > 0) {
      return res.status(409).json({ error: 'This notification already has applications. Deactivate it instead of deleting.' });
    }
    await AdmissionSession.deleteOne({ _id: req.params.id, schoolId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/admin/applications', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    // Backfill applications saved before organizationId was stamped (raw collection:
    // the tenant plugin would otherwise scope this update away from them).
    const tenantOrgId = getTenantContext()?.organizationId;
    if (tenantOrgId) {
      await AdmissionApplication.collection.updateMany(
        { schoolId: new mongoose.Types.ObjectId(String(schoolId)), organizationId: { $in: [null] } },
        { $set: { organizationId: new mongoose.Types.ObjectId(String(tenantOrgId)) } }
      );
    }
    const filter = { schoolId };
    if (req.query.sessionId && mongoose.isValidObjectId(req.query.sessionId)) filter.sessionId = req.query.sessionId;
    const [items, school] = await Promise.all([
      AdmissionApplication.find(filter).populate('sessionId', 'title academicYear').sort({ createdAt: -1 }).lean(),
      School.findById(schoolId).select('name address contactEmail contactPhone logo').lean(),
    ]);
    return res.json(items.map((a) => ({
      ...a,
      schoolName: school?.name || '',
      schoolAddress: school?.address || '',
      schoolPhone: school?.contactPhone || '',
      schoolEmail: school?.contactEmail || '',
      schoolLogo: school?.logo?.secure_url || '',
      sessionTitle: a.sessionId?.title || '',
      academicYear: a.sessionId?.academicYear || '',
      sessionId: a.sessionId?._id || a.sessionId,
    })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/applications/:id/status', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    const status = String(req.body?.status || '');
    if (!['submitted', 'shortlisted', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await AdmissionApplication.findOneAndUpdate(
      { _id: req.params.id, schoolId, status: { $ne: 'admitted' } },
      { $set: { status, reviewNote: String(req.body?.note || '').trim().slice(0, 500), reviewedAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Application not found or already admitted' });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Seat check before the admin creates the student account.
const checkAdmittable = async (schoolId, id) => {
  if (!mongoose.isValidObjectId(id)) return { status: 400, error: 'Invalid id' };
  const app = await AdmissionApplication.findOne({ _id: id, schoolId }).lean();
  if (!app) return { status: 404, error: 'Application not found' };
  if (app.status === 'admitted' || app.studentId) return { status: 409, error: 'This applicant is already admitted' };
  if (app.status !== 'approved') return { status: 409, error: 'Approve the application before admitting' };
  const session = await AdmissionSession.findOne({ _id: app.sessionId, schoolId }).lean();
  const seat = session ? classSeatsFor(session, await loadAdmittedCounts([session._id])).find((c) => c.className === app.applyingForClass) : null;
  if (seat?.full) return { status: 409, error: `All ${seat.capacity} seats in ${seat.className} are filled` };
  return { app };
};

router.post('/admin/applications/:id/admit/check', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    const result = await checkAdmittable(schoolId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Links the student account (created via /api/student/auth/register) to the application.
router.post('/admin/applications/:id/admit', adminAuth, async (req, res) => {
  try {
    const schoolId = adminSchool(req, res);
    if (!schoolId) return undefined;
    const result = await checkAdmittable(schoolId, req.params.id);
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { studentId } = req.body || {};
    if (!mongoose.isValidObjectId(studentId)) return res.status(400).json({ error: 'studentId is required' });
    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('username section').lean();
    if (!student) return res.status(404).json({ error: 'Student account not found' });
    const updated = await AdmissionApplication.findOneAndUpdate(
      { _id: req.params.id, schoolId, status: 'approved', studentId: null },
      {
        $set: {
          status: 'admitted',
          admittedAt: new Date(),
          reviewedAt: new Date(),
          studentId: student._id,
          studentUsername: student.username || '',
          parentUsername: String(req.body?.parentUsername || '').slice(0, 60),
          admittedSection: student.section || '',
        },
      },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: 'This applicant is already admitted' });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Public (no login): one admission page per school ─────────────────────────

const loadPublicSchool = async (req, res) => {
  const key = String(req.params.schoolId || '').trim().toLowerCase();
  const fields = 'name address contactEmail contactPhone logo';
  let school = null;
  if (mongoose.isValidObjectId(key)) school = await School.findById(key).select(fields).lean();
  if (!school && key) {
    const org = await Organization.findOne({ slug: key }).select('schoolId').lean();
    if (org?.schoolId) school = await School.findById(org.schoolId).select(fields).lean();
  }
  if (!school && key) {
    const pattern = new RegExp(`^${key.split('-').filter(Boolean).map((w) => w.replace(/[^a-z0-9]/g, '')).join('[^a-z0-9]+')}$`, 'i');
    school = await School.findOne({ name: pattern }).select(fields).lean();
  }
  if (!school) { res.status(404).json({ error: 'School not found' }); return null; }
  return school;
};

const slugify = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const loadBranding = async (schoolIds) => {
  const ids = schoolIds.map(String);
  const [orgs, admins] = await Promise.all([
    Organization.find({ schoolId: { $in: ids } }).select('schoolId slug logo').lean(),
    Admin.find({ schoolId: { $in: ids }, coverImage: { $nin: [null, ''] } }).select('schoolId coverImage').lean(),
  ]);
  const map = new Map();
  orgs.forEach((o) => map.set(String(o.schoolId), { slug: o.slug, orgLogo: o.logo || '' }));
  admins.forEach((a) => {
    const entry = map.get(String(a.schoolId)) || {};
    if (!entry.cover) map.set(String(a.schoolId), { ...entry, cover: a.coverImage });
  });
  return map;
};

const publicSchool = (school, branding = {}) => ({
  _id: school._id,
  slug: branding.slug || slugify(school.name) || String(school._id),
  cover: branding.cover || '',
  name: school.name,
  address: school.address || '',
  email: school.contactEmail || '',
  phone: school.contactPhone || '',
  logo: school.logo?.secure_url || branding.orgLogo || '',
});

// Admission hub: every school's active notifications in one list.
router.get('/public', async (req, res) => {
  try {
    const sessions = await AdmissionSession.find({ isActive: true })
      .select('schoolId title academicYear description classes seats startDate endDate isActive')
      .lean();
    const admitted = await loadAdmittedCounts(sessions.map((x) => x._id));
    const schoolIds = [...new Set(sessions.map((s) => String(s.schoolId)))];
    const schools = await School.find({ _id: { $in: schoolIds } })
      .select('name address contactEmail contactPhone logo')
      .lean();
    const branding = await loadBranding(schools.map((sc) => sc._id));
    const schoolById = new Map(schools.map((sc) => [String(sc._id), publicSchool(sc, branding.get(String(sc._id)))]));
    const rank = { open: 0, upcoming: 1, full: 2, closed: 3 };
    const items = sessions
      .filter((s) => schoolById.has(String(s.schoolId)))
      .map((s) => ({ ...withState(s, admitted), school: schoolById.get(String(s.schoolId)) }))
      .sort((a, b) => (rank[a.state] - rank[b.state]) || new Date(a.endDate) - new Date(b.endDate));
    return res.json({ sessions: items });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Applicant looks up every application they made, across schools.
router.post('/public/track', async (req, res) => {
  try {
    const guardianPhone = String(req.body?.guardianPhone || '').replace(/\D/g, '');
    const dateOfBirth = toDay(req.body?.dateOfBirth);
    if (guardianPhone.length !== 10 || !dateOfBirth) {
      return res.status(400).json({ error: 'Enter the 10-digit phone number and the student\'s date of birth' });
    }
    const apps = await AdmissionApplication.find({ guardianPhone, dateOfBirth })
      .populate('sessionId', 'title academicYear')
      .sort({ createdAt: -1 })
      .lean();
    const schools = await School.find({ _id: { $in: [...new Set(apps.map((a) => String(a.schoolId)))] } })
      .select('name address contactEmail contactPhone logo')
      .lean();
    const branding = await loadBranding(schools.map((sc) => sc._id));
    const schoolById = new Map(schools.map((sc) => [String(sc._id), publicSchool(sc, branding.get(String(sc._id)))]));
    return res.json(apps.map((a) => ({
      ...a,
      school: schoolById.get(String(a.schoolId)) || null,
      sessionTitle: a.sessionId?.title || '',
      academicYear: a.sessionId?.academicYear || '',
      sessionId: a.sessionId?._id || a.sessionId,
    })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/public/:schoolId', async (req, res) => {
  try {
    const school = await loadPublicSchool(req, res);
    if (!school) return undefined;
    // Only active notifications are published on the page.
    const sessions = await AdmissionSession.find({ schoolId: school._id, isActive: true })
      .select('title academicYear description classes seats startDate endDate isActive')
      .sort({ startDate: -1 })
      .lean();
    const admitted = await loadAdmittedCounts(sessions.map((x) => x._id));
    return res.json({
      school: publicSchool(school, (await loadBranding([school._id])).get(String(school._id))),
      sessions: sessions.map((x) => withState(x, admitted)),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

const nextAdmissionNumber = async (schoolId) => {
  const year = new Date().getFullYear();
  const counter = await AdmissionCounter.findOneAndUpdate(
    { schoolId, year },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return `ADM${year}${String(counter.seq).padStart(4, '0')}`;
};

const UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const applicantUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, UPLOAD_TYPES.has(file.mimetype)),
});

// Applicant photo / document upload (no login). Only images and PDFs up to 100KB.
router.post('/public/:schoolId/upload', (req, res, next) => applicantUpload.single('file')(req, res, (err) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 100KB or smaller' : 'Upload failed' });
  return next();
}), async (req, res) => {
  try {
    const school = await loadPublicSchool(req, res);
    if (!school) return undefined;
    if (!req.file) return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP or PDF file' });
    const isPdf = req.file.mimetype === 'application/pdf';
    const r = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `admissions/${school._id}`,
      resource_type: isPdf ? 'raw' : 'image',
    });
    return res.json({ url: r.secure_url, fileName: String(req.file.originalname || '').slice(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed' });
  }
});

const DOCUMENT_TYPES = {
  birth_certificate: 'Birth Certificate',
  transfer_certificate: 'Transfer Certificate',
  aadhar_card: 'Aadhaar Card',
  report_card: 'Previous Report Card',
};
// Only files uploaded through our Cloudinary account are accepted.
const isUploadedUrl = (url) => typeof url === 'string' && /^https:\/\/res\.cloudinary\.com\//i.test(url);

router.post('/public/:schoolId/sessions/:sessionId/apply', async (req, res) => {
  try {
    const school = await loadPublicSchool(req, res);
    if (!school) return undefined;
    const { sessionId } = req.params;
    if (!mongoose.isValidObjectId(sessionId)) return res.status(404).json({ error: 'Admission not found' });
    const session = await AdmissionSession.findOne({ _id: sessionId, schoolId: school._id }).lean();
    if (!session) return res.status(404).json({ error: 'Admission not found' });
    const state = sessionState(session);
    if (state !== 'open') {
      return res.status(409).json({ error: state === 'upcoming' ? 'Admissions have not started yet.' : 'Admissions are closed.' });
    }

    const b = req.body || {};
    const str = (v, max) => String(v || '').trim().slice(0, max);
    const digits = (v, max) => String(v || '').replace(/\D/g, '').slice(0, max);
    const studentName = str(b.studentName, 120);
    const dateOfBirth = toDay(b.dateOfBirth);
    const gender = str(b.gender, 10).toLowerCase();
    const applyingForClass = str(b.applyingForClass, 40);
    const guardianPhone = digits(b.guardianPhone, 10);
    const address = str(b.address, 500);
    const email = str(b.email, 160);
    const hasPreviousSchool = ['yes', 'no'].includes(b.hasPreviousSchool) ? b.hasPreviousSchool : '';
    const profilePic = isUploadedUrl(b.profilePic) ? b.profilePic : '';
    const documents = (Array.isArray(b.documents) ? b.documents : [])
      .filter((d) => d && DOCUMENT_TYPES[d.type] && isUploadedUrl(d.url))
      .slice(0, 10)
      .map((d) => ({ type: d.type, label: DOCUMENT_TYPES[d.type], url: d.url, fileName: str(d.fileName, 200) }));

    const required = {
      'Student name': studentName, 'Date of birth': dateOfBirth, Class: applyingForClass, Address: address,
      'Pin code': str(b.pinCode, 10), Nationality: str(b.nationality, 60), Email: email,
      "Father's name": str(b.fatherName, 120), "Mother's name": str(b.motherName, 120),
      'Previous schooling': hasPreviousSchool, 'Student photo': profilePic,
    };
    const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) return res.status(400).json({ error: `Please fill in: ${missing.join(', ')}` });
    if (!['male', 'female', 'other'].includes(gender)) return res.status(400).json({ error: 'Please select a gender' });
    if (guardianPhone.length !== 10) return res.status(400).json({ error: 'Phone number must be 10 digits' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (hasPreviousSchool === 'yes' && !str(b.previousSchool, 160)) return res.status(400).json({ error: 'Please enter the previous school name' });
    if (!documents.some((d) => d.type === 'birth_certificate')) return res.status(400).json({ error: 'Please upload the birth certificate' });
    if (session.classes?.length && !session.classes.includes(applyingForClass)) {
      return res.status(400).json({ error: 'Admission is not open for this class' });
    }
    const seat = classSeatsFor(session, await loadAdmittedCounts([session._id])).find((c) => c.className === applyingForClass);
    if (seat?.full) return res.status(409).json({ error: `Seats are full for ${applyingForClass}.` });

    const duplicate = await AdmissionApplication.findOne({
      sessionId: session._id,
      guardianPhone,
      dateOfBirth,
      studentName: new RegExp(`^${studentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    }).select('admissionNumber').lean();
    if (duplicate) {
      return res.status(409).json({ error: `This student has already applied here (Admission No. ${duplicate.admissionNumber}).` });
    }

    // The public page has no tenant context, so stamp the school's organization explicitly;
    // otherwise the tenant-scoped admin list never sees the application.
    const org = await Organization.findOne({ schoolId: school._id }).select('_id').lean();
    const created = await AdmissionApplication.create({
      ...(org ? { organizationId: org._id } : {}),
      schoolId: school._id,
      sessionId: session._id,
      admissionNumber: await nextAdmissionNumber(school._id),
      studentName,
      dateOfBirth,
      gender,
      applyingForClass,
      profilePic,
      birthPlace: str(b.birthPlace, 120),
      bloodGroup: str(b.bloodGroup, 10),
      nationality: str(b.nationality, 60),
      religion: str(b.religion, 60),
      category: str(b.category, 30),
      caste: str(b.caste, 60),
      aadharNumber: digits(b.aadharNumber, 12),
      birthCertificateNo: str(b.birthCertificateNo, 60),
      guardianPhone,
      email,
      address,
      permanentAddress: str(b.permanentAddress, 500),
      pinCode: digits(b.pinCode, 6),
      fatherName: str(b.fatherName, 120),
      fatherPhone: digits(b.fatherPhone, 10),
      fatherOccupation: str(b.fatherOccupation, 120),
      motherName: str(b.motherName, 120),
      motherPhone: digits(b.motherPhone, 10),
      motherOccupation: str(b.motherOccupation, 120),
      guardianName: str(b.guardianName, 120),
      guardianRelation: str(b.guardianRelation, 40),
      guardianEmail: str(b.guardianEmail, 160),
      knownHealthIssues: str(b.knownHealthIssues, 500),
      allergies: str(b.allergies, 300),
      immunizationStatus: str(b.immunizationStatus, 60),
      learningDisabilities: str(b.learningDisabilities, 300),
      hasPreviousSchool,
      previousSchool: hasPreviousSchool === 'yes' ? str(b.previousSchool, 160) : '',
      previousClass: hasPreviousSchool === 'yes' ? str(b.previousClass, 40) : '',
      previousPercentage: hasPreviousSchool === 'yes' ? str(b.previousPercentage, 20) : '',
      transferCertificateNo: hasPreviousSchool === 'yes' ? str(b.transferCertificateNo, 60) : '',
      transferCertificateDate: hasPreviousSchool === 'yes' ? str(b.transferCertificateDate, 20) : '',
      documents,
    });
    return res.status(201).json({
      ...created.toObject(),
      sessionTitle: session.title,
      academicYear: session.academicYear,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
