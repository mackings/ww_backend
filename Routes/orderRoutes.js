const express = require("express");
const { protect } = require("../Utils/auth");


const {
  createOrderFromQuotation,
  getAllOrders,
  getOrder,
  updateOrder,
  addPayment,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
  getOrderReceipt,
  assignOrderToStaff,
  unassignOrderFromStaff,
  getAvailableStaff
} = require("../Src/Sales/order"); 

const router = express.Router();

// Order routes
router.post('/create', protect, createOrderFromQuotation);
router.get('/get-orders', protect, getAllOrders);
router.get('/stats', protect, getOrderStats);
router.get('/get-orders/:id', protect, getOrder);
router.get('/get-orders/:id/receipt', protect, getOrderReceipt);
router.put('/orders/:id', protect, updateOrder);
router.post('/orders/:id/payment', protect, addPayment);
router.patch('/update-orders/:id/status', protect, updateOrderStatus);
router.delete('/delete-orders/:id', protect, deleteOrder);


router.post('/:id/assign', protect, assignOrderToStaff);
router.post('/:id/unassign', protect, unassignOrderFromStaff);
router.get('/staff/available', protect, getAvailableStaff);

module.exports = router;