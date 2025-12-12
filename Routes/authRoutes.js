
const express = require('express');
const router = express.Router();
const authController = require('../Src/Auth/authController');
const { protect,checkCompanyAccess,requireRole } = require('../Utils/auth');
const companyController = require('../Src/Auth/companyController');
const UserCompany = require("../Models/userCompanyModel");



// Public routes
router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);


router.get('/me', protect, authController.getMe);

router.post('/companies', protect,  companyController.createCompany);
router.get('/companies', protect, companyController.getMyCompanies);

router.post('/company', protect, authController.createCompany); // Create new company
router.patch('/company/:companyIndex', protect, authController.updateCompany); // Update company
router.post('/switch-company', protect, authController.switchCompany); 


router.post('/invite-staff', protect, authController.inviteStaff);
router.get('/staff', protect, authController.getCompanyStaff);
router.patch('/staff/:userId/revoke', protect, authController.revokeStaffAccess);
router.patch('/staff/:userId/restore', protect, authController.restoreStaffAccess);
router.delete('/staff/:userId', protect, authController.removeStaff);

module.exports = router;