const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Helper function to check if user is admin (checks both custom claims and Firestore)
async function isUserAdmin(context) {
  if (!context.auth) return false;

  // Check custom claims first (fast)
  if (context.auth.token.role === 'admin') {
    return true;
  }

  // Check Firestore users collection as fallback
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.role === 'admin';
    }
  } catch (error) {
    console.error('Error checking admin status from Firestore:', error);
  }

  return false;
}

// Helper function to check if user has a specific permission
async function hasUserPermission(context, permission) {
  if (!context.auth) return false;

  // Check if admin first
  if (await isUserAdmin(context)) {
    return true;
  }

  // Check custom claims
  if (context.auth.token.permissions?.[permission] === true) {
    return true;
  }

  // Check Firestore users collection
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.permissions?.[permission] === true;
    }
  } catch (error) {
    console.error('Error checking permission from Firestore:', error);
  }

  return false;
}

// Create a new user with phone number and assign role/permissions
exports.createPhoneUser = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!(await isUserAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can create users'
      );
    }

    const { phoneNumber, role = 'soldier', customRole, displayName, email } = data;

    if (!phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required'
      );
    }

    try {
      const db = admin.firestore();

      // Create the user in Firebase Auth
      let userRecord;
      try {
        userRecord = await admin.auth().createUser({
          phoneNumber,
          displayName,
          email,
        });
      } catch (error) {
        if (error.code === 'auth/phone-number-already-exists') {
          // Get existing user
          userRecord = await admin.auth().getUserByPhoneNumber(phoneNumber);
        } else {
          throw error;
        }
      }

      // Find matching soldier by phone or email for automatic linking
      let soldierDoc = null;
      let soldierData = null;

      // Try to match by phone number first
      if (phoneNumber) {
        console.log(`  Searching for soldier by phone: ${phoneNumber}`);
        const soldiersByPhone = await db.collection('soldiers')
          .where('phone_number', '==', phoneNumber)
          .limit(1)
          .get();

        if (!soldiersByPhone.empty) {
          soldierDoc = soldiersByPhone.docs[0];
          soldierData = soldierDoc.data();
          console.log(`  ✅ Found soldier by phone: ${soldierData.soldier_id}`);
        }
      }

      // Try to match by email if phone didn't match
      if (!soldierDoc && email) {
        console.log(`  Searching for soldier by email: ${email}`);
        const soldiersByEmail = await db.collection('soldiers')
          .where('email', '==', email)
          .limit(1)
          .get();

        if (!soldiersByEmail.empty) {
          soldierDoc = soldiersByEmail.docs[0];
          soldierData = soldierDoc.data();
          console.log(`  ✅ Found soldier by email: ${soldierData.soldier_id}`);
        }
      }

      // Get default permissions for the role
      const roleToUse = customRole || role || 'soldier';
      const defaultPerms = getDefaultPermissions(roleToUse);

      // Prepare user document data with soldier linking if found
      const userDocData = {
        role: roleToUse === 'admin' ? 'admin' : 'user',
        custom_role: roleToUse,
        permissions: defaultPerms,
        scope: defaultPerms.scope,
        division: soldierData?.division_name || null,
        team: soldierData?.team_name || null,
        linked_soldier_id: soldierData?.soldier_id || null,
        email: email || null,
        phoneNumber: phoneNumber,
        displayName: displayName || (soldierData ? `${soldierData.first_name || ''} ${soldierData.last_name || ''}`.trim() : null),
        totp_enabled: false,
        totp_enabled_at: null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      // Save to Firestore users collection
      const userDocRef = db.collection('users').doc(userRecord.uid);
      await userDocRef.set(userDocData);
      console.log(`  ✅ Created user document in Firestore for ${userRecord.uid}`);

      // If soldier found, update soldier document with user UID
      if (soldierDoc) {
        await soldierDoc.ref.update({
          id: userRecord.uid,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`  ✅ Updated soldier ${soldierData.soldier_id} with user UID`);
      }

      // Set custom claims with new RBAC structure
      const customClaims = {
        role: userDocData.role,
        custom_role: userDocData.custom_role,
        permissions: userDocData.permissions,
        scope: userDocData.scope,
        division: userDocData.division,
        team: userDocData.team,
        linked_soldier_id: userDocData.linked_soldier_id,
        totp_enabled: false,
        totp_secret: null,
        totp_temp_secret: null
      };

      await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

      return {
        uid: userRecord.uid,
        phoneNumber: userRecord.phoneNumber,
        displayName: userDocData.displayName,
        email: userRecord.email,
        customClaims,
        linkedSoldier: soldierData ? {
          soldier_id: soldierData.soldier_id,
          full_name: `${soldierData.first_name || ''} ${soldierData.last_name || ''}`.trim(),
          division: soldierData.division_name,
          team: soldierData.team_name
        } : null
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to create user: ${error.message}`
      );
    }
  });

// List all users with pagination
exports.listUsers = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller has permission to view users
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    // Check custom claims first (fast)
    let isAdmin = context.auth.token.role === 'admin';
    let canManageUsers = context.auth.token.permissions?.['system.users'];
    let isDivisionManager = context.auth.token.custom_role === 'division_manager';

    // If not authorized via custom claims, check Firestore users collection
    if (!isAdmin && !canManageUsers && !isDivisionManager) {
      try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(context.auth.uid).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          isAdmin = userData.role === 'admin';
          canManageUsers = userData.permissions?.['system.users'] === true;
          isDivisionManager = userData.custom_role === 'division_manager';
        }
      } catch (error) {
        console.error('Error reading user permissions from Firestore:', error);
      }
    }

    if (!isAdmin && !canManageUsers && !isDivisionManager) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Insufficient permissions to list users'
      );
    }

    try {
      const db = admin.firestore();

      // Fetch all users from Firestore users collection
      const usersSnapshot = await db.collection('users').get();

      // Map Firestore user documents to user objects
      const users = usersSnapshot.docs.map((doc) => {
        const userData = doc.data();
        return {
          uid: doc.id,
          id: doc.id,
          email: userData.email || null,
          phoneNumber: userData.phoneNumber || null,
          full_name: userData.displayName || userData.email || userData.phoneNumber || 'Unknown',
          displayName: userData.displayName || null,
          disabled: userData.disabled || false,
          created_date: userData.created_at?._seconds ? new Date(userData.created_at._seconds * 1000).toISOString() : null,
          createdAt: userData.created_at?._seconds ? new Date(userData.created_at._seconds * 1000).toISOString() : null,
          lastSignInAt: userData.last_sign_in_at?._seconds ? new Date(userData.last_sign_in_at._seconds * 1000).toISOString() : null,
          role: userData.role || 'user',
          custom_role: userData.custom_role || 'soldier',
          permissions: userData.permissions || {},
          scope: userData.scope,
          division: userData.division,
          team: userData.team,
          linkedSoldierId: userData.linked_soldier_id,
          totpEnabled: userData.totp_enabled || false
        };
      });

      return {
        users,
        pageToken: null // No pagination needed for Firestore query
      };
    } catch (error) {
      console.error('Error listing users:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to list users: ${error.message}`
      );
    }
  });

