const express = require('express');
const router = express.Router();
const { createResponseCache } = require('../utils/responseCache');

// Parent meeting list (used by the calendar). Cleared by any write here.
const parentMeetingsCache = createResponseCache({ ttlMs: 60 * 1000 });
router.use(parentMeetingsCache.invalidateOnWrite);
const ParentMeeting = require('../models/ParentMeeting');
const authTeacher = require('../middleware/authTeacher');
const authParent = require('../middleware/authParent');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const AcademicYear = require('../models/AcademicYear');
const Notification = require('../models/Notification');
const socketRegistry = require('../utils/socketRegistry');
const TeacherUser = require('../models/TeacherUser');
const Building = require('../models/Building');
const Floor = require('../models/Floor');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const ExamInvigilation = require('../models/ExamInvigilation');
const Exam = require('../models/Exam');

const MEETING_SLOT_MINUTES = 30;
const toMinutes = (hhmm) => {
  const match = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const overlaps = (startA, endA, startB, endB) => startA < endB && startB < endA;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Tell the meeting's student and parent (open tabs) to reload their meetings list.
const emitMeetingChanged = (meeting, type) => {
  try {
    const io = socketRegistry.get();
    if (!io || !meeting) return;
    const payload = { type, meetingId: String(meeting._id) };
    [meeting.studentId, meeting.parentId].filter(Boolean)
      .forEach((userId) => io.to(`user:${String(userId?._id || userId)}`).emit('meeting:changed', payload));
  } catch (_err) {
    // realtime refresh is best-effort
  }
};
const {
  buildTeacherAllocationScope,
  scopeAllowsRequest,
  studentIsWithinTeacherScope,
} = require('../utils/teacherAllocationScope');

// Meetings created before per-meeting secure rooms existed have no `videoRoom`.
// Backfill lazily on read so the parent and teacher portals always resolve the
// same room string without another migration.
const ensureVideoRooms = async (meetings) => {
  const pending = [];
  for (const meeting of meetings) {
    if (!meeting.videoRoom) {
      const room = ParentMeeting.generateVideoRoom();
      meeting.videoRoom = room;
      pending.push(ParentMeeting.updateOne({ _id: meeting._id }, { $set: { videoRoom: room } }));
    }
  }
  if (pending.length) await Promise.all(pending);
  return meetings;
};

const formatMeetingDay = (value) => {
  if (!value) return 'TBA';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
};

// Fire-and-forget notification to the meeting's teacher (parent-initiated changes).
const notifyTeacherOfMeetingChange = async (meeting, req, { title, message }) => {
  try {
    let parentName = req.user?.name;
    if (!parentName) {
      const parent = await ParentUser.findById(req.user?.id).select('name').lean();
      parentName = parent?.name || 'A parent';
    }
    await Notification.create({
      schoolId: meeting.schoolId,
      campusId: meeting.campusId || null,
      title,
      message: `${message} (${parentName})`,
      audience: 'Teacher',
      targetUserIds: [meeting.teacherId],
      createdByType: 'parent',
      createdByParentId: req.user?.id || null,
      createdByName: parentName,
      type: 'meeting',
      typeLabel: 'parent_teacher_meeting',
      category: 'general',
      priority: 'high',
    });
  } catch (notifErr) {
    console.error('Failed to notify teacher of meeting change:', notifErr);
  }
};

// ========== TEACHER ROUTES ==========

// Get students for teacher (to schedule meetings with their parents)
router.get('/teacher/students', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const requestedSession = String(req.query?.session || '').trim();
    const requestedClass = String(req.query?.className || req.query?.class || '').trim();
    const requestedSection = String(req.query?.section || '').trim();
    const search = String(req.query?.search || '').trim().toLowerCase();

    const campusId = req.campusId || null;
    const filter = { schoolId };
    if (campusId) {
      filter.campusId = campusId;
    }

    const activeYear = await AcademicYear.findOne({ schoolId, isActive: true })
      .select('name')
      .lean();
    const activeSession = String(activeYear?.name || '').trim();

    const scope = await buildTeacherAllocationScope({ schoolId, campusId, teacherId });
    if ((requestedClass || requestedSection) && !scopeAllowsRequest(scope, {
      grade: requestedClass,
      section: requestedSection,
    })) {
      return res.status(403).json({ error: 'Requested meeting class or section is outside your allocation.' });
    }

    const schoolStudents = await StudentUser.find({ ...filter, status: 'Active' })
      .select('name grade section roll academicYear')
      .sort({ grade: 1, section: 1, roll: 1 })
      .lean();
    const allStudents = schoolStudents.filter((student) => studentIsWithinTeacherScope(student, scope));

    const sessionOptionsSet = new Set(
      allStudents.map((student) => String(student?.academicYear || '').trim()).filter(Boolean)
    );
    if (activeSession) sessionOptionsSet.add(activeSession);
    const sessions = [...sessionOptionsSet].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const selectedSession = requestedSession || activeSession || sessions[0] || '';

    const matchesSession = (student) => {
      const studentSession = String(student?.academicYear || '').trim();
      if (!selectedSession) return true;
      // Records with no / malformed academicYear still belong to the roster.
      if (!studentSession) return true;
      return studentSession.toLowerCase() === selectedSession.toLowerCase();
    };
    let inSelectedSession = allStudents.filter(matchesSession);
    // If the session filter hides the whole roster (common when a school's
    // student data has stale academicYear values), fall back to the full
    // in-scope roster rather than leaving the teacher with nothing to pick.
    if (!inSelectedSession.length && allStudents.length) {
      inSelectedSession = allStudents;
    }

    const classes = [...new Set(inSelectedSession.map((student) => String(student?.grade || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const selectedClass = requestedClass;

    const sections = [...new Set(
      inSelectedSession
        .filter((student) => !selectedClass || String(student?.grade || '').trim().toLowerCase() === selectedClass.toLowerCase())
        .map((student) => String(student?.section || '').trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const students = inSelectedSession.filter((student) => {
      const className = String(student?.grade || '').trim();
      const section = String(student?.section || '').trim();
      const name = String(student?.name || '').trim().toLowerCase();

      if (selectedClass && className.toLowerCase() !== selectedClass.toLowerCase()) return false;
      if (requestedSection && section.toLowerCase() !== requestedSection.toLowerCase()) return false;
      if (search && !name.includes(search)) return false;
      return true;
    });

    res.json({
      activeSession,
      filters: {
        session: selectedSession,
        className: selectedClass,
        section: requestedSection,
      },
      options: {
        sessions,
        classes,
        sections,
      },
      students,
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get parent for a specific student
router.get('/teacher/student/:studentId/parent', authTeacher, async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const student = await StudentUser.findOne({ _id: studentId, schoolId })
      .select('grade section className sectionName')
      .lean();
    const scope = await buildTeacherAllocationScope({
      schoolId,
      campusId: req.campusId || null,
      teacherId,
    });
    if (!student || !studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'Student is outside your assigned scope' });
    }

    // Find parent with this student ID
    const parent = await ParentUser.findOne({
      schoolId,
      childrenIds: studentId
    })
    .select('name email mobile')
    .lean();

    if (!parent) {
      return res.status(404).json({ error: 'Parent not found for this student' });
    }

    res.json(parent);
  } catch (err) {
    console.error('Error fetching parent:', err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher creates a meeting
// Buildings → floors → rooms, each room flagged free/busy for a date + time.
// A room is busy if a class period, an exam/invigilation or another meeting uses it then.
router.get('/teacher/rooms', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const date = String(req.query.date || '').slice(0, 10);
    const start = toMinutes(req.query.time);
    const excludeMeetingId = String(req.query.excludeMeetingId || '');
    const campusFilter = campusId ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] } : {};

    const [buildings, floors, rooms] = await Promise.all([
      Building.find({ schoolId, isActive: { $ne: false }, ...campusFilter }).select('_id name code order').sort({ order: 1, name: 1 }).lean(),
      Floor.find({ schoolId, isActive: { $ne: false }, ...campusFilter }).select('_id buildingId name floorCode order').sort({ order: 1, name: 1 }).lean(),
      Room.find({ schoolId, isActive: { $ne: false }, ...campusFilter }).select('_id buildingId floorId roomNumber label capacity').sort({ roomNumber: 1 }).lean(),
    ]);

    const busy = new Map(); // roomId -> reason
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && start !== null) {
      const end = start + MEETING_SLOT_MINUTES;
      const dayName = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59.999`);
      const [timetables, invigilations, exams, meetings] = await Promise.all([
        Timetable.find({ schoolId, ...campusFilter, 'entries.roomId': { $ne: null } }).select('entries').lean(),
        ExamInvigilation.find({ schoolId, date }).select('roomId startTime endTime').lean(),
        Exam.find({ schoolId, date, roomId: { $ne: null } }).select('roomId time duration').lean(),
        ParentMeeting.find({
          schoolId,
          roomId: { $ne: null },
          status: { $ne: 'cancelled' },
          meetingDate: { $gte: dayStart, $lte: dayEnd },
          ...(excludeMeetingId ? { _id: { $ne: excludeMeetingId } } : {}),
        }).select('roomId meetingTime').lean(),
      ]);
      timetables.forEach((tt) => (tt.entries || []).forEach((entry) => {
        if (!entry.roomId || entry.isBreak) return;
        const day = String(entry.dayOfWeek || '').toLowerCase();
        if (!(day === dayName || day === dayName.slice(0, 3))) return;
        const s = toMinutes(entry.startTime); const e = toMinutes(entry.endTime);
        if (s !== null && e !== null && overlaps(start, end, s, e)) busy.set(String(entry.roomId), 'Class in session');
      }));
      invigilations.forEach((row) => {
        const s = toMinutes(row.startTime); const e = toMinutes(row.endTime);
        if (row.roomId && s !== null && e !== null && overlaps(start, end, s, e)) busy.set(String(row.roomId), 'Exam');
      });
      exams.forEach((exam) => {
        const s = toMinutes(exam.time);
        const e = s === null ? null : s + (Number(exam.duration) || 60);
        if (s !== null && overlaps(start, end, s, e)) busy.set(String(exam.roomId), 'Exam');
      });
      meetings.forEach((m) => {
        const s = toMinutes(m.meetingTime);
        if (s !== null && overlaps(start, end, s, s + MEETING_SLOT_MINUTES)) busy.set(String(m.roomId), 'Another meeting');
      });
    }

    res.json({
      slotMinutes: MEETING_SLOT_MINUTES,
      buildings: buildings.map((b) => ({
        id: String(b._id),
        name: b.name,
        code: b.code,
        floors: floors.filter((f) => String(f.buildingId) === String(b._id)).map((f) => ({
          id: String(f._id),
          name: f.name,
          code: f.floorCode,
          rooms: rooms.filter((r) => String(r.floorId) === String(f._id)).map((r) => ({
            id: String(r._id),
            roomNumber: r.roomNumber,
            label: r.label || '',
            capacity: r.capacity || 0,
            available: !busy.has(String(r._id)),
            reason: busy.get(String(r._id)) || '',
          })),
        })),
      })),
    });
  } catch (err) {
    console.error('Room availability error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Schedule one meeting per student in a single request: scope, students and parents are
// loaded once and everything is written in bulk, instead of 2 requests per student.
router.post('/teacher/create-bulk', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const { studentIds, title, topic, description, meetingDate, meetingTime, meetingType, location, meetingLink, roomId } = req.body || {};
    const ids = [...new Set((Array.isArray(studentIds) ? studentIds : []).map(String))].filter((id) => /^[a-f0-9]{24}$/i.test(id));
    if (!ids.length || !title || !topic || !meetingDate || !meetingTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let roomDoc = null;
    let resolvedLocation = String(location || '').trim();
    if (roomId && (meetingType || 'In Person') === 'In Person') {
      roomDoc = await Room.findOne({ _id: roomId, schoolId }).select('_id roomNumber label buildingId floorId').lean();
      if (!roomDoc) return res.status(400).json({ error: 'Selected room was not found' });
      const [building, floor] = await Promise.all([
        Building.findById(roomDoc.buildingId).select('name').lean(),
        Floor.findById(roomDoc.floorId).select('name').lean(),
      ]);
      resolvedLocation = [building?.name, floor?.name, `Room ${roomDoc.roomNumber}`].filter(Boolean).join(' · ');
    }

    const [scope, students, parents, teacher] = await Promise.all([
      buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId }),
      StudentUser.find({ _id: { $in: ids }, schoolId }).select('_id name grade section className sectionName').lean(),
      ParentUser.find({ schoolId, childrenIds: { $in: ids } }).select('_id childrenIds').lean(),
      TeacherUser.findById(teacherId).select('name').lean(),
    ]);
    const parentByStudent = new Map();
    parents.forEach((parent) => (parent.childrenIds || []).forEach((childId) => {
      if (!parentByStudent.has(String(childId))) parentByStudent.set(String(childId), parent._id);
    }));

    const skipped = [];
    const docs = [];
    students.forEach((student) => {
      if (!studentIsWithinTeacherScope(student, scope)) { skipped.push({ studentId: String(student._id), reason: 'outside your classes' }); return; }
      const parentId = parentByStudent.get(String(student._id));
      if (!parentId) { skipped.push({ studentId: String(student._id), reason: 'no parent linked' }); return; }
      docs.push(new ParentMeeting({
        schoolId,
        campusId: req.campusId || null,
        teacherId,
        parentId,
        studentId: student._id,
        title,
        topic,
        description: description || '',
        meetingDate,
        meetingTime,
        meetingType: meetingType || 'In Person',
        location: resolvedLocation,
        roomId: roomDoc?._id || null,
        meetingLink: meetingLink || '',
        status: 'scheduled',
      }));
    });
    if (!docs.length) return res.status(400).json({ error: 'None of the selected students could be scheduled', skipped });

    const meetings = await ParentMeeting.insertMany(docs);
    const studentById = new Map(students.map((s) => [String(s._id), s]));
    const teacherName = teacher?.name || 'Your teacher';
    const dateLabel = new Date(meetingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const notifications = meetings.flatMap((meeting) => {
      const student = studentById.get(String(meeting.studentId)) || {};
      const common = {
        schoolId,
        campusId: null,
        title: 'Parent-Teacher Meeting Scheduled',
        createdByType: 'teacher',
        createdByTeacherId: teacherId,
        createdByName: teacherName,
        type: 'announcement',
        typeLabel: 'parent_teacher_meeting',
        category: 'general',
        priority: 'high',
        className: String(student.grade || '').trim(),
        sectionName: String(student.section || '').trim(),
        relatedEntity: { entityType: 'meeting', entityId: meeting._id },
      };
      const where = meeting.meetingType === 'In Person' && meeting.location ? ` at ${meeting.location}` : ` (${meeting.meetingType})`;
      return [
        { ...common, audience: 'Parent', targetUserIds: [meeting.parentId],
          message: `${teacherName} has scheduled a meeting with you on ${dateLabel} at ${meeting.meetingTime}${where}. Topic: ${meeting.topic}.` },
        { ...common, audience: 'Student', targetUserIds: [meeting.studentId],
          message: `${teacherName} has scheduled a meeting with your parent on ${dateLabel} at ${meeting.meetingTime}${where}. Topic: ${meeting.topic}.` },
      ];
    });
    // insertMany fires the realtime hint + device push for each notification (see models/Notification.js).
    await Notification.insertMany(notifications, { ordered: false })
      .catch((notifErr) => console.error('Failed to create meeting notifications:', notifErr));

    res.status(201).json({ message: 'Meetings scheduled', created: meetings.length, skipped });
  } catch (err) {
    console.error('Bulk create meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/teacher/create', authTeacher, async (req, res) => {
  try {
    const {
      studentId,
      parentId,
      title,
      topic,
      description,
      meetingDate,
      meetingTime,
      meetingType,
      location,
      meetingLink
    } = req.body;

    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    // Validate required fields
    if (!studentId || !parentId || !title || !topic || !meetingDate || !meetingTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify student and parent exist and belong to the school
    const student = await StudentUser.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const scope = await buildTeacherAllocationScope({
      schoolId,
      campusId: req.campusId || null,
      teacherId,
    });
    if (!studentIsWithinTeacherScope(student, scope)) {
      return res.status(403).json({ error: 'Student is outside your assigned scope' });
    }

    const parent = await ParentUser.findOne({ _id: parentId, schoolId, childrenIds: studentId });
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const meeting = new ParentMeeting({
      schoolId,
      campusId: req.campusId || null,
      teacherId,
      parentId,
      studentId,
      title,
      topic,
      description: description || '',
      meetingDate,
      meetingTime,
      meetingType: meetingType || 'In Person',
      location: location || '',
      meetingLink: meetingLink || '',
      status: 'scheduled'
    });

    await meeting.save();

    // Send notification to parent (explicit insert so it always appears in header bell feed).
    try {
      const meetingDateLabel = meeting.meetingDate
        ? new Date(meeting.meetingDate).toLocaleDateString()
        : 'TBA';
      await Notification.create({
        schoolId,
        campusId: null,
        title: 'Parent-Teacher Meeting Scheduled',
        message: `A meeting has been scheduled with your child's teacher on ${meetingDateLabel} at ${meeting.meetingTime}. Topic: ${meeting.topic}. Type: ${meeting.meetingType}.`,
        audience: 'Parent',
        targetUserIds: [parentId],
        createdByType: 'teacher',
        createdByTeacherId: teacherId,
        type: 'announcement',
        typeLabel: 'parent_teacher_meeting',
        category: 'general',
        priority: 'high',
        relatedEntity: { entityType: 'meeting', entityId: meeting._id },
        className: String(student.grade || '').trim(),
        sectionName: String(student.section || '').trim(),
      });
      // The student is told too. Saving a Notification also pushes it to their devices
      // (web push, works with the site closed) and pings open tabs over Socket.IO.
      await Notification.create({
        schoolId,
        campusId: null,
        title: 'Parent-Teacher Meeting Scheduled',
        message: `Your teacher has scheduled a meeting with your parent on ${meetingDateLabel} at ${meeting.meetingTime}. Topic: ${meeting.topic}.`,
        audience: 'Student',
        targetUserIds: [student._id],
        createdByType: 'teacher',
        createdByTeacherId: teacherId,
        type: 'announcement',
        typeLabel: 'parent_teacher_meeting',
        category: 'general',
        priority: 'high',
        relatedEntity: { entityType: 'meeting', entityId: meeting._id },
        className: String(student.grade || '').trim(),
        sectionName: String(student.section || '').trim(),
      });
    } catch (notifErr) {
      console.error('Failed to create meeting notification:', notifErr);
    }

    res.status(201).json({
      message: 'Meeting scheduled successfully',
      meeting
    });
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher gets their meetings
router.get('/teacher/my-meetings', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const filter = { schoolId, teacherId };
    if (req.campusId) {
      filter.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null }
      ];
    }

    const meetings = await ParentMeeting.find(filter)
      .populate('studentId', 'name grade section roll profilePic')
      .populate('parentId', 'name email mobile profilePic')
      .sort({ meetingDate: -1, meetingTime: -1 });

    await ensureVideoRooms(meetings);
    res.json(meetings);
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher updates a meeting
router.put('/teacher/update/:id', authTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const meeting = await ParentMeeting.findOne({ _id: id, schoolId, teacherId });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }

    const {
      title,
      topic,
      description,
      meetingDate,
      meetingTime,
      meetingType,
      location,
      meetingLink,
      status,
      notes
    } = req.body;

    if (title !== undefined) meeting.title = title;
    if (topic !== undefined) meeting.topic = topic;
    if (description !== undefined) meeting.description = description;
    if (meetingDate !== undefined) meeting.meetingDate = meetingDate;
    if (meetingTime !== undefined) meeting.meetingTime = meetingTime;
    if (meetingType !== undefined) meeting.meetingType = meetingType;
    if (location !== undefined) meeting.location = location;
    if (meetingLink !== undefined) meeting.meetingLink = meetingLink;
    if (req.body.roomId !== undefined) {
      if (req.body.roomId && meeting.meetingType === 'In Person') {
        const roomDoc = await Room.findOne({ _id: req.body.roomId, schoolId }).select('_id roomNumber buildingId floorId').lean();
        if (!roomDoc) return res.status(400).json({ error: 'Selected room was not found' });
        const [building, floor] = await Promise.all([
          Building.findById(roomDoc.buildingId).select('name').lean(),
          Floor.findById(roomDoc.floorId).select('name').lean(),
        ]);
        meeting.roomId = roomDoc._id;
        meeting.location = [building?.name, floor?.name, `Room ${roomDoc.roomNumber}`].filter(Boolean).join(' · ');
      } else {
        meeting.roomId = null;
      }
    }
    if (status !== undefined) meeting.status = status;
    if (notes !== undefined) meeting.notes = notes;

    await meeting.save();
    emitMeetingChanged(meeting, 'updated');

    res.json({ message: 'Meeting updated successfully', meeting });
  } catch (err) {
    console.error('Update meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher deletes a meeting
router.delete('/teacher/delete/:id', authTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const teacherId = req.teacher?.id || req.user?.id;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

    const meeting = await ParentMeeting.findOneAndDelete({
      _id: id,
      schoolId,
      teacherId
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }

    // A deleted meeting shouldn't linger in the student's or parent's bell either.
    await Notification.deleteMany({ schoolId, 'relatedEntity.entityType': 'meeting', 'relatedEntity.entityId': meeting._id })
      .catch((cleanupErr) => console.error('Failed to remove meeting notifications:', cleanupErr));
    emitMeetingChanged(meeting, 'deleted');

    res.json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    console.error('Delete meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== PARENT ROUTES ==========

// Students can view meetings scheduled about them. Parent responses remain
// protected by the parent-only endpoints below.
router.get('/student/my-meetings', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const filter = { schoolId, studentId: req.user.id };
    if (req.campusId) {
      filter.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null },
      ];
    }
    const meetings = await ParentMeeting.find(filter)
      .populate('teacherId', 'name email')
      .sort({ meetingDate: -1, meetingTime: -1 })
      .lean();
    return res.json(meetings);
  } catch (err) {
    console.error('Error fetching student meetings:', err);
    return res.status(500).json({ error: err.message || 'Unable to load meetings' });
  }
});

// Parents get their meetings
router.get('/parent/my-meetings', authParent, parentMeetingsCache.cache, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const parentId = req.user?.id;
    if (!parentId) return res.status(400).json({ error: 'parentId is required' });

    const filter = { schoolId, parentId };
    if (req.campusId) {
      filter.$or = [
        { campusId: req.campusId },
        { campusId: { $exists: false } },
        { campusId: null }
      ];
    }

    const meetings = await ParentMeeting.find(filter)
      .populate('studentId', 'name grade section roll')
      .populate('teacherId', 'name email mobile')
      .sort({ meetingDate: -1, meetingTime: -1 });

    await ensureVideoRooms(meetings);
    res.json(meetings);
  } catch (err) {
    console.error('Error fetching parent meetings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Parent confirms a meeting
router.put('/parent/confirm/:id', authParent, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const parentId = req.user?.id;
    if (!parentId) return res.status(400).json({ error: 'parentId is required' });

    const meeting = await ParentMeeting.findOne({ _id: id, schoolId, parentId });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }

    meeting.status = 'confirmed';
    await meeting.save();

    await notifyTeacherOfMeetingChange(meeting, req, {
      title: 'Meeting Confirmed by Parent',
      message: `The parent confirmed the meeting on ${formatMeetingDay(meeting.meetingDate)} at ${meeting.meetingTime}.`,
    });

    res.json({ message: 'Meeting confirmed successfully', meeting });
  } catch (err) {
    console.error('Confirm meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Parent requests a reschedule
router.put('/parent/reschedule/:id', authParent, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const parentId = req.user?.id;
    if (!parentId) return res.status(400).json({ error: 'parentId is required' });

    const { requestedDate, requestedTime, reason } = req.body || {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A reason for the reschedule request is required' });
    }

    const meeting = await ParentMeeting.findOne({ _id: id, schoolId, parentId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    if (['completed', 'cancelled'].includes(meeting.status)) {
      return res.status(409).json({ error: `Cannot reschedule a ${meeting.status} meeting` });
    }

    meeting.status = 'reschedule_requested';
    meeting.rescheduleRequest = {
      requestedDate: requestedDate ? new Date(requestedDate) : null,
      requestedTime: String(requestedTime || '').trim(),
      reason: String(reason).trim(),
      requestedAt: new Date(),
    };
    await meeting.save();

    await notifyTeacherOfMeetingChange(meeting, req, {
      title: 'Reschedule Requested by Parent',
      message: `The parent asked to reschedule the meeting (currently ${formatMeetingDay(meeting.meetingDate)} at ${meeting.meetingTime}). Reason: ${meeting.rescheduleRequest.reason}`,
    });

    res.json({ message: 'Reschedule request sent to the teacher', meeting });
  } catch (err) {
    console.error('Parent reschedule request error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Parent declines a meeting
router.put('/parent/decline/:id', authParent, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const parentId = req.user?.id;
    if (!parentId) return res.status(400).json({ error: 'parentId is required' });

    const meeting = await ParentMeeting.findOne({ _id: id, schoolId, parentId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    if (['completed', 'cancelled'].includes(meeting.status)) {
      return res.status(409).json({ error: `Cannot decline a ${meeting.status} meeting` });
    }

    meeting.status = 'declined';
    if (req.body?.reason) meeting.notes = String(req.body.reason).trim();
    await meeting.save();

    await notifyTeacherOfMeetingChange(meeting, req, {
      title: 'Meeting Declined by Parent',
      message: `The parent declined the meeting on ${formatMeetingDay(meeting.meetingDate)} at ${meeting.meetingTime}.${meeting.notes ? ` Note: ${meeting.notes}` : ''}`,
    });

    res.json({ message: 'Meeting declined', meeting });
  } catch (err) {
    console.error('Parent decline meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Parent submits feedback for a completed meeting
router.post('/parent/feedback/:id', authParent, async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const parentId = req.user?.id;
    if (!parentId) return res.status(400).json({ error: 'parentId is required' });

    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const meeting = await ParentMeeting.findOne({ _id: id, schoolId, parentId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found or unauthorized' });

    meeting.parentFeedback = {
      rating,
      comment: String(req.body?.comment || '').trim(),
      submittedAt: new Date(),
    };
    await meeting.save();

    await notifyTeacherOfMeetingChange(meeting, req, {
      title: 'Meeting Feedback Received',
      message: `The parent rated the meeting ${rating}/5${meeting.parentFeedback.comment ? `: "${meeting.parentFeedback.comment}"` : '.'}`,
    });

    res.json({ message: 'Thank you for your feedback', meeting });
  } catch (err) {
    console.error('Parent meeting feedback error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
