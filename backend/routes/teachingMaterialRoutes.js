const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeachingMaterial = require('../models/TeachingMaterial');
const TeacherUser = require('../models/TeacherUser');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const authTeacher = require('../middleware/authTeacher');

// Middleware to ensure teacher is authenticated
router.use(authTeacher);
router.use((req, res, next) => {
  req.userId = req.user?.id || req.teacher?.id || null;
  next();
});

// Helper function to get denormalized names
const resolveDenormalizedNames = async (classId, sectionId, subjectId) => {
  const result = {};

  if (classId) {
    const classDoc = await Class.findById(classId).lean();
    result.className = classDoc ? classDoc.name : '';
  }

  if (sectionId) {
    const sectionDoc = await Section.findById(sectionId).lean();
    result.sectionName = sectionDoc ? sectionDoc.name : '';
  }

  if (subjectId) {
    const subjectDoc = await Subject.findById(subjectId).lean();
    result.subjectName = subjectDoc ? subjectDoc.name : '';
  }

  return result;
};

// CREATE: Create new material or folder
router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      content,
      materialType,
      learningType,
      typeLabel,
      classId,
      sectionId,
      subjectId,
      chapterId,
      chapterTitle,
      topicTitle,
      subTopicTitle,
      tags,
      category,
      status,
      priority,
      difficulty,
      attachments,
      hasQuiz,
      quiz,
      hasPoll,
      poll,
      scheduledFor,
      expiresAt,
      folderId
    } = req.body;

    // Validate required fields
    if (!title || !classId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Title, classId, and sectionId are required'
      });
    }

    // Resolve denormalized names
    const denormalized = await resolveDenormalizedNames(classId, sectionId, subjectId);

    // Get teacher name
    const teacher = await TeacherUser.findById(req.userId).lean();

    // Create material object
    const materialData = {
      schoolId: req.schoolId,
      campusId: req.campusId || null,
      title: title.trim(),
      content: content || '',
      materialType: materialType || 'note',
      learningType: learningType || 'note',
      typeLabel: typeLabel || 'Study Material',
      classId,
      sectionId,
      subjectId: subjectId || null,
      chapterId: chapterId || '',
      chapterTitle: chapterTitle || '',
      topicTitle: topicTitle || '',
      subTopicTitle: subTopicTitle || '',
      ...denormalized,
      teacherId: req.userId,
      teacherName: teacher ? teacher.name : '',
      status: status || 'draft',
      priority: priority || 'medium',
      difficulty: difficulty || 'intermediate',
      attachments: attachments || [],
      tags: tags || [],
      category: category || 'general',
      hasQuiz: hasQuiz || false,
      hasPoll: hasPoll || false,
      folderId: folderId || null
    };

    if (materialData.status === 'published') {
      materialData.publishedAt = new Date();
      materialData.publishedForStudentPortal = true;
    }

    // Add optional fields
    if (quiz && hasQuiz) materialData.quiz = quiz;
    if (poll && hasPoll) materialData.poll = poll;
    if (scheduledFor) {
      materialData.scheduledFor = new Date(scheduledFor);
      materialData.status = 'scheduled';
    }
    if (expiresAt) materialData.expiresAt = new Date(expiresAt);

    // Create version record if content exists
    if (content) {
      materialData.currentVersion = 1;
      materialData.versions = [{
        versionNumber: 1,
        content,
        title,
        attachments: attachments || [],
        editedBy: req.userId,
        editedAt: new Date(),
        changeDescription: 'Initial version'
      }];
    }

    const material = new TeachingMaterial(materialData);
    await material.save();

    res.status(201).json({
      success: true,
      message: `${materialType === 'folder' ? 'Folder' : 'Material'} created successfully`,
      material
    });
  } catch (error) {
    console.error('Error creating teaching material:', error);
    next(error);
  }
});

// READ: List all teacher's materials with filters
router.get('/', async (req, res, next) => {
  try {
    const { status, folderId, classId, subjectId, search, category, tags, page = 1, limit = 20 } = req.query;

    const filters = {
      teacherId: req.userId,
      schoolId: req.schoolId
    };

    // Apply optional filters
    if (status) filters.status = status;
    if (folderId) filters.folderId = new mongoose.Types.ObjectId(folderId);
    if (classId) filters.classId = new mongoose.Types.ObjectId(classId);
    if (subjectId) filters.subjectId = new mongoose.Types.ObjectId(subjectId);
    if (category) filters.category = category;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filters.tags = { $in: tagArray };
    }

    // Text search
    if (search) {
      filters.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const materials = await TeachingMaterial.find(filters)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .lean();

    const total = await TeachingMaterial.countDocuments(filters);

    // Separate folders and materials
    const folders = materials.filter(m => m.materialType === 'folder');
    const regularMaterials = materials.filter(m => m.materialType !== 'folder');

    res.json({
      success: true,
      materials: regularMaterials,
      folders,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching teaching materials:', error);
    next(error);
  }
});

// READ: Get single material
router.get('/:id', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name email');

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('Error fetching teaching material:', error);
    next(error);
  }
});

