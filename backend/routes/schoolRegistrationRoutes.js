const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const School = require('../models/School');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');
const rateLimit = require('../middleware/rateLimit');
const { sendWebhook, WEBHOOK_EVENTS } = require('../utils/webhookSender');
const { sendSchoolRegistrationConfirmationEmail } = require('../utils/mailer');
const { logger } = require('../utils/logger');
const { logSecurityEvent } = require('../utils/securityEventLogger');
const { getRequestNetworkContext } = require('../utils/request');

const router = express.Router();

const ALLOWED_SCHOOL_TYPES = ['Public', 'Private', 'Charter', 'International'];
const ALLOWED_BOARDS = ['CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'NIOS', 'Other'];
const ALLOWED_ACADEMIC_STRUCTURES = ['Semester', 'Trimester', 'Quarter'];
const ALLOWED_USER_RANGES = ['<100', '100-500', '500-1000', '1000+'];
const ALLOWED_CAMPUS_TYPES = ['Main', 'Branch'];
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const registrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});
const REGISTRATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const REGISTRATION_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const hasHtmlTag = (value) => typeof value === 'string' && /<[^>]+>/.test(value);

const hasDangerousKeys = (value, depth = 0) => {
  if (depth > 8 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => hasDangerousKeys(item, depth + 1));
  if (!isObject(value)) return false;

  return Object.entries(value).some(([key, nested]) => {
    if (FORBIDDEN_OBJECT_KEYS.has(key) || key.startsWith('$') || key.includes('.')) {
      return true;
    }
    return hasDangerousKeys(nested, depth + 1);
  });
};

