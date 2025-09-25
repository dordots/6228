import { auth } from './config';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';

// Helper to detect if input is phone or email
export const isPhoneNumber = (input) => {
  // E.164 format: +[country code][number]
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(input);
};

// Initialize reCAPTCHA verifier for phone auth
let recaptchaVerifier;
export const initializeRecaptcha = (buttonId) => {
  recaptchaVerifier = new RecaptchaVerifier(buttonId, {
    'size': 'invisible',
    'callback': (response) => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
      console.log('reCAPTCHA verified');
    }
  }, auth);
};

// Sign in with email or phone
export const signIn = async (credential, password) => {
  if (isPhoneNumber(credential)) {
    // Phone authentication flow
    if (!recaptchaVerifier) {
      throw new Error('Please initialize reCAPTCHA first');
    }
    
    const confirmationResult = await signInWithPhoneNumber(auth, credential, recaptchaVerifier);
    // Store confirmation result for verification step
    window.confirmationResult = confirmationResult;
    
    return {
      requiresVerification: true,
      type: 'phone',
      message: 'Verification code sent to your phone'
    };
  } else {
    // Email authentication flow
    const userCredential = await signInWithEmailAndPassword(auth, credential, password);
    return {
      requiresVerification: false,
      user: userCredential.user
    };
  }
};

// Verify phone code
export const verifyPhoneCode = async (code) => {
  if (!window.confirmationResult) {
    throw new Error('No pending verification');
  }
  
  const result = await window.confirmationResult.confirm(code);
  delete window.confirmationResult; // Clean up
  return result.user;
};

// Sign up with email
export const signUpWithEmail = async (email, password, displayName) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Update profile with display name
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }
  
  return userCredential.user;
};

// Sign out
export const logout = async () => {
  await signOut(auth);
};

// Auth state observer
export const onAuth = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Update user profile
export const updateUserProfile = async (profileData) => {
  const user = getCurrentUser();
  if (!user) throw new Error('No authenticated user');
  
  await updateProfile(user, profileData);
  return user;
};