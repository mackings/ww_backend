const mongoose = require('mongoose');
require('dotenv').config();
const Material = require('../Models/MaterialModel');

async function migrateMaterialApproval() {
  try {
    console.log('🚀 Starting Material Approval Migration...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    const result = await Material.updateMany(
      { status: { $exists: false } },
      {
        $set: {
          isGlobal: false,
          status: 'approved',
          approvedAt: new Date(),
          resubmissionCount: 0,
          approvalHistory: [{
            action: 'approved',
            performedByName: 'System Migration',
            reason: 'Existing material auto-approved during migration',
            timestamp: new Date()
          }]
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} materials to approved status\n`);

    // Update submittedBy field for existing materials
    const materials = await Material.find({ submittedBy: { $exists: false } });
    console.log(`📝 Setting submittedBy for ${materials.length} materials...`);

    for (const material of materials) {
      // You can set to company owner or a default user
      // For now, we'll leave it null since we don't know who created it
      material.submittedBy = null;
      await material.save({ validateBeforeSave: false });
    }

    const totalMaterials = await Material.countDocuments();
    const approvedMaterials = await Material.countDocuments({ status: 'approved' });

    console.log('\n📊 Migration Summary:');
    console.log(`   Total materials: ${totalMaterials}`);
    console.log(`   Approved materials: ${approvedMaterials}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
    process.exit(0);
  }
}

migrateMaterialApproval();
