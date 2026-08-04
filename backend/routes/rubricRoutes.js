const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const authTeacher = require('../middleware/authTeacher');
const Rubric = require('../models/Rubric');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ── POST /api/rubrics/ai-generate — AI-powered rubric criteria generation ─────
router.post('/ai-generate', authTeacher, async (req, res) => {
  try {
    const { subject, taskDescription, gradeLevel } = req.body || {};
    if (!subject && !taskDescription) {
      return res.status(400).json({ error: 'subject or taskDescription is required' });
    }
    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/generate/teacher`,
      {
        mode: 'rubric_generate',
        subject: subject || taskDescription,
        topic: taskDescription || `Assessment rubric for ${subject}`,
        gradeLevel: gradeLevel || null,
        context: null,
        question: null,
      },
      { timeout: 120_000 }
    );
    const raw = (aiRes.data?.content || '').trim();
    let rubric = null;
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) rubric = JSON.parse(raw.slice(start, end + 1));
    } catch (_) { /* fall through */ }
    return res.json({ success: true, data: { rubric, raw } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rubrics — create rubric ─────────────────────────────────────────
router.post('/', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, subject, criteria, isTemplate } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!Array.isArray(criteria) || !criteria.length) return res.status(400).json({ error: 'criteria[] is required' });

    const totalScore = criteria.reduce((s, c) => s + (Number(c.maxScore) || 0), 0);
    const rubric = await Rubric.create({
      schoolId, campusId: req.campusId || null, teacherId,
      title: String(title).trim(), description: String(description || '').trim(),
      subject: String(subject || '').trim(),
      criteria, totalScore, isTemplate: Boolean(isTemplate),
    });
    return res.status(201).json({ success: true, data: rubric });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rubrics — list teacher's rubrics ─────────────────────────────────
router.get('/', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const rubrics = await Rubric.find({ schoolId, teacherId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: rubrics });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rubrics/:id — single rubric ──────────────────────────────────────
router.get('/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const rubric = await Rubric.findOne({ _id: req.params.id, schoolId }).lean();
    if (!rubric) return res.status(404).json({ error: 'Rubric not found' });
    return res.json({ success: true, data: rubric });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/rubrics/:id — update rubric ─────────────────────────────────────
router.put('/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const { title, description, subject, criteria, isTemplate } = req.body || {};
    const updates = { title, description, subject, criteria, isTemplate };
    if (Array.isArray(criteria)) updates.totalScore = criteria.reduce((s, c) => s + (Number(c.maxScore) || 0), 0);
    const rubric = await Rubric.findOneAndUpdate(
      { _id: req.params.id, schoolId, teacherId },
      { $set: updates },
      { new: true }
    );
    if (!rubric) return res.status(404).json({ error: 'Rubric not found' });
    return res.json({ success: true, data: rubric });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/rubrics/:id ───────────────────────────────────────────────────
router.delete('/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    await Rubric.deleteOne({ _id: req.params.id, schoolId, teacherId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
