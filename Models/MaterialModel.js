const mongoose = require('mongoose');

// Sub-schemas for different material properties
const sizeVariantSchema = new mongoose.Schema({
  name: { type: String }, // e.g., "Full Sheet", "Half Sheet"
  width: { type: Number, required: true },
  length: { type: Number, required: true },
  unit: { type: String, default: 'inches' },
  pricePerUnit: { type: Number } // Optional override price
}, { _id: false });

const foamVariantSchema = new mongoose.Schema({
  thickness: { type: Number, required: true },
  thicknessUnit: { type: String, default: 'inches' },
  density: { type: String }, // e.g., "ordinary", "lemon", "grey"
  width: { type: Number },
  length: { type: Number },
  dimensionUnit: { type: String, default: 'inches' },
  pricePerSqm: { type: Number }
}, { _id: false });

const materialTypeSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "Iroko", "Mahogany", "Mdf"
  pricePerSqm: { type: Number },
  pricePerUnit: { type: Number }, // For items sold by piece
  standardWidth: { type: Number },
  standardLength: { type: Number },
  dimensionUnit: { type: String }
}, { _id: false });

// Common thickness schema for all material types
const commonThicknessSchema = new mongoose.Schema({
  thickness: { type: Number, required: true },
  unit: { type: String, default: 'mm', enum: ['mm', 'cm', 'inches', 'ft'] }
}, { _id: false });

// Main material schema
const materialSchema = new mongoose.Schema({
  // Basic Information

  companyName: {  // ✅ NEW: Make materials company-specific
    type: String,
    required: true,
    index: true
  },

  name: { 
    type: String, 
    required: true,
    trim: true
  }, // e.g., "Wood", "Board", "Foam", "Marble"
  
  category: {
    type: String,
    enum: ['WOOD', 'BOARD', 'FOAM', 'MARBLE', 'HARDWARE', 'FABRIC', 'OTHER'],
    required: true
  },

  // Standard Dimensions (for sheet materials)
  standardWidth: { type: Number },
  standardLength: { type: Number },
  standardUnit: { 
    type: String, 
    enum: ['mm', 'cm', 'm', 'inches', 'ft'],
    default: 'inches'
  },

  // Pricing
  pricePerSqm: { type: Number }, // Base price per square meter
  pricePerUnit: { type: Number }, // For items sold per piece (handles, nails, etc.)
  pricingUnit: {
    type: String,
    enum: ['sqm', 'piece', 'pound', 'bag', 'liter', 'meter'],
    default: 'sqm'
  },

  // Material Types/Variants
  types: [materialTypeSchema], // e.g., Wood types: Iroko, Mahogany, etc.
  
  // Size Variants (for materials with multiple size options)
  sizeVariants: [sizeVariantSchema], // e.g., Full Sheet, Half Sheet
  
  // Foam-specific variants
  foamVariants: [foamVariantSchema],

  // Common thicknesses for non-foam materials (Board, Wood, Marble, etc.)
  commonThicknesses: [commonThicknessSchema],

  // Waste Calculation
  wasteThreshold: { 
    type: Number, 
    default: 0.75,
    min: 0,
    max: 1
  }, // 75% threshold for extra unit

  // Additional Properties
  unit: { type: String }, // Legacy field - "per square meter", "per piece", etc.
  
  // Metadata
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  notes: { type: String },

  // Legacy arrays (keeping for backward compatibility)
  sizes: [{
    width: Number,
    length: Number
  }],
  
  foamDensities: [{
    density: Number,
    unit: String
  }],
  
  foamThicknesses: [{
    thickness: Number,
    unit: String
  }]

}, { 
  timestamps: true 
});

// Indexes for better query performance
materialSchema.index({ name: 1, category: 1 });
materialSchema.index({ 'types.name': 1 });
materialSchema.index({ isActive: 1 });

// Virtual for display name
materialSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.category})`;
});

// Method to get all available thicknesses for a material
materialSchema.methods.getAllThicknesses = function() {
  const thicknesses = [];
  
  // Get from commonThicknesses (for Board, Wood, etc.)
  if (this.commonThicknesses && this.commonThicknesses.length > 0) {
    this.commonThicknesses.forEach(ct => {
      thicknesses.push({
        thickness: ct.thickness,
        unit: ct.unit
      });
    });
  }
  
  // Get from foamVariants (for Foam)
  if (this.foamVariants && this.foamVariants.length > 0) {
    this.foamVariants.forEach(fv => {
      thicknesses.push({
        thickness: fv.thickness,
        unit: fv.thicknessUnit
      });
    });
  }
  
  // Get from legacy foamThicknesses
  if (this.foamThicknesses && this.foamThicknesses.length > 0) {
    this.foamThicknesses.forEach(ft => {
      thicknesses.push({
        thickness: ft.thickness,
        unit: ft.unit
      });
    });
  }
  
  // Remove duplicates based on thickness value
  const uniqueThicknesses = thicknesses.filter((item, index, self) =>
    index === self.findIndex((t) => t.thickness === item.thickness)
  );
  
  // Sort by thickness value
  return uniqueThicknesses.sort((a, b) => a.thickness - b.thickness);
};

// Method to get price for specific type
materialSchema.methods.getPriceForType = function(typeName) {
  if (!typeName) return this.pricePerSqm || this.pricePerUnit;
  
  const type = this.types.find(t => 
    t.name.toLowerCase() === typeName.toLowerCase()
  );
  
  return type?.pricePerSqm || type?.pricePerUnit || this.pricePerSqm || this.pricePerUnit;
};

// Method to get dimensions for specific variant
materialSchema.methods.getDimensionsForVariant = function(variantName) {
  if (!variantName) {
    return {
      width: this.standardWidth,
      length: this.standardLength,
      unit: this.standardUnit
    };
  }
  
  const variant = this.sizeVariants.find(v => 
    v.name.toLowerCase() === variantName.toLowerCase()
  );
  
  return variant || {
    width: this.standardWidth,
    length: this.standardLength,
    unit: this.standardUnit
  };
};

// Method to check if material has thickness options
materialSchema.methods.hasThicknessOptions = function() {
  return (this.commonThicknesses && this.commonThicknesses.length > 0) ||
         (this.foamVariants && this.foamVariants.length > 0) ||
         (this.foamThicknesses && this.foamThicknesses.length > 0);
};

module.exports = mongoose.model('Material', materialSchema);
