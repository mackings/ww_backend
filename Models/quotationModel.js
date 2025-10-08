const mongoose = require('mongoose');

// Check if model already exists
if (mongoose.models.Quotation) {
  module.exports = mongoose.models.Quotation;
} else {
  const itemSchema = new mongoose.Schema({
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

  const quotationSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    quotationNumber: {
      type: String,
      unique: true
    },
    clientName: {
      type: String,
      required: true
    },
    clientAddress: String,
    nearestBusStop: String,
    phoneNumber: String,
    email: String,
    description: String,
    items: [itemSchema],
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
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'rejected', 'completed'],
      default: 'draft'
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

  // Generate quotation number before saving
  quotationSchema.pre('save', async function(next) {
    if (!this.quotationNumber) {
      const count = await mongoose.model('Quotation').countDocuments();
      this.quotationNumber = `QT-${(count + 1).toString().padStart(5, '0')}`;
    }
    next();
  });

//   // Indexes
//   quotationSchema.index({ userId: 1, createdAt: -1 });
//   quotationSchema.index({ quotationNumber: 1 });
//   quotationSchema.index({ status: 1 });

  module.exports = mongoose.model('Quotation', quotationSchema);
}