const express = require('express');
const router = express.Router();
const AlcovePost = require('../models/AlcovePost');
const AlcoveComment = require('../models/AlcoveComment');
const AlcoveSubmission = require('../models/AlcoveSubmission');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const teacherAuth = require('../middleware/authTeacher');
const authAnyUser = require('../middleware/authAnyUser');
const authStudent = require('../middleware/authStudent');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.user?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  return schoolId;
};

const normalizeUserType = (value) => String(value || '').toLowerCase();
const buildActorKey = (req) => `${normalizeUserType(req.userType || req.user?.userType || req.user?.type) || 'user'}:${String(req.user?.id || '')}`;

const resolveAuthorName = async (req, fallback = 'Anonymous') => {
  const userId = req.user?.id;
  if (!userId) return fallback;

  const userType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
  if (userType === 'student') {
    const student = await StudentUser.findById(userId).select('name username studentCode').lean();
    return (student?.name || student?.username || student?.studentCode || fallback).trim();
  }
  if (userType === 'teacher') {
    const teacher = await TeacherUser.findById(userId).select('name username employeeCode').lean();
    return (teacher?.name || teacher?.username || teacher?.employeeCode || fallback).trim();
  }
  return String(req.user?.username || fallback).trim();
};

const resolveViewerProfiles = async (viewerKeys = []) => {
  const studentIds = [];
  const teacherIds = [];
  const parentIds = [];

  viewerKeys.forEach((raw) => {
    const [type, id] = String(raw || '').split(':');
    if (!id) return;
    const normalizedType = normalizeUserType(type);
    if (normalizedType === 'student') studentIds.push(id);
    else if (normalizedType === 'teacher') teacherIds.push(id);
    else if (normalizedType === 'parent') parentIds.push(id);
  });

  const [students, teachers, parents] = await Promise.all([
    studentIds.length ? StudentUser.find({ _id: { $in: studentIds } }).select('_id name username').lean() : [],
    teacherIds.length ? TeacherUser.find({ _id: { $in: teacherIds } }).select('_id name username employeeCode').lean() : [],
    parentIds.length ? ParentUser.find({ _id: { $in: parentIds } }).select('_id name username').lean() : [],
  ]);

  const studentMap = new Map(students.map((item) => [String(item._id), item]));
  const teacherMap = new Map(teachers.map((item) => [String(item._id), item]));
  const parentMap = new Map(parents.map((item) => [String(item._id), item]));

  return viewerKeys
    .map((raw) => {
      const [type, id] = String(raw || '').split(':');
      if (!id) return null;
      const normalizedType = normalizeUserType(type);
      if (normalizedType === 'student') {
        const student = studentMap.get(id);
        return {
          id,
          userType: 'student',
          name: student?.name || student?.username || 'Student',
        };
      }
      if (normalizedType === 'teacher') {
        const teacher = teacherMap.get(id);
        return {
          id,
          userType: 'teacher',
          name: teacher?.name || teacher?.username || teacher?.employeeCode || 'Teacher',
        };
      }
      if (normalizedType === 'parent') {
        const parent = parentMap.get(id);
        return {
          id,
          userType: 'parent',
          name: parent?.name || parent?.username || 'Parent',
        };
      }
      return {
        id,
        userType: normalizedType || 'user',
        name: 'User',
      };
    })
    .filter(Boolean);
};

