const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const controller = require('../controllers/paymentSettingsController');

const router = express.Router();

router.get('/', adminAuth, controller.getSettings);
router.post('/', adminAuth, controller.saveSettings);
router.post('/test', adminAuth, controller.testConnection);
router.delete('/', adminAuth, controller.disconnect);

module.exports = router;
