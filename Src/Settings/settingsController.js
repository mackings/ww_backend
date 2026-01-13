const Settings = require('../../Models/settingsModel');
const ApiResponse = require('../../Utils/apiResponse');

const coerceBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
};

const applyBoolean = (target, key, value) => {
  const coerced = coerceBoolean(value);
  if (coerced !== undefined) {
    target[key] = coerced;
  }
};

/**
 * @desc    Get company settings (create defaults if missing)
 * @route   GET /api/settings
 * @access  Private (company context)
 */
exports.getSettings = async (req, res) => {
  try {
    if (!req.companyName) {
      return ApiResponse.error(res, 'Company context required', 400);
    }

    let settings = await Settings.findOne({ companyName: req.companyName });

    if (!settings) {
      settings = await Settings.create({
        companyName: req.companyName,
        updatedBy: req.user._id
      });
    }

    return ApiResponse.success(res, 'Settings fetched successfully', settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return ApiResponse.error(res, 'Error fetching settings', 500);
  }
};

/**
 * @desc    Update company settings
 * @route   PUT /api/settings
 * @access  Private (Owner/Admin)
 */
exports.updateSettings = async (req, res) => {
  try {
    if (!req.companyName) {
      return ApiResponse.error(res, 'Company context required', 400);
    }

    const {
      cloudSyncEnabled,
      autoBackupEnabled,
      notifications
    } = req.body || {};

    let settings = await Settings.findOne({ companyName: req.companyName });

    if (!settings) {
      settings = new Settings({ companyName: req.companyName });
    }

    applyBoolean(settings, 'cloudSyncEnabled', cloudSyncEnabled);
    applyBoolean(settings, 'autoBackupEnabled', autoBackupEnabled);

    if (notifications && typeof notifications === 'object') {
      settings.notifications = settings.notifications || {};
      applyBoolean(settings.notifications, 'pushNotification', notifications.pushNotification);
      applyBoolean(settings.notifications, 'emailNotification', notifications.emailNotification);
      applyBoolean(settings.notifications, 'quotationReminders', notifications.quotationReminders);
      applyBoolean(settings.notifications, 'projectDeadlines', notifications.projectDeadlines);
      applyBoolean(settings.notifications, 'backupAlerts', notifications.backupAlerts);
    }

    settings.updatedBy = req.user._id;
    await settings.save();

    return ApiResponse.success(res, 'Settings updated successfully', settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return ApiResponse.error(res, 'Error updating settings', 500);
  }
};
