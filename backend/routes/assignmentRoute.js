const express = require('express');
const { logger } = require('../utils/logger');
const router = express.Router();
const crypto = require('crypto');
const Assignment = require('../models/Assignment');
const adminAuth = require('../middleware/adminAuth');
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const StudentProgress = require('../models/StudentProgress');
const StudentUser = require('../models/StudentUser');
const NotificationService = require('../utils/notificationService');
const Timetable = require('../models/Timetable');
const Class = require('../models/Class');
const Section = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildCampusFilter = (campusId) => (
    campusId
        ? {
            $or: [
                { campusId },
                { campusId: { $exists: false } },
                { campusId: null }
            ]
        }
        : {}
);
const normalizeSubmissionFormat = (value = 'text') => (value === 'pdf' ? 'pdf' : 'text');
const normalizeDifficulty = (value = 'Medium') => {
    const allowed = new Set(['Easy', 'Medium', 'Hard']);
    return allowed.has(value) ? value : 'Medium';
};

const resolveSchoolId = (req, res) => {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId) {
        res.status(400).json({ error: 'schoolId is required' });
        return null;
    }
    return schoolId;
};

const getActiveAcademicYear = async (schoolId) => {
    if (!schoolId) return null;
    return AcademicYear.findOne({ schoolId, isActive: true })
        .select('_id name startDate endDate')
        .lean();
};

router.get("/fetch", adminAuth, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const filter = { schoolId };
        if (req.campusId) {
            filter.$or = [
                { campusId: req.campusId },
                { campusId: { $exists: false } },
                { campusId: null }
            ];
        }
        const assignments = await Assignment.find(filter);
        res.status(200).json(assignments);
    } catch(err) {
        res.status(500).json({ error: "Internal server error" });
    }
})
router.post("/add", adminAuth, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { title, subject, class: className, marks, status, dueDate } = req.body;
        const schoolId = resolveSchoolId(req, res);
        if (!schoolId) return;
        const assignment = new Assignment({
            schoolId,
            campusId: req.campusId || null,
            title,
            subject,
            class: className,
            marks,
            status,
            dueDate
        });
        await assignment.save();

        // Create notification for students if assignment is active
        if (status === 'active') {
            try {
                await NotificationService.notifyAssignmentCreated({
                    schoolId,
                    campusId: req.campusId || null,
                    assignment,
                    createdBy: req.admin?.id || null
                });
            } catch (notifErr) {
                logger.error('Failed to create assignment notification:', notifErr);
                // Don't fail the entire request if notification fails
            }
        }

        res.status(201).json({ message: "Assignment created successfully" });
    } catch(err) {
        res.status(500).json({ error: "Internal server error" });
    }
})

// ========== TEACHER ROUTES ==========

