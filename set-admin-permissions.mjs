#!/usr/bin/env node

/**
 * Admin Permissions Setup Script
 *
 * This script sets up an admin user with BOTH:
 * 1. Custom claims in Firebase Authentication (for security rules)
 * 2. Document in Firestore users collection (for app UI)
 *
 * Usage:
 *   node set-admin-permissions.mjs <user-uid>
 *   OR
 *   node set-admin-permissions.mjs --email <email>
 *   OR
 *   node set-admin-permissions.mjs --phone <phone>
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
  readFileSync(join(__dirname, 'knowledge-base', 'project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json'), 'utf8')
);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

// Admin permissions with all access
const adminPermissions = {
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
};

async function setAdminPermissions(uid) {
  try {
    console.log(`\nSetting admin permissions for user: ${uid}\n`);

    // Get user from Firebase Auth
    const user = await auth.getUser(uid);
    console.log(`✓ Found user in Firebase Auth:`);
    console.log(`  - UID: ${user.uid}`);
    console.log(`  - Email: ${user.email || 'N/A'}`);
    console.log(`  - Phone: ${user.phoneNumber || 'N/A'}`);
    console.log(`  - Display Name: ${user.displayName || 'N/A'}`);

    // Set custom claims (for Firestore security rules)
    console.log(`\n📝 Setting custom claims in Firebase Authentication...`);
    await auth.setCustomUserClaims(uid, {
      role: 'admin',
      custom_role: 'admin',
      permissions: adminPermissions,
      scope: 'global',
      division: null,
      team: null,
      linked_soldier_id: null,
      totp_enabled: true
    });
    console.log(`✓ Custom claims set successfully`);

    // Create/update Firestore document (for app UI)
    console.log(`\n📝 Creating/updating document in Firestore users collection...`);
    await db.collection('users').doc(uid).set({
      role: 'admin',
      custom_role: 'admin',
      permissions: adminPermissions,
      scope: 'global',
      division: null,
      team: null,
      linked_soldier_id: null,
      totp_enabled: true,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      displayName: user.displayName || 'Admin User',
      updated_at: FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✓ Firestore document created/updated successfully`);

    // Verify the changes
    console.log(`\n🔍 Verifying changes...`);
    const updatedUser = await auth.getUser(uid);
    const firestoreDoc = await db.collection('users').doc(uid).get();

    console.log(`\n✅ Setup complete!`);
    console.log(`\nCustom Claims (for security rules):`);
    console.log(`  - role: ${updatedUser.customClaims?.role}`);
    console.log(`  - custom_role: ${updatedUser.customClaims?.custom_role}`);
    console.log(`  - scope: ${updatedUser.customClaims?.scope}`);
    console.log(`  - Has permissions: ${!!updatedUser.customClaims?.permissions}`);

    console.log(`\nFirestore Document (for app UI):`);
    console.log(`  - Exists: ${firestoreDoc.exists}`);
    if (firestoreDoc.exists) {
      const data = firestoreDoc.data();
      console.log(`  - role: ${data.role}`);
      console.log(`  - custom_role: ${data.custom_role}`);
      console.log(`  - Has permissions: ${!!data.permissions}`);
    }

    console.log(`\n📋 Next steps:`);
    console.log(`  1. User needs to log out and log back in to refresh their token`);
    console.log(`  2. After login, they should have full admin access`);
    console.log(`  3. Check that they can see all navigation items`);
    console.log(`  4. Verify they can access all Firestore collections\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Error setting admin permissions:`, error.message);
    process.exit(1);
  }
}

async function findUserByEmail(email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (error) {
    console.error(`❌ User not found with email: ${email}`);
    process.exit(1);
  }
}

async function findUserByPhone(phone) {
  try {
    const user = await auth.getUserByPhoneNumber(phone);
    return user.uid;
  } catch (error) {
    console.error(`❌ User not found with phone: ${phone}`);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(`❌ Please provide user identifier`);
  console.log(`\nUsage:`);
  console.log(`  node set-admin-permissions.mjs <user-uid>`);
  console.log(`  node set-admin-permissions.mjs --email <email>`);
  console.log(`  node set-admin-permissions.mjs --phone <phone>`);
  console.log(`\nExamples:`);
  console.log(`  node set-admin-permissions.mjs abc123xyz`);
  console.log(`  node set-admin-permissions.mjs --email admin@example.com`);
  console.log(`  node set-admin-permissions.mjs --phone +972501234567\n`);
  process.exit(1);
}

let uid;

if (args[0] === '--email') {
  if (!args[1]) {
    console.error(`❌ Please provide email address`);
    process.exit(1);
  }
  uid = await findUserByEmail(args[1]);
} else if (args[0] === '--phone') {
  if (!args[1]) {
    console.error(`❌ Please provide phone number`);
    process.exit(1);
  }
  uid = await findUserByPhone(args[1]);
} else {
  uid = args[0];
}

// Run setup
await setAdminPermissions(uid);
