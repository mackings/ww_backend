const express = require("express");
const { getClients, getSalesAnalytics, getInventoryStatus } = require("../Src/Sales/sales");
const { protect } = require("../Utils/auth");
const  {getActiveCompany} = require('../Utils/ActiveCompany');


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


router.use(protect);
router.use(getActiveCompany);

// Sales routes
router.get('/get-clients', protect, getClients);

router.get('/get-sales', protect, getSalesAnalytics);

router.get('/get-inventory', protect, getInventoryStatus);

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