const express = require("express");
const { getClients, getSalesAnalytics, getInventoryStatus } = require("../Src/Sales/sales");
const { protect } = require("../Utils/auth");
const { getActiveCompany } = require('../Utils/ActiveCompany');
const { checkPermission, checkAnyPermission } = require('../Utils/permissions');

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

// Apply auth and company middleware to all routes
router.use(protect);
router.use(getActiveCompany);

// ✅ Sales routes - require 'sales' permission
router.get('/get-clients', checkPermission('sales'), getClients);
router.get('/get-sales', checkPermission('sales'), getSalesAnalytics);

// ✅ Inventory can be accessed by sales OR order staff
router.get('/get-inventory', checkAnyPermission(['sales', 'order']), getInventoryStatus);

// ✅ Order routes - require 'order' permission
router.post('/orders/create', checkPermission('order'), createOrderFromQuotation);
router.get('/orders', checkPermission('order'), getAllOrders);
router.get('/orders/stats', checkPermission('order'), getOrderStats);
router.get('/orders/:id', checkPermission('order'), getOrder);

// ✅ Receipt can be accessed by order OR invoice staff
router.get('/orders/:id/receipt', checkAnyPermission(['order', 'invoice']), getOrderReceipt);

router.put('/orders/:id', checkPermission('order'), updateOrder);
router.post('/orders/:id/payment', checkPermission('order'), addPayment);
router.patch('/orders/:id/status', checkPermission('order'), updateOrderStatus);
router.delete('/orders/:id', checkPermission('order'), deleteOrder);

module.exports = router;