const express = require('express');
const helmet = require('helmet');
require('dotenv').config({ quiet: true });
const connectDB = require('./Utils/dbConnect');
const { startReminderScheduler } = require('./Utils/reminderScheduler');

const app = express();

// Basic middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Ensure DB connection before handling requests (fixes buffering timeouts).
app.use(async (req, res, next) => {
  // Let health check succeed even if DB is down.
  if (req.path === '/health') return next();

  try {
    await connectDB();

    // Start scheduler once per warm instance (optional).
    if (!global.__wwBackendSchedulerStarted) {
      global.__wwBackendSchedulerStarted = true;
      startReminderScheduler();
    }

    return next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return res.status(503).json({
      success: false,
      message: 'Database connection unavailable'
    });
  }
});

// Routes
//const authRoutes = require('../wwBackend/Routes/authRoutes');
const authRoutes = require("./Routes/authRoutes");
const bomRoutes = require("./Routes/bomRoutes");
const quotationRoutes = require("./Routes/quotationRoutes");
const productRoutes = require("./Routes/productRoutes");
//const staffRoutes = require("./Routes/staffRoutes");
const salesRoutes = require("./Routes/salesRoutes");
const invoicesRoutes = require("./Routes/invoicesRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const OCost = require("./Routes/ocRoutes")
const NotRoutes = require('./Routes/notificationRoutes');
const permRoutes = require('./Routes/permRoutes');
const platformRoutes = require('./Routes/platformRoutes');
const settingsRoutes = require('./Routes/settingsRoutes');
const databaseRoutes = require('./Routes/databaseRoutes');


app.use('/api/auth', authRoutes);
app.use('/api/quotation', quotationRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/product', productRoutes);
//app.use('/api/staff', staffRoutes);
app.use("/api/sales", salesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/orders',orderRoutes);
app.use('/api/oc/', OCost);
app.use("/api/notifications", NotRoutes);
app.use("/api/permission", permRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/database', databaseRoutes);

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

// Local dev server (Vercel serverless will use `module.exports = app`)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
