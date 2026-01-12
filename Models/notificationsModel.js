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
    required: false,
    index: true
  },
  type: {
    type: String,
    enum: [


      // Company events
      'company_created',
      

      // Permission events
      'permissions_updated',
      'permission_granted',
      'permission_revoked',
      

      // Access events
      'access_granted',
      'access_revoked',
      
      // Staff events
      'staff_added',
      'staff_removed',
      
      // Product events
      'product_created',
      'product_updated',
      'product_deleted',
      'product_submitted_for_approval',
      'product_approved',
      'product_rejected',
      'product_resubmitted',
      'global_product_added',
      
      // Quotation events
      'quotation_created',
      'quotation_updated',
      'quotation_deleted',
      
      // Order events
      'order_created',
      'order_updated',
      'order_deleted',
      'order_assigned',
      'order_unassigned',
      
      // Invoice events
      'invoice_created',
      'invoice_updated',
      'invoice_deleted',
      
      // BOM events
      'bom_created',
      'bom_updated',
      'bom_deleted',
      
      // Material events
      'material_created',
      'material_updated',
      'material_deleted',
      
      // Overhead cost events
      'overhead_cost_created',
      'overhead_cost_updated',
      'overhead_cost_deleted',

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