const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../Models/user');
const Company = require('../Models/companyModel');
const UserCompany = require('../Models/userCompanyModel');

/**
 * Migration Script: Move companies from User.companies array to Company collection
 *
 * OLD STRUCTURE: User.companies[] (embedded documents)
 * NEW STRUCTURE: Company collection + UserCompany junction table
 */

async function migrateCompanies() {
  try {
    console.log('🚀 Starting Company Migration...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Find all users with companies in their array
    const usersWithCompanies = await User.find({
      'companies.0': { $exists: true }, // Has at least one company
      isPlatformOwner: { $ne: true }    // Exclude platform owners
    });

    console.log(`📊 Found ${usersWithCompanies.length} users with companies in old structure\n`);

    let companiesMigrated = 0;
    let linksMigrated = 0;
    let skippedDuplicates = 0;
    const processedCompanies = new Map(); // Track by company name to avoid duplicates

    for (const user of usersWithCompanies) {
      console.log(`\n👤 Processing user: ${user.fullname} (${user.email})`);
      console.log(`   Found ${user.companies.length} companies`);

      for (const oldCompany of user.companies) {
        const companyName = oldCompany.name;

        // Skip if no company name
        if (!companyName) {
          console.log(`   ⚠️  Skipping company with no name`);
          continue;
        }

        try {
          let companyDoc;

          // Check if we already processed this company (same name)
          if (processedCompanies.has(companyName)) {
            companyDoc = processedCompanies.get(companyName);
            console.log(`   ℹ️  Company "${companyName}" already exists, linking user...`);
          } else {
            // Check if company already exists in new structure
            companyDoc = await Company.findOne({ name: companyName });

            if (companyDoc) {
              console.log(`   ℹ️  Company "${companyName}" found in database, linking user...`);
              processedCompanies.set(companyName, companyDoc);
            } else {
              // Create new company document
              // Determine the owner (user with 'owner' role for this company)
              const ownerId = oldCompany.role === 'owner' ? user._id : user._id;

              companyDoc = await Company.create({
                name: companyName,
                email: oldCompany.email || user.email,
                phoneNumber: oldCompany.phoneNumber || user.phoneNumber,
                address: oldCompany.address || '',
                owner: ownerId,
                isActive: oldCompany.accessGranted !== false
              });

              console.log(`   ✅ Created company: ${companyName}`);
              companiesMigrated++;
              processedCompanies.set(companyName, companyDoc);
            }
          }

          // Create UserCompany link (if doesn't exist)
          const existingLink = await UserCompany.findOne({
            user: user._id,
            company: companyDoc._id
          });

          if (existingLink) {
            console.log(`   ⚠️  User already linked to ${companyName}, skipping...`);
            skippedDuplicates++;
          } else {
            await UserCompany.create({
              user: user._id,
              company: companyDoc._id,
              role: oldCompany.role || 'staff',
              position: oldCompany.position || 'Staff',
              accessGranted: oldCompany.accessGranted !== false,
              invitedBy: oldCompany.invitedBy || null,
              joinedAt: oldCompany.joinedAt || new Date()
            });

            console.log(`   ✅ Linked user to ${companyName} as ${oldCompany.role}`);
            linksMigrated++;
          }

          // Update user's lastActiveCompany if they have accessGranted
          if (oldCompany.accessGranted !== false) {
            await User.findByIdAndUpdate(user._id, {
              lastActiveCompany: companyDoc._id
            });
          }

        } catch (error) {
          console.error(`   ❌ Error processing company "${companyName}":`, error.message);
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Companies created: ${companiesMigrated}`);
    console.log(`🔗 User-Company links created: ${linksMigrated}`);
    console.log(`⚠️  Duplicate links skipped: ${skippedDuplicates}`);
    console.log(`👥 Users processed: ${usersWithCompanies.length}`);

    // Verify migration
    const totalCompanies = await Company.countDocuments();
    const totalLinks = await UserCompany.countDocuments();

    console.log('\n📈 Final Database Counts:');
    console.log(`   Companies: ${totalCompanies}`);
    console.log(`   UserCompany links: ${totalLinks}`);

    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('   1. Old companies are still in User.companies array');
    console.log('   2. Consider removing User.companies field in future');
    console.log('   3. Test the app to ensure everything works');
    console.log('   4. Platform owner dashboard should now show companies');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from database');
    process.exit(0);
  }
}

// Run migration
migrateCompanies();
