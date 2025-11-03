/**
 * Migration Script: Update User Permissions and TOTP Fields
 *
 * This script:
 * 1. Reads all users from Firestore
 * 2. Assigns permissions based on their custom_role
 * 3. Ensures TOTP fields exist (sets to null if missing)
 *
 * Usage:
 *   node migrate-user-permissions.mjs
 *   node migrate-user-permissions.mjs --dry-run  (preview changes without applying)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

// Permission templates based on custom_role
const ROLE_PERMISSIONS = {
  admin: {
    permissions: {
      'personnel.view': true,
      'personnel.create': true,
      'personnel.update': true,
      'personnel.delete': true,
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
      'system.users': true,
    },
    scope: 'global'
  },

  division_manager: {
    permissions: {
      'personnel.view': true,
      'personnel.create': true,
      'personnel.update': true,
      'personnel.delete': false,
      'equipment.view': true,
      'equipment.create': true,
      'equipment.update': true,
      'equipment.delete': false,
      'operations.sign': true,
      'operations.transfer': true,
      'operations.deposit': true,
      'operations.release': true,
      'operations.verify': true,
      'operations.maintain': true,
      'system.reports': true,
      'system.history': true,
      'system.import': false,
      'system.export': true,
      'system.users': false,
    },
    scope: 'division'
  },

  team_leader: {
    permissions: {
      'personnel.view': true,
      'personnel.create': false,
      'personnel.update': true,
      'personnel.delete': false,
      'equipment.view': true,
      'equipment.create': false,
      'equipment.update': true,
      'equipment.delete': false,
      'operations.sign': true,
      'operations.transfer': true,
      'operations.deposit': true,
      'operations.release': true,
      'operations.verify': true,
      'operations.maintain': false,
      'system.reports': true,
      'system.history': true,
      'system.import': false,
      'system.export': false,
      'system.users': false,
    },
    scope: 'team'
  },

  soldier: {
    permissions: {
      'personnel.view': true,
      'personnel.create': false,
      'personnel.update': false,
      'personnel.delete': false,
      'equipment.view': true,
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
      'system.history': true,
      'system.import': false,
      'system.export': false,
      'system.users': false,
    },
    scope: 'self'
  },

  // Default for unknown roles
  default: {
    permissions: {
      'personnel.view': true,
      'personnel.create': false,
      'personnel.update': false,
      'personnel.delete': false,
      'equipment.view': true,
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
      'system.history': true,
      'system.import': false,
      'system.export': false,
      'system.users': false,
    },
    scope: 'self'
  }
};

// TOTP field defaults
const TOTP_FIELDS = {
  totp_enabled: null,
  totp_enabled_at: null,
  totp_verified_until: null,
  totp_verified_at: null,
  totp_device_fingerprint: null
};

/**
 * Get permissions for a custom role
 */
function getPermissionsForRole(customRole) {
  const roleKey = customRole?.toLowerCase();
  return ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS.default;
}

/**
 * Migrate a single user document
 */
async function migrateUser(userDoc, dryRun = false) {
  const userId = userDoc.id;
  const userData = userDoc.data();


  const updates = {};
  let hasChanges = false;

  // 1. Check and update permissions based on custom_role
  const roleConfig = getPermissionsForRole(userData.custom_role);

  if (!userData.permissions || JSON.stringify(userData.permissions) !== JSON.stringify(roleConfig.permissions)) {
    updates.permissions = roleConfig.permissions;
    hasChanges = true;
  }

  // 2. Check and update scope
  if (userData.scope !== roleConfig.scope) {
    updates.scope = roleConfig.scope;
    hasChanges = true;
  }

  // 3. Ensure TOTP fields exist
  const missingTotpFields = [];
  for (const [field, defaultValue] of Object.entries(TOTP_FIELDS)) {
    if (userData[field] === undefined) {
      updates[field] = defaultValue;
      missingTotpFields.push(field);
      hasChanges = true;
    }
  }


  // Apply updates
  if (hasChanges) {
    if (!dryRun) {
      try {
        await userDoc.ref.update(updates);
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }

  return { success: true, hasChanges };
}

/**
 * Main migration function
 */
async function migrateAllUsers(dryRun = false) {
  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      return;
    }

    // Statistics
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalNoChanges = 0;

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const result = await migrateUser(userDoc, dryRun);
      totalProcessed++;

      if (result.success) {
        if (result.hasChanges) {
          totalUpdated++;
        } else {
          totalNoChanges++;
        }
      } else {
        totalErrors++;
      }
    }

  } catch (error) {
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateAllUsers(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  });