// Update user role and permissions
exports.updateUserRole = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!(await isUserAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can update user roles'
      );
    }

    const { uid, role, division, team } = data;

    if (!uid || !role) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID and role are required'
      );
    }

    try {
      const db = admin.firestore();

      // Get current user document from Firestore
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      // Get default permissions for the role
      const permissions = getDefaultPermissions(role);

      // Prepare updated user data
      const updatedUserData = {
        role: role === 'admin' ? 'admin' : 'user',
        custom_role: role,
        permissions: permissions,
        scope: permissions.scope,
        division: division || null,
        team: team || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      };

      // If user document exists, preserve TOTP settings
      if (userDoc.exists) {
        const currentData = userDoc.data();
        updatedUserData.totp_enabled = currentData.totp_enabled || false;
        updatedUserData.totp_enabled_at = currentData.totp_enabled_at || null;
      }

      // Update Firestore users collection
      await userDocRef.set(updatedUserData, { merge: true });

      // Also update custom claims for backward compatibility
      try {
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};

        const updatedClaims = {
          ...currentClaims,
          role: role === 'admin' ? 'admin' : 'user',
          custom_role: role,
          permissions: permissions,
          scope: permissions.scope,
          division: division || null,
          team: team || null,
          totp_enabled: currentClaims.totp_enabled || false,
          totp_secret: currentClaims.totp_secret || null,
          totp_temp_secret: currentClaims.totp_temp_secret || null,
        };

        await admin.auth().setCustomUserClaims(uid, updatedClaims);
      } catch (authError) {
        console.warn('Could not update auth custom claims (user may not exist in auth):', authError.message);
        // Continue anyway since Firestore is the source of truth
      }

      return {
        uid,
        role,
        permissions: permissions,
        scope: permissions.scope,
        division,
        team
      };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to update user role: ${error.message}`
      );
    }
  });

// Update user division/team assignment
exports.updateUserPermissions = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin or division manager
    const isAdmin = await isUserAdmin(context);
    let isDivisionManager = context.auth?.token?.custom_role === 'division_manager';

    // Check Firestore if not in custom claims
    if (!isDivisionManager && context.auth) {
      try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        if (userDoc.exists) {
          isDivisionManager = userDoc.data().custom_role === 'division_manager';
        }
      } catch (error) {
        console.error('Error checking division manager status:', error);
      }
    }

    if (!isAdmin && !isDivisionManager) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins and division managers can update user assignments'
      );
    }

    const { uid, division, team } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID is required'
      );
    }

    try {
      const db = admin.firestore();

      // Division managers can only assign within their division
      if (context.auth.token.custom_role === 'division_manager' &&
          division !== context.auth.token.division) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Division managers can only assign users within their own division'
        );
      }

      // Update Firestore users collection
      const userDocRef = db.collection('users').doc(uid);
      await userDocRef.set({
        division: division || null,
        team: team || null,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Also update custom claims for backward compatibility
      try {
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};

        const updatedClaims = {
          ...currentClaims,
          division: division || null,
          team: team || null,
        };

        await admin.auth().setCustomUserClaims(uid, updatedClaims);
      } catch (authError) {
        console.warn('Could not update auth custom claims:', authError.message);
        // Continue anyway since Firestore is the source of truth
      }

      return {
        uid,
        division,
        team
      };
    } catch (error) {
      console.error('Error updating user assignment:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to update user assignment: ${error.message}`
      );
    }
  });

