const express = require("express");
const { getClients } = require("../Src/Sales/sales");
const { protect } = require("../Utils/auth");
const {
  createInvoiceFromQuotation,
  getAllInvoices,
  getInvoice,
  updateInvoicePayment,
  updateInvoiceStatus,
  deleteInvoice,
  getInvoiceStats
} = require("../Src/Sales/invoice"); 

const router = express.Router();



// Sales routes
router.get('/get-clients', protect, getClients);

// Invoice routes
router.post('/invoices/create', protect, createInvoiceFromQuotation);
router.get('/invoices', protect, getAllInvoices);
router.get('/invoices/stats', protect, getInvoiceStats);
router.get('/invoices/:id', protect, getInvoice);
router.patch('/invoices/:id/payment', protect, updateInvoicePayment);
router.patch('/invoices/:id/status', protect, updateInvoiceStatus);
router.delete('/invoices/:id', protect, deleteInvoice);

module.exports = router;