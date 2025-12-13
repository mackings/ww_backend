// Routes/notificationRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../Utils/auth');
const { getActiveCompany } = require('../Utils/ActiveCompany');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount
} = require('../Src/Auth/notificationController');

// Apply middlewares
router.use(protect);
router.use(getActiveCompany);

// Routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;