// Delete user (hard delete from both Authentication and Firestore)
exports.deleteUser = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!(await isUserAdmin(context))) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can delete users'
      );
    }

    const { uid } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID is required'
      );
    }

    try {
      const db = admin.firestore();

      console.log(`\n========================================`);
      console.log(`[deleteUser] STEP 1: Starting delete for UID: ${uid}`);

      // Get user from Authentication to get their email/phone
      let authUser;
      try {
        authUser = await admin.auth().getUser(uid);
        console.log(`[deleteUser] STEP 2: Found user in Authentication`);
        console.log(`  Email: ${authUser.email || 'N/A'}`);
        console.log(`  Phone: ${authUser.phoneNumber || 'N/A'}`);
        console.log(`  UID: ${authUser.uid}`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`[deleteUser] ⚠️  User ${uid} not found in Authentication`);
        } else {
          console.log(`[deleteUser] ❌ Error getting user from Auth:`, error);
          throw error;
        }
      }

      // Delete user from Authentication
      let authDeleted = false;
      if (authUser) {
        console.log(`[deleteUser] STEP 3: Deleting from Firebase Authentication...`);
        try {
          await admin.auth().deleteUser(uid);
          authDeleted = true;
          console.log(`[deleteUser] ✅ Deleted user from Firebase Authentication`);
        } catch (error) {
          console.log(`[deleteUser] ❌ Error deleting from Auth:`, error);
          throw error;
        }
      }

      // Delete user document from Firestore by searching with phone or email
      let firestoreDeleted = false;

      console.log(`[deleteUser] STEP 4: Searching for user document in Firestore...`);

      // Try to find and delete by phone number
      if (authUser?.phoneNumber) {
        console.log(`[deleteUser] STEP 4a: Searching by phoneNumber field`);
        console.log(`  Query: users.where('phoneNumber', '==', '${authUser.phoneNumber}')`);

        try {
          const usersByPhone = await db.collection('users')
            .where('phoneNumber', '==', authUser.phoneNumber)
            .get();

          console.log(`  Result: Found ${usersByPhone.size} document(s)`);

          if (!usersByPhone.empty) {
            for (const doc of usersByPhone.docs) {
              const docData = doc.data();
              console.log(`  Document ID: ${doc.id}`);
              console.log(`  Document data:`, JSON.stringify(docData, null, 2));

              console.log(`  Attempting to delete document ${doc.id}...`);
              await doc.ref.delete();
              firestoreDeleted = true;
              console.log(`  ✅ Successfully deleted document ${doc.id}`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Error searching/deleting by phone:`, error);
        }
      } else {
        console.log(`[deleteUser] STEP 4a: No phone number available, skipping phone search`);
      }

      // Try to find and delete by email if not deleted yet
      if (!firestoreDeleted && authUser?.email) {
        console.log(`[deleteUser] STEP 4b: Searching by email field`);
        console.log(`  Query: users.where('email', '==', '${authUser.email}')`);

        try {
          const usersByEmail = await db.collection('users')
            .where('email', '==', authUser.email)
            .get();

          console.log(`  Result: Found ${usersByEmail.size} document(s)`);

          if (!usersByEmail.empty) {
            for (const doc of usersByEmail.docs) {
              const docData = doc.data();
              console.log(`  Document ID: ${doc.id}`);
              console.log(`  Document data:`, JSON.stringify(docData, null, 2));

              console.log(`  Attempting to delete document ${doc.id}...`);
              await doc.ref.delete();
              firestoreDeleted = true;
              console.log(`  ✅ Successfully deleted document ${doc.id}`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Error searching/deleting by email:`, error);
        }
      } else if (!firestoreDeleted) {
        console.log(`[deleteUser] STEP 4b: No email available or already deleted, skipping email search`);
      }

      if (!firestoreDeleted) {
        console.log(`[deleteUser] ⚠️  WARNING: No user document found/deleted in Firestore`);
      }

      console.log(`[deleteUser] STEP 5: Delete operation complete`);
      console.log(`  Deleted from Auth: ${authDeleted}`);
      console.log(`  Deleted from Firestore: ${firestoreDeleted}`);
      console.log(`========================================\n`);

      return {
        success: true,
        uid,
        deletedFromAuth: authDeleted,
        deletedFromFirestore: firestoreDeleted
      };
    } catch (error) {
      console.error('[deleteUser] ❌ FATAL ERROR:', error);
      console.log(`========================================\n`);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to delete user: ${error.message}`
      );
    }
  });

// Get user by phone number
exports.getUserByPhone = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller has permission
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const isAdmin = await isUserAdmin(context);
    const canManageUsers = await hasUserPermission(context, 'system.users');

    if (!isAdmin && !canManageUsers) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Insufficient permissions'
      );
    }

    const { phoneNumber } = data;

    if (!phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required'
      );
    }

    try {
      const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      const customClaims = user.customClaims || {};

      return {
        uid: user.uid,
        id: user.uid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        full_name: user.displayName || user.email || user.phoneNumber,
        displayName: user.displayName,
        disabled: user.disabled,
        created_date: user.metadata.creationTime,
        role: customClaims.role || 'user',
        custom_role: customClaims.custom_role || 'soldier',
        permissions: customClaims.permissions || {},
        scope: customClaims.scope,
        division: customClaims.division,
        team: customClaims.team,
        linkedSoldierId: customClaims.linked_soldier_id,
        totpEnabled: customClaims.totp_enabled || false
      };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return null;
      }
      console.error('Error getting user by phone:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to get user: ${error.message}`
      );
    }
  });

