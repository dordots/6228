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
      },
      'expired-callback': () => {
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
    try {
      // Check if input is phone number
      const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);

      if (isPhone) {
        // Phone authentication flow
        if (!verificationCode) {
          // Step 1: Send verification code
          const appVerifier = setupRecaptcha();
          confirmationResult = await signInWithPhoneNumber(auth, emailOrPhone, appVerifier);
          return { requiresVerification: true, verificationId: confirmationResult.verificationId };
        } else {
          // Step 2: Verify code
          if (!confirmationResult) {
            throw new Error('No pending verification');
          }
          const result = await confirmationResult.confirm(verificationCode);

          // Sync user data with soldier record after successful sign-in
          try {
            const syncFunction = httpsCallable(functions, 'syncUserOnSignIn');
            const syncResult = await syncFunction();
          } catch (syncError) {
            // Don't block login if sync fails
          }

          return { user: result.user, requiresVerification: false };
        }
      } else {
        // Email authentication
        const userCredential = await signInWithEmailAndPassword(auth, emailOrPhone, password);

        // Sync user data with soldier record after successful sign-in
        try {
          const syncFunction = httpsCallable(functions, 'syncUserOnSignIn');
          const syncResult = await syncFunction();
        } catch (syncError) {
          // Don't block login if sync fails
        }

        return { user: userCredential.user, requiresVerification: false };
      }
    } catch (error) {
      // Handle Firebase rate limiting with better error messages
      if (error.code === 'auth/too-many-requests') {
        // Firebase doesn't provide exact retry time, so we estimate based on common patterns
        // Typically 15-60 minutes for SMS rate limits
        const estimatedWaitMinutes = 15;
        const enhancedError = new Error(`Too many SMS requests. Please wait approximately ${estimatedWaitMinutes} minutes and try again.`);
        enhancedError.code = error.code;
        enhancedError.retryAfterMinutes = estimatedWaitMinutes;
        throw enhancedError;
      }
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
      throw error;
    }
  },
  
  // Get current user with custom claims
  me: async (forceRefresh = false) => {
    return new Promise(async (resolve) => {
      const getFullUser = async (user) => {
        if (!user) {
          return null;
        }

        // ALWAYS sync user data on every page load to ensure permissions are current
        try {
          const syncFunction = httpsCallable(functions, 'syncUserOnSignIn');
          await syncFunction();
        } catch (syncError) {
          // Don't block if sync fails - use cached data
        }

        // Get custom claims (force refresh to get latest claims from server after sync)
        // Custom claims now contain the linked user's data (set by syncUserOnSignIn)
        const idTokenResult = await user.getIdTokenResult(true); // Always force refresh after sync
        const claims = idTokenResult.claims;

        // If we have user_doc_id in claims, fetch the actual user document
        // This is the document that was found by linked_soldier_id
        let firestoreUserData = null;
        if (claims.user_doc_id) {
          try {
            const userDocRef = doc(db, 'users', claims.user_doc_id);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              firestoreUserData = userDocSnap.data();
            }
          } catch (error) {
          }
        }

        // Build user object from custom claims (which contain linked user data)
        // Use Firestore data if available, otherwise fall back to custom claims
        // Get displayName from claims (set by syncUserOnSignIn) or fallback to user doc or auth displayName
        const displayName = claims.displayName ?? firestoreUserData?.displayName ?? user.displayName;

        const userData = {
          id: user.uid,
          uid: user.uid,
          email: user.email,
          phone: user.phoneNumber,
          displayName: displayName, // Use displayName from claims (from user doc)
          full_name: displayName || user.email || user.phoneNumber,
          // Use claims data (which came from linked user) or Firestore
          totp_enabled: firestoreUserData?.totp_enabled ?? claims.totp_enabled ?? false,
          // TOTP device verification (from Firestore users collection)
          totp_verified_until: firestoreUserData?.totp_verified_until?.toMillis() ?? null,
          totp_device_fingerprint: firestoreUserData?.totp_device_fingerprint ?? null,
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
      throw error;
    }
  }
};

// Export auth instance for direct access if needed
export { auth };