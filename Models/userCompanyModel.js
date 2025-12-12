const mongoose = require('mongoose');

const userCompanySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'staff'],
    required: true,
  },
  position: {
    type: String,
    trim: true,
  },
  accessGranted: {
    type: Boolean,
    default: true,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Compound index to ensure a user can only have one role per company
userCompanySchema.index({ user: 1, company: 1 }, { unique: true });

module.exports = mongoose.models.UserCompany || mongoose.model('UserCompany', userCompanySchema);