/**
 * Fix existing user claims by running syncUserOnSignIn logic for all users
 * Run this once after deploying the new syncUserOnSignIn function
 *
 * Usage: node scripts/fix-existing-user-claims.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixUserClaims() {
  console.log('Starting to fix existing user claims...\n');

  try {
    // Get all users from Firebase Auth
    const listUsersResult = await admin.auth().listUsers();
    const authUsers = listUsersResult.users;

    console.log(`Found ${authUsers.length} users in Firebase Auth\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const authUser of authUsers) {
      console.log(`\n========================================`);
      console.log(`Processing user: ${authUser.uid}`);
      console.log(`  Email: ${authUser.email || 'N/A'}`);
      console.log(`  Phone: ${authUser.phoneNumber || 'N/A'}`);

      try {
        // Find user in users table by email or phone
        let userData = null;
        let userDocId = null;

        if (authUser.email) {
          const usersByEmail = await db.collection('users')
            .where('email', '==', authUser.email)
            .limit(1)
            .get();

          if (!usersByEmail.empty) {
            userData = usersByEmail.docs[0].data();
            userDocId = usersByEmail.docs[0].id;
            console.log(`  ✅ Found user by email: ${userDocId}`);
          }
        }

        if (!userData && authUser.phoneNumber) {
          const usersByPhone = await db.collection('users')
            .where('phoneNumber', '==', authUser.phoneNumber)
            .limit(1)
            .get();

          if (!usersByPhone.empty) {
            userData = usersByPhone.docs[0].data();
            userDocId = usersByPhone.docs[0].id;
            console.log(`  ✅ Found user by phone: ${userDocId}`);
          }
        }

        if (!userData) {
          console.log(`  ⚠️  No user document found in users table - skipping`);
          errorCount++;
          continue;
        }

        // Get linked soldier if exists
        let soldierData = null;
        if (userData.linked_soldier_id) {
          const soldierQuery = await db.collection('soldiers')
            .where('soldier_id', '==', userData.linked_soldier_id)
            .limit(1)
            .get();

          if (!soldierQuery.empty) {
            soldierData = soldierQuery.docs[0].data();
            console.log(`  ✅ Found linked soldier: ${soldierData.soldier_id}`);
          }
        }

        // Build custom claims
        const displayName = userData.displayName ||
                           (soldierData ? `${soldierData.first_name || ''} ${soldierData.last_name || ''}`.trim() : null) ||
                           userData.email ||
                           userData.phoneNumber;

        const customClaims = {
          role: userData.role || 'soldier',
          custom_role: userData.custom_role || 'soldier',
          permissions: userData.permissions || getDefaultPermissions(userData.custom_role || 'soldier'),
          scope: userData.scope || 'self',
          division: userData.division || null,
          team: userData.team || null,
          linked_soldier_id: userData.linked_soldier_id || null,
          user_doc_id: userDocId,
          displayName: displayName,
          email: userData.email || authUser.email,
          phoneNumber: userData.phoneNumber || authUser.phoneNumber,
          totp_enabled: userData.totp_enabled || false
        };

        // Update custom claims
        await admin.auth().setCustomUserClaims(authUser.uid, customClaims);
        console.log(`  ✅ Updated custom claims for ${authUser.uid}`);
        console.log(`     Role: ${customClaims.custom_role}`);
        console.log(`     Display Name: ${displayName}`);
        console.log(`     Division: ${customClaims.division || 'N/A'}`);
        console.log(`     Team: ${customClaims.team || 'N/A'}`);

        successCount++;

      } catch (error) {
        console.error(`  ❌ Error processing user ${authUser.uid}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n========================================`);
    console.log(`\nComplete!`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total: ${authUsers.length}`);

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

// Helper function to get default permissions
function getDefaultPermissions(role) {
  const basePermissions = {
    'personnel.view': false,
    'personnel.create': false,
    'personnel.update': false,
    'personnel.delete': false,
    'equipment.view': false,
    'equipment.create': false,
    'equipment.update': false,
    'equipment.delete': false,
    'operations.sign': false,
    'operations.transfer': false,
    'operations.deposit': false,
    'operations.release': false,
    'operations.verify': false,
    'operations.maintain': false,
    'system.reports': false,
    'system.history': false,
    'system.import': false,
    'system.export': false,
    'system.users': false
  };

  switch (role) {
    case 'admin':
      return {
        ...Object.fromEntries(Object.keys(basePermissions).map(k => [k, true])),
        scope: 'global'
      };

    case 'division_manager':
      return {
        ...basePermissions,
        'personnel.view': true,
        'personnel.create': true,
        'personnel.update': true,
        'equipment.view': true,
        'equipment.create': true,
        'equipment.update': true,
        'equipment.delete': true,
        'operations.sign': true,
        'operations.transfer': true,
        'operations.deposit': true,
        'operations.release': true,
        'operations.verify': true,
        'operations.maintain': true,
        'system.reports': true,
        'system.history': true,
        'system.import': true,
        'system.export': true,
        scope: 'division'
      };

    case 'team_leader':
      return {
        ...basePermissions,
        'personnel.view': true,
        'personnel.update': true,
        'equipment.view': true,
        'equipment.update': true,
        'operations.sign': true,
        'operations.deposit': true,
        'operations.verify': true,
        'system.reports': true,
        'system.history': true,
        scope: 'team'
      };

    default: // soldier
      return {
        ...basePermissions,
        'personnel.view': true,
        'equipment.view': true,
        'system.history': true,
        scope: 'self'
      };
  }
}

// Run the script
fixUserClaims();
