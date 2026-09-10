const { buildTeacherAllocationScope, studentIsWithinTeacherScope, scopeAllowsRequest } = require('./teacherAllocationScope');
const StudentUser = require('../models/StudentUser');
const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function scopedStudents(req) {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const scope = await buildTeacherAllocationScope({ schoolId, teacherId, campusId: req.campusId || null });
  const { className, section, subject } = req.query || {};
  if (!scope.length || !scopeAllowsRequest(scope, { grade: className, section, subject })) {
    throw Object.assign(new Error('Class allocation required'), { status: 403 });
  }
  const filter = { schoolId };
  if (req.campusId) filter.campusId = req.campusId;
  if (className) filter.grade = { $regex: '^(?:Class\\s+)?' + escape(className.replace(/^class\s+/i, '')) + '$', $options: 'i' };
  if (section) filter.section = { $regex: '^' + escape(section) + '$', $options: 'i' };
  const students = await StudentUser.find(filter).select('_id name roll grade section attendance').lean();
  return students.filter((s) => studentIsWithinTeacherScope(s, scope));
}

module.exports = { scopedStudents };
