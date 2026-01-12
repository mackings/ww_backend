const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('../Models/user');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createPlatformOwner() {
  try {
    console.log('🚀 Platform Owner Setup\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Get user input
    const fullname = await question('Enter full name: ');
    const email = await question('Enter email: ');
    const phoneNumber = await question('Enter phone number: ');
    const password = await question('Enter password (min 8 characters): ');

    if (!fullname || !email || !phoneNumber || !password) {
      console.log('❌ All fields are required');
      process.exit(1);
    }

    if (password.length < 8) {
      console.log('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });

    if (existingUser) {
      console.log('\n⚠️  User already exists with this email or phone');
      const makeOwner = await question('Make this user a platform owner? (yes/no): ');

      if (makeOwner.toLowerCase() === 'yes') {
        existingUser.isPlatformOwner = true;
        existingUser.platformOwnerSince = new Date();
        await existingUser.save();
        console.log('✅ User updated to platform owner');
        console.log(`   ID: ${existingUser._id}`);
        console.log(`   Name: ${existingUser.fullname}`);
        console.log(`   Email: ${existingUser.email}`);
      } else {
        console.log('❌ Operation cancelled');
      }

      rl.close();
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create platform owner
    const platformOwner = await User.create({
      fullname,
      email,
      phoneNumber,
      password: hashedPassword,
      isPlatformOwner: true,
      platformOwnerSince: new Date(),
      isVerified: true,
      companies: [],
      activeCompanyIndex: 0
    });

    console.log('\n✅ Platform owner created successfully!');
    console.log(`   ID: ${platformOwner._id}`);
    console.log(`   Name: ${platformOwner.fullname}`);
    console.log(`   Email: ${platformOwner.email}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
  }
}

// Run script
createPlatformOwner();
