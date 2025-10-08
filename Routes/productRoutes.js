const express = require('express');
const router = express.Router();
const productController = require('../Src/Quotation/product');
const { protect } = require('../Utils/auth');

router.use(protect);

// Get categories (before :id route to avoid conflicts)
router.get('/categories', productController.getCategories);

// Product CRUD
router.post('/', productController.createProduct);
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;