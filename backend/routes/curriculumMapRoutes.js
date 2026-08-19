const express = require('express');
const router = express.Router();
const authTeacher = require('../middleware/authTeacher');
const CurriculumMap = require('../models/CurriculumMap');
const { detectGaps } = require('../services/gapDetectionEngine');
const StudentInsight = require('../models/StudentInsight');

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

// GET /api/curriculum-map/gaps?studentId=&subject=&className=
// Teacher-facing: detect root-cause knowledge gaps for a specific student.
router.get('/gaps', authTeacher, async (req, res) => {
  try {
    const { studentId, subject, className } = req.query;
    if (!studentId || !subject) return res.status(400).json({ error: 'studentId and subject are required' });
    const result = await detectGaps({
      studentId,
      schoolId: req.schoolId,
      subject,
      className: className || '',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/curriculum-map/insights?subject=&limit=50
// Teacher-facing: fetch stored gap-detection insight records for their school.
router.get('/insights', authTeacher, async (req, res) => {
  try {
    const { subject, limit = 50 } = req.query;
    const filter = { schoolId: req.schoolId, insightType: 'gap_detection' };
    if (subject) filter.subject = { $regex: subject, $options: 'i' };
    const insights = await StudentInsight.find(filter)
      .sort({ generatedAt: -1 })
      .limit(Number(limit))
      .populate('studentId', 'name roll className sectionName')
      .lean();
    return res.json({ success: true, data: insights });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/curriculum-map/mastery-graph?subject=&className=&studentId=
// Student→Mastery edge view: returns curriculum topics with the student's mastery score for each.
// This is the "Student → Mastery edges auto-maintained" knowledge-graph query.
router.get('/mastery-graph', authTeacher, async (req, res) => {
  try {
    const { subject, className, studentId } = req.query;
    if (!subject || !className || !studentId) {
      return res.status(400).json({ error: 'subject, className, and studentId are required' });
    }
    const MasteryScore = require('../models/MasteryScore');

    const [map, masteryRecords] = await Promise.all([
      CurriculumMap.findOne({ schoolId: req.schoolId, subject: { $regex: subject, $options: 'i' }, className }).lean(),
      MasteryScore.find({ studentId, schoolId: req.schoolId, subject: { $regex: subject, $options: 'i' } }).lean(),
    ]);

    const masteryByTopic = {};
    for (const r of masteryRecords) {
      if (r.topicTitle) masteryByTopic[r.topicTitle.toLowerCase()] = r;
    }

    const topics = (map?.topics || []).sort((a, b) => a.order - b.order).map((t) => ({
      order: t.order,
      title: t.title,
      description: t.description,
      learningOutcomes: t.learningOutcomes || [],
      concepts: t.concepts || [],
      mastery: masteryByTopic[t.title?.toLowerCase()] || null,
    }));

    return res.json({
      success: true,
      data: {
        subject,
        className,
        studentId,
        topics,
        overallAvg: topics.length
          ? Math.round(topics.filter((t) => t.mastery).reduce((s, t) => s + t.mastery.score, 0) / (topics.filter((t) => t.mastery).length || 1))
          : null,
      },
    });
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
