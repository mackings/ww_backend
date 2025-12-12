const express = require("express");
const { protect } = require("../Utils/auth");
const  {getActiveCompany} = require('../Utils/ActiveCompany');


const {
  createInvoiceFromQuotation,
  getAllInvoices,
  getInvoice,
  updateInvoicePayment,
  updateInvoiceStatus,
  deleteInvoice,
  getInvoiceStats,
  uploadPdf
} = require("../Src/Sales/invoice");


const router = express.Router();

router.use(protect);
router.use(getActiveCompany);

// Invoice routes
router.post('/create', protect, uploadPdf, createInvoiceFromQuotation);
router.get('/invoices', protect, getAllInvoices);
router.get('/invoices/stats', protect, getInvoiceStats);
router.get('/invoices/:id', protect, getInvoice);
router.patch('/:id/payment', protect, updateInvoicePayment);
router.patch('/invoices/:id/status', protect, updateInvoiceStatus);
router.delete('/invoices/:id', protect, deleteInvoice);


module.exports = router;