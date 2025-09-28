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

      // Get default permissions for the role
      const roleToUse = customRole || role || 'soldier';
      const defaultPerms = getDefaultPermissions(roleToUse);
      
      // Set custom claims with new RBAC structure
      const customClaims = {
        role: roleToUse === 'admin' ? 'admin' : 'user',
        custom_role: roleToUse,
        permissions: defaultPerms,
        scope: defaultPerms.scope,
        division: null,
        team: null,
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
    const canManageUsers = context.auth.token.permissions?.['system.users'];
    const isDivisionManager = context.auth.token.custom_role === 'division_manager';

    if (!isAdmin && !canManageUsers && !isDivisionManager) {
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
            id: user.uid, // Add id for frontend compatibility
            email: user.email,
            phoneNumber: user.phoneNumber,
            full_name: user.displayName || user.email || user.phoneNumber, // Add full_name
            displayName: user.displayName,
            disabled: user.disabled,
            created_date: user.metadata.creationTime, // Rename for frontend
            createdAt: user.metadata.creationTime,
            lastSignInAt: user.metadata.lastSignInTime,
            role: customClaims.role || 'user',
            custom_role: customClaims.custom_role || 'soldier',
            permissions: customClaims.permissions || {},
            scope: customClaims.scope,
            division: customClaims.division,
            team: customClaims.team,
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

    const { uid, role, division, team } = data;

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

      // Get default permissions for the role
      const permissions = getDefaultPermissions(role);

      // Update custom claims with new RBAC structure
      const updatedClaims = {
        ...currentClaims,
        role: role === 'admin' ? 'admin' : 'user', // Admin is special, others are 'user' base role
        custom_role: role,
        permissions: permissions,
        scope: permissions.scope,
        division: division || null,
        team: team || null,
      };

      await admin.auth().setCustomUserClaims(uid, updatedClaims);

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
    if (!context.auth || 
        (context.auth.token.role !== 'admin' && 
         context.auth.token.custom_role !== 'division_manager')) {
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
      // Get current user
      const user = await admin.auth().getUser(uid);
      const currentClaims = user.customClaims || {};

      // Division managers can only assign within their division
      if (context.auth.token.custom_role === 'division_manager' && 
          division !== context.auth.token.division) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Division managers can only assign users within their own division'
        );
      }

      // Update custom claims with division/team
      const updatedClaims = {
        ...currentClaims,
        division: division || null,
        team: team || null,
      };

      await admin.auth().setCustomUserClaims(uid, updatedClaims);

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

      // Get admin permissions
      const adminPerms = getDefaultPermissions('admin');
      
      // Set admin claims with new RBAC structure
      const adminClaims = {
        role: 'admin',
        custom_role: 'admin',
        permissions: adminPerms,
        scope: adminPerms.scope,
        division: null,
        team: null,
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
        'system.import': true,
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