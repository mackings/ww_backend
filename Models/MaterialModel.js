


const mongoose = require('mongoose');

const sizeSchema = new mongoose.Schema({
  width: { type: Number },
  length: { type: Number }
}, { _id: false });

const foamDensitySchema = new mongoose.Schema({
  density: { type: Number },
  unit: { type: String }
}, { _id: false });

const foamThicknessSchema = new mongoose.Schema({
  thickness: { type: Number },
  unit: { type: String }
}, { _id: false });

const materialTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  pricePerSqm: { type: Number }
}, { _id: false });

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unit: { type: String, required: true },
  standardWidth: { type: Number, required: true },
  standardLength: { type: Number, required: true },
  standardUnit: { type: String, required: true },
  pricePerSqm: { type: Number, required: true },
  sizes: [sizeSchema],
  foamDensities: [foamDensitySchema],
  foamThicknesses: [foamThicknessSchema],
  types: [materialTypeSchema],
  wasteThreshold: { type: Number, default: 0.75 }
}, { timestamps: true });

module.exports = mongoose.model('Material', materialSchema);