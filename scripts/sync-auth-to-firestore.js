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
  console.log(`✅ Found service account file: ${serviceAccountPath}\n`);
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'project-1386902152066454120'
  });
} else {
  console.log('❌ Service account file not found.');
  console.log('   Please download it from Firebase Console:');
  console.log('   https://console.firebase.google.com/project/project-1386902152066454120/settings/serviceaccounts/adminsdk');
  console.log('   And save it as: knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json\n');
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
  console.log('📋 Fetching all authentication users...');
  const users = [];
  let nextPageToken;

  try {
    do {
      const result = await auth.listUsers(1000, nextPageToken);
      users.push(...result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    console.log(`✅ Found ${users.length} authentication users\n`);
    return users;
  } catch (error) {
    console.error('❌ Error fetching auth users:', error.message);
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
    console.error(`❌ Error finding soldier for user ${authUser.uid}:`, error.message);
    throw error;
  }
}

/**
 * Update soldier document with user UID
 */
async function updateSoldierWithUid(soldierDoc, uid, dryRun) {
  const soldierData = soldierDoc.data();

  if (dryRun) {
    console.log(`  [DRY-RUN] Would update soldier ${soldierData.soldier_id} with id: ${uid}`);
    return true;
  }

  try {
    await soldierDoc.ref.update({
      id: uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  ✅ Updated soldier ${soldierData.soldier_id} with id: ${uid}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating soldier ${soldierData.soldier_id}:`, error.message);
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
    console.log(`  [DRY-RUN] Would create user document for ${authUser.uid}:`, JSON.stringify(userDoc, null, 2));
    return true;
  }

  try {
    await db.collection('users').doc(authUser.uid).set(userDoc, { merge: true });
    console.log(`  ✅ Created/updated user document for ${authUser.uid}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error creating user document for ${authUser.uid}:`, error.message);
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
    console.error('Error getting sample soldier:', error.message);
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

  console.log(`\n🔍 Processing user: ${authUser.uid}`);
  console.log(`   Email: ${authUser.email || 'N/A'}`);
  console.log(`   Phone: ${authUser.phoneNumber || 'N/A'}`);

  try {
    // Check if user already has a Firestore document with linked_soldier_id
    const existingUserDoc = await db.collection('users').doc(authUser.uid).get();

    if (existingUserDoc.exists && existingUserDoc.data().linked_soldier_id) {
      console.log(`  ⏭️  User already linked to soldier: ${existingUserDoc.data().linked_soldier_id} - skipping`);
      userInfo.status = 'skipped';
      userInfo.reason = 'Already synced';
      stats.skipped++;
      return userInfo;
    }

    // Find matching soldier
    const soldierDoc = await findMatchingSoldier(authUser);

    if (!soldierDoc) {
      console.log('  ⚠️  No matching soldier found - linking to sample soldier');

      if (!sampleSoldier) {
        console.log('  ❌ No sample soldier available - skipping');
        userInfo.status = 'skipped';
        userInfo.reason = 'No matching soldier and no sample soldier available';
        stats.skipped++;
        return userInfo;
      }

      const sampleSoldierData = sampleSoldier.data();
      console.log(`  📌 Linking to sample soldier: ${sampleSoldierData.soldier_id}`);

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
    console.log(`  ✅ Found matching soldier: ${soldierData.soldier_id} (${soldierData.first_name} ${soldierData.last_name})`);

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
    console.error(`  ❌ Error processing user ${authUser.uid}:`, error.message);
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
  console.log('\n🔄 Firebase Auth to Firestore Sync Script');
  console.log('==========================================\n');

  if (dryRun) {
    console.log('🔍 DRY-RUN MODE: No changes will be made to the database\n');
  } else {
    console.log('⚠️  LIVE MODE: Changes will be written to the database\n');
  }

  try {
    // Get sample soldier for unmatched users
    console.log('📋 Getting sample soldier for unmatched users...');
    const sampleSoldier = await getSampleSoldier();
    if (sampleSoldier) {
      const sampleData = sampleSoldier.data();
      console.log(`✅ Sample soldier: ${sampleData.soldier_id} (${sampleData.first_name} ${sampleData.last_name})\n`);
    } else {
      console.log('⚠️  No sample soldier found - unmatched users will be skipped\n');
    }

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
    console.error('\n❌ Fatal error during sync:', error.message);
    process.exit(1);
  }
}

/**
 * Print summary report
 */
function printSummary(dryRun) {
  console.log('\n\n📊 SYNC SUMMARY');
  console.log('================\n');

  if (dryRun) {
    console.log('Mode: DRY-RUN (no changes made)\n');
  } else {
    console.log('Mode: LIVE (changes applied)\n');
  }

  console.log(`Total Auth Users: ${stats.totalAuthUsers}`);
  console.log(`Matched to Soldiers: ${stats.matchedBySoldier}`);
  console.log(`Soldiers Updated: ${stats.updatedSoldiers}`);
  console.log(`User Docs Created: ${stats.createdUserDocs}`);
  console.log(`Skipped (no match): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}\n`);

  // Show breakdown by status
  const successCount = stats.details.filter(d => d.status === 'success').length;
  const skippedCount = stats.details.filter(d => d.status === 'skipped').length;
  const errorCount = stats.details.filter(d => d.status === 'error').length;

  console.log('Breakdown:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}\n`);

  // Show details of errors if any
  if (errorCount > 0) {
    console.log('Errors encountered:');
    stats.details
      .filter(d => d.status === 'error')
      .forEach(d => {
        console.log(`  - User ${d.uid} (${d.email || d.phone}): ${d.reason}`);
      });
    console.log();
  }

  // Show details of skipped users
  if (skippedCount > 0 && skippedCount <= 10) {
    console.log('Skipped users (no matching soldier):');
    stats.details
      .filter(d => d.status === 'skipped')
      .forEach(d => {
        console.log(`  - ${d.uid} (${d.email || d.phone || 'no email/phone'})`);
      });
    console.log();
  } else if (skippedCount > 10) {
    console.log(`${skippedCount} users skipped (no matching soldier)\n`);
  }

  if (dryRun) {
    console.log('🔍 This was a dry-run. No changes were made.');
    console.log('   Run with --live flag to apply changes.\n');
  } else {
    console.log('✅ Sync completed successfully!\n');
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('\n🚀 Firebase Auth to Firestore Sync Tool\n');

  // Check for command line argument
  const args = process.argv.slice(2);
  const isLiveMode = args.includes('--live');

  if (isLiveMode) {
    console.log('⚠️  WARNING: You are about to run this script in LIVE mode.');
    console.log('   This will modify your Firebase database.\n');

    const confirm = await question('Type "yes" to continue: ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('Cancelled by user.');
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
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
