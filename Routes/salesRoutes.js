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
const {
  createOrderFromQuotation,
  getAllOrders,
  getOrder,
  updateOrder,
  addPayment,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
  getOrderReceipt
} = require("../Src/Sales/order"); 

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

// Order routes
router.post('/orders/create', protect, createOrderFromQuotation);
router.get('/orders', protect, getAllOrders);
router.get('/orders/stats', protect, getOrderStats);
router.get('/orders/:id', protect, getOrder);
router.get('/orders/:id/receipt', protect, getOrderReceipt);
router.put('/orders/:id', protect, updateOrder);
router.post('/orders/:id/payment', protect, addPayment);
router.patch('/orders/:id/status', protect, updateOrderStatus);
router.delete('/orders/:id', protect, deleteOrder);

module.exports = router;