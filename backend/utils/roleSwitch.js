const jwt = require('jsonwebtoken');
const TeacherUser = require('../models/TeacherUser');
const Principal = require('../models/Principal');
const Admin = require('../models/Admin');

// A teacher who is also the school's principal is linked to their Principal
// account by email/username within the same school (tenant scope is applied by
// the plugin). Mirrors how principalRoutes resolves the principal's teacher avatar.
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const identityFilter = (...values) => {
  const patterns = [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))]
    .map((v) => new RegExp(`^${escapeRegex(v)}$`, 'i'));
  if (!patterns.length) return null;
  return { $or: [{ email: { $in: patterns } }, { username: { $in: patterns } }] };
};

const sameSchool = (schoolId) => (schoolId ? { schoolId } : {});

const findLinkedPrincipal = async (teacherId) => {
  const teacher = await TeacherUser.findById(teacherId).select('email username schoolId').lean();
  const filter = identityFilter(teacher?.email, teacher?.username);
  if (!filter) return null;
  return Principal.findOne({ ...filter, ...sameSchool(teacher.schoolId) }).lean();
};

const findLinkedTeacher = async (principalId) => {
  const principal = await Principal.findById(principalId).select('email username schoolId').lean();
  const filter = identityFilter(principal?.email, principal?.username);
  if (!filter) return null;
  return TeacherUser.findOne({ ...filter, ...sameSchool(principal.schoolId) }).lean();
};

const expiresIn = () => process.env.JWT_EXPIRES_IN || '24h';

const signPrincipalToken = (principal) => jwt.sign({
  id: principal._id,
  type: 'principal',
  userType: 'principal',
  organizationId: principal.organizationId || null,
  schoolId: principal.schoolId || null,
  campusId: principal.campusId || null,
  campusName: principal.campusName || null,
  campusType: principal.campusType || null,
}, process.env.JWT_SECRET, { expiresIn: expiresIn() });

const signTeacherToken = (teacher) => jwt.sign({
  id: teacher._id,
  userType: 'teacher',
  organizationId: teacher.organizationId || null,
  schoolId: teacher.schoolId || null,
  campusId: teacher.campusId || null,
}, process.env.JWT_SECRET, { expiresIn: expiresIn() });

// Admin-panel access granted to a teacher through Roles & Access.
const findLinkedAdmin = (teacherId) => Admin.findOne({
  linkedTeacherId: teacherId,
  isTeamMember: true,
  status: { $ne: 'inactive' },
}).lean();

const signAdminToken = (admin) => jwt.sign({
  id: admin._id,
  type: 'admin',
  role: admin.role || 'admin',
  teamMember: Boolean(admin.isTeamMember),
  username: admin.username,
  organizationId: admin.organizationId || null,
  schoolId: admin.schoolId || null,
  campusId: admin.campusId || null,
  campusName: admin.campusName || null,
  campusType: admin.campusType || null,
}, process.env.JWT_SECRET, { expiresIn: expiresIn() });

module.exports = {
  findLinkedPrincipal, findLinkedTeacher, findLinkedAdmin, signPrincipalToken, signTeacherToken, signAdminToken,
};