// UPDATE: Update material
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, content, attachments, tags, priority, category, difficulty, typeLabel, expiresAt } = req.body;

    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Don't allow editing if material is archived
    if (material.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit archived materials'
      });
    }

    // Store old version if content changed
    if (content && content !== material.content) {
      const newVersion = material.currentVersion + 1;
      material.versions.push({
        versionNumber: material.currentVersion,
        content: material.content,
        title: material.title,
        attachments: material.attachments,
        editedBy: req.userId,
        editedAt: new Date(),
        changeDescription: req.body.changeDescription || 'Updated version'
      });
      material.currentVersion = newVersion;
    }

    // Update fields
    if (title) material.title = title.trim();
    if (content) material.content = content;
    if (attachments) material.attachments = attachments;
    if (tags) material.tags = tags;
    if (priority) material.priority = priority;
    if (category) material.category = category;
    if (difficulty) material.difficulty = difficulty;
    if (typeLabel) material.typeLabel = typeLabel;
    if (expiresAt) material.expiresAt = new Date(expiresAt);

    // Reset status to draft if previously published
    if (material.status === 'published') {
      material.status = 'draft';
    }

    await material.save();

    res.json({
      success: true,
      message: 'Material updated successfully',
      material
    });
  } catch (error) {
    console.error('Error updating teaching material:', error);
    next(error);
  }
});

// DELETE: Delete material
router.delete('/:id', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // TODO: Delete files from Cloudinary if needed
    // For now, files remain in Cloudinary (can be cleaned up later)

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting teaching material:', error);
    next(error);
  }
});

// PUBLISH: Move from draft to published
router.post('/:id/publish', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    if (material.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Material is already published'
      });
    }

    material.status = 'published';
    material.publishedAt = new Date();
    material.publishedForStudentPortal = true;

    await material.save();

    res.json({
      success: true,
      message: 'Material published successfully',
      material
    });
  } catch (error) {
    console.error('Error publishing material:', error);
    next(error);
  }
});

// ARCHIVE: Move material to archived
router.post('/:id/archive', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    material.status = 'archived';
    await material.save();

    res.json({
      success: true,
      message: 'Material archived successfully'
    });
  } catch (error) {
    console.error('Error archiving material:', error);
    next(error);
  }
});

// FOLDERS: Create folder
router.post('/folder/create', async (req, res, next) => {
  try {
    const { name, description, color, parentFolderId, classId, sectionId } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }

    const folder = new TeachingMaterial({
      schoolId: req.schoolId,
      materialType: 'folder',
      title: name.trim(),
      content: description || '',
      teacherId: req.userId,
      classId: classId || new mongoose.Types.ObjectId('000000000000000000000000'),
      sectionId: sectionId || new mongoose.Types.ObjectId('000000000000000000000000'),
      folderId: parentFolderId || null,
      status: 'published',
      typeLabel: 'Folder',
      priority: 'medium',
      color: color || '#3b82f6'
    });

    await folder.save();

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    next(error);
  }
});

// FOLDERS: List folders
router.get('/folders/list', async (req, res, next) => {
  try {
    const { parentFolderId } = req.query;

    const filters = {
      teacherId: req.userId,
      schoolId: req.schoolId,
      materialType: 'folder'
    };

    if (parentFolderId) {
      filters.folderId = new mongoose.Types.ObjectId(parentFolderId);
    } else {
      filters.folderId = null;
    }

    const folders = await TeachingMaterial.find(filters)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      folders
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    next(error);
  }
});

// BULK: Bulk delete
router.post('/bulk/delete', async (req, res, next) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No IDs provided for deletion'
      });
    }

    const result = await TeachingMaterial.deleteMany({
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    res.json({
      success: true,
      message: `${result.deletedCount} materials deleted`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting:', error);
    next(error);
  }
});

// BULK: Move to folder
router.patch('/bulk/move', async (req, res, next) => {
  try {
    const { ids, folderId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No IDs provided for moving'
      });
    }

    const result = await TeachingMaterial.updateMany(
      {
        _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
        teacherId: req.userId,
        schoolId: req.schoolId
      },
      {
        $set: {
          folderId: folderId ? new mongoose.Types.ObjectId(folderId) : null
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} materials moved`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error bulk moving:', error);
    next(error);
  }
});

// ANALYTICS: Get material analytics
router.get('/:id/analytics', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    }).lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Calculate analytics
    const analytics = {
      materialId: material._id,
      title: material.title,
      views: material.views,
      uniqueViewers: material.viewedBy ? material.viewedBy.length : 0,
      downloads: material.downloads,
      completions: material.completedBy ? material.completedBy.length : 0,
      averageTimeSpent: 0,
      quizStats: null,
      viewsByDate: [],
      topViewers: []
    };

    // Calculate average time spent
    if (material.viewedBy && material.viewedBy.length > 0) {
      const totalTime = material.viewedBy.reduce((sum, v) => sum + (v.timeSpent || 0), 0);
      analytics.averageTimeSpent = Math.round(totalTime / material.viewedBy.length);
    }

    // Quiz statistics
    if (material.hasQuiz && material.quizAttempts && material.quizAttempts.length > 0) {
      const scores = material.quizAttempts.map(a => a.score);
      const totalAttempts = material.quizAttempts.length;
      const passedAttempts = material.quizAttempts.filter(a => a.score >= (material.quiz?.passingScore || 70)).length;

      analytics.quizStats = {
        attempts: totalAttempts,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        passRate: Math.round((passedAttempts / totalAttempts) * 100),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores)
      };
    }

    // Top viewers
    if (material.viewedBy) {
      analytics.topViewers = material.viewedBy
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 5)
        .map(v => ({
          studentId: v.studentId,
          viewCount: v.viewCount,
          lastViewedAt: v.lastViewedAt
        }));
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    next(error);
  }
});

module.exports = router;
