const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
    sparse: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'admin',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // The admin who created this staff
  },
  accessGranted: {
    type: Boolean,
    default: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
