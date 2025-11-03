#!/usr/bin/env node

/**
 * Admin Setup Script for Firebase Armory System
 * 
 * This script helps set up the first admin user.
 * 
 * Usage:
 *   node setup-admin.mjs +972501234567
 * 
 * The phone number must be in E.164 format (with country code).
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
  readFileSync(join(__dirname, 'firebase-service-account.json'), 'utf8')
);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

async function setupAdmin(phoneNumber) {
  try {
    // Check if admin already exists
    const adminDoc = await db.collection('system').doc('admin_setup').get();

    if (adminDoc.exists && adminDoc.data().hasAdmin) {
      process.exit(1);
    }

    // Get or create user
    let user;
    try {
      user = await auth.getUserByPhoneNumber(phoneNumber);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await auth.createUser({
          phoneNumber: phoneNumber,
          displayName: 'System Administrator'
        });
      } else {
        throw error;
      }
    }
    
    // Set admin custom claims
    await auth.setCustomUserClaims(user.uid, {
      role: 'admin',
      custom_role: 'admin',
      permissions: {
        can_create_soldiers: true,
        can_edit_soldiers: true,
        can_delete_soldiers: true,
        can_create_weapons: true,
        can_edit_weapons: true,
        can_delete_weapons: true,
        can_create_gear: true,
        can_edit_gear: true,
        can_delete_gear: true,
        can_create_drones: true,
        can_edit_drones: true,
        can_delete_drones: true,
        can_create_drone_components: true,
        can_edit_drone_components: true,
        can_delete_drone_components: true,
        can_create_equipment: true,
        can_edit_equipment: true,
        can_delete_equipment: true,
        can_import_data: true,
        can_manage_users: true,
        can_sign_equipment: true,
        can_view_reports: true,
        can_perform_maintenance: true,
        can_view_history: true,
        can_transfer_equipment: true,
        can_deposit_equipment: true,
        can_release_equipment: true,
        can_export_data: true,
        can_perform_daily_verification: true,
      },
      linked_soldier_id: null,
      totp_enabled: false
    });
    
    // Mark admin as created
    await db.collection('system').doc('admin_setup').set({
      hasAdmin: true,
      firstAdminUid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      phoneNumber: phoneNumber
    });

    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Get phone number from command line
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  process.exit(1);
}

// Validate phone number format
if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
  process.exit(1);
}

// Run setup
setupAdmin(phoneNumber);