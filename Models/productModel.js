const mongoose = require('mongoose');

if (mongoose.models.Product) {
  module.exports = mongoose.models.Product;
} else {
  const productSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    productId: {
      type: String,
      sparse: true
    },
    category: {
      type: String,
      required: true
    },
    subCategory: String,
    description: String,
    image: String,
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

  // Compound index for unique product ID per user
  productSchema.index({ userId: 1, productId: 1 }, { unique: true, sparse: true });
  productSchema.index({ userId: 1, category: 1 });
  productSchema.index({ userId: 1, createdAt: -1 });

  module.exports = mongoose.model('Product', productSchema);
}