const uploadRegistrationAsset = async (req, res, { bulk = false } = {}) => {
  const files = bulk ? req.files : (req.file ? [req.file] : []);
  if (!files.length) return res.status(400).json({ message: 'No file received' });

  const allowedTypes = bulk ? REGISTRATION_DOCUMENT_TYPES : REGISTRATION_IMAGE_TYPES;
  if (files.some((file) => !allowedTypes.has(file.mimetype))) {
    return res.status(400).json({ message: 'Unsupported registration file type' });
  }

  try {
    const uploaded = await Promise.all(files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: bulk ? 'school_verification_docs' : 'school_logos',
        resource_type: 'auto',
        access_mode: 'public',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      });
      return {
        originalName: file.originalname,
        public_id: result.public_id,
        secure_url: result.secure_url,
        resource_type: result.resource_type,
        format: result.format,
        bytes: result.bytes,
      };
    }));
    return res.json({ uploaded: uploaded.length, files: uploaded });
  } catch (err) {
    console.error('School registration upload error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
};

router.post('/uploads/single', registrationUpload.single('file'), (req, res) =>
  uploadRegistrationAsset(req, res)
);

router.post('/uploads/bulk', registrationUpload.array('files', 5), (req, res) =>
  uploadRegistrationAsset(req, res, { bulk: true })
);

const asString = (value) => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const maskEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return undefined;
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return undefined;
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskPhone = (phone) => {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return undefined;
  const suffix = normalized.slice(-4);
  return `***${suffix}`;
};

const logSchoolRegistrationEvent = (req, payload = {}) => {
  const {
    outcome = 'success',
    action = 'school_registration.unknown',
    level,
    ...extra
  } = payload;
  const net = getRequestNetworkContext(req);

  logger.log({
    level: level || (outcome === 'failure' ? 'warn' : 'info'),
    message: 'School registration event',
    event: 'school_registration_event',
    portal: 'public_school_registration',
    page: '/school-registration',
    apiRoute: '/api/school-registration',
    action,
    outcome,
    requestId: req?.requestId || undefined,
    traceId: req?.traceId || undefined,
    method: req?.method,
    path: req?.originalUrl,
    ip: net.clientIp,
    remoteIp: net.remoteIp,
    ipSource: net.source,
    forwardedForChain: net.forwardedChain,
    forwardedForCount: net.forwardedCount,
    ...extra,
  });
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SCHOOL_REG_WINDOW_MINUTES = parsePositiveInt(process.env.SCHOOL_REG_WINDOW_MINUTES, 15); // defaults to 15 minutes
const SCHOOL_REG_MAX_REQUESTS = parsePositiveInt(process.env.SCHOOL_REG_MAX_REQUESTS, 6); // defaults to 6 attempts
const SCHOOL_REG_WINDOW_MS = SCHOOL_REG_WINDOW_MINUTES * 60 * 1000;

// PUBLIC ENDPOINT - No authentication required
// POST /api/school-registration
router.post(
  '/',
  rateLimit({
    windowMs: SCHOOL_REG_WINDOW_MS,
    max: SCHOOL_REG_MAX_REQUESTS,
    useForwardedFor: false,
    skipFailedRequests: true,
    requestWasSuccessful: (_req, res) => (
      res.statusCode < 500 && res.statusCode !== 400
    ),
    onLimit: ({ req, windowMs, max, currentCount }) => {
      logSchoolRegistrationEvent(req, {
        action: 'school_registration.rate_limited',
        outcome: 'failure',
        statusCode: 429,
        maxRequests: max,
        windowMs,
        currentCount,
      });
    },
  }),
  async (req, res) => {
    // #swagger.tags = ['School Registration']
    try {
      if (hasDangerousKeys(req.body)) {
        logSecurityEvent(req, {
          action: 'security.injection_payload_blocked',
          outcome: 'blocked',
          severity: 'high',
          statusCode: 400,
          reason: 'Dangerous key pattern in payload',
          target: 'school_registration',
        });
        logSchoolRegistrationEvent(req, {
          action: 'school_registration.blocked_dangerous_payload',
          outcome: 'failure',
          statusCode: 400,
          level: 'warn',
        });
        return res.status(400).json({
          errors: { payload: 'Invalid request payload format' },
        });
      }

      const {
        name, campuses, officialEmail, contactPersonName, contactPhone,
        address, schoolType, board, boardOther, academicYearStructure, estimatedUsers,
        websiteURL, logo, verificationDocs
      } = req.body;

      logSchoolRegistrationEvent(req, {
        action: 'school_registration.submit_attempt',
        schoolName: asString(name)?.trim() || undefined,
        officialEmailMasked: maskEmail(officialEmail),
        contactPhoneMasked: maskPhone(contactPhone),
        campusCount: Array.isArray(campuses) ? campuses.length : 0,
      });

      // Server-side validation
      const errors = {};

      if (typeof name !== 'string') {
        errors.name = 'School name is invalid';
      } else if (!name.trim()) {
        errors.name = 'School name is required';
      } else if (name.trim().length < 3) {
        errors.name = 'School name must be at least 3 characters';
      } else if (hasHtmlTag(name)) {
        errors.name = 'School name contains invalid characters';
      }

      // Validate campuses array
      if (!campuses || !Array.isArray(campuses) || campuses.length === 0) {
        errors.campuses = 'At least one campus is required';
      } else {
        // Validate each campus
        for (let i = 0; i < campuses.length; i++) {
          const campus = campuses[i];

          if (!isObject(campus)) {
            errors[`campus_${i}`] = `Campus ${i + 1} payload is invalid`;
            continue;
          }

          if (typeof campus.name !== 'string' || !campus.name.trim()) {
            errors[`campus_${i}_name`] = `Campus ${i + 1} name is required`;
          } else if (hasHtmlTag(campus.name)) {
            errors[`campus_${i}_name`] = `Campus ${i + 1} name contains invalid characters`;
          }

          if (campus.campusType && !ALLOWED_CAMPUS_TYPES.includes(campus.campusType)) {
            errors[`campus_${i}_campusType`] = `Campus ${i + 1} type is invalid`;
          }

          if (typeof campus.address !== 'string' || !campus.address.trim()) {
            errors[`campus_${i}_address`] = `Campus ${i + 1} address is required`;
          } else if (campus.address.trim().length < 10) {
            errors[`campus_${i}_address`] = `Campus ${i + 1} address must be at least 10 characters`;
          }

          if (campus.contactPerson && typeof campus.contactPerson !== 'string') {
            errors[`campus_${i}_contactPerson`] = `Campus ${i + 1} contact person is invalid`;
          } else if (hasHtmlTag(campus.contactPerson)) {
            errors[`campus_${i}_contactPerson`] = `Campus ${i + 1} contact person contains invalid characters`;
          }

          if (campus.contactPhone && (typeof campus.contactPhone !== 'string' || !/^\+?[\d\s\-()]{10,}$/.test(campus.contactPhone))) {
            errors[`campus_${i}_phone`] = `Campus ${i + 1} phone number is invalid`;
          }
        }
      }

      if (typeof officialEmail !== 'string' || !officialEmail.trim()) {
        errors.officialEmail = 'Official email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) {
        errors.officialEmail = 'Invalid email format';
      }

      if (typeof contactPersonName !== 'string' || !contactPersonName.trim()) {
        errors.contactPersonName = 'Contact person name is required';
      } else if (hasHtmlTag(contactPersonName)) {
        errors.contactPersonName = 'Contact person name contains invalid characters';
      }

      if (typeof contactPhone !== 'string' || !contactPhone.trim()) {
        errors.contactPhone = 'Contact phone is required';
      } else if (!/^\+?[\d\s\-()]{10,}$/.test(contactPhone)) {
        errors.contactPhone = 'Invalid phone format';
      }

      if (typeof address !== 'string' || !address.trim()) {
        errors.address = 'School address is required';
      } else if (address.trim().length < 10) {
        errors.address = 'Please provide a complete address';
      }

      if (!schoolType) {
        errors.schoolType = 'School type is required';
      } else if (!ALLOWED_SCHOOL_TYPES.includes(schoolType)) {
        errors.schoolType = 'School type is invalid';
      }

      if (!board) {
        errors.board = 'School board/affiliation is required';
      } else if (!ALLOWED_BOARDS.includes(board)) {
        errors.board = 'School board/affiliation is invalid';
      } else if (board === 'Other' && (typeof boardOther !== 'string' || !boardOther.trim())) {
        errors.boardOther = 'Please specify the board name';
      } else if (board === 'Other' && hasHtmlTag(boardOther)) {
        errors.boardOther = 'Board name contains invalid characters';
      }

      if (!academicYearStructure) {
        errors.academicYearStructure = 'Academic year structure is required';
      } else if (!ALLOWED_ACADEMIC_STRUCTURES.includes(academicYearStructure)) {
        errors.academicYearStructure = 'Academic year structure is invalid';
      }

      if (!estimatedUsers) {
        errors.estimatedUsers = 'Estimated number of users is required';
      } else if (!ALLOWED_USER_RANGES.includes(estimatedUsers)) {
        errors.estimatedUsers = 'Estimated number of users is invalid';
      }

      // Validate website URL if provided
      if (websiteURL && typeof websiteURL !== 'string') {
        errors.websiteURL = 'Please enter a valid URL';
      } else if (websiteURL && websiteURL.trim()) {
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlPattern.test(websiteURL)) {
          errors.websiteURL = 'Please enter a valid URL';
        }
      }

      if (!isObject(logo) || !isNonEmptyString(logo.secure_url)) {
        errors.logo = 'School logo is required';
      }

      if (!verificationDocs || !Array.isArray(verificationDocs) || verificationDocs.length === 0) {
        errors.verificationDocs = 'At least one verification document is required';
      } else if (verificationDocs.some((doc) => !isObject(doc) || !isNonEmptyString(doc.secure_url))) {
        errors.verificationDocs = 'Verification document payload is invalid';
      }

      if (Object.keys(errors).length > 0) {
        logSchoolRegistrationEvent(req, {
          action: 'school_registration.validation_failed',
          outcome: 'failure',
          statusCode: 400,
          errorCount: Object.keys(errors).length,
          errorKeys: Object.keys(errors),
          officialEmailMasked: maskEmail(officialEmail),
        });
        return res.status(400).json({ errors });
      }

      // Check for duplicate email
      const existingSchool = await School.findOne({
        $or: [
          { officialEmail: officialEmail.toLowerCase() },
          { contactEmail: officialEmail.toLowerCase() }
        ]
      });

      if (existingSchool) {
        logSchoolRegistrationEvent(req, {
          action: 'school_registration.duplicate_email',
          outcome: 'failure',
          statusCode: 409,
          officialEmailMasked: maskEmail(officialEmail),
          existingSchoolId: asString(existingSchool._id),
        });
        return res.status(409).json({
          error: 'A school with this email address is already registered'
        });
      }

      // Create school registration
      const school = await School.create({
        name: name.trim(),
        campuses: campuses.map(c => ({
          name: c.name.trim(),
          address: c.address.trim(),
          campusType: c.campusType || 'Branch',
          contactPerson: c.contactPerson?.trim() || undefined,
          contactPhone: c.contactPhone?.trim() || undefined
        })),
        campusName: campuses[0]?.name.trim(), // For backward compatibility
        officialEmail: officialEmail.toLowerCase().trim(),
        contactEmail: officialEmail.toLowerCase().trim(),
        contactPersonName: contactPersonName.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
        schoolType,
        board,
        boardOther: board === 'Other' ? boardOther?.trim() : undefined,
        academicYearStructure,
        estimatedUsers,
        websiteURL: websiteURL?.trim() || undefined,
        logo,
        verificationDocs,
        registrationStatus: 'pending',
        submittedAt: new Date(),
        status: 'inactive' // Inactive until approved
      });

      try {
        await sendSchoolRegistrationConfirmationEmail({
          to: school.officialEmail,
          schoolName: school.name,
          schoolCode: school.code,
          submittedAt: school.submittedAt
        });
      } catch (emailErr) {
        logSchoolRegistrationEvent(req, {
          action: 'school_registration.confirmation_email_failed',
          outcome: 'failure',
          level: 'warn',
          schoolId: asString(school._id),
          officialEmailMasked: maskEmail(school.officialEmail),
          reason: emailErr?.message || 'Unknown email error',
        });
      }

      // Send webhook to Super Admin Portal
      sendWebhook(WEBHOOK_EVENTS.SCHOOL_REGISTERED, {
        schoolId: school._id.toString(),
        name: school.name,
        campuses: school.campuses,
        campusCount: school.campuses.length,
        officialEmail: school.officialEmail,
        contactPhone: school.contactPhone,
        contactPersonName: school.contactPersonName,
        schoolType: school.schoolType,
        board: school.board,
        boardOther: school.boardOther,
        academicYearStructure: school.academicYearStructure,
        estimatedUsers: school.estimatedUsers,
        address: school.address,
        websiteURL: school.websiteURL,
        code: school.code,
        logo: school.logo,
        verificationDocs: school.verificationDocs,
        registrationStatus: school.registrationStatus,
        submittedAt: school.submittedAt
      }).catch(err => {
        // Log but don't fail registration if webhook fails
        logSchoolRegistrationEvent(req, {
          action: 'school_registration.webhook_failed',
          outcome: 'failure',
          level: 'error',
          schoolId: asString(school._id),
          webhookEvent: WEBHOOK_EVENTS.SCHOOL_REGISTERED,
          reason: err?.message || 'Unknown webhook error',
        });
      });

      // Return sanitized response (no sensitive internal fields)
      logSchoolRegistrationEvent(req, {
        action: 'school_registration.submit_success',
        statusCode: 201,
        schoolId: asString(school._id),
        schoolCode: asString(school.code),
        campusCount: school.campuses.length,
        officialEmailMasked: maskEmail(school.officialEmail),
      });

      res.status(201).json({
        message: 'Registration submitted successfully',
        school: {
          id: school._id,
          name: school.name,
          campusCount: school.campuses.length,
          code: school.code,
          registrationStatus: school.registrationStatus,
          submittedAt: school.submittedAt
        }
      });

    } catch (err) {
      logSchoolRegistrationEvent(req, {
        action: 'school_registration.submit_failed',
        outcome: 'failure',
        level: 'error',
        statusCode: err?.code === 11000 ? 409 : 500,
        reason: err?.message || 'Unknown server error',
      });

      if (err.code === 11000) {
        return res.status(409).json({
          error: 'A school with this information already exists'
        });
      }

      if (err.name === 'ValidationError') {
        const validationErrors = {};
        for (const [field, validationErr] of Object.entries(err.errors || {})) {
          validationErrors[field] = validationErr?.message || 'Invalid value';
        }
        return res.status(400).json({ errors: validationErrors });
      }

      res.status(500).json({
        error: 'Registration failed. Please try again later.'
      });
    }
  }
);

module.exports = router;
