const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },

   isActive: {
    type: Boolean,
    default: true,
  },
  
  
  // Multiple Companies Support
  companies: [{
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'staff'],
      default: 'staff',
    },
    position: {
      type: String,
      trim: true,
      default: 'Staff',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    accessGranted: {
      type: Boolean,
      default: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },

    permissions: {
      quotation: { type: Boolean, default: false },
      sales: { type: Boolean, default: false },
      order: { type: Boolean, default: false },
      database: { type: Boolean, default: false },
      receipts: { type: Boolean, default: false },
      backupAlerts: { type: Boolean, default: false },
      invoice: { type: Boolean, default: false },
      products: { type: Boolean, default: false },
      boms: { type: Boolean, default: false },
    },
  }],
  

  activeCompanyIndex: {
    type: Number,
    default: 0,
  },
  
  // Verification & Reset
  isVerified: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

// Helper method to get active company
userSchema.methods.getActiveCompany = function() {
  if (this.companies && this.companies.length > 0) {
    return this.companies[this.activeCompanyIndex] || this.companies[0];
  }
  return null;
};

// Helper method to check if user is owner/admin in active company
userSchema.methods.canManageStaff = function() {
  const activeCompany = this.getActiveCompany();
  return activeCompany && ['owner', 'admin'].includes(activeCompany.role);
};



module.exports = mongoose.models.User || mongoose.model('User', userSchema);