// Teachers get their class/section assignments (for creating assignments)
router.get("/teacher/my-classes", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const campusId = req.campusId || null;

        // The authTeacher middleware puts the decoded token in req.user and req.teacher
        // The token contains { id, userType, schoolId, campusId, ... }
        const teacherId = req.user?.id || req.teacher?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        logger.info('Teacher my-classes request:', { teacherId, schoolId, campusId });

        // Find all timetables where this teacher is assigned
        const timetables = await Timetable.find({
            schoolId,
            'entries.teacherId': teacherId
        })
        .populate({
            path: 'classId',
            select: 'name academicYearId',
            populate: { path: 'academicYearId', select: 'name' }
        })
        .populate('sectionId', 'name')
        .populate('entries.subjectId', 'name code')
        .lean();

        logger.info('Found timetables:', timetables.length);

        // Extract unique class-section combinations and assigned subjects
        const teacherIdString = String(teacherId);
        const classSectionsMap = new Map();

        timetables.forEach(timetable => {
            if (!timetable.classId || !timetable.sectionId) return;
            const key = `${timetable.classId._id}-${timetable.sectionId._id}`;
            const existing = classSectionsMap.get(key);
            const subjectMap = existing?.subjectMap || new Map();

            (timetable.entries || []).forEach(entry => {
                if (!entry?.teacherId || !entry?.subjectId) return;
                if (String(entry.teacherId) !== teacherIdString) return;
                const subjectId = String(entry.subjectId?._id);
                const subjectName = entry.subjectId?.name;
                if (!subjectId || !subjectName) return;
                if (!subjectMap.has(subjectId)) {
                    subjectMap.set(subjectId, { id: entry.subjectId._id, name: subjectName });
                }
            });

            if (!existing) {
                classSectionsMap.set(key, {
                    classId: timetable.classId._id,
                    className: timetable.classId.name,
                    sectionId: timetable.sectionId._id,
                    sectionName: timetable.sectionId.name,
                    academicYearId: timetable.classId?.academicYearId?._id || timetable.classId?.academicYearId || null,
                    sessionName: timetable.classId?.academicYearId?.name || '',
                    subjectMap
                });
            } else {
                existing.subjectMap = subjectMap;
            }
        });

        let classSections = Array.from(classSectionsMap.values()).map(item => ({
            classId: item.classId,
            className: item.className,
            sectionId: item.sectionId,
            sectionName: item.sectionName,
            academicYearId: item.academicYearId || null,
            sessionName: item.sessionName || '',
            subjects: Array.from(item.subjectMap.values())
        }));

        // If no timetables found, fallback to all classes in the school/campus
        if (classSections.length === 0) {
            logger.info('No timetables found, fetching all class-section combinations');

            const filter = { schoolId };
            if (campusId) {
                filter.campusId = campusId;
            }

            const classes = await Class.find(filter)
                .populate('academicYearId', 'name')
                .lean();

            for (const classDoc of classes) {
                const sections = await Section.find({
                    schoolId,
                    classId: classDoc._id,
                    ...(campusId ? { campusId } : {})
                }).lean();

                sections.forEach(section => {
                    classSections.push({
                        classId: classDoc._id,
                        className: classDoc.name,
                        sectionId: section._id,
                        sectionName: section.name,
                        academicYearId: classDoc.academicYearId?._id || classDoc.academicYearId || null,
                        sessionName: classDoc.academicYearId?.name || '',
                        subjects: []
                    });
                });
            }
        }

        logger.info('Unique class-sections:', classSections);
        res.json(classSections);
    } catch (err) {
        logger.error('Error in teacher/my-classes:', err);
        res.status(500).json({ error: err.message });
    }
});