// Set admin by phone (for initial setup)
exports.setAdminByPhone = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // This can only be called by an existing admin or if no admins exist
    const db = admin.firestore();
    
    try {
      // Check if any admin exists
      const adminCheck = await db.collection('system')
        .doc('admin_setup')
        .get();
      
      const hasAdmin = adminCheck.exists && adminCheck.data().hasAdmin;
      
      if (hasAdmin && !(await isUserAdmin(context))) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Admin already exists. Only admins can create new admins.'
        );
      }

      const { phoneNumber } = data;

      if (!phoneNumber) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Phone number is required'
        );
      }

      // Get user by phone
      const user = await admin.auth().getUserByPhoneNumber(phoneNumber);

      // Get admin permissions
      const adminPerms = getDefaultPermissions('admin');
      
      // Set admin claims with new RBAC structure
      // IMPORTANT: Preserve existing TOTP settings if they exist
      const adminClaims = {
        role: 'admin',
        custom_role: 'admin',
        permissions: adminPerms,
        scope: adminPerms.scope,
        division: null,
        team: null,
        linked_soldier_id: null,
        totp_enabled: user.customClaims?.totp_enabled || false,
        totp_secret: user.customClaims?.totp_secret || null,
        totp_temp_secret: user.customClaims?.totp_temp_secret || null
      };

      await admin.auth().setCustomUserClaims(user.uid, adminClaims);

      // Mark that admin has been created
      if (!hasAdmin) {
        await db.collection('system')
          .doc('admin_setup')
          .set({
            hasAdmin: true,
            firstAdminUid: user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
      }

      return {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        message: 'Admin role assigned successfully'
      };
    } catch (error) {
      console.error('Error setting admin:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to set admin: ${error.message}`
      );
    }
  });