// Create a new post (Teacher only)
router.post('/posts', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { title, subject, chapter, difficulty = 'medium', problemText, solutionText, tags = [], highlighted = false } = req.body;
    const teacherName = await resolveAuthorName(req, 'Teacher');
    const post = await AlcovePost.create({
      schoolId,
      title,
      subject,
      chapter,
      difficulty,
      problemText,
      solutionText: solutionText || '',
      tags,
      highlighted,
      author: req.user?.id || undefined,
      authorUserId: String(req.user?.id || ''),
      authorType: 'teacher',
      authorName: teacherName || 'Teacher',
      isStudentPosted: false,
    });
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create a new post (Student problem upload)
router.post('/posts/student', authStudent, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { title, subject, chapter, difficulty = 'medium', problemText, tags = [] } = req.body;
    if (!title || !subject || !chapter || !problemText) {
      return res.status(400).json({ error: 'title, subject, chapter and problemText are required' });
    }
    const student = await StudentUser.findById(req.user?.id).select('name username grade section').lean();
    const studentName = (student?.name || student?.username || await resolveAuthorName(req, 'Student') || 'Student').trim();
    const post = await AlcovePost.create({
      schoolId,
      title: String(title).trim(),
      subject: String(subject).trim(),
      chapter: String(chapter).trim(),
      difficulty,
      problemText: String(problemText).trim(),
      solutionText: '',
      tags: Array.isArray(tags) ? tags : [],
      highlighted: false,
      authorUserId: String(req.user?.id || ''),
      authorType: 'student',
      authorName: studentName || 'Student',
      authorGrade: String(student?.grade || ''),
      authorSection: String(student?.section || ''),
      isStudentPosted: true,
    });
    res.status(201).json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List posts with filters/search/pagination
router.get('/posts', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'posts.fetch',
      targetType: 'student',
      targetId: req.user?.id,
      page: Number(req.query?.page || 1),
      limit: Number(req.query?.limit || 20),
    });
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { subject, chapter, difficulty, q, mine, page = 1, limit = 20 } = req.query;
    const filter = { schoolId };
    if (subject) filter.subject = subject;
    if (chapter) filter.chapter = chapter;
    if (difficulty) filter.difficulty = difficulty;
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { title: regex },
        { problemText: regex },
        { solutionText: regex },
        { tags: regex },
        { chapter: regex },
        { subject: regex },
      ];
    }
    if (String(mine || '').toLowerCase() === 'true') {
      const currentUserType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
      if (currentUserType === 'teacher') {
        filter.author = req.user?.id;
      } else {
        filter.authorUserId = String(req.user?.id || '');
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
      AlcovePost.find(filter)
        .populate('author', 'name username employeeCode')
        .sort({ highlighted: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AlcovePost.countDocuments(filter),
    ]);
    const actorKey = buildActorKey(req);
    const currentUserType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
    const answeredPostIds = currentUserType === 'student' && posts.length
      ? new Set(
          (await AlcoveSubmission.find({
            studentId: req.user?.id,
            postId: { $in: posts.map((post) => post._id) },
          }).select('postId').lean()).map((sub) => String(sub.postId))
        )
      : new Set();
    const stats = await Promise.all(
      posts.map(async (post) => {
        const [commentCount, submissionCount] = await Promise.all([
          AlcoveComment.countDocuments({ post: post._id, schoolId }),
          AlcoveSubmission.countDocuments({ postId: post._id, schoolId }),
        ]);
        return {
          postId: String(post._id),
          commentCount,
          submissionCount,
        };
      })
    );
    const statsByPostId = new Map(stats.map((entry) => [entry.postId, entry]));
    const items = posts.map((post) => {
      const stat = statsByPostId.get(String(post._id)) || { commentCount: 0, submissionCount: 0 };
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
      return {
        ...post,
        authorName:
          post?.authorName
          || post?.author?.name
          || post?.author?.username
          || post?.author?.employeeCode
          || 'Teacher',
        authorType: post?.authorType || 'teacher',
        isStudentPosted: Boolean(post?.isStudentPosted),
        commentCount: stat.commentCount,
        submissionCount: stat.submissionCount,
        likeCount: likedBy.length,
        isLiked: likedBy.includes(actorKey),
        viewCount: Number(post.viewCount) || 0,
        hasAnswered: currentUserType === 'student' ? answeredPostIds.has(String(post._id)) : undefined,
      };
    });
    res.json({ items, total, page: Number(page), limit: Number(limit) });
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'posts.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      resultCount: Array.isArray(items) ? items.length : 0,
      total,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'posts.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Get single post
router.get('/posts/:id', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId })
      .populate('author', 'name username employeeCode')
      .lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    const [commentCount, submissionCount] = await Promise.all([
      AlcoveComment.countDocuments({ post: req.params.id, schoolId }),
      AlcoveSubmission.countDocuments({ postId: req.params.id, schoolId }),
    ]);
    const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
    const actorKey = buildActorKey(req);
    res.json({
      ...post,
      authorName:
        post?.authorName
        || post?.author?.name
        || post?.author?.username
        || post?.author?.employeeCode
        || 'Teacher',
      authorType: post?.authorType || 'teacher',
      isStudentPosted: Boolean(post?.isStudentPosted),
      commentCount,
      submissionCount,
      likeCount: likedBy.length,
      isLiked: likedBy.includes(actorKey),
      viewCount: Number(post.viewCount) || 0,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Track a post view (any authenticated user)
router.post('/posts/:id/view', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId });
    if (!post) return res.status(404).json({ error: 'Not found' });

    const actorKey = buildActorKey(req);
    const viewedBy = Array.isArray(post.viewedBy) ? post.viewedBy : [];
    let changed = false;
    if (!viewedBy.includes(actorKey)) {
      viewedBy.push(actorKey);
      post.viewedBy = viewedBy;
      post.viewCount = viewedBy.length;
      changed = true;
    }
    if (changed) await post.save();

    res.json({ viewCount: Number(post.viewCount) || 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get viewers for a post (any authenticated user)
router.get('/posts/:id/viewers', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId }).lean();
    if (!post) return res.status(404).json({ error: 'Not found' });

    const viewedBy = Array.isArray(post.viewedBy) ? post.viewedBy : [];
    const viewers = await resolveViewerProfiles(viewedBy);
    res.json({
      count: viewers.length,
      viewers,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle like for a post (any authenticated user)
router.post('/posts/:id/like', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId });
    if (!post) return res.status(404).json({ error: 'Not found' });

    const actorKey = buildActorKey(req);
    const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
    const existingIndex = likedBy.indexOf(actorKey);
    let liked = false;

    if (existingIndex >= 0) {
      likedBy.splice(existingIndex, 1);
      liked = false;
    } else {
      likedBy.push(actorKey);
      liked = true;
    }
    post.likedBy = likedBy;
    await post.save();

    res.json({
      liked,
      likeCount: likedBy.length,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a post (Teacher only; no author check here for brevity)
router.patch('/posts/:id', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const updates = req.body;
    const post = await AlcovePost.findOneAndUpdate(
      { _id: req.params.id, schoolId },
      updates,
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a post (Teacher/admin)
router.delete('/posts/:id', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOneAndDelete({ _id: req.params.id, schoolId });
    if (!post) return res.status(404).json({ error: 'Not found' });
    await AlcoveComment.deleteMany({ post: req.params.id, schoolId });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Comments: list
router.get('/posts/:id/comments', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const items = await AlcoveComment.find({ post: req.params.id, schoolId }).sort({ createdAt: 1 }).lean();

    const missingStudentMetaIds = [...new Set(
      items
        .filter((comment) => (
          String(comment?.authorType || '').toLowerCase() === 'student'
          && comment?.authorId
          && (!comment?.authorGrade || !comment?.authorSection)
        ))
        .map((comment) => String(comment.authorId))
    )];

    const students = missingStudentMetaIds.length
      ? await StudentUser.find({ _id: { $in: missingStudentMetaIds } }).select('_id grade section').lean()
      : [];
    const studentMeta = new Map(students.map((student) => [String(student._id), student]));

    const enrichedItems = items.map((comment) => {
      if (String(comment?.authorType || '').toLowerCase() !== 'student') return comment;
      if (comment?.authorGrade && comment?.authorSection) return comment;
      const profile = studentMeta.get(String(comment.authorId));
      if (!profile) return comment;
      return {
        ...comment,
        authorGrade: String(comment.authorGrade || profile.grade || ''),
        authorSection: String(comment.authorSection || profile.section || ''),
      };
    });

    res.json(enrichedItems);
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'comments.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'alcove_post',
      targetId: req.params.id,
      resultCount: Array.isArray(enrichedItems) ? enrichedItems.length : 0,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'comments.fetch',
      statusCode: 400,
      err,
      targetType: 'alcove_post',
      targetId: req.params.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Comments: create (any logged-in user)
router.post('/posts/:id/comments', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { text, authorName } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    const resolvedAuthorName = authorName?.trim() || await resolveAuthorName(req);
    const isStudentAuthor = String(req.userType || '').toLowerCase() === 'student';
    const studentMeta = isStudentAuthor
      ? await StudentUser.findById(req.user?.id).select('grade section').lean()
      : null;
    const comment = await AlcoveComment.create({
      schoolId,
      post: req.params.id,
      text: text.trim(),
      authorId: req.user?.id || undefined,
      authorType: req.userType || 'unknown',
      authorName: resolvedAuthorName || 'Anonymous',
      authorGrade: String(studentMeta?.grade || ''),
      authorSection: String(studentMeta?.section || ''),
    });
    res.status(201).json(comment);
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'comment.create',
      outcome: 'success',
      statusCode: 201,
      targetType: 'alcove_comment',
      targetId: comment._id,
      postId: req.params.id,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'comment.create',
      statusCode: 400,
      err,
      targetType: 'alcove_post',
      targetId: req.params.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Comments: delete (author or admin/teacher)
router.delete('/posts/:id/comments/:commentId', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const comment = await AlcoveComment.findOne({ _id: req.params.commentId, schoolId, post: req.params.id });
    if (!comment) return res.status(404).json({ error: 'Not found' });

    const isAdmin = req.userType === 'Admin';
    const isTeacher = req.userType === 'teacher';
    const isAuthor = comment.authorId && req.user?.id && comment.authorId === req.user.id;
    if (!isAdmin && !isTeacher && !isAuthor) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await comment.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Submissions: submit answer (Student only)
router.post('/posts/:postId/submissions', authStudent, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const { postId } = req.params;
    const { answerText } = req.body;
    const studentId = req.user.id;
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    // Validate answer text
    if (!answerText || !answerText.trim()) {
      return res.status(400).json({ error: 'Answer text is required' });
    }

    // Verify post exists and belongs to same school
    const post = await AlcovePost.findOne({ _id: postId, schoolId });
    if (!post) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Get student details
    const student = await StudentUser.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Create or update submission (upsert pattern)
    const submission = await AlcoveSubmission.findOneAndUpdate(
      { postId, studentId },
      {
        answerText: answerText.trim(),
        studentName: student.name,
        grade: student.grade,
        section: student.section,
        schoolId,
        submittedAt: new Date()
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    res.status(201).json({
      message: 'Answer submitted successfully',
      submission
    });
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'submission.create',
      outcome: 'success',
      statusCode: 201,
      targetType: 'alcove_submission',
      targetId: submission._id,
      postId,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'submission.create',
      statusCode: 400,
      err,
      targetType: 'alcove_post',
      targetId: req.params.postId,
    });
    if (err.code === 11000) {
      // Duplicate key error (shouldn't happen with findOneAndUpdate)
      res.status(400).json({ error: 'You have already submitted an answer' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// Submissions: get all submissions for a post (Any authenticated user)
router.get('/posts/:postId/submissions', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const { postId } = req.params;
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    // Verify post exists
    const post = await AlcovePost.findOne({ _id: postId, schoolId });
    if (!post) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Fetch all submissions for this post (public visibility)
    const submissions = await AlcoveSubmission.find({
      postId,
      schoolId
    })
    .sort({ submittedAt: -1 })  // Most recent first
    .select('studentId studentName answerText submittedAt grade section')
    .lean();

    res.json(submissions);
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'submissions.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'alcove_post',
      targetId: postId,
      resultCount: Array.isArray(submissions) ? submissions.length : 0,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'submissions.fetch',
      statusCode: 400,
      err,
      targetType: 'alcove_post',
      targetId: req.params.postId,
    });
    res.status(400).json({ error: err.message });
  }
});

// Submissions: get student's own submission for a post (Student only)
router.get('/posts/:postId/my-submission', authStudent, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const { postId } = req.params;
    const studentId = req.user.id;
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    const submission = await AlcoveSubmission.findOne({
      postId,
      studentId,
      schoolId
    });

    res.json(submission || null);
    logStudentPortalEvent(req, {
      feature: 'academic_alcove',
      action: 'my_submission.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'alcove_post',
      targetId: postId,
      hasSubmission: Boolean(submission),
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'academic_alcove',
      action: 'my_submission.fetch',
      statusCode: 400,
      err,
      targetType: 'alcove_post',
      targetId: req.params.postId,
    });
    res.status(400).json({ error: err.message });
  }
});

// Submissions: teacher view all submissions for their posts (Teacher only)
router.get('/teacher/submissions', teacherAuth, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const teacherId = req.teacher?.id || req.user?.id;
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;

    // Get all posts created by this teacher
    const posts = await AlcovePost.find({
      author: teacherId,
      schoolId
    }).select('_id title subject');

    const postIds = posts.map(p => p._id);

    // Get all submissions for these posts
    const submissions = await AlcoveSubmission.find({
      postId: { $in: postIds },
      schoolId
    })
    .populate('postId', 'title subject')
    .sort({ submittedAt: -1 })
    .lean();

    res.json(submissions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
