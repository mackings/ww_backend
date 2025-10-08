const mongoose = require('mongoose');



let otpSchema;

if (mongoose.models.OTP) {
  module.exports = mongoose.models.OTP;
} else {
  otpSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    otp: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['password_reset', 'verification'],
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index - will be set dynamically later
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });


  otpSchema.index({ userId: 1, type: 1 });
  module.exports = mongoose.model('OTP', otpSchema);
}
