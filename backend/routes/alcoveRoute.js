const express = require('express');
const router = express.Router();
const AlcovePost = require('../models/AlcovePost');
const AlcoveComment = require('../models/AlcoveComment');
const AlcoveSubmission = require('../models/AlcoveSubmission');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const Admin = require('../models/Admin');
const School = require('../models/School');
const teacherAuth = require('../middleware/authTeacher');
const authAnyUser = require('../middleware/authAnyUser');
const authStudent = require('../middleware/authStudent');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');
const ClassModel = require('../models/Class');
const SectionModel = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
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

const audienceKey = (grade, section) => `${String(grade || '').trim().toLowerCase()}|${String(section || '').trim().toLowerCase()}`;

// Resolves the requested sections against real Class/Section docs of this school,
// so names on the post always match what students carry in grade/section.
const resolveAudience = async (rawAudience, schoolId) => {
  const audience = parseJsonField(rawAudience, null);
  if (!audience || audience.type !== 'classes') return { audience: 'school', audienceClasses: [], audienceKeys: [] };
  const sectionIds = [...new Set((Array.isArray(audience.classes) ? audience.classes : [])
    .map((entry) => String(entry?.sectionId || ''))
    .filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
  if (!sectionIds.length) throw new Error('Pick at least one class to share with');
  const sections = await SectionModel.find({ _id: { $in: sectionIds }, schoolId }).select('_id name classId').lean();
  const classes = await ClassModel.find({ _id: { $in: sections.map((s) => s.classId) }, schoolId }).select('_id name').lean();
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const audienceClasses = sections
    .filter((s) => classById.has(String(s.classId)))
    .map((s) => ({ classId: s.classId, sectionId: s._id, grade: classById.get(String(s.classId)).name, section: s.name }));
  if (!audienceClasses.length) throw new Error('Selected classes were not found');
  return {
    audience: 'classes',
    audienceClasses,
    audienceKeys: audienceClasses.map((entry) => audienceKey(entry.grade, entry.section)),
  };
};

// Teachers and admins see everything; students see school-wide posts plus posts for their own
// class-section; parents see school-wide posts plus posts for their children's class-sections.
const buildAudienceFilter = async (req) => {
  const userType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
  const meId = String(req.user?.id || '');
  const notRemovedOrMine = {
    $or: [
      { 'removal.at': null },
      { authorUserId: meId, authorType: userType },
      ...(userType === 'teacher' && /^[a-f0-9]{24}$/i.test(meId) ? [{ author: meId }] : []),
    ],
  };
  if (userType === 'teacher' || userType === 'admin') return notRemovedOrMine;
  const visible = [{ audience: { $ne: 'classes' } }];
  if (userType === 'student') {
    const student = await StudentUser.findById(req.user?.id).select('grade section').lean();
    if (student?.grade) visible.push({ audienceKeys: audienceKey(student.grade, student.section) });
  }
  if (userType === 'parent') {
    const parent = await ParentUser.findById(req.user?.id).select('childrenIds').lean();
    const childIds = Array.isArray(parent?.childrenIds) ? parent.childrenIds : [];
    if (childIds.length) {
      const children = await StudentUser.find({ _id: { $in: childIds } }).select('grade section').lean();
      const keys = children.filter((child) => child.grade).map((child) => audienceKey(child.grade, child.section));
      if (keys.length) visible.push({ audienceKeys: { $in: keys } });
    }
  }
  return { $and: [{ $or: visible }, notRemovedOrMine] };
};

// keys: actor keys (`<userType>:<id>`) → Map(key → { id, userType, name, photo, grade?, section? })
const loadUserProfiles = async (keys = []) => {
  const idsByType = { student: new Set(), teacher: new Set(), parent: new Set(), admin: new Set() };
  keys.forEach((key) => {
    const [type, id] = String(key || '').split(':');
    const normalizedType = normalizeUserType(type);
    if (idsByType[normalizedType] && /^[a-f0-9]{24}$/i.test(String(id || ''))) idsByType[normalizedType].add(id);
  });
  const find = (Model, ids, fields) => (ids.size ? Model.find({ _id: { $in: [...ids] } }).select(fields).lean() : []);
  const [students, teachers, parents, admins] = await Promise.all([
    find(StudentUser, idsByType.student, '_id name username profilePic grade section'),
    find(TeacherUser, idsByType.teacher, '_id name username employeeCode profilePic'),
    find(ParentUser, idsByType.parent, '_id name username'),
    find(Admin, idsByType.admin, '_id name username avatar schoolId'),
  ]);
  const profiles = new Map();
  students.forEach((u) => profiles.set(`student:${u._id}`, {
    id: String(u._id), userType: 'student', name: u.name || u.username || 'Student',
    photo: u.profilePic || '', grade: String(u.grade || ''), section: String(u.section || ''),
  }));
  teachers.forEach((u) => profiles.set(`teacher:${u._id}`, {
    id: String(u._id), userType: 'teacher', name: u.name || u.username || u.employeeCode || 'Teacher', photo: u.profilePic || '',
  }));
  parents.forEach((u) => profiles.set(`parent:${u._id}`, {
    id: String(u._id), userType: 'parent', name: u.name || u.username || 'Parent', photo: '',
  }));
  // School admins post on behalf of the school, so they show the school logo.
  const schoolIds = [...new Set(admins.map((u) => String(u.schoolId || '')).filter(Boolean))];
  const schools = schoolIds.length ? await School.find({ _id: { $in: schoolIds } }).select('_id logo').lean() : [];
  const logoBySchool = new Map(schools.map((school) => [String(school._id), school.logo?.secure_url || '']));
  admins.forEach((u) => profiles.set(`admin:${u._id}`, {
    id: String(u._id), userType: 'admin', name: u.name || u.username || 'School Admin',
    photo: logoBySchool.get(String(u.schoolId || '')) || u.avatar || '',
  }));
  return profiles;
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
  if (userType === 'parent' || userType === 'admin') {
    const profile = (await loadUserProfiles([`${userType}:${userId}`])).get(`${userType}:${userId}`);
    if (profile?.name) return profile.name.trim();
  }
  return String(req.user?.username || fallback).trim();
};

// refs: [{ type, id }] → Map(`${type}:${id}` → photo URL)
const resolveProfilePics = async (refs = []) => {
  const profiles = await loadUserProfiles(refs.map(({ type, id }) => `${normalizeUserType(type)}:${id}`));
  const pics = new Map();
  profiles.forEach((profile, key) => { if (profile.photo) pics.set(key, profile.photo); });
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

// Create a new post (any signed-in user; only teachers and admins may limit the audience to classes)
router.post('/posts', authAnyUser, withPostImages, async (req, res) => {
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
    const authorType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
    if (!['teacher', 'admin', 'student', 'parent'].includes(authorType)) {
      return res.status(403).json({ error: 'Your account cannot post here' });
    }
    let audienceFields;
    try {
      audienceFields = authorType === 'teacher' || authorType === 'admin'
        ? await resolveAudience(req.body.audience, schoolId)
        : await resolveAudience(null, schoolId);
    } catch (audienceErr) {
      return res.status(400).json({ error: audienceErr.message });
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
    const authorName = await resolveAuthorName(req, authorType === 'admin' ? 'School Admin' : 'User');
    const studentMeta = authorType === 'student'
      ? await StudentUser.findById(req.user?.id).select('grade section').lean()
      : null;
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
      ...audienceFields,
      highlighted,
      author: authorType === 'teacher' ? (req.user?.id || undefined) : undefined,
      authorUserId: String(req.user?.id || ''),
      authorType,
      authorName: authorName || 'User',
      authorGrade: String(studentMeta?.grade || ''),
      authorSection: String(studentMeta?.section || ''),
      isStudentPosted: authorType === 'student',
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

// Class-sections an admin can target: the active academic year's classes
// (or every class when no year is marked active).
router.get('/audience-classes', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    if (normalizeUserType(req.userType || req.user?.userType || req.user?.type) !== 'admin') {
      return res.status(403).json({ error: 'Admins only' });
    }
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const activeYear = await AcademicYear.findOne({ schoolId, isActive: true }).select('_id').lean();
    const classFilter = { schoolId };
    if (activeYear) classFilter.$or = [{ academicYearId: activeYear._id }, { academicYearId: null }, { academicYearId: { $exists: false } }];
    const classes = await ClassModel.find(classFilter).select('_id name order').sort({ order: 1, name: 1 }).lean();
    const sections = classes.length
      ? await SectionModel.find({ schoolId, classId: { $in: classes.map((c) => c._id) } }).select('_id name classId').sort({ name: 1 }).lean()
      : [];
    const classById = new Map(classes.map((c) => [String(c._id), c]));
    res.json(sections.map((section) => ({
      classId: String(section.classId),
      sectionId: String(section._id),
      className: classById.get(String(section.classId))?.name || '',
      sectionName: section.name,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Current user's wall identity (any role)
router.get('/me', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const userType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
    const id = String(req.user?.id || '');
    const profile = (await loadUserProfiles([`${userType}:${id}`])).get(`${userType}:${id}`);
    res.json({
      id,
      userType,
      name: profile?.name || req.user?.name || req.user?.username || 'User',
      photo: profile?.photo || '',
      grade: profile?.grade || '',
      section: profile?.section || '',
    });
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
        if (currentUserType === 'admin' || currentUserType === 'parent') filter.authorType = currentUserType;
      }
    }
    const actorKey = buildActorKey(req);
    if (String(req.query.liked || '').toLowerCase() === 'true') filter.likedBy = actorKey;
    if (String(req.query.saved || '').toLowerCase() === 'true') filter.savedBy = actorKey;
    if (String(req.query.hasPoll || '').toLowerCase() === 'true') filter['poll.question'] = { $gt: '' };
    const audienceFilter = await buildAudienceFilter(req);
    if (audienceFilter) filter.$and = [...(filter.$and || []), audienceFilter];
    // Posts removed by an admin only appear in their author's own list (My Contributions).
    if (String(mine || '').toLowerCase() !== 'true') filter['removal.at'] = null;

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
        isSaved: (Array.isArray(post.savedBy) ? post.savedBy : []).includes(actorKey), saveCount: Array.isArray(post.savedBy) ? post.savedBy.length : 0,
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
    const audienceFilter = await buildAudienceFilter(req);
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId, ...(audienceFilter || {}) })
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
      isSaved: (Array.isArray(post.savedBy) ? post.savedBy : []).includes(actorKey), saveCount: Array.isArray(post.savedBy) ? post.savedBy.length : 0,
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

// People who liked a post, with name, photo and role (students also carry class/section).
router.get('/posts/:id/likers', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const audienceFilter = await buildAudienceFilter(req);
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId, ...(audienceFilter || {}) }).select('likedBy').lean();
    if (!post) return res.status(404).json({ error: 'Not found' });
    const keys = Array.isArray(post.likedBy) ? post.likedBy : [];
    const profiles = await loadUserProfiles(keys);
    // Newest likes first; likedBy is appended to in order.
    const likers = [...keys].reverse().map((key) => {
      const [type, id] = String(key).split(':');
      return profiles.get(key) || { id, userType: type || 'user', name: type === 'parent' ? 'Parent' : 'User', photo: '' };
    });
    res.json({ likers });
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
    res.json({ saved, saveCount: Math.max(0, post.savedBy.length + (saved ? 1 : -1)) });
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
    const profiles = await loadUserProfiles(keys);
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

// Delete a post: its author, or a school admin (moderation)
router.delete('/posts/:id', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Alcove']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const existing = await AlcovePost.findOne({ _id: req.params.id, schoolId }).select('author authorUserId authorType').lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const isAdmin = normalizeUserType(req.userType || req.user?.userType || req.user?.type) === 'admin';
    const isAuthor = isPostAuthor(req, existing);
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    if (isAdmin && !isAuthor) {
      // Moderation: wipe everything about the post but keep a stub so its author learns why.
      const remarks = String(req.body?.remarks || '').trim().slice(0, 1000);
      if (!remarks) return res.status(400).json({ error: 'Please add remarks for the author' });
      await AlcovePost.updateOne({ _id: req.params.id, schoolId }, {
        $set: {
          removal: {
            at: new Date(),
            byUserId: String(req.user?.id || ''),
            byName: await resolveAuthorName(req, 'School Admin'),
            remarks,
          },
          problemText: '', solutionText: '', tags: [], images: [],
          likedBy: [], savedBy: [], viewedBy: [], viewCount: 0,
        },
        $unset: { poll: 1 },
      });
      await AlcoveComment.deleteMany({ post: req.params.id, schoolId });
      return res.json({ ok: true, removed: true });
    }
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
    const { text, authorName, parentId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    let parentComment = null;
    if (parentId) {
      const parent = await AlcoveComment.findOne({ _id: parentId, post: req.params.id, schoolId }).select('_id parentComment').lean();
      if (!parent) return res.status(404).json({ error: 'The comment you replied to no longer exists' });
      // Replying to a reply attaches to the same thread.
      parentComment = parent.parentComment || parent._id;
    }
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
      authorType: ['student', 'teacher', 'parent', 'admin'].includes(normalizeUserType(req.userType)) ? normalizeUserType(req.userType) : 'unknown',
      authorName: resolvedAuthorName || 'Anonymous',
      parentComment,
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

    // The comment's author, the post's author, or a school admin may delete it.
    const currentType = normalizeUserType(req.userType || req.user?.userType || req.user?.type);
    const isAdmin = currentType === 'admin';
    const isAuthor = Boolean(comment.authorId && req.user?.id && String(comment.authorId) === String(req.user.id)
      && (!comment.authorType || comment.authorType === 'unknown' || normalizeUserType(comment.authorType) === currentType));
    const post = await AlcovePost.findOne({ _id: req.params.id, schoolId }).select('author authorUserId authorType').lean();
    const isPostOwner = Boolean(post && isPostAuthor(req, post));
    if (!isAdmin && !isAuthor && !isPostOwner) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Deleting a comment also removes its replies.
    const { deletedCount: replyCount } = await AlcoveComment.deleteMany({ parentComment: comment._id, schoolId });
    await comment.deleteOne();
    res.json({ ok: true, deleted: 1 + (replyCount || 0) });
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
