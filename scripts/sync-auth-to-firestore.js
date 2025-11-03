import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import readline from 'readline';

// Initialize Firebase Admin SDK
// Try to load service account file if it exists
const serviceAccountPaths = [
  './knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json',
  './knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json'
];

let serviceAccountPath = null;
for (const path of serviceAccountPaths) {
  if (existsSync(path)) {
    serviceAccountPath = path;
    break;
  }
}

if (serviceAccountPath) {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'project-1386902152066454120'
  });
} else {
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Statistics tracking
const stats = {
  totalAuthUsers: 0,
  matchedBySoldier: 0,
  updatedSoldiers: 0,
  createdUserDocs: 0,
  skipped: 0,
  errors: 0,
  details: []
};

/**
 * Fetch all users from Firebase Authentication
 */
async function getAllAuthUsers() {
  const users = [];
  let nextPageToken;

  try {
    do {
      const result = await auth.listUsers(1000, nextPageToken);
      users.push(...result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    return users;
  } catch (error) {
    throw error;
  }
}

/**
 * Find matching soldier by email or phone number
 */
async function findMatchingSoldier(authUser) {
  try {
    // Try to match by email first
    if (authUser.email) {
      const soldiersByEmail = await db.collection('soldiers')
        .where('email', '==', authUser.email)
        .limit(1)
        .get();

      if (!soldiersByEmail.empty) {
        return soldiersByEmail.docs[0];
      }
    }

    // Try to match by phone number
    if (authUser.phoneNumber) {
      const soldiersByPhone = await db.collection('soldiers')
        .where('phone_number', '==', authUser.phoneNumber)
        .limit(1)
        .get();

      if (!soldiersByPhone.empty) {
        return soldiersByPhone.docs[0];
      }
    }

    return null;
  } catch (error) {
    throw error;
  }
}

/**
 * Update soldier document with user UID
 */
async function updateSoldierWithUid(soldierDoc, uid, dryRun) {
  const soldierData = soldierDoc.data();

  if (dryRun) {
    return true;
  }

  try {
    await soldierDoc.ref.update({
      id: uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Create or update user document in users collection
 */
async function createUserDocument(authUser, soldierData, dryRun) {
  const userDoc = {
    custom_role: 'soldier',
    role: 'soldier',
    permissions: {
      can_view_all_soldiers: false
    },
    totp_enabled: false,
    totp_enabled_at: null,
    email: authUser.email || null,
    phoneNumber: authUser.phoneNumber || null,
    displayName: authUser.displayName || `${soldierData?.first_name || ''} ${soldierData?.last_name || ''}`.trim() || null,
    division: soldierData?.division_name || null,
    team: soldierData?.team_name || null,
    linked_soldier_id: soldierData?.soldier_id || null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  };

  if (dryRun) {
    return true;
  }

  try {
    await db.collection('users').doc(authUser.uid).set(userDoc, { merge: true });
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Get or create sample soldier
 */
async function getSampleSoldier() {
  try {
    // Look for existing sample soldier
    const sampleSoldiersQuery = await db.collection('soldiers')
      .where('soldier_id', '==', 'SAMPLE_SOLDIER')
      .limit(1)
      .get();

    if (!sampleSoldiersQuery.empty) {
      return sampleSoldiersQuery.docs[0];
    }

    // If no sample soldier exists, find any soldier to use as sample
    const anySoldierQuery = await db.collection('soldiers').limit(1).get();

    if (!anySoldierQuery.empty) {
      return anySoldierQuery.docs[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Process a single auth user
 */
async function processAuthUser(authUser, sampleSoldier, dryRun) {
  const userInfo = {
    uid: authUser.uid,
    email: authUser.email,
    phone: authUser.phoneNumber,
    status: 'skipped',
    reason: '',
    soldierMatch: null
  };

  try {
    // Check if user already has a Firestore document with linked_soldier_id
    const existingUserDoc = await db.collection('users').doc(authUser.uid).get();

    if (existingUserDoc.exists && existingUserDoc.data().linked_soldier_id) {
      userInfo.status = 'skipped';
      userInfo.reason = 'Already synced';
      stats.skipped++;
      return userInfo;
    }

    // Find matching soldier
    const soldierDoc = await findMatchingSoldier(authUser);

    if (!soldierDoc) {
      if (!sampleSoldier) {
        userInfo.status = 'skipped';
        userInfo.reason = 'No matching soldier and no sample soldier available';
        stats.skipped++;
        return userInfo;
      }

      const sampleSoldierData = sampleSoldier.data();

      // Create user document with sample soldier data
      await createUserDocument(authUser, sampleSoldierData, dryRun);
      if (!dryRun) stats.createdUserDocs++;

      userInfo.status = 'success';
      userInfo.reason = 'Linked to sample soldier';
      userInfo.soldierMatch = {
        id: sampleSoldierData.soldier_id,
        name: `${sampleSoldierData.first_name} ${sampleSoldierData.last_name}`,
        division: sampleSoldierData.division_name,
        team: sampleSoldierData.team_name,
        isSample: true
      };
      stats.matchedBySoldier++;
      return userInfo;
    }

    const soldierData = soldierDoc.data();

    userInfo.soldierMatch = {
      id: soldierData.soldier_id,
      name: `${soldierData.first_name} ${soldierData.last_name}`,
      division: soldierData.division_name,
      team: soldierData.team_name
    };
    stats.matchedBySoldier++;

    // Update soldier document with user UID
    await updateSoldierWithUid(soldierDoc, authUser.uid, dryRun);
    if (!dryRun) stats.updatedSoldiers++;

    // Create user document
    await createUserDocument(authUser, soldierData, dryRun);
    if (!dryRun) stats.createdUserDocs++;

    userInfo.status = 'success';
    userInfo.reason = 'Synced successfully';
    return userInfo;

  } catch (error) {
    userInfo.status = 'error';
    userInfo.reason = error.message;
    stats.errors++;
    return userInfo;
  }
}

/**
 * Main sync function
 */
async function syncAuthToFirestore(dryRun = true) {
  try {
    // Get sample soldier for unmatched users
    const sampleSoldier = await getSampleSoldier();

    // Fetch all auth users
    const authUsers = await getAllAuthUsers();
    stats.totalAuthUsers = authUsers.length;

    // Process each user
    for (const authUser of authUsers) {
      const result = await processAuthUser(authUser, sampleSoldier, dryRun);
      stats.details.push(result);
    }

    // Print summary
    printSummary(dryRun);

  } catch (error) {
    process.exit(1);
  }
}

/**
 * Print summary report
 */
function printSummary(dryRun) {
}

/**
 * Main entry point
 */
async function main() {
  // Check for command line argument
  const args = process.argv.slice(2);
  const isLiveMode = args.includes('--live');

  if (isLiveMode) {
    const confirm = await question('Type "yes" to continue: ');

    if (confirm.toLowerCase() !== 'yes') {
      rl.close();
      process.exit(0);
    }
  }

  await syncAuthToFirestore(!isLiveMode);

  rl.close();
  process.exit(0);
}

// Run the script
main().catch(error => {
  rl.close();
  process.exit(1);
});
