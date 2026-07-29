const express = require('express');
const router = express.Router();
const authTeacher = require('../middleware/authTeacher');
const CurriculumMap = require('../models/CurriculumMap');

// GET /api/curriculum-map?subject=&className=&section=
router.get('/', authTeacher, async (req, res) => {
  try {
    const { subject, className, section } = req.query;
    const filter = { schoolId: req.schoolId };
    if (subject)   filter.subject   = { $regex: subject, $options: 'i' };
    if (className) filter.className = { $regex: className, $options: 'i' };
    if (section)   filter.section   = section;
    const maps = await CurriculumMap.find(filter).sort({ subject: 1, className: 1 }).lean();
    return res.json({ success: true, data: maps });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/curriculum-map  — create or upsert the map for a subject/class/section
router.post('/', authTeacher, async (req, res) => {
  try {
    const { subject, className, section = '', topics = [] } = req.body;
    if (!subject || !className) return res.status(400).json({ error: 'subject and className are required' });

    const ordered = topics.map((t, i) => ({ ...t, order: i + 1 }));

    const map = await CurriculumMap.findOneAndUpdate(
      { schoolId: req.schoolId, subject, className, section },
      { $set: { topics: ordered, createdBy: req.teacher?.id || req.user?.id } },
      { upsert: true, new: true }
    );
    return res.json({ success: true, data: map });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/curriculum-map/:id/topic — add a single topic
router.patch('/:id/topic', authTeacher, async (req, res) => {
  try {
    const { title, description = '', estimatedWeeks = 1 } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const map = await CurriculumMap.findOne({ _id: req.params.id, schoolId: req.schoolId });
    if (!map) return res.status(404).json({ error: 'Curriculum map not found' });

    const order = map.topics.length + 1;
    map.topics.push({ order, title, description, estimatedWeeks });
    await map.save();
    return res.json({ success: true, data: map });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/curriculum-map/:id
router.delete('/:id', authTeacher, async (req, res) => {
  try {
    await CurriculumMap.findOneAndDelete({ _id: req.params.id, schoolId: req.schoolId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
