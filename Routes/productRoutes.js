const express = require('express');
const router = express.Router();
const productController = require('../Src/Quotation/product');
const multer = require("multer");
const upload = multer(); // in-memory file upload
const { protect } = require('../Utils/auth');
const  {getActiveCompany} = require('../Utils/ActiveCompany');

// Protect all routes
router.use(protect);
router.use(getActiveCompany);

//Material Routes

router.get('/materials', productController.getMaterials);
router.get('/materials/grouped', productController.getMaterialsGrouped);
router.get('/materials/supported', productController.getSupportedMaterials);
router.get('/materials/supported/summary', productController.getSupportedMaterialsSummary);
router.post('/creatematerial', upload.single("image"), productController.createMaterial);
router.post('/:materialId/add-types', productController.addMaterialTypes)
router.post('/material/:materialId/calculate-cost', productController.calculateMaterialCost)


router.get('/categories', productController.getCategories);

// ✅ Product CRUD routes
router.post('/', upload.single("image"), productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProduct);
router.put('/:id', upload.single("image"), productController.updateProduct);
router.patch('/:id/resubmit', upload.single("image"), productController.resubmitProduct);
router.delete('/:id', productController.deleteProduct);



module.exports = router;
