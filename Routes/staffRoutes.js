const express = require('express');
const { protect } = require('../Utils/auth');
const staffController = require('../Src/Auth/staffController');

const router = express.Router();

router.post('/create', protect, staffController.createStaff);
router.get('/', protect, staffController.getAllStaff);
router.patch('/:id/grant', protect, staffController.grantAccess);
router.patch('/:id/revoke', protect, staffController.revokeAccess);
router.delete('/:id', protect, staffController.deleteStaff);

module.exports = router;
