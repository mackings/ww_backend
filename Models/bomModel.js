const mongoose = require('mongoose');

// Check if model already exists
if (mongoose.models.BOM) {
  module.exports = mongoose.models.BOM;
} else {
  const materialSchema = new mongoose.Schema({
    woodType: {
      type: String,
      required: true
    },
    foamType: String,
    type: {
      type: String,
      enum: ['wood', 'foam', 'other'],
      default: 'wood'
    },
    width: Number,
    height: Number,
    length: Number,
    thickness: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'm', 'mm'],
      default: 'cm'
    },
    squareMeter: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    description: String
  });

  const additionalCostSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  });

  const bomSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    bomNumber: {
      type: String,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    description: String,
    materials: [materialSchema],
    additionalCosts: [additionalCostSchema],
    materialsCost: {
      type: Number,
      default: 0
    },
    additionalCostsTotal: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
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

  // Generate BOM number before saving
  bomSchema.pre('save', async function(next) {
    if (!this.bomNumber) {
      const count = await mongoose.model('BOM').countDocuments();
      this.bomNumber = `BOM-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
  });

  // Indexes
  bomSchema.index({ userId: 1, createdAt: -1 });
  bomSchema.index({ bomNumber: 1 });

  module.exports = mongoose.model('BOM', bomSchema);
}
