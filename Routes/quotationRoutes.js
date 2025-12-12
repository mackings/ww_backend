const express = require('express');
const router = express.Router();
const quotationController = require('../Src/Quotation/quotation');
const { protect } = require('../Utils/auth');
const  {getActiveCompany} = require('../Utils/ActiveCompany');


// All routes require authentication
router.use(protect);
router.use(getActiveCompany);

// Quotation CRUD
router.post('/', quotationController.createQuotation);
router.get('/', quotationController.getAllQuotations);
router.get('/:id', quotationController.getQuotation);
router.put('/:id', quotationController.updateQuotation);
router.delete('/:id', quotationController.deleteQuotation);

// Item management
router.post('/:id/items', quotationController.addItemToQuotation);
router.delete('/:id/items/:itemId', quotationController.deleteItemFromQuotation);

// PDF generation
router.get('/:id/pdf', quotationController.generateQuotationPDF);

module.exports = router;