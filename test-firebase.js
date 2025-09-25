import { db, auth } from './src/firebase/config.js';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

async function testFirestoreConnection() {
  console.log('\n🔥 Testing Firestore Connection...');
  try {
    const querySnapshot = await getDocs(collection(db, 'test'));
    console.log('✅ Firestore connected successfully!');
    console.log(`Found ${querySnapshot.size} documents in test collection`);
  } catch (error) {
    console.error('❌ Firestore connection error:', error.message);
    if (error.code === 'permission-denied') {
      console.log('💡 Tip: Make sure you have deployed security rules or are authenticated');
    }
  }
}

async function testAuthConnection() {
  console.log('\n🔐 Testing Auth Connection...');
  try {
    // Check if auth is initialized
    console.log('✅ Firebase Auth initialized');
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('✅ User is signed in:');
        console.log('  - UID:', user.uid);
        console.log('  - Email:', user.email || 'N/A');
        console.log('  - Phone:', user.phoneNumber || 'N/A');
      } else {
        console.log('ℹ️  No user is currently signed in');
      }
      unsubscribe(); // Stop listening after first check
    });
    
    // Give auth state time to resolve
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error('❌ Auth connection error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Firebase Connection Test Suite');
  console.log('=================================');
  
  await testAuthConnection();
  await testFirestoreConnection();
  
  console.log('\n=================================');
  console.log('✅ Connection tests completed!');
  console.log('\n💡 Next steps:');
  console.log('1. Run "node test-auth.js" to test authentication');
  console.log('2. Deploy rules: firebase deploy --only firestore:rules');
  console.log('3. Enable services in Firebase Console if needed');
}

runAllTests().catch(console.error).finally(() => process.exit(0));