const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../Models/user');

async function createPlatformOwner() {
  try {
    console.log('🚀 Creating Platform Owner...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Platform owner credentials
    const platformOwnerData = {
      fullname: 'Platform Admin',
      email: 'admin@woodworker.com',
      phoneNumber: '+1234567890',
      password: 'Admin@2024'
    };

    console.log('Creating platform owner with:');
    console.log(`Email: ${platformOwnerData.email}`);
    console.log(`Password: ${platformOwnerData.password}\n`);

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: platformOwnerData.email },
        { phoneNumber: platformOwnerData.phoneNumber }
      ]
    });

    if (existingUser) {
      console.log('⚠️  User already exists with this email or phone');
      console.log('Updating existing user to platform owner...\n');

      existingUser.isPlatformOwner = true;
      existingUser.platformOwnerSince = new Date();
      await existingUser.save();

      console.log('✅ User updated to platform owner!');
      console.log(`   ID: ${existingUser._id}`);
      console.log(`   Name: ${existingUser.fullname}`);
      console.log(`   Email: ${existingUser.email}`);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(platformOwnerData.password, 12);

      // Create platform owner
      const platformOwner = await User.create({
        fullname: platformOwnerData.fullname,
        email: platformOwnerData.email,
        phoneNumber: platformOwnerData.phoneNumber,
        password: hashedPassword,
        isPlatformOwner: true,
        platformOwnerSince: new Date(),
        isVerified: true,
        companies: [],
        activeCompanyIndex: 0
      });

      console.log('✅ Platform owner created successfully!');
      console.log(`   ID: ${platformOwner._id}`);
      console.log(`   Name: ${platformOwner.fullname}`);
      console.log(`   Email: ${platformOwner.email}`);
    }

    console.log('\n📧 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${platformOwnerData.email}`);
    console.log(`Password: ${platformOwnerData.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
    process.exit(0);
  }
}

// Run script
createPlatformOwner();
