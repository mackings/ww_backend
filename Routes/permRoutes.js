// Routes/permissionsRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../Utils/auth');
const { getActiveCompany } = require('../Utils/ActiveCompany');
const {
  getStaffPermissions,
  updateStaffPermissions,
  grantPermission,
  revokePermission
} = require('../Src/Auth/permController');

// Apply middlewares
router.use(protect);
router.use(getActiveCompany);

// Routes
router.get('/:staffId', getStaffPermissions);
router.put('/:staffId', updateStaffPermissions);
router.post('/:staffId/grant', grantPermission);
router.post('/:staffId/revoke', revokePermission);

module.exports = router;