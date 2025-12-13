// Utils/notificationHelper.js

const Notification = require('../Models/notificationsModel');
const User = require('../Models/user');



/**
 * Create notification for all staff in a company
 */
const notifyCompany = async ({
  companyName,
  type,
  title,
  message,
  performedBy,
  performedByName,
  metadata = {},
  excludeUserId = null
}) => {
  try {
    // Find all users in this company
    const users = await User.find({
      'companies.name': companyName
    });

    const notifications = [];

    for (const user of users) {
      // Skip if this is the user who performed the action
      if (excludeUserId && user._id.toString() === excludeUserId.toString()) {
        continue;
      }

      const companyData = user.companies.find(c => c.name === companyName);
      
      // Only notify if they have access
      if (companyData && companyData.accessGranted) {
        notifications.push({
          userId: user._id,
          companyName,
          type,
          title,
          message,
          performedBy,
          performedByName,
          metadata
        });
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    console.log(`✅ Created ${notifications.length} notifications for company: ${companyName}`);
  } catch (error) {
    console.error('❌ Notify company error:', error);
  }
};

/**
 * Create notification for a single user
 */
const notifyUser = async ({
  userId,
  companyName,
  type,
  title,
  message,
  performedBy,
  performedByName,
  metadata = {}
}) => {
  try {
    await Notification.create({
      userId,
      companyName,
      type,
      title,
      message,
      performedBy,
      performedByName,
      metadata
    });

    console.log(`✅ Notification sent to user: ${userId}`);
  } catch (error) {
    console.error('❌ Notify user error:', error);
  }
};

module.exports = {
  notifyCompany,
  notifyUser
};