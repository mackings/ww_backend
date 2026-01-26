const mongoose = require('mongoose');
const Counter = require('./counterModel');

const receiptSchema = new mongoose.Schema({
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
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: String,
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },
  invoiceNumber: String,
  quotationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    default: null
  },
  quotationNumber: String,
  receiptNumber: {
    type: String
  },
  receiptDate: {
    type: Date,
    default: Date.now
  },
  clientName: {
    type: String,
    required: true
  },
  clientAddress: String,
  nearestBusStop: String,
  phoneNumber: String,
  email: String,
  subtotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
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
  currency: {
    type: String,
    default: 'NGN'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'cheque', 'card', 'other', 'transfer'],
    default: 'cash'
  },
  reference: String,
  notes: String,
  recordedBy: String,
  recordedAt: {
    type: Date,
    default: Date.now
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

receiptSchema.pre('save', async function(next) {
  if (!this.receiptNumber) {
    const counter = await Counter.findOneAndUpdate(
      { key: 'receiptNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.receiptNumber = `RC-${counter.seq.toString().padStart(4, '0')}`;
  }

  this.updatedAt = new Date();
  next();
});

receiptSchema.index({ userId: 1, createdAt: -1 });
receiptSchema.index({ orderId: 1 });
receiptSchema.index({ receiptNumber: 1 });

module.exports = mongoose.models.Receipt || mongoose.model('Receipt', receiptSchema);
