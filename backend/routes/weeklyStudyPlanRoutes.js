const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const { generateWeeklyStudyPlan, startOfWeek } = require('../services/weeklyStudyPlanService');
const WeeklyStudyPlan = require('../models/WeeklyStudyPlan');

router.get('/current', authStudent, async (req, res) => {
  try {
    const plan = await generateWeeklyStudyPlan({ studentId: req.user?.id, schoolId: req.schoolId });
    return res.json({ success: true, data: plan });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/current/tasks/:taskId', authStudent, async (req, res) => {
  try {
    const plan = await WeeklyStudyPlan.findOne({ studentId: req.user?.id, schoolId: req.schoolId, weekStart: startOfWeek(), status: 'active', 'tasks._id': req.params.taskId });
    if (!plan) return res.status(404).json({ error: 'Study task not found' });
    const task = plan.tasks.id(req.params.taskId);
    task.completed = Boolean(req.body?.completed);
    task.completedAt = task.completed ? new Date() : null;
    await plan.save();
    return res.json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
