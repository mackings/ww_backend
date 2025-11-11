const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  woodType: {
    type: String,
    required: true
  },
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

const invoiceSchema = new mongoose.Schema({
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
  invoiceNumber: {
    type: String,
    unique: true
  },
  quotationNumber: String,
  clientName: {
    type: String,
    required: true
  },
  clientAddress: String,
  nearestBusStop: String,
  phoneNumber: String,
  email: String,
  description: String,
  items: [invoiceItemSchema],
  service: {
    product: String,
    quantity: Number,
    discount: Number,
    totalPrice: Number
  },
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
  finalTotal: {
    type: Number,
    default: 0
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  dueDate: {
    type: Date
  },
  paidDate: {
    type: Date
  },
  notes: String,
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

// Generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `INV-${(count + 1).toString().padStart(5, '0')}`;
  }
  
  // Calculate balance
  this.balance = this.finalTotal - this.amountPaid;
  
  // Update payment status
  if (this.amountPaid === 0) {
    this.paymentStatus = 'unpaid';
  } else if (this.amountPaid >= this.finalTotal) {
    this.paymentStatus = 'paid';
    this.status = 'paid';
    if (!this.paidDate) {
      this.paidDate = new Date();
    }
  } else {
    this.paymentStatus = 'partial';
  }
  
  next();
});

// Indexes
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ quotationId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paymentStatus: 1 });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);