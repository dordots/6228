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
import { auth, functions } from './config';

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
          return { user: result.user, requiresVerification: false };
        }
      } else {
        // Email authentication
        const userCredential = await signInWithEmailAndPassword(auth, emailOrPhone, password);
        return { user: userCredential.user, requiresVerification: false };
      }
    } catch (error) {
      console.error('Login error:', error);
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
  me: async () => {
    return new Promise(async (resolve) => {
      const getFullUser = async (user) => {
        if (!user) return null;
        
        // Get custom claims
        const idTokenResult = await user.getIdTokenResult();
        const claims = idTokenResult.claims;
        
        // Return user object with custom fields
        return {
          id: user.uid,
          uid: user.uid,
          email: user.email,
          phone: user.phoneNumber,
          displayName: user.displayName,
          // Add custom claims
          totp_enabled: claims.totp_enabled || false,
          role: claims.role,
          custom_role: claims.custom_role,
          permissions: claims.permissions,
          linked_soldier_id: claims.linked_soldier_id,
          // Add other user properties
          emailVerified: user.emailVerified,
          metadata: user.metadata
        };
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
    const verifyTotpFn = httpsCallable(functions, 'verifyTotp');
    const result = await verifyTotpFn({ token });
    return result.data;
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
  }
};

// Export auth instance for direct access if needed
export { auth };