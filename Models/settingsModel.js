const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  pushNotification: { type: Boolean, default: true },
  emailNotification: { type: Boolean, default: true },
  quotationReminders: { type: Boolean, default: true },
  projectDeadlines: { type: Boolean, default: true },
  backupAlerts: { type: Boolean, default: true }
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  cloudSyncEnabled: {
    type: Boolean,
    default: false
  },
  autoBackupEnabled: {
    type: Boolean,
    default: false
  },
  notifications: {
    type: notificationSettingsSchema,
    default: () => ({})
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
