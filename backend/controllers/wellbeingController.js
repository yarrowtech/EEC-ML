const Wellbeing = require('../models/Wellbeing');
const StudentUser = require('../models/StudentUser');

exports.getWellbeing = async (req, res) => {
  const { studentId } = req.params;
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    return res.status(400).json({ msg: 'schoolId is required' });
  }

  try {
    let wellbeing = await Wellbeing.findOne({ student: studentId, schoolId });

    if (!wellbeing) {
      // If no wellbeing record exists, create a default one
      const student = await StudentUser.findOne({ _id: studentId, schoolId });
      if (!student) {
        return res.status(404).json({ msg: 'Student not found' });
      }
      wellbeing = new Wellbeing({
        student: studentId,
        schoolId,
      });
      await wellbeing.save();
    }

    res.json(wellbeing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.updateWellbeing = async (req, res) => {
  const { studentId } = req.params;
  const {
    mood,
    socialEngagement,
    academicStress,
    behaviorChanges,
    notes,
  } = req.body;
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    return res.status(400).json({ msg: 'schoolId is required' });
  }

  try {
    let student = await StudentUser.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    let wellbeing = await Wellbeing.findOne({ student: studentId, schoolId });

    if (!wellbeing) {
      wellbeing = new Wellbeing({
        student: studentId,
        schoolId,
      });
    }

    wellbeing.mood = mood || wellbeing.mood;
    wellbeing.socialEngagement = socialEngagement || wellbeing.socialEngagement;
    wellbeing.academicStress = academicStress || wellbeing.academicStress;
    wellbeing.behaviorChanges = behaviorChanges || wellbeing.behaviorChanges;
    wellbeing.notes = notes || wellbeing.notes;
    wellbeing.lastAssessment = Date.now();

    await wellbeing.save();

    // Route a distressed check-in to leadership / counselling for human follow-up.
    try {
      const { escalateWellbeingIfNeeded } = require('../services/escalationService');
      await escalateWellbeingIfNeeded({
        schoolId, campusId: student.campusId || req.campusId || null,
        student, wellbeing,
      });
    } catch (escErr) {
      console.error('wellbeing escalation check failed:', escErr.message);
    }

    res.json(wellbeing);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