// Helper function to get default permissions by role
function getDefaultPermissions(role) {
  const basePermissions = {
    // Personnel permissions
    'personnel.view': false,
    'personnel.create': false,
    'personnel.update': false,
    'personnel.delete': false,
    
    // Equipment permissions (covers weapons, gear, drones, standard equipment)
    'equipment.view': false,
    'equipment.create': false,
    'equipment.update': false,
    'equipment.delete': false,
    
    // Operations permissions
    'operations.sign': false,
    'operations.transfer': false,
    'operations.deposit': false,
    'operations.release': false,
    'operations.verify': false,
    'operations.maintain': false,
    
    // System permissions
    'system.reports': false,
    'system.history': false,
    'system.import': false,
    'system.export': false,
    'system.users': false,
  };
  
  switch (role) {
    case 'admin':
      // Admin has all permissions with global scope
      return {
        ...Object.keys(basePermissions).reduce((acc, key) => ({...acc, [key]: true}), {}),
        scope: 'global'
      };
      
    case 'division_manager':
      // Division manager has most permissions within their division
      return {
        ...basePermissions,
        'personnel.view': true,
        'personnel.create': true,
        'personnel.update': true,
        'personnel.delete': false,
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
        'system.import': false,  // Import is admin-only
        'system.export': true,
        'system.users': false,
        scope: 'division'
      };
      
    case 'team_leader':
      // Team leader has limited permissions within their team
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
      
    case 'soldier':
      // Soldier can only view their own data
      return {
        ...basePermissions,
        'personnel.view': true, // Own profile only
        'equipment.view': true, // Own equipment only
        'system.history': true, // Own activities only
        scope: 'self'
      };
      
    default:
      // Default to soldier permissions
      return {
        ...basePermissions,
        'personnel.view': true,
        'equipment.view': true,
        'system.history': true,
        scope: 'self'
      };
  }
}

/**
 * Find user account directly by email/phone on sign-in
 * Called by client after successful authentication
 *
 * Flow:
 * 1. User signs in with email/phone
 * 2. Find user in users table WHERE email == user.email OR phoneNumber == user.phone
 * 3. Return that user's data (displayName, role, permissions, division, team)
 * 4. Optionally find linked soldier for display
 */
