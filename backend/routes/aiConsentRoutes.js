const express = require('express');
const mongoose = require('mongoose');
const authParent = require('../middleware/authParent');
const adminAuth = require('../middleware/adminAuth');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const consent = require('../services/aiConsentService');
const router = express.Router();

async function authorizeChild(req, res, next) {
  try {
    if (!req.schoolId || !mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json({ error: 'Valid student and school are required' });
    }
    // Consent cannot rely on the legacy child-name fallback: names are not unique.
    const parent = await ParentUser.findOne({ _id: req.user?.id, schoolId: req.schoolId,
      childrenIds: req.params.studentId }).select('name').lean();
    if (!parent) return res.status(403).json({ error: 'This child is not linked to your parent account. Contact the school to verify the link.' });
    const child = await StudentUser.exists({ _id: req.params.studentId, schoolId: req.schoolId });
    if (!child) return res.status(404).json({ error: 'Child not found' });
    req.consentActor = { id: req.user.id, type: 'parent', name: parent.name || 'Parent/guardian' };
    next();
  } catch (_) { return res.status(500).json({ error: 'Unable to verify child access' }); }
}

router.get('/parent/:studentId', authParent, authorizeChild, async (req, res) => {
  try {
    return res.json({ success: true, data: await consent.personalisationAllowed({ studentId: req.params.studentId, schoolId: req.schoolId }) });
  } catch (_) { return res.status(500).json({ error: 'Unable to load AI consent' }); }
});

router.put('/parent/:studentId', authParent, authorizeChild, async (req, res) => {
  if (typeof req.body?.granted !== 'boolean') return res.status(400).json({ error: 'granted must be a boolean' });
  try {
    const scope = { studentId: req.params.studentId, schoolId: req.schoolId };
    const action = req.body.granted ? consent.recordConsent : consent.withdrawConsent;
    const result = await action({ ...scope, givenBy: req.consentActor.name, actor: req.consentActor });
    if (result.notFound) return res.status(404).json({ error: 'Child not found' });
    return res.json({ success: true, data: await consent.personalisationAllowed(scope) });
  } catch (_) { return res.status(500).json({ error: 'Unable to save AI consent. Please retry.' }); }
});

router.delete('/admin/:studentId', adminAuth, async (req, res) => {
  if (!req.schoolId || !mongoose.Types.ObjectId.isValid(req.params.studentId)) return res.status(400).json({ error: 'Valid student and school are required' });
  try {
    const result = await consent.withdrawConsent({ studentId: req.params.studentId, schoolId: req.schoolId,
      actor: { id: req.user?.id, type: 'admin', name: req.user?.name } });
    if (result.notFound) return res.status(404).json({ error: 'Student not found in this school' });
    return res.json({ success: true });
  } catch (_) { return res.status(500).json({ error: 'Unable to withdraw AI consent' }); }
});
module.exports = router;