// Teachers create assignment
router.post("/teacher/create", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const {
            title,
            description,
            subject,
            classId,
            sectionId,
            marks,
            dueDate,
            status,
            attachments,
            submissionFormat,
            type,
            difficulty,
            academicYearId
        } = req.body || {};
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const activeYear = await getActiveAcademicYear(schoolId);
        if (!activeYear?._id) {
            return res.status(400).json({ error: 'No active academic session found. Ask admin to activate a session first.' });
        }
        if (academicYearId && String(academicYearId) !== String(activeYear._id)) {
            return res.status(400).json({ error: 'Assignments can only be created for the active academic session.' });
        }

        // Validate that class and section exist and belong to the same school
        const classDoc = await Class.findOne({ _id: classId, schoolId });
        if (!classDoc) {
            return res.status(404).json({ error: 'Class not found' });
        }

        const sectionDoc = await Section.findOne({ _id: sectionId, schoolId, classId });
        if (!sectionDoc) {
            return res.status(404).json({ error: 'Section not found or does not belong to this class' });
        }

        const assignment = new Assignment({
            schoolId,
            campusId: req.campusId || null,
            teacherId,
            title,
            description: description || '',
            subject,
            type: type || 'Assignment',
            difficulty: normalizeDifficulty(difficulty),
            class: classDoc.name || '',
            section: sectionDoc.name || '',
            classId,
            sectionId,
            academicYearId: activeYear._id,
            sessionName: activeYear.name || '',
            marks: marks || 100,
            attachments: attachments || [],
            submissionFormat: normalizeSubmissionFormat(submissionFormat),
            status: status || 'draft',
            dueDate
        });

        await assignment.save();

        // Create notification for students if assignment is active
        if (status === 'active') {
            try {
                await NotificationService.notifyAssignmentCreated({
                    schoolId,
                    campusId: req.campusId || null,
                    assignment,
                    createdBy: teacherId
                });
            } catch (notifErr) {
                logger.error('Failed to create assignment notification:', notifErr);
            }
        }

        res.status(201).json({ message: "Assignment created successfully", assignment });
    } catch (err) {
        logger.error('Create assignment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Teachers get their own assignments
router.get("/teacher/my-assignments", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const filter = { schoolId, teacherId };
        const activeYear = await getActiveAcademicYear(schoolId);
        if (activeYear?._id) {
            filter.academicYearId = activeYear._id;
        }
        if (req.campusId) {
            filter.$or = [
                { campusId: req.campusId },
                { campusId: { $exists: false } },
                { campusId: null }
            ];
        }

        const assignments = await Assignment.find(filter)
            .populate('classId', 'name')
            .populate('sectionId', 'name')
            .populate('academicYearId', 'name')
            .sort({ createdAt: -1 });

        const assignmentIds = assignments.map((assignment) => assignment._id);
        const progressDocs = assignmentIds.length
            ? await StudentProgress.find({
                schoolId,
                'submissions.assignmentId': { $in: assignmentIds }
            }).select('studentId submissions').lean()
            : [];

        const submittedByAssignment = new Map();
        progressDocs.forEach((doc) => {
            const studentId = String(doc.studentId || '');
            (doc.submissions || []).forEach((sub) => {
                const assignmentId = String(sub.assignmentId || '');
                if (!assignmentId || !studentId) return;
                if (!submittedByAssignment.has(assignmentId)) {
                    submittedByAssignment.set(assignmentId, new Set());
                }
                submittedByAssignment.get(assignmentId).add(studentId);
            });
        });

        const studentFilter = { schoolId };
        if (req.campusId) {
            studentFilter.campusId = req.campusId;
        }
        const students = await StudentUser.find(studentFilter)
            .select('grade section')
            .lean();
        const classStrengthMap = new Map();
        students.forEach((student) => {
            const key = `${String(student.grade || '').trim().toLowerCase()}::${String(student.section || '').trim().toLowerCase()}`;
            classStrengthMap.set(key, (classStrengthMap.get(key) || 0) + 1);
        });

        const assignmentsWithStats = assignments.map((assignment) => {
            const assignmentId = String(assignment._id);
            const className = String(assignment.class || assignment.classId?.name || '').trim();
            const sectionName = String(assignment.section || assignment.sectionId?.name || '').trim();
            const classKey = `${className.toLowerCase()}::${sectionName.toLowerCase()}`;
            const totalStudents = classStrengthMap.get(classKey) || 0;
            const submissions = submittedByAssignment.get(assignmentId)?.size || 0;
            const submissionRate = totalStudents > 0 ? Math.round((submissions / totalStudents) * 100) : 0;
            return {
                ...assignment.toObject(),
                submissions,
                totalStudents,
                submissionRate
            };
        });

        res.json(assignmentsWithStats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers update assignment
router.put("/teacher/update/:id", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { id } = req.params;
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const assignment = await Assignment.findOne({ _id: id, schoolId, teacherId });
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or unauthorized' });
        }
        const activeYear = await getActiveAcademicYear(schoolId);
        if (activeYear?._id && assignment.academicYearId && String(assignment.academicYearId) !== String(activeYear._id)) {
            return res.status(400).json({ error: 'Only assignments from the active academic session can be updated.' });
        }

        const { title, description, subject, marks, dueDate, status, attachments, submissionFormat, classId, sectionId, type, difficulty } = req.body;

        if (title) assignment.title = title;
        if (description !== undefined) assignment.description = description;
        if (subject) assignment.subject = subject;
        if (type !== undefined) assignment.type = type || 'Assignment';
        if (difficulty !== undefined) assignment.difficulty = normalizeDifficulty(difficulty);
        if (marks !== undefined) assignment.marks = marks;
        if (dueDate) assignment.dueDate = dueDate;
        if (status) assignment.status = status;
        if (submissionFormat) assignment.submissionFormat = normalizeSubmissionFormat(submissionFormat);
        if (attachments !== undefined) assignment.attachments = attachments;

        if (classId || sectionId) {
            const nextClassId = classId || assignment.classId;
            const nextSectionId = sectionId || assignment.sectionId;

            const classDoc = await Class.findOne({ _id: nextClassId, schoolId });
            if (!classDoc) {
                return res.status(404).json({ error: 'Class not found' });
            }

            const sectionDoc = await Section.findOne({ _id: nextSectionId, schoolId, classId: classDoc._id });
            if (!sectionDoc) {
                return res.status(404).json({ error: 'Section not found or does not belong to this class' });
            }

            assignment.classId = classDoc._id;
            assignment.sectionId = sectionDoc._id;
            assignment.class = classDoc.name || assignment.class;
            assignment.section = sectionDoc.name || assignment.section;
        }

        await assignment.save();

        res.json({ message: "Assignment updated successfully", assignment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers delete assignment
router.delete("/teacher/delete/:id", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { id } = req.params;
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const assignment = await Assignment.findOneAndDelete({ _id: id, schoolId, teacherId });
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or unauthorized' });
        }

        res.json({ message: "Assignment deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers grade assignment submission
router.post("/teacher/grade", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { studentId, assignmentId, score, feedback } = req.body;
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
        const activeYear = await getActiveAcademicYear(schoolId);

        // Verify assignment belongs to this teacher
        const assignmentFilter = { _id: assignmentId, schoolId, teacherId };
        if (activeYear?._id) {
            assignmentFilter.academicYearId = activeYear._id;
        }
        const assignment = await Assignment.findOne(assignmentFilter);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or unauthorized' });
        }

        // schoolId guard: student must belong to the same school
        const progress = await StudentProgress.findOne({ studentId, schoolId });
        if (!progress) {
            return res.status(404).json({ error: 'Student progress not found' });
        }

        const submissionIndex = progress.submissions.findIndex(
            sub => sub.assignmentId.toString() === assignmentId
        );

        if (submissionIndex === -1) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        progress.submissions[submissionIndex].score = score;
        progress.submissions[submissionIndex].feedback = feedback || '';
        progress.submissions[submissionIndex].status = 'graded';
        // publishedByTeacher stays false until teacher explicitly publishes
        progress.lastUpdated = new Date();

        await progress.save();

        res.json({ message: "Assignment graded successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers publish grades so students can see their marks and feedback
router.post("/teacher/publish-grades", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { studentIds, assignmentId } = req.body;
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        if (!assignmentId) return res.status(400).json({ error: 'assignmentId is required' });
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'studentIds array is required' });
        }

        // Verify assignment belongs to this teacher and school
        const assignment = await Assignment.findOne({ _id: assignmentId, schoolId, teacherId });
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or unauthorized' });
        }

        const progressDocs = await StudentProgress.find({
            schoolId,
            studentId: { $in: studentIds },
        });

        let publishedCount = 0;
        await Promise.all(progressDocs.map(async (progress) => {
            const idx = progress.submissions.findIndex(
                (s) => String(s.assignmentId) === String(assignmentId) && s.status === 'graded'
            );
            if (idx === -1) return;
            progress.submissions[idx].publishedByTeacher = true;
            progress.submissions[idx].publishedAt = new Date();
            progress.lastUpdated = new Date();
            publishedCount += 1;
            await progress.save();
        }));

        // Notify students their marks are available
        try {
            const NotificationService = require('../utils/notificationService');
            await NotificationService.notifyMarksPublished({
                schoolId,
                campusId: req.campusId || null,
                assignment,
                studentIds,
                createdBy: teacherId,
            });
        } catch (_) { /* non-critical */ }

        res.json({ message: `Marks published for ${publishedCount} student(s)`, publishedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Teachers grade multiple assignment submissions at once
router.post("/teacher/grade-bulk", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { grades } = req.body || {};
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
        const activeYear = await getActiveAcademicYear(schoolId);

        if (!Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({ error: 'grades array is required' });
        }

        const assignmentIds = Array.from(new Set(
            grades.map((item) => String(item?.assignmentId || '')).filter(Boolean)
        ));
        const studentIds = Array.from(new Set(
            grades.map((item) => String(item?.studentId || '')).filter(Boolean)
        ));

        const assignments = await Assignment.find({
            _id: { $in: assignmentIds },
            schoolId,
            teacherId,
            ...(activeYear?._id ? { academicYearId: activeYear._id } : {})
        }).select('_id marks');
        const assignmentMap = new Map(assignments.map((item) => [String(item._id), item]));

        const progressDocs = await StudentProgress.find({
            schoolId,
            studentId: { $in: studentIds }
        });
        const progressMap = new Map(progressDocs.map((item) => [String(item.studentId), item]));

        const touchedProgress = new Map();
        const failed = [];
        let updatedCount = 0;

        grades.forEach((entry, index) => {
            const studentId = String(entry?.studentId || '');
            const assignmentId = String(entry?.assignmentId || '');
            const scoreRaw = entry?.score;
            const feedback = entry?.feedback || '';

            if (!studentId || !assignmentId) {
                failed.push({ index, reason: 'studentId and assignmentId are required' });
                return;
            }

            const assignment = assignmentMap.get(assignmentId);
            if (!assignment) {
                failed.push({ index, assignmentId, reason: 'Assignment not found or unauthorized' });
                return;
            }

            const score = Number(scoreRaw);
            if (!Number.isFinite(score) || score < 0) {
                failed.push({ index, studentId, assignmentId, reason: 'Invalid score' });
                return;
            }
            if (score > Number(assignment.marks || 0)) {
                failed.push({
                    index,
                    studentId,
                    assignmentId,
                    reason: `Score cannot exceed ${assignment.marks}`
                });
                return;
            }

            const progress = progressMap.get(studentId);
            if (!progress) {
                failed.push({ index, studentId, assignmentId, reason: 'Student progress not found' });
                return;
            }

            const submissionIndex = progress.submissions.findIndex(
                (sub) => String(sub.assignmentId) === assignmentId
            );
            if (submissionIndex === -1) {
                failed.push({ index, studentId, assignmentId, reason: 'Submission not found' });
                return;
            }

            progress.submissions[submissionIndex].score = score;
            progress.submissions[submissionIndex].feedback = feedback;
            progress.submissions[submissionIndex].status = 'graded';
            // publishedByTeacher stays false until teacher explicitly publishes
            progress.lastUpdated = new Date();

            touchedProgress.set(studentId, progress);
            updatedCount += 1;
        });

        if (touchedProgress.size > 0) {
            await Promise.all(
                Array.from(touchedProgress.values()).map((doc) => doc.save())
            );
        }

        res.json({
            message: 'Bulk grading completed',
            updatedCount,
            failedCount: failed.length,
            failed
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== STUDENT ROUTES ==========

// Students get assignments for their class/section
router.get("/student/assignments", authStudent, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const studentId = req.student?.id || req.user?.id;
        if (!studentId) return res.status(400).json({ error: 'studentId is required' });

        // Get student details
        const student = await StudentUser.findById(studentId)
            .select('grade section campusId');
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const campusId = req.campusId || student.campusId || null;
        const campusScope = buildCampusFilter(campusId);
        const gradeValue = String(student.grade || '').trim();
        const sectionValue = String(student.section || '').trim();

        // Find class by grade if available
        let classDoc = null;
        if (gradeValue) {
            const classQuery = {
                schoolId,
                name: gradeValue,
                ...campusScope
            };
            classDoc = await Class.findOne(classQuery);
            if (!classDoc) {
                classDoc = await Class.findOne({
                    ...classQuery,
                    name: { $regex: `^${escapeRegex(gradeValue)}$`, $options: 'i' }
                });
            }
        }

        // Find section by name and classId if available
        let sectionDoc = null;
        if (sectionValue) {
            const sectionQuery = {
                schoolId,
                name: sectionValue,
                ...campusScope
            };
            if (classDoc?._id) {
                sectionQuery.classId = classDoc._id;
            }
            sectionDoc = await Section.findOne(sectionQuery);
            if (!sectionDoc) {
                sectionDoc = await Section.findOne({
                    ...sectionQuery,
                    name: { $regex: `^${escapeRegex(sectionValue)}$`, $options: 'i' }
                });
            }
        }

        if (!classDoc && !gradeValue) {
            return res.json([]);
        }

        // Get assignments for this class and section
        const activeYear = await getActiveAcademicYear(schoolId);
        const filter = { schoolId, status: 'active' };
        const andConditions = [];
        if (campusScope.$or) {
            andConditions.push({ $or: campusScope.$or });
        }
        if (activeYear?._id) {
            andConditions.push({ academicYearId: activeYear._id });
        }
        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        if (classDoc?._id) {
            filter.classId = classDoc._id;
        } else if (gradeValue) {
            filter.class = new RegExp(`\\b${escapeRegex(gradeValue)}\\b`, 'i');
        } else {
            return res.json([]);
        }

        const assignments = await Assignment.find(filter)
            .populate('teacherId', 'name')
            .sort({ createdAt: -1 });

        const normalizedSection = sectionValue.toLowerCase();
        const sectionIdString = sectionDoc?._id ? String(sectionDoc._id) : null;
        const scopedAssignments = assignments.filter((assignment) => {
            if (sectionIdString && assignment.sectionId) {
                return String(assignment.sectionId) === sectionIdString;
            }
            if (normalizedSection) {
                if (assignment.section) {
                    return assignment.section.trim().toLowerCase() === normalizedSection;
                }
                // If assignment has no section label (older data), keep it to avoid hiding work
                return true;
            }
            return true;
        });

        // Get student's submission status for each assignment
        const progress = await StudentProgress.findOne({ studentId, schoolId });
        const submissions = progress?.submissions || [];

        const assignmentsWithStatus = scopedAssignments.map(assignment => {
            const submission = submissions.find(
                sub => sub.assignmentId.toString() === assignment._id.toString()
            );
            return {
                ...assignment.toObject(),
                submissionStatus: submission?.status || 'not_submitted',
                submittedAt: submission?.submittedAt,
                submissionText: submission?.submissionText || '',
                attachmentUrl: submission?.attachmentUrl || '',
                score: submission?.score,
                feedback: submission?.feedback,
                submissionFormat: assignment.submissionFormat || 'text'
            };
        });

        res.json(assignmentsWithStatus);
        logStudentPortalEvent(req, {
            feature: 'assignments',
            action: 'student_assignments.fetch',
            outcome: 'success',
            statusCode: 200,
            targetType: 'student',
            targetId: studentId,
            resultCount: assignmentsWithStatus.length,
        });
    } catch (err) {
        logStudentPortalError(req, {
            feature: 'assignments',
            action: 'student_assignments.fetch',
            statusCode: 500,
            err,
            targetType: 'student',
            targetId: req.user?.id,
        });
        logger.error('Student assignments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student submits assignment
router.post("/submit", authStudent, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const { assignmentId, submissionText, attachmentUrl } = req.body || {};
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        if (!assignmentId) return res.status(400).json({ error: 'assignmentId is required' });

        const assignment = await Assignment.findOne({ _id: assignmentId, schoolId }).lean();
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
        const activeYear = await getActiveAcademicYear(schoolId);
        if (activeYear?._id && String(assignment.academicYearId || '') !== String(activeYear._id)) {
            return res.status(400).json({ error: 'This assignment does not belong to the active academic session.' });
        }
        if (assignment.status !== 'active') {
            return res.status(400).json({ error: 'This assignment is not accepting submissions right now.' });
        }

        const requiredFormat = assignment.submissionFormat || 'text';
        if (requiredFormat === 'text' && !submissionText?.trim()) {
            return res.status(400).json({ error: 'This assignment requires a written response.' });
        }
        if (requiredFormat === 'pdf' && !attachmentUrl) {
            return res.status(400).json({ error: 'This assignment requires a PDF upload.' });
        }

        let progress = await StudentProgress.findOne({ studentId: req.user.id, schoolId });
        if (!progress) {
            progress = new StudentProgress({ studentId: req.user.id, schoolId, submissions: [] });
        }

        const isLate = assignment.dueDate && new Date() > new Date(assignment.dueDate);
        const status = isLate ? 'late' : 'submitted';

        const existingIndex = progress.submissions.findIndex(
            (sub) => sub.assignmentId.toString() === String(assignmentId)
        );
        const existingSubmission = existingIndex >= 0 ? progress.submissions[existingIndex] : null;
        if (existingSubmission) {
            return res.status(400).json({ error: 'This assignment has already been submitted and cannot be edited, deleted, or resubmitted.' });
        }

        // Compute submission hash for plagiarism detection
        const submissionHash = submissionText?.trim()
            ? crypto.createHash('sha256').update(submissionText.trim()).digest('hex')
            : '';

        // Check for identical submissions from other students in same assignment
        let similarStudentIds = [];
        if (submissionHash) {
            const duplicates = await StudentProgress.find({
                schoolId,
                studentId: { $ne: req.user.id },
                'submissions.assignmentId': assignmentId,
                'submissions.submissionHash': submissionHash,
            }).select('studentId').lean();
            similarStudentIds = duplicates.map((d) => d.studentId);
        }

        const submissionData = {
            submittedAt: new Date(),
            status,
            submissionText: submissionText || '',
            attachmentUrl: attachmentUrl || '',
            submissionHash,
            similarSubmissions: similarStudentIds,
        };

        progress.submissions.push({
            assignmentId,
            ...submissionData
        });

        progress.lastUpdated = new Date();
        await progress.save();

        // Fire-and-forget AI essay grading if this is an essay assignment with a rubric
        if (assignment.isEssay && assignment.rubric && submissionText?.trim()) {
            const submissionIdx = progress.submissions.findIndex(
                (s) => String(s.assignmentId) === String(assignmentId) && s.submissionText === submissionText
            );
            (async () => {
                try {
                    const AI_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');
                    const rubricLines = assignment.rubric.split('\n').filter(Boolean);
                    const rubricArr = rubricLines.map((line, i) => ({
                        criterion: line.replace(/^\d+[.)]\s*/, '').trim() || `Criterion ${i + 1}`,
                        maxScore: Math.floor(assignment.marks / rubricLines.length),
                    }));
                    // Use dedicated rubric_grade teacher mode for per-criterion breakdown
                    const aiRes = await fetch(`${AI_URL}/generate/teacher`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mode: 'rubric_grade',
                            subject: assignment.subject || '',
                            topic: assignment.topic || assignment.title,
                            question: assignment.description || assignment.title,
                            context: `Student submission:\n${submissionText}\n\nRubric criteria:\n${
                                rubricArr.map((r) => `- ${r.criterion} (max ${r.maxScore} marks)`).join('\n')
                            }`,
                        }),
                    });
                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        const content = aiData?.content || '';
                        const jsonMatch = content.match(/\{[\s\S]*\}/);
                        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                        const totalScore = parsed?.totalScore ?? parsed?.total_score ?? null;
                        const gradingFeedback = parsed?.overallFeedback || parsed?.feedback || content;
                        const criteriaBreakdown = parsed?.criteria || [];
                        if (submissionIdx >= 0 && totalScore !== null) {
                            const freshProgress = await StudentProgress.findOne({ studentId: req.user.id, schoolId });
                            const idx = freshProgress?.submissions?.findIndex(
                                (s) => String(s.assignmentId) === String(assignmentId)
                            );
                            if (freshProgress && idx >= 0) {
                                freshProgress.submissions[idx].aiScore = Math.min(Number(totalScore), assignment.marks);
                                freshProgress.submissions[idx].aiGradingFeedback = String(gradingFeedback).slice(0, 1000);
                                freshProgress.submissions[idx].aiGradingStatus = 'done';
                                // Store per-criterion breakdown for teacher review UI
                                if (criteriaBreakdown.length) {
                                    freshProgress.submissions[idx].aiCriteriaBreakdown = criteriaBreakdown;
                                }
                                await freshProgress.save();
                            }
                        }
                    }
                } catch (aiErr) {
                    // Mark AI grading as failed so teacher knows to grade manually
                    try {
                        const failProgress = await StudentProgress.findOne({ studentId: req.user.id, schoolId });
                        const failIdx = failProgress?.submissions?.findIndex(
                            (s) => String(s.assignmentId) === String(assignmentId)
                        );
                        if (failProgress && failIdx >= 0) {
                            failProgress.submissions[failIdx].aiGradingStatus = 'failed';
                            await failProgress.save();
                        }
                    } catch (_) { /* best-effort */ }
                }
            })();
        }

        res.status(201).json({
            message: 'Assignment submitted',
            status,
            submittedAt: submissionData.submittedAt,
            submissionText: submissionData.submissionText,
            attachmentUrl: submissionData.attachmentUrl,
        });
        logStudentPortalEvent(req, {
            feature: 'assignments',
            action: 'assignment_submit.create',
            outcome: 'success',
            statusCode: 201,
            targetType: 'assignment',
            targetId: assignmentId,
            studentId: req.user?.id,
            submissionStatus: status,
            hasAttachment: Boolean(attachmentUrl),
        });
    } catch (err) {
        logStudentPortalError(req, {
            feature: 'assignments',
            action: 'assignment_submit.create',
            statusCode: 400,
            err,
            targetType: 'assignment',
            targetId: req.body?.assignmentId,
            studentId: req.user?.id,
        });
        res.status(400).json({ error: err.message });
    }
});

// Teacher views submissions for THEIR assignments only (used by evaluation page)
router.get("/teacher/submissions", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.teacher?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

        const teacherId = req.teacher?.id || req.user?.id;
        if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });

        const activeYear = await getActiveAcademicYear(schoolId);
        const assignmentFilter = { schoolId, teacherId };
        if (activeYear?._id) {
            assignmentFilter.academicYearId = activeYear._id;
        }

        // Find all assignments created by this teacher
        const teacherAssignments = await Assignment.find(assignmentFilter)
            .populate('classId', 'name')
            .populate('sectionId', 'name')
            .lean();

        if (!teacherAssignments.length) return res.json([]);

        const assignmentIds = teacherAssignments.map(a => a._id);
        const assignmentMap = {};
        teacherAssignments.forEach(a => { assignmentMap[String(a._id)] = a; });

        // Find all StudentProgress docs that have a submission for one of these assignments
        const progressDocs = await StudentProgress.find({
            schoolId,
            'submissions.assignmentId': { $in: assignmentIds }
        })
        .populate('studentId', 'name grade section roll')
        .lean();

        // Flatten to one row per submission
        const rows = [];
        progressDocs.forEach(doc => {
            (doc.submissions || []).forEach(sub => {
                const aIdStr = String(sub.assignmentId);
                const assignment = assignmentMap[aIdStr];
                if (!assignment) return; // not this teacher's assignment
                rows.push({
                    submissionId: sub._id,
                    studentId: doc.studentId?._id,
                    studentName: doc.studentId?.name,
                    grade: doc.studentId?.grade,
                    section: doc.studentId?.section,
                    assignmentId: assignment._id,
                    assignmentTitle: assignment.title,
                    subject: assignment.subject,
                    totalMarks: assignment.marks,
                    className: assignment.classId?.name || assignment.class,
                    sectionName: assignment.sectionId?.name,
                    submittedAt: sub.submittedAt,
                    submissionText: sub.submissionText || '',
                    attachmentUrl: sub.attachmentUrl || '',
                    status: sub.status,          // submitted | graded | late
                    score: sub.score ?? null,
                    feedback: sub.feedback || '',
                    dueDate: assignment.dueDate
                });
            });
        });

        // Sort: ungraded first, then by submission time
        rows.sort((a, b) => {
            if ((a.score === null) !== (b.score === null)) return a.score === null ? -1 : 1;
            return new Date(b.submittedAt) - new Date(a.submittedAt);
        });

        res.json(rows);
    } catch (err) {
        logger.error('Error in teacher/submissions:', err);
        res.status(500).json({ error: err.message });
    }
});

// List submissions (admin/teacher)
router.get("/submissions", authTeacher, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const { assignmentId, studentId } = req.query || {};

        const filter = { schoolId };
        if (studentId) {
            filter.studentId = studentId;
        } else if (req.campusId) {
            const campusStudents = await StudentUser.find({ schoolId, campusId: req.campusId })
                .select('_id')
                .lean();
            const campusIds = campusStudents.map((student) => student._id);
            filter.studentId = { $in: campusIds };
        }

        const progressDocs = await StudentProgress.find(filter)
            .populate('studentId', 'name grade section roll')
            .populate('submissions.assignmentId', 'title subject dueDate marks')
            .lean();

        const items = progressDocs.map((doc) => {
            let submissions = doc.submissions || [];
            if (assignmentId) {
                submissions = submissions.filter(
                    (sub) => String(sub.assignmentId?._id || sub.assignmentId) === String(assignmentId)
                );
            }
            return {
                student: doc.studentId,
                submissions,
            };
        }).filter((item) => item.submissions.length > 0);

        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Student fetch own submissions — only returns graded+published entries so
// students cannot see AI-generated marks before teacher review
router.get("/my-submissions", authStudent, async (req, res) => {
  // #swagger.tags = ['Assignments']
    try {
        const schoolId = req.schoolId || req.user?.schoolId || null;
        if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
        const progress = await StudentProgress.findOne({ studentId: req.user.id, schoolId })
            .populate('submissions.assignmentId', 'title subject dueDate marks')
            .lean();
        const all = progress?.submissions || [];
        // Only expose score/feedback after teacher has explicitly published
        const submissions = all.map((sub) => {
            const published = sub.publishedByTeacher === true;
            return {
                _id: sub._id,
                assignmentId: sub.assignmentId,
                submittedAt: sub.submittedAt,
                status: sub.status,
                submissionText: sub.submissionText,
                attachmentUrl: sub.attachmentUrl,
                // score and feedback only visible after teacher publishes
                score: published ? sub.score : undefined,
                feedback: published ? sub.feedback : undefined,
                publishedByTeacher: published,
                publishedAt: published ? sub.publishedAt : undefined,
            };
        });
        res.json(submissions);
        logStudentPortalEvent(req, {
            feature: 'assignments',
            action: 'my_submissions.fetch',
            outcome: 'success',
            statusCode: 200,
            targetType: 'student',
            targetId: req.user?.id,
            resultCount: submissions.length,
        });
    } catch (err) {
        logStudentPortalError(req, {
            feature: 'assignments',
            action: 'my_submissions.fetch',
            statusCode: 500,
            err,
            targetType: 'student',
            targetId: req.user?.id,
        });
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
