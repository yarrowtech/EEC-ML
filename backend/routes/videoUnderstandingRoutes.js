const express = require('express');
const router = express.Router();
const axios = require('axios');
const authTeacher = require('../middleware/authTeacher');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB — lecture-length videos
// Same SSRF guard pattern as aiTutorRoutes.js explain-photo: only ever fetch
// from the app's own Cloudinary account, never an arbitrary URL a caller supplies.
const _ALLOWED_VIDEO_HOSTS = new Set(['res.cloudinary.com']);

// POST /api/video/summarize — teacher provides a Cloudinary video URL (from
// /api/uploads); the video's audio track is transcribed and turned into a
// summary + quiz. Audio-only understanding (see ai-service video/service.py
// docstring) — no frame/vision analysis of on-screen slides in this pass.
router.post('/summarize', authTeacher, async (req, res) => {
  try {
    const { videoUrl } = req.body || {};
    if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl is required' });

    let parsed;
    try { parsed = new URL(videoUrl); } catch { return res.status(400).json({ success: false, error: 'videoUrl is not a valid URL' }); }
    if (parsed.protocol !== 'https:' || !_ALLOWED_VIDEO_HOSTS.has(parsed.hostname)) {
      return res.status(400).json({ success: false, error: 'videoUrl must be an https Cloudinary URL from this app' });
    }

    let videoBuf;
    try {
      const dl = await axios.get(videoUrl, {
        responseType: 'arraybuffer', timeout: 60000, maxContentLength: MAX_VIDEO_BYTES, maxBodyLength: MAX_VIDEO_BYTES,
      });
      const ct = String(dl.headers['content-type'] || '');
      if (!ct.startsWith('video/')) return res.status(400).json({ success: false, error: 'URL does not point to a video' });
      videoBuf = Buffer.from(dl.data);
    } catch (dlErr) {
      return res.status(400).json({ success: false, error: 'Could not fetch the video', detail: dlErr.message });
    }

    const FormData = require('form-data');
    const form = new FormData();
    form.append('video', videoBuf, { filename: 'lecture.mp4', contentType: 'video/mp4' });

    const started = Date.now();
    let aiRes;
    try {
      aiRes = await axios.post(`${AI_SERVICE_URL}/video/understand`, form, {
        headers: form.getHeaders(), timeout: 600000, maxBodyLength: Infinity,
      });
    } catch (aiErr) {
      const status = aiErr.response?.status || 502;
      return res.status(status).json({ success: false, error: aiErr.response?.data?.detail || 'Video understanding failed' });
    }

    require('../services/aiInteractionLogger').logAiInteraction({
      schoolId: req.schoolId, userId: req.user?.id || req.teacher?.id, userRole: 'teacher',
      feature: 'video_understand', aiResponse: { content: aiRes.data?.summary },
      status: 'success', latencyMs: Date.now() - started,
    });

    return res.json({ success: true, data: aiRes.data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
