const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ExternalResource = require('../models/ExternalResource');
const authStudent = require('../middleware/authStudent');
const adminAuth = require('../middleware/adminAuth');
const authTeacher = require('../middleware/authTeacher');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeThumbnail(url) {
  try {
    const u = new URL(url);
    let videoId = null;
    if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
    else if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  } catch {
    return '';
  }
}

function sanitiseUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function normaliseOrigin(origin) {
  return String(origin || '').trim().toLowerCase() === 'eec' ? 'eec' : 'school';
}

// ─── Student: list published resources ───────────────────────────────────────

router.get('/student', authStudent, async (req, res) => {
  try {
    const { subject, type, search } = req.query;
    const filter = {
      schoolId: req.schoolId,
      isPublished: true,
      $or: [{ classId: null }, { classId: req.classId || null }],
    };
    if (subject) filter.subject = subject;
    if (type) filter.resourceType = type;
    if (search) {
      filter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    const resources = await ExternalResource.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: resources });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Track view (fire-and-forget from client)
router.post('/student/:id/view', authStudent, async (req, res) => {
  try {
    await ExternalResource.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-fatal
  }
});

// ─── Admin: full CRUD ─────────────────────────────────────────────────────────

router.get('/admin', adminAuth, async (req, res) => {
  try {
    const resources = await ExternalResource.find({ schoolId: req.schoolId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: resources });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin', adminAuth, async (req, res) => {
  try {
    const { title, description, url, resourceType, subject, source, origin, tags, classId, isPublished, thumbnailUrl } = req.body;
    if (!title || !url) return res.status(400).json({ success: false, message: 'title and url are required' });

    const safeUrl = sanitiseUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'Invalid URL — only http/https allowed' });

    const thumb = thumbnailUrl || extractYouTubeThumbnail(safeUrl);

    const resource = await ExternalResource.create({
      title: title.trim(),
      description: (description || '').trim(),
      url: safeUrl,
      resourceType: resourceType || 'website',
      subject: (subject || '').trim(),
      source: (source || '').trim(),
      origin: normaliseOrigin(origin),
      thumbnailUrl: thumb,
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
      classId: classId || null,
      schoolId: req.schoolId,
      campusId: req.campusId || null,
      isPublished: isPublished !== false,
      addedBy: req.userId,
      addedByRole: 'Admin',
    });

    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id', adminAuth, async (req, res) => {
  try {
    const { title, description, url, resourceType, subject, source, origin, tags, classId, isPublished, thumbnailUrl } = req.body;

    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (url !== undefined) {
      const safeUrl = sanitiseUrl(url);
      if (!safeUrl) return res.status(400).json({ success: false, message: 'Invalid URL' });
      update.url = safeUrl;
      update.thumbnailUrl = thumbnailUrl || extractYouTubeThumbnail(safeUrl);
    }
    if (resourceType !== undefined) update.resourceType = resourceType;
    if (subject !== undefined) update.subject = subject.trim();
    if (source !== undefined) update.source = source.trim();
    if (origin !== undefined) update.origin = normaliseOrigin(origin);
    if (tags !== undefined) update.tags = tags.map((t) => t.trim()).filter(Boolean);
    if (classId !== undefined) update.classId = classId || null;
    if (isPublished !== undefined) update.isPublished = isPublished;

    const resource = await ExternalResource.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.schoolId },
      update,
      { new: true }
    );
    if (!resource) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    await ExternalResource.findOneAndDelete({ _id: req.params.id, schoolId: req.schoolId });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Teacher can also add resources
router.post('/teacher', authTeacher, async (req, res) => {
  try {
    const { title, description, url, resourceType, subject, source, tags, isPublished } = req.body;
    if (!title || !url) return res.status(400).json({ success: false, message: 'title and url are required' });

    const safeUrl = sanitiseUrl(url);
    if (!safeUrl) return res.status(400).json({ success: false, message: 'Invalid URL — only http/https allowed' });

    const resource = await ExternalResource.create({
      title: title.trim(),
      description: (description || '').trim(),
      url: safeUrl,
      resourceType: resourceType || 'website',
      subject: (subject || '').trim(),
      source: (source || '').trim(),
      origin: 'school',
      thumbnailUrl: extractYouTubeThumbnail(safeUrl),
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
      schoolId: req.schoolId,
      campusId: req.campusId || null,
      isPublished: isPublished !== false,
      addedBy: req.teacher?.id || req.userId,
      addedByRole: 'Teacher',
    });

    res.status(201).json({ success: true, data: resource });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
