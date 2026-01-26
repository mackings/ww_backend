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
    enum: ['cm', 'inch', 'm','ft','in'],
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

const orderBomMaterialSchema = new mongoose.Schema({
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
    min: 0
  },
  price: {
    type: Number,
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

const orderBomAdditionalCostSchema = new mongoose.Schema({
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

const orderBomSchema = new mongoose.Schema({
  bomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM',
    required: true
  },
  bomNumber: String,
  name: String,
  description: String,
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  product: {
    productId: String,
    name: String,
    description: String,
    image: String
  },
  materials: [orderBomMaterialSchema],
  additionalCosts: [orderBomAdditionalCostSchema],
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
  pricing: {
    pricingMethod: String,
    markupPercentage: {
      type: Number,
      default: 0
    },
    materialsTotal: {
      type: Number,
      default: 0
    },
    additionalTotal: {
      type: Number,
      default: 0
    },
    overheadCost: {
      type: Number,
      default: 0
    },
    costPrice: {
      type: Number,
      default: 0
    },
    sellingPrice: {
      type: Number,
      default: 0
    }
  },
  expectedDuration: {
    value: {
      type: Number,
      required: false
    },
    unit: {
      type: String,
      enum: ['Hour', 'Day', 'Week', 'Month'],
      default: 'Day'
    }
  },
  dueDate: {
    type: Date,
    default: null
  }
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

    companyName: {  // ✅ NEW
    type: String,
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

  // BOMs linked to this order (snapshot of BOMs at order creation)
  boms: [orderBomSchema],
  bomIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BOM'
  }],
  
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
      enum: ['cash', 'bank_transfer', 'cheque', 'card', 'other','transfer']
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

  assignedTo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
assignedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
assignedAt: {
  type: Date,
  default: null
},
assignmentNotes: {
  type: String,
  default: null
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


orderSchema.index({ assignedTo: 1 });

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
