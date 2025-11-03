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
    // Get user from Firebase Auth
    const user = await auth.getUser(uid);

    // Set custom claims (for Firestore security rules)
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

    // Create/update Firestore document (for app UI)
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

    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

async function findUserByEmail(email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (error) {
    process.exit(1);
  }
}

async function findUserByPhone(phone) {
  try {
    const user = await auth.getUserByPhoneNumber(phone);
    return user.uid;
  } catch (error) {
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  process.exit(1);
}

let uid;

if (args[0] === '--email') {
  if (!args[1]) {
    process.exit(1);
  }
  uid = await findUserByEmail(args[1]);
} else if (args[0] === '--phone') {
  if (!args[1]) {
    process.exit(1);
  }
  uid = await findUserByPhone(args[1]);
} else {
  uid = args[0];
}

// Run setup
await setAdminPermissions(uid);
