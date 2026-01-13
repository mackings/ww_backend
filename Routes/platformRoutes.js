const express = require('express');
const router = express.Router();
const platformController = require('../Src/Platform/platformController');
const multer = require("multer");
const upload = multer();
const { protect, requirePlatformOwner } = require('../Utils/auth');
const { getActiveCompanyOptional } = require('../Utils/ActiveCompany');

// Protect all routes - require platform owner
router.use(protect);
router.use(requirePlatformOwner);
router.use(getActiveCompanyOptional);

// Dashboard
router.get('/dashboard/stats', platformController.getDashboardStats);
router.get('/stats/overview', platformController.getPlatformOverview);

// Companies
router.get('/companies', platformController.getAllCompanies);
router.get('/companies/:companyId/usage', platformController.getCompanyUsage);
router.get('/companies/:companyId/profile', platformController.getCompanyProfile);

// Products
router.get('/products/all', platformController.getAllProducts);
router.get('/products/pending', platformController.getPendingProducts);
router.get('/products/:productId', platformController.getProductDetails);
router.patch('/products/:productId/approve', platformController.approveProduct);
router.patch('/products/:productId/reject', platformController.rejectProduct);
router.post('/products/global', upload.single("image"), platformController.createGlobalProduct);

// Materials
router.get('/materials/pending', platformController.getPendingMaterials);
router.patch('/materials/:materialId/approve', platformController.approveMaterial);
router.patch('/materials/:materialId/reject', platformController.rejectMaterial);

module.exports = router;
