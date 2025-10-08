const express = require('express');
const router = express.Router();
const bomController = require('../Src/Quotation/bom');
const { protect } = require('../Utils/auth');

// All routes require authentication
router.use(protect);

// BOM CRUD
router.post('/', bomController.createBOM);
router.get('/', bomController.getAllBOMs);
router.get('/:id', bomController.getBOM);
router.put('/:id', bomController.updateBOM);
router.delete('/:id', bomController.deleteBOM);

// Material management
router.post('/:id/materials', bomController.addMaterialToBOM);
router.delete('/:id/materials/:materialId', bomController.deleteMaterialFromBOM);

module.exports = router;