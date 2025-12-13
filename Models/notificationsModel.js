
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'permissions_updated',
      'permission_granted',
      'permission_revoked',
      'access_granted',
      'access_revoked',
      'staff_added',
      'staff_removed',
      'product_created',
      'product_updated',
      'product_deleted',
      'quotation_created',
      'quotation_updated',
      'quotation_deleted',
      'order_created',
      'order_updated',
      'order_deleted',
      'order_assigned',
      'invoice_created',
      'invoice_updated',
      'invoice_deleted',
      'bom_created',
      'bom_updated',
      'bom_deleted',
      'material_created',
      'material_updated',
      'material_deleted',
      'overhead_cost_created',
    'overhead_cost_updated',
    'overhead_cost_deleted',
    'order_assigned',
    'order_unassigned',
    ],
    
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedByName: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

// Compound indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ companyName: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);