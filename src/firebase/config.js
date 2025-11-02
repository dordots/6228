import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Initialize App Check (only in production)
export let appCheck = null;
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (recaptchaSiteKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
      console.log('✅ App Check initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize App Check:', error);
    }
  } else {
    console.warn('⚠️  VITE_RECAPTCHA_SITE_KEY not found. App Check not initialized.');
  }
}

// Analytics only available in browser environment
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then(yes => yes && (analytics = getAnalytics(app)));
}

// Helper to check if we're in development
export const isDevelopment = import.meta.env.DEV;

// Enable App Check debug token in development
if (isDevelopment && typeof window !== 'undefined') {
  // @ts-ignore
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.log('🔧 App Check debug mode enabled for development');
}

// Import emulator connectors
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';

// Connect to emulators in development
if (isDevelopment && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firebase emulators...');
  
  // Only connect if not already connected
  if (!auth.config.emulator) {
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('✅ Connected to Auth emulator');
  }
  
  if (!db._settings?.host?.includes('localhost:8080')) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore emulator');
  }
  
  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('✅ Connected to Functions emulator');
  
  connectStorageEmulator(storage, 'localhost', 9199);
  console.log('✅ Connected to Storage emulator');
}

export default app;