const express = require('express');
const router = express.Router();
const bomController = require('../Src/Quotation/bom');
const { protect } = require('../Utils/auth');
const  {getActiveCompany} = require('../Utils/ActiveCompany');

// All routes require authentication
router.use(protect);
router.use(getActiveCompany);

// BOM CRUD
router.post('/', bomController.createBOM);
router.get('/', bomController.getAllBOMs);
router.get('/:id', bomController.getBOM);
router.put('/:id', bomController.updateBOM);
router.delete('/:id', bomController.deleteBOM);

// Material management
router.post('/:id/materials', bomController.addMaterialToBOM);
router.delete('/:id/materials/:materialId', bomController.deleteMaterialFromBOM);

//Additional Costs

router.post('/:id/additional-costs', bomController.addAdditionalCost);
router.delete('/:id/additional-costs/:costId', bomController.deleteAdditionalCost);

module.exports = router;