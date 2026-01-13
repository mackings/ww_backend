const express = require('express');
const router = express.Router();
const { protect } = require('../Utils/auth');
const { getActiveCompany } = require('../Utils/ActiveCompany');
const { requireOwnerOrAdmin } = require('../Utils/permissions');
const settingsController = require('../Src/Settings/settingsController');

router.use(protect);
router.use(getActiveCompany);

router.get('/', settingsController.getSettings);
router.put('/', requireOwnerOrAdmin, settingsController.updateSettings);

module.exports = router;
