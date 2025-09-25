import { auth } from './src/firebase/config.js';
import { 
  signIn, 
  verifyPhoneCode, 
  initializeRecaptcha,
  signUpWithEmail,
  getCurrentUser,
  logout
} from './src/firebase/auth.js';

// Test credentials
const TEST_PHONE = '+972541234567';
const TEST_PASSWORD = '123456';
const TEST_EMAIL = 'test@example.com';

// Mock reCAPTCHA for testing
class MockRecaptchaVerifier {
  constructor(elementId, options, auth) {
    this.type = 'recaptcha';
    console.log('MockRecaptchaVerifier initialized');
  }
  
  render() {
    return Promise.resolve('mock-widget-id');
  }
  
  verify() {
    return Promise.resolve('mock-recaptcha-token');
  }
}

// Override the RecaptchaVerifier for testing
if (typeof window === 'undefined') {
  global.window = {
    confirmationResult: null
  };
  global.RecaptchaVerifier = MockRecaptchaVerifier;
}

async function testPhoneAuth() {
  console.log('\n🔐 Testing Phone Authentication...');
  console.log('Phone number:', TEST_PHONE);
  
  try {
    // Initialize reCAPTCHA (mocked for testing)
    initializeRecaptcha('sign-in-button');
    
    // Attempt phone sign in
    const result = await signIn(TEST_PHONE, null);
    
    if (result.requiresVerification) {
      console.log('✅ SMS verification initiated');
      console.log('Type:', result.type);
      console.log('Message:', result.message);
      
      // In a real scenario, user would receive SMS and enter code
      // For testing, you'll need to:
      // 1. Check Firebase Console for the verification code
      // 2. Or use Firebase Auth Emulator which provides test codes
      console.log('\n⚠️  Please enter the verification code from SMS');
      console.log('For testing with emulator, the code is usually: 123456');
      
      // Simulate verification (replace with actual code in production)
      // const verificationCode = '123456'; // Use actual code from SMS
      // const user = await verifyPhoneCode(verificationCode);
      // console.log('✅ Phone authentication successful!');
      // console.log('User ID:', user.uid);
      // console.log('Phone:', user.phoneNumber);
    }
  } catch (error) {
    console.error('❌ Phone auth error:', error.message);
    if (error.code === 'auth/invalid-phone-number') {
      console.error('Invalid phone number format. Use E.164 format: +[country][number]');
    } else if (error.code === 'auth/missing-recaptcha-verifier') {
      console.error('reCAPTCHA not properly initialized');
    }
  }
}

async function testEmailAuth() {
  console.log('\n📧 Testing Email Authentication...');
  
  try {
    // Test email sign up
    const user = await signUpWithEmail(TEST_EMAIL, TEST_PASSWORD, 'Test User');
    console.log('✅ Email sign up successful!');
    console.log('User ID:', user.uid);
    console.log('Email:', user.email);
    
    // Sign out
    await logout();
    console.log('✅ Signed out successfully');
    
    // Test email sign in
    const signInResult = await signIn(TEST_EMAIL, TEST_PASSWORD);
    if (!signInResult.requiresVerification) {
      console.log('✅ Email sign in successful!');
      console.log('User:', signInResult.user.email);
    }
  } catch (error) {
    console.error('❌ Email auth error:', error.message);
    if (error.code === 'auth/email-already-in-use') {
      console.log('Email already registered, trying sign in...');
      try {
        const signInResult = await signIn(TEST_EMAIL, TEST_PASSWORD);
        console.log('✅ Email sign in successful!');
      } catch (signInError) {
        console.error('❌ Sign in failed:', signInError.message);
      }
    }
  }
}

async function testCurrentUser() {
  console.log('\n👤 Testing Current User...');
  
  const user = getCurrentUser();
  if (user) {
    console.log('✅ Current user found:');
    console.log('UID:', user.uid);
    console.log('Email:', user.email);
    console.log('Phone:', user.phoneNumber);
    console.log('Display Name:', user.displayName);
  } else {
    console.log('❌ No user currently signed in');
  }
}

async function runAllTests() {
  console.log('🚀 Starting Firebase Authentication Tests\n');
  console.log('================================');
  
  // Test phone authentication
  await testPhoneAuth();
  
  // Note: Comment out email test if you only want to test phone
  // await testEmailAuth();
  
  // Check current user
  await testCurrentUser();
  
  console.log('\n================================');
  console.log('✅ Tests completed!');
  console.log('\nNext steps:');
  console.log('1. If testing phone auth, enter the SMS verification code');
  console.log('2. Run "node test-firebase.js" to test Firestore connection');
  console.log('3. Deploy security rules: firebase deploy --only firestore:rules');
}

// Run tests
runAllTests().catch(console.error);