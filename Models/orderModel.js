const mongoose = require('mongoose');


const orderItemSchema = new mongoose.Schema({

  woodType: String,
  foamType: String,
  width: Number,
  height: Number,
  length: Number,
  thickness: Number,
  unit: {
    type: String,
    enum: ['cm', 'inch', 'm'],
    default: 'cm'
  },
  squareMeter: Number,
  quantity: {
    type: Number,
    default: 1
  },
  costPrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  description: String,
  image: String
});


const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  quotationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    required: true
  },
  orderNumber: {
    type: String,
    unique: true
  },
  quotationNumber: String,
  
  // Client/Customer Information
  
  clientName: {
    type: String,
    required: true
  },
  phoneNumber: String,
  email: String,
  clientAddress: String,
  nearestBusStop: String,
  
  // Order Items (copied from quotation)
  items: [orderItemSchema],
  
  // Service (if any from quotation)
  service: {
    product: String,
    quantity: Number,
    discount: Number,
    totalPrice: Number
  },
  
  // Financial Information (from quotation)
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalCost: {
    type: Number,
    default: 0
  },
  totalSellingPrice: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Payment Tracking
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'NGN'
  },
  
  // Payment Status
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  
  // Payment History
  payments: [{
    amount: Number,
    paymentDate: {
      type: Date,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'cheque', 'card', 'other']
    },
    reference: String,
    notes: String,
    recordedBy: String,
    recordedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Order Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'on_hold'],
    default: 'pending'
  },
  
  // Dates
  orderDate: {
    type: Date,
    default: Date.now
  },
  startDate: Date,
  endDate: Date,
  completedDate: Date,
  
  // Additional Information
  notes: String,
  internalNotes: String,
  description: String,
  
  // Linked Invoice
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Calculate balance
  this.balance = this.totalAmount - this.amountPaid;
  
  // Update payment status based on amount paid
  if (this.amountPaid === 0) {
    this.paymentStatus = 'unpaid';
  } else if (this.amountPaid >= this.totalAmount) {
    this.paymentStatus = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }
  
  // Update completion date
  if (this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  
  next();
});

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ quotationId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ clientName: 1 });
orderSchema.index({ orderDate: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);