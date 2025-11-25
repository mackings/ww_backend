const mongoose = require('mongoose');

// Avoid model overwrite errors in dev
if (mongoose.models.BOM) {
  module.exports = mongoose.models.BOM;
} else {

  const materialSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true
    },
    woodType: String,
    foamType: String,
    type: String,
    width: Number,
    height: Number,
    length: Number,
    thickness: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'm', 'mm','ft','in'],
      default: 'cm'
    },
    squareMeter: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0
    },
    description: String,
    subtotal: {
      type: Number,
      default: 0
    }
  });

  /**
   * Additional Cost Schema
   * For extra costs such as labor, finishing, delivery, etc.
   */
  const additionalCostSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  });

  /**
   * BOM Schema
   */
  const bomSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    bomNumber: {
      type: String,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,

    // List of all materials
    materials: [materialSchema],

    // Additional cost list
    additionalCosts: [additionalCostSchema],

    // Auto-calculated totals
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

    // Optional quotation link
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null
    },

    // Timestamps
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

  /**
   * Auto-generate BOM number before saving
   */
  bomSchema.pre('save', async function (next) {
    // Auto-generate BOM number
    if (!this.bomNumber) {
      const count = await mongoose.model('BOM').countDocuments();
      this.bomNumber = `BOM-${(count + 1).toString().padStart(4, '0')}`;
    }

    // Calculate material subtotals
    this.materials.forEach(m => {
      m.subtotal = (m.price || 0) * (m.quantity || 1);
    });

    // Compute totals
    this.materialsCost = this.materials.reduce((sum, m) => sum + (m.subtotal || 0), 0);
    this.additionalCostsTotal = this.additionalCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
    this.totalCost = this.materialsCost + this.additionalCostsTotal;

    this.updatedAt = new Date();
    next();
  });

  /**
   * Recalculate totals before updates (findOneAndUpdate)
   */
  bomSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();

    if (update.materials || update.additionalCosts) {
      const materials = update.materials || [];
      const additionalCosts = update.additionalCosts || [];

      const materialsCost = materials.reduce((sum, m) => {
        const subtotal = (m.price || 0) * (m.quantity || 1);
        return sum + subtotal;
      }, 0);

      const additionalCostsTotal = additionalCosts.reduce((sum, c) => sum + (c.amount || 0), 0);

      update.materialsCost = materialsCost;
      update.additionalCostsTotal = additionalCostsTotal;
      update.totalCost = materialsCost + additionalCostsTotal;
      update.updatedAt = new Date();
    }

    next();
  });

  // Indexes
  bomSchema.index({ userId: 1, createdAt: -1 });
  bomSchema.index({ bomNumber: 1 });
  bomSchema.index({ productId: 1 });

  module.exports = mongoose.model('BOM', bomSchema);
}
