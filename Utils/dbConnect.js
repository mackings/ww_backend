const mongoose = require('mongoose');

// Serverless-friendly mongoose connection caching.
// Vercel will reuse the same lambda instance across requests sometimes,
// so caching prevents creating a new TCP connection per request.

const globalKey = '__wwBackendMongoose';
const cached = global[globalKey] || { conn: null, promise: null };
global[globalKey] = cached;

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  return uri;
};

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = getMongoUri();
    cached.promise = mongoose.connect(uri, {
      // Make cold-start connections more resilient on serverless.
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      bufferTimeoutMS: 30000
    }).then((mongooseInstance) => mongooseInstance);
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;

