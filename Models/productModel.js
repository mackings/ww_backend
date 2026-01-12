const mongoose = require('mongoose');


const productSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyName: {  // ✅ NEW: Company-level data
    type: String,
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

  // Approval workflow fields
  isGlobal: {
    type: Boolean,
    default: false,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  resubmissionCount: {
    type: Number,
    default: 0
  },
  approvalHistory: [{
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'resubmitted']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedByName: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

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

// Compound index for company + product
productSchema.index({ companyName: 1, productId: 1 }, { unique: true, sparse: true });
productSchema.index({ companyName: 1, category: 1 });
productSchema.index({ companyName: 1, createdAt: -1 });
// New indexes for approval workflow
productSchema.index({ isGlobal: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ submittedBy: 1 });

module.exports = mongoose.model('Product', productSchema);

// if (mongoose.models.Product) {
//   module.exports = mongoose.models.Product;
// } else {
//   const productSchema = new mongoose.Schema({
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: true,
//       index: true
//     },
//     name: {
//       type: String,
//       required: true
//     },
//     productId: {
//       type: String,
//       sparse: true
//     },
//     category: {
//       type: String,
//       required: true
//     },
//     subCategory: String,
//     description: String,
//     image: String,
//     createdAt: {
//       type: Date,
//       default: Date.now
//     },
//     updatedAt: {
//       type: Date,
//       default: Date.now
//     }
//   }, {
//     timestamps: true
//   });

//   // Compound index for unique product ID per user
//   productSchema.index({ userId: 1, productId: 1 }, { unique: true, sparse: true });
//   productSchema.index({ userId: 1, category: 1 });
//   productSchema.index({ userId: 1, createdAt: -1 });

//   module.exports = mongoose.model('Product', productSchema);
//}