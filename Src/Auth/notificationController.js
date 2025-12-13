// Controllers/notificationController.js

const Notification = require('../../Models/notificationsModel');
const { success, error } = require('../../Utils/apiResponse');

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = {
      userId: req.user._id,
      companyName: req.companyName
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('performedBy', 'fullname email');

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      companyName: req.companyName,
      isRead: false
    });

    return success(res, 'Notifications fetched successfully', {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });

  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return error(res, 'Notification not found', 404);
    }

    return success(res, 'Notification marked as read', notification);

  } catch (err) {
    console.error('Mark as read error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        userId: req.user._id,
        companyName: req.companyName,
        isRead: false 
      },
      { isRead: true }
    );

    return success(res, 'All notifications marked as read');

  } catch (err) {
    console.error('Mark all as read error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!notification) {
      return error(res, 'Notification not found', 404);
    }

    return success(res, 'Notification deleted');

  } catch (err) {
    console.error('Delete notification error:', err);
    return error(res, 'Server error', 500);
  }
};

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      companyName: req.companyName,
      isRead: false
    });

    return success(res, 'Unread count fetched', { count });

  } catch (err) {
    console.error('Get unread count error:', err);
    return error(res, 'Server error', 500);
  }
};

// module.exports = {
//   getNotifications,
//   markAsRead,
//   markAllAsRead,
//   deleteNotification,
//   getUnreadCount
// };