const express = require('express');
const router = express.Router();
const ParentMeeting = require('../models/ParentMeeting');
const authTeacher = require('../middleware/authTeacher');
const authParent = require('../middleware/authParent');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const AcademicYear = require('../models/AcademicYear');
const Notification = require('../models/Notification');

// ========== TEACHER ROUTES ==========

// Get students for teacher (to schedule meetings with their parents)
router.get('/teacher/students', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId || req.teacher?.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

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

    // Get all students from the school/campus.
    const allStudents = await StudentUser.find(filter)
      .select('name grade section roll academicYear')
      .sort({ grade: 1, section: 1, roll: 1 })
      .lean();

    const sessionOptionsSet = new Set(
      allStudents.map((student) => String(student?.academicYear || '').trim()).filter(Boolean)
    );
    if (activeSession) sessionOptionsSet.add(activeSession);
    const sessions = [...sessionOptionsSet].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const selectedSession = requestedSession || activeSession || sessions[0] || '';

    const inSelectedSession = allStudents.filter((student) => {
      const studentSession = String(student?.academicYear || '').trim();
      if (!selectedSession) return true;
      return studentSession.toLowerCase() === selectedSession.toLowerCase();
    });

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

    const parent = await ParentUser.findOne({ _id: parentId, schoolId });
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
      .populate('studentId', 'name grade section roll')
      .populate('parentId', 'name email mobile')
      .sort({ meetingDate: -1, meetingTime: -1 });

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
    if (status !== undefined) meeting.status = status;
    if (notes !== undefined) meeting.notes = notes;

    await meeting.save();

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
router.get('/parent/my-meetings', authParent, async (req, res) => {
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

    res.json({ message: 'Meeting confirmed successfully', meeting });
  } catch (err) {
    console.error('Confirm meeting error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
