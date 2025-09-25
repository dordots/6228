import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import readline from 'readline';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const auth = admin.auth();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupAdminUser() {
  console.log('🔐 Firebase Admin User Setup\n');
  
  try {
    // Get admin details
    const email = await question('Enter admin email address: ');
    const password = await question('Enter admin password (min 6 characters): ');
    const displayName = await question('Enter admin display name: ');
    const phoneNumber = await question('Enter admin phone number (optional, format: +1234567890): ');
    
    console.log('\nCreating admin user...');
    
    // Create user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber: phoneNumber || undefined,
      emailVerified: true
    });
    
    console.log('✅ User created successfully:', userRecord.uid);
    
    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'manage_users'],
      created_at: new Date().toISOString()
    });
    
    console.log('✅ Admin role assigned');
    
    // Create a corresponding entry in Firestore (optional)
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName,
      phoneNumber: userRecord.phoneNumber || null,
      role: 'admin',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ User profile created in Firestore');
    
    console.log('\n🎉 Admin user setup complete!');
    console.log('\nYou can now log in with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\n⚠️  Important: Save these credentials securely!');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('\nUser with this email already exists.');
      const existingEmail = await question('Enter existing user email to make admin: ');
      
      try {
        const existingUser = await auth.getUserByEmail(existingEmail);
        await auth.setCustomUserClaims(existingUser.uid, {
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users'],
          created_at: new Date().toISOString()
        });
        console.log('✅ Admin role assigned to existing user');
      } catch (err) {
        console.error('Error updating existing user:', err.message);
      }
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run setup
console.log('Starting Firebase Admin User Setup...\n');
console.log('This script will create the first admin user for your Firebase app.');
console.log('Make sure Firebase Auth is enabled in your Firebase Console.\n');

setupAdminUser();