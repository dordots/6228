import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const auth = admin.auth();
const db = admin.firestore();

async function createTestAdmin() {
  // Test admin credentials
  const email = 'admin@armory.com';
  const password = 'Admin123!';
  const displayName = 'System Admin';

  try {
    // Create user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });

    // Set custom claims for admin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      permissions: ['read', 'write', 'delete', 'manage_users'],
      created_at: new Date().toISOString()
    });

    // Create user profile in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: 'admin',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      // Update existing user to have admin role
      const existingUser = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(existingUser.uid, {
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'manage_users'],
        created_at: new Date().toISOString()
      });
    } else {
    }
  }

  process.exit(0);
}

// Run
createTestAdmin();