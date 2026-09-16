/**
 * Shared pieces for system-generated formal notices (letterhead school block,
 * notice numbers, PDF attachment upload). Used by the exam notices; the
 * teacher-feedback notice keeps its own copy for now.
 */
const School = require('../models/School');
const NoticeCounter = require('../models/NoticeCounter');
const { renderFormalNoticePdf } = require('./formalNoticePdf');
const { uploadBufferToCloudinary } = require('./cloudinaryUpload');

const schoolInitials = (name = '') => String(name)
  .split(/\s+/)
  .filter((w) => /^[A-Za-z]/.test(w))
  .map((w) => w[0].toUpperCase())
  .join('') || 'SCH';

// "2026-2027" → "2026-27"
const shortSession = (name = '') => {
  const m = String(name).match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
  return m ? `${m[1]}-${m[2].slice(-2)}` : String(name || '').trim();
};

// "2026-2027" → "2026–2027"
const sessionLabel = (name = '') => String(name || '').replace(/\s*-\s*/, '–');

const formatDateLabel = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
};

// e.g. KSHS/2026-27/EXAM/003 — per school, per series, per session.
const nextNoticeNumber = async ({ schoolId, schoolName, sessionName, series }) => {
  const session = shortSession(sessionName);
  const counter = await NoticeCounter.findOneAndUpdate(
    { schoolId, key: `${series}:${session}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `${schoolInitials(schoolName)}/${session}/${series}/${String(counter.seq).padStart(3, '0')}`;
};

const loadSchoolHeader = async (schoolId) => {
  const school = await School.findById(schoolId)
    .select('name address board boardOther contactEmail officialEmail contactPhone logo')
    .lean();
  return {
    name: school?.name || '',
    address: school?.address || '',
    board: school?.board === 'Other' ? (school?.boardOther || '') : (school?.board || ''),
    email: school?.contactEmail || school?.officialEmail || '',
    phone: school?.contactPhone || '',
    logoUrl: school?.logo?.secure_url || '',
  };
};

const SIGNATURE = (schoolName) => ['By Order,', 'School Administration', schoolName || ''];
const FOOTER = 'Note: This is a system-generated notice published through the EEC School Management System.';

// Plain-text copy of a formal notice (bell previews, search, push, share).
const noticeToText = (doc) => [
  doc.salutation,
  '',
  ...(doc.paragraphs || []),
  '',
  ...(doc.details || []).map((d) => `${d.label}: ${d.value}`),
  '',
  ...(doc.instructions || []).map((line, i) => `${i + 1}. ${line}`),
  '',
  ...(doc.sections || []).map((s) => `${s.title} ${s.text}`),
  '',
  ...(doc.closing || []),
].join('\n').replace(/\n{3,}/g, '\n\n').split('**').join('').trim();

/**
 * Render the notice as a PDF and upload it to a fixed public_id (overwritten
 * when the notice changes). Returns the attachments array, or null on failure
 * — a missing PDF must never block the notice itself.
 * Stored without a '.pdf' extension: this Cloudinary account refuses to
 * deliver files by that extension (401); the portals' download helper adds
 * the real file name back.
 */
const buildNoticePdfAttachment = async ({ document, publicId, fileName }) => {
  try {
    const buffer = await renderFormalNoticePdf(document);
    const uploaded = await uploadBufferToCloudinary(buffer, {
      folder: 'notices',
      public_id: publicId,
      resource_type: 'raw',
      use_filename: false,
      unique_filename: false,
      overwrite: true,
      invalidate: true,
    });
    return [{ name: fileName, url: uploaded.secure_url, size: buffer.length, type: 'application/pdf' }];
  } catch (err) {
    console.error('[formal-notice] PDF failed:', err.message);
    return null;
  }
};

/**
 * A notice can carry per-role versions (document.variants.student / .parent —
 * salutation and the role section). This returns the document as a given
 * role sees it; without a role (admin) the combined version is returned.
 */
const documentForRole = (doc, role) => {
  const variant = role && doc?.variants?.[role];
  if (!variant) return doc;
  const { variants, ...rest } = doc;
  return { ...rest, ...variant };
};

/**
 * PDFs for a notice: one per role when the notice has role variants
 * (Dear Student / Dear Parent), else a single one. Each attachment carries
 * `role` so every portal shows only its own copy.
 */
const buildNoticePdfAttachments = async ({ document, publicId, fileName }) => {
  const roles = document?.variants ? Object.keys(document.variants) : [];
  if (!roles.length) return buildNoticePdfAttachment({ document, publicId, fileName });
  const out = [];
  for (const role of roles) {
    // eslint-disable-next-line no-await-in-loop
    const att = await buildNoticePdfAttachment({
      document: documentForRole(document, role),
      publicId: `${publicId}_${role}`,
      fileName: fileName.replace(/\.pdf$/i, `-${role === 'parent' ? 'Parent' : 'Student'}.pdf`),
    });
    if (!att) return null;
    out.push({ ...att[0], role });
  }
  return out;
};

module.exports = {
  documentForRole,
  buildNoticePdfAttachments,
  schoolInitials,
  shortSession,
  sessionLabel,
  formatDateLabel,
  nextNoticeNumber,
  loadSchoolHeader,
  noticeToText,
  buildNoticePdfAttachment,
  SIGNATURE,
  FOOTER,
};
