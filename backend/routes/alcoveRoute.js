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
const multer = require('multer');
const { uploadBufferToCloudinary } = require('../utils/cloudinaryUpload');

const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const POST_IMAGE_MAX_COUNT = 4;
const POST_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const postImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: POST_IMAGE_MAX_BYTES, files: POST_IMAGE_MAX_COUNT },
  fileFilter: (_req, file, cb) => {
    if (POST_IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'images'));
  },
}).array('images', POST_IMAGE_MAX_COUNT);

// Multer only engages on multipart requests, so JSON posts pass straight through.
const withPostImages = (req, res, next) => postImageUpload(req, res, (err) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Each photo must be 5MB or smaller.' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: `You can attach up to ${POST_IMAGE_MAX_COUNT} photos.` });
    return res.status(400).json({ error: 'Photos must be JPG, PNG, WebP or GIF.' });
  }
  return next(err);
});

// Multipart fields arrive as strings; JSON bodies arrive already parsed.
const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const normalizePoll = (rawPoll) => {
  const poll = parseJsonField(rawPoll, null);
  if (!poll || typeof poll !== 'object') return undefined;
  const question = String(poll.question || '').trim();
  const options = (Array.isArray(poll.options) ? poll.options : [])
    .map((option) => String(typeof option === 'string' ? option : option?.text || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!question || options.length < 2) return undefined;
  return { question, options: options.map((text) => ({ text, votes: [] })) };
};

const serializePoll = (poll, actorKey) => {
  if (!poll?.question || !Array.isArray(poll.options) || poll.options.length === 0) return null;
  let myVote = -1;
  const options = poll.options.map((option, index) => {
    const votes = Array.isArray(option.votes) ? option.votes : [];
    if (votes.includes(actorKey)) myVote = index;
    return { text: option.text, voteCount: votes.length };
  });
  return {
    question: poll.question,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
    myVote,
    isClosed: isPollClosed(poll),
    closesAt: poll.closesAt || null,
  };
};

function isPollClosed(poll) {
  return Boolean(poll?.closed) || Boolean(poll?.closesAt && new Date(poll.closesAt) <= new Date());
}

const isPostAuthor = (req, post) => {
  const authorRef = postAuthorRef(post);
  const currentType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
  return authorRef.type === currentType && authorRef.id === String(req.user?.id || '');
};

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

// refs: [{ type: 'student' | 'teacher', id }] → Map(`${type}:${id}` → profilePic)
const resolveProfilePics = async (refs = []) => {
  const idsByType = { student: new Set(), teacher: new Set() };
  refs.forEach(({ type, id }) => {
    const normalizedType = normalizeUserType(type);
    if (id && idsByType[normalizedType]) idsByType[normalizedType].add(String(id));
  });
  const [students, teachers] = await Promise.all([
    idsByType.student.size ? StudentUser.find({ _id: { $in: [...idsByType.student] } }).select('_id profilePic').lean() : [],
    idsByType.teacher.size ? TeacherUser.find({ _id: { $in: [...idsByType.teacher] } }).select('_id profilePic').lean() : [],
  ]);
  const pics = new Map();
  students.forEach((item) => { if (item.profilePic) pics.set(`student:${item._id}`, item.profilePic); });
  teachers.forEach((item) => { if (item.profilePic) pics.set(`teacher:${item._id}`, item.profilePic); });
  return pics;
};

const postAuthorRef = (post) => {
  const type = normalizeUserType(post?.authorType || 'teacher');
  const id = type === 'teacher' ? (post?.author?._id || post?.author || post?.authorUserId) : post?.authorUserId;
  return { type, id: id ? String(id) : '' };
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
router.post('/posts', teacherAuth, withPostImages, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { title, subject, chapter, difficulty = 'medium', problemText = '', solutionText, highlighted = false } = req.body;
    const tags = (parseJsonField(req.body.tags, []) || []).map((tag) => String(tag).trim()).filter(Boolean);
    const poll = normalizePoll(req.body.poll);
    const files = Array.isArray(req.files) ? req.files : [];
    if (!String(problemText).trim() && !files.length && !poll) {
      return res.status(400).json({ error: 'Write something, add a photo, or create a poll.' });
    }
    const images = await Promise.all(files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: 'alcove_posts',
        resource_type: 'image',
        context: { schoolId: String(schoolId) },
      });
      return { url: result?.secure_url || '', publicId: result?.public_id || '' };
    }));
    const fallbackTitle = String(problemText).trim().split('\n')[0] || poll?.question || 'Photo post';
    const teacherName = await resolveAuthorName(req, 'Teacher');
    const post = await AlcovePost.create({
      schoolId,
      title: String(title || fallbackTitle).trim().slice(0, 160),
      subject: String(subject || 'General').trim(),
      chapter: String(chapter || 'General').trim(),
      difficulty,
      problemText: String(problemText).trim(),
      solutionText: solutionText || '',
      tags,
      images: images.filter((image) => image.url),
      poll,
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
    const actorKey = buildActorKey(req);
    if (String(req.query.liked || '').toLowerCase() === 'true') filter.likedBy = actorKey;
    if (String(req.query.saved || '').toLowerCase() === 'true') filter.savedBy = actorKey;
    if (String(req.query.hasPoll || '').toLowerCase() === 'true') filter['poll.question'] = { $gt: '' };

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
    const authorPics = await resolveProfilePics(posts.map(postAuthorRef));
    const items = posts.map((post) => {
      const stat = statsByPostId.get(String(post._id)) || { commentCount: 0, submissionCount: 0 };
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
      const authorRef = postAuthorRef(post);
      return {
        ...post,
        authorPhoto: authorPics.get(`${authorRef.type}:${authorRef.id}`) || '',
        poll: serializePoll(post.poll, actorKey),
        isSaved: (Array.isArray(post.savedBy) ? post.savedBy : []).includes(actorKey),
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
      poll: serializePoll(post.poll, actorKey),
      isSaved: (Array.isArray(post.savedBy) ? post.savedBy : []).includes(actorKey),
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

// Poll vote (any logged-in user): picking the current choice again clears the vote.
router.post('/posts/:id/vote', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const optionIndex = Number(req.body?.optionIndex);
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId });
    if (!post) return res.status(404).json({ error: 'Not found' });
    const options = post.poll?.options || [];
    if (!post.poll?.question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      return res.status(400).json({ error: 'Invalid poll option' });
    }
    if (isPollClosed(post.poll)) return res.status(409).json({ error: 'This poll is closed' });
    const actorKey = buildActorKey(req);
    const hadThisVote = options[optionIndex].votes.includes(actorKey);
    options.forEach((option) => {
      option.votes = option.votes.filter((key) => key !== actorKey);
      option.voteLog = (option.voteLog || []).filter((entry) => entry.key !== actorKey);
    });
    if (!hadThisVote) {
      options[optionIndex].votes.push(actorKey);
      options[optionIndex].voteLog.push({ key: actorKey, at: new Date() });
    }
    await post.save();
    res.json({ poll: serializePoll(post.poll, actorKey) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save / unsave a post for the current user.
router.post('/posts/:id/save', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const actorKey = buildActorKey(req);
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId }).select('savedBy');
    if (!post) return res.status(404).json({ error: 'Not found' });
    const saved = !post.savedBy.includes(actorKey);
    await AlcovePost.updateOne(
      { _id: req.params.id, schoolId },
      saved ? { $addToSet: { savedBy: actorKey } } : { $pull: { savedBy: actorKey } }
    );
    res.json({ saved });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Poll voters, grouped by option. Only the post's author may see who voted.
router.get('/posts/:id/poll-voters', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId }).select('author authorUserId authorType poll').lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (!isPostAuthor(req, post)) {
      return res.status(403).json({ error: 'Only the poll author can see voters' });
    }
    const options = post.poll?.options || [];
    const keys = [...new Set(options.flatMap((option) => option.votes || []))];
    const idsByType = { student: [], teacher: [] };
    keys.forEach((key) => {
      const [type, id] = String(key).split(':');
      if (idsByType[type] && id) idsByType[type].push(id);
    });
    const [students, teachers] = await Promise.all([
      idsByType.student.length ? StudentUser.find({ _id: { $in: idsByType.student } }).select('_id name username profilePic grade section').lean() : [],
      idsByType.teacher.length ? TeacherUser.find({ _id: { $in: idsByType.teacher } }).select('_id name username employeeCode profilePic').lean() : [],
    ]);
    const profiles = new Map();
    students.forEach((s) => profiles.set(`student:${s._id}`, {
      id: String(s._id), userType: 'student', name: s.name || s.username || 'Student',
      photo: s.profilePic || '', grade: String(s.grade || ''), section: String(s.section || ''),
    }));
    teachers.forEach((t) => profiles.set(`teacher:${t._id}`, {
      id: String(t._id), userType: 'teacher', name: t.name || t.username || t.employeeCode || 'Teacher',
      photo: t.profilePic || '',
    }));
    const fallbackProfile = (key) => {
      const [type, id] = String(key).split(':');
      return { id, userType: type || 'user', name: type === 'parent' ? 'Parent' : 'User', photo: '' };
    };
    res.json({
      question: post.poll?.question || '',
      isClosed: isPollClosed(post.poll),
      closed: Boolean(post.poll?.closed),
      closesAt: post.poll?.closesAt || null,
      options: options.map((option) => {
        const votedAt = new Map((option.voteLog || []).map((entry) => [entry.key, entry.at]));
        return {
          text: option.text,
          voters: (option.votes || []).map((key) => ({
            ...(profiles.get(key) || fallbackProfile(key)),
            votedAt: votedAt.get(key) || null,
          })),
        };
      }),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Close a poll now, schedule it to close, or reopen it (author only).
// Body: { action: 'close' | 'schedule' | 'reopen', closesAt?: ISO date }
router.patch('/posts/:id/poll', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId });
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (!post.poll?.question) return res.status(400).json({ error: 'This post has no poll' });
    if (!isPostAuthor(req, post)) return res.status(403).json({ error: 'Only the poll author can change it' });

    const { action, closesAt } = req.body || {};
    if (action === 'close') {
      post.poll.closed = true;
      post.poll.closesAt = null;
    } else if (action === 'schedule') {
      const when = new Date(closesAt);
      if (Number.isNaN(when.getTime()) || when <= new Date()) {
        return res.status(400).json({ error: 'Pick a closing time in the future' });
      }
      post.poll.closed = false;
      post.poll.closesAt = when;
    } else if (action === 'reopen') {
      post.poll.closed = false;
      post.poll.closesAt = null;
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    await post.save();
    res.json({ poll: serializePoll(post.poll, buildActorKey(req)) });
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
    const authorPics = await resolveProfilePics(items.map((comment) => ({ type: comment?.authorType, id: comment?.authorId })));

    const enrichedItems = items.map((rawComment) => {
      const comment = {
        ...rawComment,
        authorPhoto: authorPics.get(`${normalizeUserType(rawComment?.authorType)}:${rawComment?.authorId}`) || '',
      };
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
    const authorPics = await resolveProfilePics([{ type: comment.authorType, id: comment.authorId }]);
    res.status(201).json({
      ...comment.toObject(),
      authorPhoto: authorPics.get(`${normalizeUserType(comment.authorType)}:${comment.authorId}`) || '',
    });
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
