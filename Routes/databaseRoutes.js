const express = require('express');
const router = express.Router();
const { protect } = require('../Utils/auth');
const { getActiveCompany } = require('../Utils/ActiveCompany');
const { requireOwnerOrAdmin } = require('../Utils/permissions');
const databaseController = require('../Src/Database/databaseController');

router.use(protect);
router.use(getActiveCompany);

// Quotations
router.get('/quotations', databaseController.getQuotations);
router.put('/quotations/:id', databaseController.updateQuotation);
router.delete('/quotations/:id', databaseController.deleteQuotation);

// BOMs
router.get('/boms', databaseController.getBoms);
router.put('/boms/:id', databaseController.updateBom);
router.delete('/boms/:id', databaseController.deleteBom);

// Clients (derived from quotations)
router.get('/clients', databaseController.getClients);
router.put('/clients', databaseController.updateClient);
router.delete('/clients', databaseController.deleteClient);

// Staff
router.get('/staff', databaseController.getStaff);
router.put('/staff/:userId', requireOwnerOrAdmin, databaseController.updateStaff);
router.delete('/staff/:userId', requireOwnerOrAdmin, databaseController.deleteStaff);

// Products
router.get('/products', databaseController.getProducts);
router.put('/products/:id', databaseController.updateProduct);
router.delete('/products/:id', databaseController.deleteProduct);

// Materials
router.get('/materials', databaseController.getMaterials);
router.put('/materials/:id', databaseController.updateMaterial);
router.delete('/materials/:id', databaseController.deleteMaterial);

module.exports = router;
