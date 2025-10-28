import {
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  PhoneAuthProvider,
  signInWithCredential,
  updateProfile
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { auth, functions, db } from './config';

// Auth state management
let currentUser = null;
let authStateListeners = [];

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authStateListeners.forEach(callback => callback(user));
});

export const addAuthStateListener = (callback) => {
  authStateListeners.push(callback);
  return () => {
    authStateListeners = authStateListeners.filter(cb => cb !== callback);
  };
};

// Phone auth helpers
let confirmationResult = null;
let recaptchaVerifier = null;

const setupRecaptcha = (containerId = 'recaptcha-container') => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: (response) => {
        console.log('reCAPTCHA verified');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        recaptchaVerifier = null;
      }
    });
  }
  return recaptchaVerifier;
};

// Main auth object compatible with Base44 API
export const User = {
  // Login with email/password or phone
  login: async ({ emailOrPhone, password, verificationCode }) => {
    console.log(`\n========================================`);
    console.log(`[User.login] STEP 1: Starting login process`);
    console.log(`  Login identifier: ${emailOrPhone}`);

    try {
      // Check if input is phone number
      const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
      console.log(`[User.login] STEP 2: Detected authentication type`);
      console.log(`  Type: ${isPhone ? 'PHONE' : 'EMAIL'}`);

      if (isPhone) {
        // Phone authentication flow
        if (!verificationCode) {
          // Step 1: Send verification code
          console.log(`[User.login] STEP 3: Sending SMS verification code`);
          console.log(`  Phone: ${emailOrPhone}`);
          const appVerifier = setupRecaptcha();
          confirmationResult = await signInWithPhoneNumber(auth, emailOrPhone, appVerifier);
          console.log(`  ✅ Verification code sent successfully`);
          console.log(`  Verification ID: ${confirmationResult.verificationId}`);
          console.log(`========================================\n`);
          return { requiresVerification: true, verificationId: confirmationResult.verificationId };
        } else {
          // Step 2: Verify code
          console.log(`[User.login] STEP 3: Verifying SMS code`);
          console.log(`  Code: ${verificationCode}`);
          if (!confirmationResult) {
            throw new Error('No pending verification');
          }
          const result = await confirmationResult.confirm(verificationCode);
          console.log(`  ✅ Phone authentication successful`);
          console.log(`  Auth UID: ${result.user.uid}`);
          console.log(`  Phone: ${result.user.phoneNumber}`);

          // Sync user data with soldier record after successful sign-in
          console.log(`[User.login] STEP 4: Syncing user data with Firestore`);
          console.log(`  Calling: syncUserOnSignIn cloud function`);
          try {
            const syncFunction = httpsCallable(functions, 'syncUserOnSignIn');
            const syncResult = await syncFunction();
            console.log(`  ✅ User data synced successfully`);
            console.log(`  Sync result:`, JSON.stringify(syncResult.data, null, 2));
          } catch (syncError) {
            console.warn(`  ⚠️  Failed to sync user data:`, syncError.message);
            console.warn(`  Login will continue, but user data may not be current`);
            // Don't block login if sync fails
          }

          console.log(`[User.login] ✅ SUCCESS: Login complete`);
          console.log(`========================================\n`);
          return { user: result.user, requiresVerification: false };
        }
      } else {
        // Email authentication
        console.log(`[User.login] STEP 3: Authenticating with email/password`);
        console.log(`  Email: ${emailOrPhone}`);
        const userCredential = await signInWithEmailAndPassword(auth, emailOrPhone, password);
        console.log(`  ✅ Email authentication successful`);
        console.log(`  Auth UID: ${userCredential.user.uid}`);
        console.log(`  Email: ${userCredential.user.email}`);

        // Sync user data with soldier record after successful sign-in
        console.log(`[User.login] STEP 4: Syncing user data with Firestore`);
        console.log(`  Calling: syncUserOnSignIn cloud function`);
        try {
          const syncFunction = httpsCallable(functions, 'syncUserOnSignIn');
          const syncResult = await syncFunction();
          console.log(`  ✅ User data synced successfully`);
          console.log(`  Sync result:`, JSON.stringify(syncResult.data, null, 2));
        } catch (syncError) {
          console.warn(`  ⚠️  Failed to sync user data:`, syncError.message);
          console.warn(`  Login will continue, but user data may not be current`);
          // Don't block login if sync fails
        }

        console.log(`[User.login] ✅ SUCCESS: Login complete`);
        console.log(`========================================\n`);
        return { user: userCredential.user, requiresVerification: false };
      }
    } catch (error) {
      console.error(`[User.login] ❌ ERROR: Login failed`);
      console.error(`  Error:`, error.message);
      console.log(`========================================\n`);
      throw error;
    }
  },
  
  // Register with email/password or phone
  register: async ({ emailOrPhone, password, displayName, verificationCode }) => {
    try {
      const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
      
      if (isPhone) {
        // Phone registration uses same flow as login
        return User.login({ emailOrPhone, verificationCode });
      } else {
        // Email registration
        const userCredential = await createUserWithEmailAndPassword(auth, emailOrPhone, password);
        
        // Update display name if provided
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
        
        return { user: userCredential.user, requiresVerification: false };
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },
  
  // Get current user with custom claims
  me: async (forceRefresh = false) => {
    return new Promise(async (resolve) => {
      const getFullUser = async (user) => {
        console.log(`\n========================================`);
        console.log(`[User.me] STEP 1: Loading user data`);
        console.log(`  Force refresh: ${forceRefresh}`);

        if (!user) {
          console.log(`[User.me] ❌ No authenticated user found`);
          console.log(`========================================\n`);
          return null;
        }

        console.log(`[User.me] STEP 2: Got authenticated user from Firebase Auth`);
        console.log(`  Auth UID: ${user.uid}`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Phone: ${user.phoneNumber || 'N/A'}`);

        // Get custom claims (force refresh to get latest claims from server)
        // Custom claims now contain the linked user's data (set by syncUserOnSignIn)
        console.log(`[User.me] STEP 3: Fetching ID token and custom claims from Firebase Auth`);
        const idTokenResult = await user.getIdTokenResult(forceRefresh);
        const claims = idTokenResult.claims;

        console.log(`[User.me] STEP 4: Retrieved custom claims`);
        console.log(`  Custom claims contain:`);
        console.log(`    - role: ${claims.role || 'N/A'}`);
        console.log(`    - custom_role: ${claims.custom_role || 'N/A'}`);
        console.log(`    - linked_soldier_id: ${claims.linked_soldier_id || 'N/A'}`);
        console.log(`    - user_doc_id: ${claims.user_doc_id || 'N/A'}`);
        console.log(`    - division: ${claims.division || 'N/A'}`);
        console.log(`    - team: ${claims.team || 'N/A'}`);
        console.log(`    - displayName: ${claims.displayName || 'N/A'}`);
        console.log(`    - email: ${claims.email || 'N/A'}`);
        console.log(`    - phoneNumber: ${claims.phoneNumber || 'N/A'}`);
        console.log(`  Permissions:`, JSON.stringify(claims.permissions || {}, null, 2));

        // If we have user_doc_id in claims, fetch the actual user document
        // This is the document that was found by linked_soldier_id
        let firestoreUserData = null;
        if (claims.user_doc_id) {
          console.log(`[User.me] STEP 5: Fetching linked user document from Firestore`);
          console.log(`  User document ID: ${claims.user_doc_id}`);
          console.log(`  Collection: users`);
          try {
            const userDocRef = doc(db, 'users', claims.user_doc_id);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              firestoreUserData = userDocSnap.data();
              console.log(`  ✅ Found user document in Firestore`);
              console.log(`    - role: ${firestoreUserData.role || 'N/A'}`);
              console.log(`    - custom_role: ${firestoreUserData.custom_role || 'N/A'}`);
              console.log(`    - division: ${firestoreUserData.division || 'N/A'}`);
              console.log(`    - team: ${firestoreUserData.team || 'N/A'}`);
              console.log(`    - linked_soldier_id: ${firestoreUserData.linked_soldier_id || 'N/A'}`);
            } else {
              console.warn(`  ⚠️  User document not found in Firestore: ${claims.user_doc_id}`);
              console.warn(`  Will use custom claims data as fallback`);
            }
          } catch (error) {
            console.warn(`  ⚠️  Error fetching user data from Firestore:`, error.message);
            console.warn(`  Will use custom claims data as fallback`);
          }
        } else {
          console.log(`[User.me] STEP 5: No user_doc_id in claims`);
          console.log(`  Using custom claims data directly (no Firestore fallback)`);
        }

        // Build user object from custom claims (which contain linked user data)
        // Use Firestore data if available, otherwise fall back to custom claims
        console.log(`[User.me] STEP 6: Building user object`);

        // Get displayName from claims (set by syncUserOnSignIn) or fallback to user doc or auth displayName
        const displayName = claims.displayName ?? firestoreUserData?.displayName ?? user.displayName;
        console.log(`  Display name source: ${claims.displayName ? 'custom claims' : firestoreUserData?.displayName ? 'Firestore' : user.displayName ? 'Auth' : 'none'}`);

        const userData = {
          id: user.uid,
          uid: user.uid,
          email: user.email,
          phone: user.phoneNumber,
          displayName: displayName, // Use displayName from claims (from user doc)
          full_name: displayName || user.email || user.phoneNumber,
          // Use claims data (which came from linked user) or Firestore
          totp_enabled: firestoreUserData?.totp_enabled ?? claims.totp_enabled ?? false,
          role: firestoreUserData?.role ?? claims.role,
          custom_role: firestoreUserData?.custom_role ?? claims.custom_role,
          permissions: firestoreUserData?.permissions ?? claims.permissions,
          scope: firestoreUserData?.scope ?? claims.scope,
          division: firestoreUserData?.division ?? claims.division,
          team: firestoreUserData?.team ?? claims.team,
          linked_soldier_id: firestoreUserData?.linked_soldier_id ?? claims.linked_soldier_id,
          user_doc_id: claims.user_doc_id, // The actual user document ID
          // Add other user properties
          emailVerified: user.emailVerified,
          metadata: user.metadata
        };

        console.log(`[User.me] STEP 7: Final user object built`);
        console.log(`  User data summary:`);
        console.log(`    - UID: ${userData.uid}`);
        console.log(`    - Display Name: ${userData.displayName || 'N/A'}`);
        console.log(`    - Email: ${userData.email || 'N/A'}`);
        console.log(`    - Phone: ${userData.phone || 'N/A'}`);
        console.log(`    - Role: ${userData.role || 'N/A'}`);
        console.log(`    - Custom Role: ${userData.custom_role || 'N/A'}`);
        console.log(`    - Scope: ${userData.scope || 'N/A'}`);
        console.log(`    - Division: ${userData.division || 'N/A'}`);
        console.log(`    - Team: ${userData.team || 'N/A'}`);
        console.log(`    - Linked Soldier ID: ${userData.linked_soldier_id || 'N/A'}`);
        console.log(`    - User Doc ID: ${userData.user_doc_id || 'N/A'}`);
        console.log(`  Permissions:`, JSON.stringify(userData.permissions || {}, null, 2));

        console.log(`[User.me] ✅ SUCCESS: User data loaded successfully`);
        console.log(`========================================\n`);

        return userData;
      };

      if (currentUser) {
        const fullUser = await getFullUser(currentUser);
        resolve(fullUser);
      } else {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          unsubscribe();
          const fullUser = await getFullUser(user);
          resolve(fullUser);
        });
      }
    });
  },
  
  // Logout
  logout: async () => {
    try {
      await signOut(auth);
      confirmationResult = null;
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },
  
  // TOTP functions
  generateTotp: async () => {
    const generateTotpFn = httpsCallable(functions, 'generateTotp');
    const result = await generateTotpFn();
    return result.data;
  },
  
  verifyTotp: async (token) => {
    try {
      const verifyTotpFn = httpsCallable(functions, 'verifyTotp');
      const result = await verifyTotpFn({ token });
      return result.data;
    } catch (error) {
      // Re-throw with original Firebase error code for rate limiting detection
      throw error;
    }
  },
  
  // Helper to check if user is authenticated
  isAuthenticated: () => {
    return !!currentUser;
  },
  
  // Get current user synchronously
  getCurrentUser: () => {
    return currentUser;
  },
  
  // Get user token for API calls
  getIdToken: async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }
    return await currentUser.getIdToken();
  },
  
  // Get custom claims (roles, permissions)
  getCustomClaims: async () => {
    if (!currentUser) {
      return null;
    }
    const idTokenResult = await currentUser.getIdTokenResult();
    return idTokenResult.claims;
  },
  
  // Check if user has specific role
  hasRole: async (role) => {
    const claims = await User.getCustomClaims();
    return claims?.role === role || (Array.isArray(claims?.roles) && claims.roles.includes(role));
  },
  
  // Update current user data (custom claims)
  updateMyUserData: async (updates) => {
    const updateUserDataFn = httpsCallable(functions, 'updateUserData');
    const result = await updateUserDataFn({ updates });
    
    // Force refresh the current user's token to get updated claims
    if (currentUser) {
      await currentUser.getIdToken(true);
    }
    
    return result.data;
  },
  
  // Clean up recaptcha on component unmount
  cleanup: () => {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    confirmationResult = null;
  },
  
  // User Management Methods (for UserManagement page)
  
  // List all users (with pagination to get all users)
  list: async (options = {}) => {
    try {
      const listUsersFn = httpsCallable(functions, 'listUsers');
      let allUsers = [];
      let pageToken = null;

      // Loop through all pages until no more pageToken
      do {
        const requestData = { ...options };
        if (pageToken) {
          requestData.pageToken = pageToken;
        }
        const result = await listUsersFn(requestData);
        const users = result.data.users || [];
        allUsers = allUsers.concat(users);
        pageToken = result.data.pageToken;
      } while (pageToken);

      return allUsers;
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  },
  
  // Create new user
  create: async (userData) => {
    try {
      const createUserFn = httpsCallable(functions, 'createPhoneUser');
      const result = await createUserFn(userData);
      return result.data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  
  // Update user (role/permissions)
  update: async (uid, updates) => {
    try {
      if (updates.role !== undefined || updates.customRole !== undefined || 
          updates.division !== undefined || updates.team !== undefined) {
        const updateRoleFn = httpsCallable(functions, 'updateUserRole');
        await updateRoleFn({ 
          uid, 
          role: updates.role || updates.customRole, 
          division: updates.division,
          team: updates.team
        });
      }
      
      if (updates.permissions && (updates.permissions.division !== undefined || 
                                  updates.permissions.team !== undefined)) {
        const updatePermsFn = httpsCallable(functions, 'updateUserPermissions');
        await updatePermsFn({ 
          uid, 
          division: updates.permissions.division,
          team: updates.permissions.team
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },
  
  // Delete user
  delete: async (uid, hardDelete = false) => {
    try {
      const deleteUserFn = httpsCallable(functions, 'deleteUser');
      const result = await deleteUserFn({ uid, hardDelete });
      return result.data;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },
  
  // Find user by email/phone
  findByEmail: async (emailOrPhone) => {
    try {
      const getUserFn = httpsCallable(functions, 'getUserByPhone');
      const result = await getUserFn({ phoneNumber: emailOrPhone });
      return result.data;
    } catch (error) {
      console.error('Error finding user:', error);
      return null;
    }
  },
  
  // Bulk create users (for import)
  bulkCreate: async (users) => {
    try {
      // Create users one by one (can be optimized later)
      const results = [];
      for (const user of users) {
        try {
          const result = await User.create(user);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      return results;
    } catch (error) {
      console.error('Error in bulk create:', error);
      throw error;
    }
  }
};

// Export auth instance for direct access if needed
export { auth };