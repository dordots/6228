/**
 * Migration Script: Add equipment.assign_components Permission
 *
 * This script:
 * 1. Reads all users from Firestore
 * 2. Adds 'equipment.assign_components' permission to all users
 *    - true for admins
 *    - false for all other roles
 * 3. Updates both Firestore and custom claims
 *
 * Usage:
 *   node migrate-assign-components-permission.mjs
 *   node migrate-assign-components-permission.mjs --dry-run  (preview changes without applying)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'knowledge-base', 'project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json'), 'utf8')
);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Determine if user should have assign_components permission
 */
function shouldHaveAssignComponentsPermission(userData) {
  // Admin role (either role === 'admin' or custom_role === 'admin')
  return userData.role === 'admin' || userData.custom_role === 'admin';
}

/**
 * Migrate a single user document
 */
async function migrateUser(userDoc, dryRun = false) {
  const userId = userDoc.id;
  const userData = userDoc.data();

  const updates = {};
  let hasChanges = false;

  // Determine the permission value
  const shouldHavePermission = shouldHaveAssignComponentsPermission(userData);
  
  // Check if permission needs to be added or updated
  if (!userData.permissions || userData.permissions['equipment.assign_components'] !== shouldHavePermission) {
    // Initialize permissions object if it doesn't exist
    if (!userData.permissions) {
      updates.permissions = {};
      hasChanges = true;
    } else {
      updates.permissions = { ...userData.permissions };
    }
    updates.permissions['equipment.assign_components'] = shouldHavePermission;
    hasChanges = true;
  }

  // Apply updates to Firestore
  if (hasChanges && !dryRun) {
    try {
      await userDoc.ref.update(updates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Update custom claims if needed
  if (hasChanges && !dryRun) {
    try {
      const user = await auth.getUser(userId);
      const currentClaims = user.customClaims || {};
      
      // Update permissions in custom claims
      const updatedClaims = {
        ...currentClaims,
        permissions: {
          ...(currentClaims.permissions || {}),
          'equipment.assign_components': shouldHavePermission
        }
      };

      await auth.setCustomUserClaims(userId, updatedClaims);
    } catch (error) {
      console.error(`Error updating custom claims for user ${userId}:`, error.message);
      // Continue even if custom claims update fails
    }
  }

  return { success: true, hasChanges, permissionValue: shouldHavePermission };
}

/**
 * Main migration function
 */
async function migrateAllUsers(dryRun = false) {
  try {
    console.log(dryRun ? '🔍 DRY RUN MODE - No changes will be applied' : '🚀 Starting migration...');
    console.log('');

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      console.log('No users found in Firestore.');
      return;
    }

    console.log(`Found ${usersSnapshot.size} users to process.`);
    console.log('');

    // Statistics
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalNoChanges = 0;
    let adminCount = 0;
    let nonAdminCount = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const result = await migrateUser(userDoc, dryRun);
      totalProcessed++;

      if (result.success) {
        if (result.hasChanges) {
          totalUpdated++;
          if (result.permissionValue) {
            adminCount++;
          } else {
            nonAdminCount++;
          }
          console.log(`✓ User ${userData.displayName || userData.email || userDoc.id} (${userData.custom_role || userData.role || 'unknown'}): ${result.permissionValue ? 'GRANTED' : 'DENIED'} assign_components permission`);
        } else {
          totalNoChanges++;
        }
      } else {
        totalErrors++;
        console.error(`✗ Error processing user ${userDoc.id}: ${result.error}`);
      }
    }

    console.log('');
    console.log('='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Total users processed: ${totalProcessed}`);
    console.log(`Users updated: ${totalUpdated}`);
    console.log(`  - Admins (permission = true): ${adminCount}`);
    console.log(`  - Non-admins (permission = false): ${nonAdminCount}`);
    console.log(`Users with no changes: ${totalNoChanges}`);
    console.log(`Errors: ${totalErrors}`);
    console.log('='.repeat(50));

    if (dryRun) {
      console.log('');
      console.log('⚠️  This was a DRY RUN. No changes were applied.');
      console.log('Run without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateAllUsers(dryRun)
  .then(() => {
    console.log('');
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