exports.syncUserOnSignIn = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Must be authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to sync user data'
      );
    }

    const authUid = context.auth.uid;
    const db = admin.firestore();

    try {
      // Get auth user data
      const authUser = await admin.auth().getUser(authUid);

      // Find user directly in users table by email or phone
      let userDoc = null;
      let userData = null;
      let userDocId = null;

      // Try to find by email first
      if (authUser.email) {
        const usersByEmail = await db.collection('users')
          .where('email', '==', authUser.email)
          .limit(1)
          .get();

        if (!usersByEmail.empty) {
          userDoc = usersByEmail.docs[0];
          userData = userDoc.data();
          userDocId = userDoc.id;
        }
      }

      // Try to find by phone if email didn't match
      if (!userDoc && authUser.phoneNumber) {
        const usersByPhone = await db.collection('users')
          .where('phoneNumber', '==', authUser.phoneNumber)
          .limit(1)
          .get();

        if (!usersByPhone.empty) {
          userDoc = usersByPhone.docs[0];
          userData = userDoc.data();
          userDocId = userDoc.id;
        }
      }

      // If no user found, throw error
      if (!userData) {
        throw new functions.https.HttpsError(
          'not-found',
          'No user account found for this email/phone. Please contact your administrator to set up your account.'
        );
      }

      // STEP 4: Find and link soldier on sign-in
      console.log(`[syncUserOnSignIn] STEP 5: Finding soldier to link...`);
      let soldierData = null;
      let shouldUpdateUserDoc = false;
      let newLinkedSoldierId = userData.linked_soldier_id; // Start with existing value

      // Try to find soldier by phone number
      if (authUser.phoneNumber) {
        console.log(`[syncUserOnSignIn] STEP 5a: Searching for soldier by phone number...`);
        console.log(`  Query: soldiers WHERE phone_number == "${authUser.phoneNumber}"`);

        try {
          const soldiersByPhone = await db.collection('soldiers')
            .where('phone_number', '==', authUser.phoneNumber)
            .limit(1)
            .get();

          console.log(`  Result: Found ${soldiersByPhone.size} soldier(s)`);

          if (!soldiersByPhone.empty) {
            soldierData = soldiersByPhone.docs[0].data();
            console.log(`  ✅ FOUND: Soldier ${soldierData.soldier_id} by phone`);
            console.log(`    Name: ${soldierData.first_name} ${soldierData.last_name}`);
            console.log(`    Division: ${soldierData.division_name || 'N/A'}`);
            console.log(`    Team: ${soldierData.team_name || 'N/A'}`);

            // Update linked soldier ID if it changed
            if (newLinkedSoldierId !== soldierData.soldier_id) {
              console.log(`  📝 Updating linked_soldier_id from "${newLinkedSoldierId || 'null'}" to "${soldierData.soldier_id}"`);
              newLinkedSoldierId = soldierData.soldier_id;
              shouldUpdateUserDoc = true;
            }
          } else {
            console.log(`  ❌ NOT FOUND by phone`);
          }
        } catch (error) {
          console.error(`  ❌ Error searching by phone:`, error);
        }
      } else {
        console.log(`[syncUserOnSignIn] STEP 5a: Skipping phone search (no phone number)`);
      }

      // Try to find soldier by email if not found by phone
      if (!soldierData && authUser.email) {
        console.log(`[syncUserOnSignIn] STEP 5b: Searching for soldier by email...`);
        console.log(`  Query: soldiers WHERE email == "${authUser.email}"`);

        try {
          const soldiersByEmail = await db.collection('soldiers')
            .where('email', '==', authUser.email)
            .limit(1)
            .get();

          console.log(`  Result: Found ${soldiersByEmail.size} soldier(s)`);

          if (!soldiersByEmail.empty) {
            soldierData = soldiersByEmail.docs[0].data();
            console.log(`  ✅ FOUND: Soldier ${soldierData.soldier_id} by email`);
            console.log(`    Name: ${soldierData.first_name} ${soldierData.last_name}`);
            console.log(`    Division: ${soldierData.division_name || 'N/A'}`);
            console.log(`    Team: ${soldierData.team_name || 'N/A'}`);

            // Update linked soldier ID if it changed
            if (newLinkedSoldierId !== soldierData.soldier_id) {
              console.log(`  📝 Updating linked_soldier_id from "${newLinkedSoldierId || 'null'}" to "${soldierData.soldier_id}"`);
              newLinkedSoldierId = soldierData.soldier_id;
              shouldUpdateUserDoc = true;
            }
          } else {
            console.log(`  ❌ NOT FOUND by email`);
          }
        } catch (error) {
          console.error(`  ❌ Error searching by email:`, error);
        }
      } else if (!soldierData) {
        console.log(`[syncUserOnSignIn] STEP 5b: Skipping email search (no email or already found)`);
      }

      // If no soldier found, use "SAMPLE_SOLDIER" as the ID and set division/team to null
      if (!soldierData) {
        console.log(`[syncUserOnSignIn] STEP 5c: No soldier found, using SAMPLE_SOLDIER ID...`);

        // Update linked soldier ID to "SAMPLE_SOLDIER" and clear division/team
        const needsUpdate = newLinkedSoldierId !== 'SAMPLE_SOLDIER' || userData.division !== null || userData.team !== null;

        if (needsUpdate) {
          console.log(`  📝 Updating user:`);
          console.log(`    - linked_soldier_id: "${newLinkedSoldierId || 'null'}" → "SAMPLE_SOLDIER"`);
          console.log(`    - division: "${userData.division || 'null'}" → null`);
          console.log(`    - team: "${userData.team || 'null'}" → null`);
          newLinkedSoldierId = 'SAMPLE_SOLDIER';
          shouldUpdateUserDoc = true;
        } else {
          console.log(`  ℹ️  Already set: linked_soldier_id="SAMPLE_SOLDIER", division=null, team=null`);
        }
      } else {
        console.log(`[syncUserOnSignIn] STEP 5c: Soldier found, skipping SAMPLE_SOLDIER fallback`);
      }

      // Calculate display name from soldier data
      // Display name is always from soldier: first_name + last_name, or "Sample Soldier" if no soldier found
      const displayName = soldierData
        ? `${soldierData.first_name || ''} ${soldierData.last_name || ''}`.trim()
        : 'Sample Soldier';

      console.log(`[syncUserOnSignIn] STEP 5d: Display name will be: "${displayName}"`);

      // ALWAYS update user document with latest soldier data (division, team, displayName, linked_soldier_id)
      if (userDoc) {
        console.log(`[syncUserOnSignIn] STEP 5e: Updating user document with soldier data...`);
        console.log(`  User Doc ID: ${userDocId}`);
        console.log(`  Linked soldier ID: ${newLinkedSoldierId}`);

        try {
          // Set division and team from soldier if they exist, otherwise null
          const newDivision = soldierData?.division_name || null;
          const newTeam = soldierData?.team_name || null;

          const updateData = {
            linked_soldier_id: newLinkedSoldierId,
            division: newDivision,
            team: newTeam,
            displayName: displayName,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          };

          console.log(`  Update data:`, {
            linked_soldier_id: updateData.linked_soldier_id,
            division: updateData.division,
            team: updateData.team,
            displayName: updateData.displayName
          });

          if (soldierData) {
            console.log(`  ℹ️  Division from soldier: ${soldierData.division_name ? `"${soldierData.division_name}"` : 'null (soldier has no division)'}`);
            console.log(`  ℹ️  Team from soldier: ${soldierData.team_name ? `"${soldierData.team_name}"` : 'null (soldier has no team)'}`);
          } else {
            console.log(`  ℹ️  No soldier found - division and team set to null`);
          }

          await userDoc.ref.update(updateData);
          console.log(`  ✅ Successfully updated user document`);

          // Update userData object for use below
          userData.linked_soldier_id = newLinkedSoldierId;
          userData.division = newDivision;
          userData.team = newTeam;
          userData.displayName = displayName;
        } catch (updateError) {
          console.error(`  ❌ Error updating user document:`, updateError);
        }
      }

      try {
        const customClaims = {
          role: userData.role || 'soldier',
          custom_role: userData.custom_role || 'soldier',
          permissions: userData.permissions || getDefaultPermissions('soldier'),
          scope: userData.scope || 'self',
          division: soldierData?.division_name || userData.division || null,
          team: soldierData?.team_name || userData.team || null,
          linked_soldier_id: userData.linked_soldier_id || null,
          user_doc_id: userDocId,
          displayName: displayName,
          email: userData.email || authUser.email,
          phoneNumber: userData.phoneNumber || authUser.phoneNumber,
          totp_enabled: userData.totp_enabled || false,
          totp_secret: authUser.customClaims?.totp_secret || null,
          totp_temp_secret: authUser.customClaims?.totp_temp_secret || null
        };

        await admin.auth().setCustomUserClaims(authUid, customClaims);
      } catch (claimsError) {
        console.warn(`[syncUserOnSignIn] Could not update custom claims:`, claimsError.message);
      }

      // Return the user's complete data
      return {
        success: true,
        user: {
          user_doc_id: userDocId,
          auth_uid: authUid,
          displayName: displayName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          role: userData.role,
          custom_role: userData.custom_role,
          permissions: userData.permissions,
          scope: userData.scope,
          division: userData.division,
          team: userData.team,
          linked_soldier_id: userData.linked_soldier_id,
          totp_enabled: userData.totp_enabled || false
        },
        soldier: soldierData ? {
          soldier_id: soldierData.soldier_id,
          first_name: soldierData.first_name,
          last_name: soldierData.last_name,
          division_name: soldierData.division_name,
          team_name: soldierData.team_name
        } : null
      };

    } catch (error) {
      // If it's already an HttpsError, re-throw it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      console.error(`[syncUserOnSignIn] ERROR:`, error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to sync user data: ${error.message}`
      );
    }
  });

