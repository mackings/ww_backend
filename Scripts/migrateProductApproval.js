const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../Models/productModel');
const User = require('../Models/user');

async function migrateProductApproval() {
  try {
    console.log('🔄 Starting product approval migration...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Update all existing products
    const updateResult = await Product.updateMany(
      {
        status: { $exists: false } // Only update products without status field
      },
      {
        $set: {
          isGlobal: false,
          status: 'approved',  // Auto-approve existing products
          approvedAt: new Date(),
          resubmissionCount: 0,
          approvalHistory: [{
            action: 'approved',
            performedByName: 'System Migration',
            reason: 'Existing product auto-approved during migration',
            timestamp: new Date()
          }]
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} products`);

    // Set submittedBy to userId for existing products
    const products = await Product.find({ submittedBy: { $exists: false } });

    let submittedByCount = 0;
    for (const product of products) {
      product.submittedBy = product.userId;
      await product.save();
      submittedByCount++;
    }

    console.log(`✅ Set submittedBy for ${submittedByCount} products`);

    // Display summary
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n📊 Product Status Summary:');
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
}

// Run migration
migrateProductApproval();
