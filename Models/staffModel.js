const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  // Reference to the user who created this staff
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Staff role
  role: {
    type: String,
    enum: ['admin', 'manager', 'staff', 'viewer'],
    default: 'staff'
  },
  // Permissions array
  permissions: [{
    module: {
      type: String,
      enum: ['products', 'purchases', 'users', 'reports', 'settings', 'wallet', 'delivery'],
      required: true
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve'],
    }]
  }],
  // Access status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Last login tracking
  lastLogin: {
    type: Date
  },
  // Access revocation details
  revokedAt: {
    type: Date
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revokedReason: {
    type: String
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, {
  timestamps: true
});

// Index for querying active staff by creator
staffSchema.index({ createdBy: 1, isActive: 1 });

// Method to check if staff has specific permission
staffSchema.methods.hasPermission = function(module, action) {
  if (!this.isActive) return false;
  
  const permission = this.permissions.find(p => p.module === module);
  if (!permission) return false;
  
  return permission.actions.includes(action);
};

// Method to revoke access
staffSchema.methods.revokeAccess = function(revokedBy, reason) {
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokedReason = reason;
  return this.save();
};

// Method to restore access
staffSchema.methods.restoreAccess = function() {
  this.isActive = true;
  this.revokedAt = undefined;
  this.revokedBy = undefined;
  this.revokedReason = undefined;
  return this.save();
};

module.exports = mongoose.models.Staff || mongoose.model('Staff', staffSchema);