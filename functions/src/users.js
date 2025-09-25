const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Create a new user with phone number and assign role/permissions
exports.createPhoneUser = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can create users'
      );
    }

    const { phoneNumber, role = 'soldier', customRole, permissions = {}, linkedSoldierId, displayName, email } = data;

    if (!phoneNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Phone number is required'
      );
    }

    try {
      // Create the user
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

      // Set custom claims
      const customClaims = {
        role,
        custom_role: customRole || (role === 'admin' ? 'admin' : role === 'manager' ? 'manager' : 'soldier'),
        permissions: {
          ...getDefaultPermissions(customRole || role),
          ...permissions
        },
        linked_soldier_id: linkedSoldierId || null,
        totp_enabled: false
      };

      await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

      return {
        uid: userRecord.uid,
        phoneNumber: userRecord.phoneNumber,
        displayName: userRecord.displayName,
        email: userRecord.email,
        customClaims
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

    const isAdmin = context.auth.token.role === 'admin';
    const canManageUsers = context.auth.token.permissions?.can_manage_users;

    if (!isAdmin && !canManageUsers) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Insufficient permissions to list users'
      );
    }

    try {
      const { pageToken, maxResults = 100 } = data;
      
      // List users
      const listResult = await admin.auth().listUsers(maxResults, pageToken);
      
      // Get custom claims for each user
      const users = await Promise.all(
        listResult.users.map(async (user) => {
          const customClaims = user.customClaims || {};
          return {
            uid: user.uid,
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName,
            disabled: user.disabled,
            createdAt: user.metadata.creationTime,
            lastSignInAt: user.metadata.lastSignInTime,
            role: customClaims.role || 'soldier',
            customRole: customClaims.custom_role,
            permissions: customClaims.permissions || {},
            linkedSoldierId: customClaims.linked_soldier_id,
            totpEnabled: customClaims.totp_enabled || false
          };
        })
      );

      return {
        users,
        pageToken: listResult.pageToken
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
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can update user roles'
      );
    }

    const { uid, role, customRole } = data;

    if (!uid || !role) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID and role are required'
      );
    }

    try {
      // Get current user
      const user = await admin.auth().getUser(uid);
      const currentClaims = user.customClaims || {};

      // Update custom claims
      const updatedClaims = {
        ...currentClaims,
        role,
        custom_role: customRole || role,
        permissions: {
          ...getDefaultPermissions(customRole || role),
          ...(currentClaims.permissions || {})
        }
      };

      await admin.auth().setCustomUserClaims(uid, updatedClaims);

      return {
        uid,
        role,
        customRole: customRole || role,
        permissions: updatedClaims.permissions
      };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to update user role: ${error.message}`
      );
    }
  });

// Update user permissions
exports.updateUserPermissions = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can update user permissions'
      );
    }

    const { uid, permissions } = data;

    if (!uid || !permissions) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID and permissions are required'
      );
    }

    try {
      // Get current user
      const user = await admin.auth().getUser(uid);
      const currentClaims = user.customClaims || {};

      // Update custom claims
      const updatedClaims = {
        ...currentClaims,
        permissions: {
          ...(currentClaims.permissions || {}),
          ...permissions
        }
      };

      await admin.auth().setCustomUserClaims(uid, updatedClaims);

      return {
        uid,
        permissions: updatedClaims.permissions
      };
    } catch (error) {
      console.error('Error updating user permissions:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to update user permissions: ${error.message}`
      );
    }
  });

// Delete user (soft delete by disabling)
exports.deleteUser = functions
  .runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
  .https.onCall(async (data, context) => {
    // Check if caller is admin
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can delete users'
      );
    }

    const { uid, hardDelete = false } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User ID is required'
      );
    }

    try {
      if (hardDelete) {
        // Permanently delete user
        await admin.auth().deleteUser(uid);
      } else {
        // Soft delete by disabling account
        await admin.auth().updateUser(uid, {
          disabled: true
        });
      }

      return {
        uid,
        deleted: hardDelete,
        disabled: !hardDelete
      };
    } catch (error) {
      console.error('Error deleting user:', error);
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

    const isAdmin = context.auth.token.role === 'admin';
    const canManageUsers = context.auth.token.permissions?.can_manage_users;

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
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        disabled: user.disabled,
        role: customClaims.role || 'soldier',
        customRole: customClaims.custom_role,
        permissions: customClaims.permissions || {},
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
      
      if (hasAdmin && (!context.auth || context.auth.token.role !== 'admin')) {
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

      // Set admin claims
      const adminClaims = {
        role: 'admin',
        custom_role: 'admin',
        permissions: getDefaultPermissions('admin'),
        linked_soldier_id: null,
        totp_enabled: user.customClaims?.totp_enabled || false
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
  switch (role) {
    case 'admin':
      // Admin has all permissions
      return {
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
      };
      
    case 'manager':
      // Manager has most permissions
      return {
        can_create_soldiers: true,
        can_edit_soldiers: true,
        can_delete_soldiers: false,
        can_create_weapons: true,
        can_edit_weapons: true,
        can_delete_weapons: false,
        can_create_gear: true,
        can_edit_gear: true,
        can_delete_gear: false,
        can_create_drones: true,
        can_edit_drones: true,
        can_delete_drones: false,
        can_create_drone_components: true,
        can_edit_drone_components: true,
        can_delete_drone_components: false,
        can_create_equipment: true,
        can_edit_equipment: true,
        can_delete_equipment: false,
        can_import_data: true,
        can_manage_users: false,
        can_sign_equipment: true,
        can_view_reports: true,
        can_perform_maintenance: true,
        can_view_history: true,
        can_transfer_equipment: true,
        can_deposit_equipment: true,
        can_release_equipment: true,
        can_export_data: true,
        can_perform_daily_verification: true,
      };
      
    default:
      // Soldier or default role has limited permissions
      return {
        can_create_soldiers: false,
        can_edit_soldiers: true,
        can_delete_soldiers: false,
        can_create_weapons: false,
        can_edit_weapons: false,
        can_delete_weapons: false,
        can_create_gear: false,
        can_edit_gear: false,
        can_delete_gear: false,
        can_create_drones: false,
        can_edit_drones: false,
        can_delete_drones: false,
        can_create_drone_components: false,
        can_edit_drone_components: false,
        can_delete_drone_components: false,
        can_create_equipment: false,
        can_edit_equipment: false,
        can_delete_equipment: false,
        can_import_data: false,
        can_manage_users: false,
        can_sign_equipment: true,
        can_view_reports: true,
        can_perform_maintenance: true,
        can_view_history: true,
        can_transfer_equipment: false,
        can_deposit_equipment: true,
        can_release_equipment: true,
        can_export_data: false,
        can_perform_daily_verification: false,
      };
  }
}