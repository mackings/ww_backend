const mongoose = require('mongoose');


const materialSchema = new mongoose.Schema({
  woodType: { type: String, required: true },
  foamType: String,
  type: { type: String, enum: ['wood', 'foam', 'other'], default: 'wood' },
  width: Number,
  height: Number,
  length: Number,
  thickness: Number,
  unit: { type: String, enum: ['cm', 'inch', 'm'], default: 'cm' },
  squareMeter: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  description: String
});

const bomSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bomNumber: { type: String, unique: true },
    name: { type: String, required: true },
    description: String,
    materials: [materialSchema],
    totalCost: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// ✅ Auto-generate sequential BOM number
bomSchema.pre('save', async function (next) {
  if (!this.bomNumber) {
    const count = await mongoose.model('BOM').countDocuments();
    this.bomNumber = `BOM-${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

const BOM = mongoose.models.BOM || mongoose.model('BOM', bomSchema);
module.exports = BOM;
