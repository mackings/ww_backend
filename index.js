const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
require('dotenv').config({ quiet: true });

const app = express();

// Basic middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('../wwBackend/Routes/authRoutes');
const bomRoutes = require("../wwBackend/Routes/bomRoutes");
const quotationRoutes = require("../wwBackend/Routes/quotationRoutes");
const productRoutes = require("../wwBackend/Routes/productRoutes");
app.use('/api/auth', authRoutes);
app.use('/api/quotation', quotationRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/product', productRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
