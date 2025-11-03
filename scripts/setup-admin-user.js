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
  try {
    // Get admin details
    const email = await question('Enter admin email address: ');
    const password = await question('Enter admin password (min 6 characters): ');
    const displayName = await question('Enter admin display name: ');
    const phoneNumber = await question('Enter admin phone number (optional, format: +1234567890): ');

    // Create user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      phoneNumber: phoneNumber || undefined,
      emailVerified: true
    });

    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'manage_users'],
      created_at: new Date().toISOString()
    });

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

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      const existingEmail = await question('Enter existing user email to make admin: ');

      try {
        const existingUser = await auth.getUserByEmail(existingEmail);
        await auth.setCustomUserClaims(existingUser.uid, {
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users'],
          created_at: new Date().toISOString()
        });
      } catch (err) {
      }
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run setup
setupAdminUser();