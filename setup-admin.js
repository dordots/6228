#!/usr/bin/env node

/**
 * Admin Setup Script for Firebase Armory System
 * 
 * This script helps set up the first admin user.
 * 
 * Usage:
 *   node setup-admin.js +972501234567
 * 
 * The phone number must be in E.164 format (with country code).
 */

const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setupAdmin(phoneNumber) {
  try {
    console.log(`Setting up admin for phone: ${phoneNumber}`);
    
    // Check if admin already exists
    const db = admin.firestore();
    const adminDoc = await db.collection('system').doc('admin_setup').get();
    
    if (adminDoc.exists && adminDoc.data().hasAdmin) {
      console.error('❌ Admin already exists! Only one initial admin can be set up this way.');
      console.log('Use the admin UI to create additional admins.');
      process.exit(1);
    }
    
    // Get or create user
    let user;
    try {
      user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      console.log(`Found existing user: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await admin.auth().createUser({
          phoneNumber: phoneNumber,
          displayName: 'System Administrator'
        });
        console.log(`Created new user: ${user.uid}`);
      } else {
        throw error;
      }
    }
    
    // Set admin custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      phoneNumber: phoneNumber
    });
    
    console.log('✅ Admin setup complete!');
    console.log(`Phone: ${phoneNumber}`);
    console.log(`UID: ${user.uid}`);
    console.log('\nNext steps:');
    console.log('1. Open the application');
    console.log('2. Login with this phone number');
    console.log('3. Set up 2FA when prompted');
    console.log('4. Start managing users from the User Management page');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    process.exit(1);
  }
}

// Get phone number from command line
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Please provide a phone number');
  console.log('Usage: node setup-admin.js +972501234567');
  process.exit(1);
}

// Validate phone number format
if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
  console.error('❌ Invalid phone number format');
  console.log('Phone number must be in E.164 format (e.g., +972501234567)');
  process.exit(1);
}

// Run setup
setupAdmin(phoneNumber);