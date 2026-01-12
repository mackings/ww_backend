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

/**
 * Notify all platform owners
 */
const notifyPlatformOwners = async ({
  type,
  title,
  message,
  performedBy,
  performedByName,
  metadata = {}
}) => {
  try {
    const platformOwners = await User.find({ isPlatformOwner: true });

    const notifications = platformOwners.map(owner => ({
      userId: owner._id,
      companyName: 'PLATFORM',
      type,
      title,
      message,
      performedBy,
      performedByName,
      metadata
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    console.log(`✅ Notified ${notifications.length} platform owners`);
  } catch (error) {
    console.error('❌ Notify platform owners error:', error);
  }
};

/**
 * Notify all company owners (not platform owners)
 */
const notifyAllCompanyOwners = async ({
  type,
  title,
  message,
  performedBy,
  performedByName,
  metadata = {}
}) => {
  try {
    const users = await User.find({
      'companies.role': 'owner',
      isPlatformOwner: { $ne: true }
    });

    const notifications = [];

    for (const user of users) {
      for (const company of user.companies) {
        if (company.role === 'owner' && company.accessGranted) {
          notifications.push({
            userId: user._id,
            companyName: company.name,
            type,
            title,
            message,
            performedBy,
            performedByName,
            metadata
          });
        }
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    console.log(`✅ Notified ${notifications.length} company owners`);
  } catch (error) {
    console.error('❌ Notify company owners error:', error);
  }
};

module.exports = {
  notifyCompany,
  notifyUser,
  notifyPlatformOwners,
  notifyAllCompanyOwners
};