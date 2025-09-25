import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testConnection() {
  console.log('🔥 Testing Firebase Connection...\n');
  console.log('Using Firebase:', process.env.REACT_APP_USE_FIREBASE === 'true' ? '✅ Yes' : '❌ No');
  
  try {
    // Test Firestore connection
    console.log('\n📊 Testing Firestore...');
    const collections = ['soldiers', 'equipment', 'weapons', 'serialized_gear'];
    
    for (const collectionName of collections) {
      try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        console.log(`✅ ${collectionName}: ${querySnapshot.size} documents`);
      } catch (error) {
        console.log(`❌ ${collectionName}: ${error.message}`);
      }
    }
    
    // Test Auth
    console.log('\n🔐 Firebase Auth Status:');
    console.log(`Current user: ${auth.currentUser ? auth.currentUser.email : 'Not logged in'}`);
    
    console.log('\n✅ Firebase is properly configured!');
    console.log('\nNext steps:');
    console.log('1. Run "node scripts/setup-admin-user.js" to create an admin user');
    console.log('2. Start the app with "npm run dev"');
    console.log('3. Log in with your admin credentials');
    console.log('4. Use the Data Export page to export Base44 data');
    console.log('5. Run migration script to import data to Firebase');
    
  } catch (error) {
    console.error('\n❌ Firebase connection error:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Check your .env.local file has correct Firebase config');
    console.log('2. Make sure Firebase services are enabled in Firebase Console');
    console.log('3. Check if security rules are properly deployed');
  }
  
  process.exit(0);
}

// Run test
testConnection();