/**
 * Automatically create user document when a new user signs in
 * Triggered by Firebase Authentication onCreate event
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  console.log(`[onUserCreate] New user created: ${user.uid}`);
  console.log(`  Email: ${user.email || 'N/A'}`);
  console.log(`  Phone: ${user.phoneNumber || 'N/A'}`);

  const db = admin.firestore();

  try {
    // Check if user document already exists (shouldn't happen, but just in case)
    const userDocRef = db.collection('users').doc(user.uid);
    const existingUserDoc = await userDocRef.get();

    if (existingUserDoc.exists) {
      console.log(`  User document already exists, skipping creation`);
      return null;
    }

    // Find matching soldier by email or phone
    let soldierDoc = null;
    let soldierData = null;

    // Try to match by email first
    if (user.email) {
      console.log(`  Searching for soldier by email: ${user.email}`);
      const soldiersByEmail = await db.collection('soldiers')
        .where('email', '==', user.email)
        .limit(1)
        .get();

      if (!soldiersByEmail.empty) {
        soldierDoc = soldiersByEmail.docs[0];
        soldierData = soldierDoc.data();
        console.log(`  ✅ Found soldier by email: ${soldierData.soldier_id}`);
      }
    }

    // Try to match by phone number if email didn't match
    if (!soldierDoc && user.phoneNumber) {
      console.log(`  Searching for soldier by phone: ${user.phoneNumber}`);
      const soldiersByPhone = await db.collection('soldiers')
        .where('phone_number', '==', user.phoneNumber)
        .limit(1)
        .get();

      if (!soldiersByPhone.empty) {
        soldierDoc = soldiersByPhone.docs[0];
        soldierData = soldierDoc.data();
        console.log(`  ✅ Found soldier by phone: ${soldierData.soldier_id}`);
      }
    }

    // Prepare user document data
    const defaultRole = 'soldier'; // All new users default to soldier role
    const permissions = getDefaultPermissions(defaultRole);

    const userDocData = {
      custom_role: defaultRole,
      role: defaultRole,
      permissions: permissions,
      scope: permissions.scope,
      totp_enabled: false,
      totp_enabled_at: null,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      displayName: user.displayName || null,
      division: null,
      team: null,
      linked_soldier_id: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // If soldier found, populate additional fields
    if (soldierData) {
      console.log(`  Linking user to soldier: ${soldierData.soldier_id}`);
      userDocData.displayName = userDocData.displayName || `${soldierData.first_name || ''} ${soldierData.last_name || ''}`.trim();
      userDocData.division = soldierData.division_name || null;
      userDocData.team = soldierData.team_name || null;
      userDocData.linked_soldier_id = soldierData.soldier_id;

      // Update soldier document with user UID
      await soldierDoc.ref.update({
        id: user.uid,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  ✅ Updated soldier ${soldierData.soldier_id} with user UID`);
    } else {
      console.log(`  ⚠️  No matching soldier found - creating user with default soldier role`);
    }

    // Create user document in Firestore
    await userDocRef.set(userDocData);
    console.log(`  ✅ Created user document for ${user.uid} with role: ${defaultRole}`);

    // Also set custom claims for backward compatibility
    try {
      const customClaims = {
        role: defaultRole,
        custom_role: defaultRole,
        permissions: permissions,
        scope: permissions.scope,
        division: userDocData.division,
        team: userDocData.team,
        linked_soldier_id: userDocData.linked_soldier_id,
        totp_enabled: false,
        totp_secret: null,
        totp_temp_secret: null
      };

      await admin.auth().setCustomUserClaims(user.uid, customClaims);
      console.log(`  ✅ Set custom claims for ${user.uid}`);
    } catch (claimsError) {
      console.warn(`  ⚠️  Could not set custom claims:`, claimsError.message);
      // Don't fail - Firestore is the source of truth
    }

    console.log(`[onUserCreate] Successfully processed user ${user.uid}`);
    return null;

  } catch (error) {
    console.error(`[onUserCreate] Error processing user ${user.uid}:`, error);
    // Don't throw - we don't want to block user creation
    return null;
  }
});