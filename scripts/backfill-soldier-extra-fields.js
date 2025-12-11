import admin from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Backfill script:
 * - Iterates all soldiers.
 * - Adds new personal-details fields if they are missing, setting them to "" (empty string).
 * - Safe by default: run with --dry-run to preview, --execute to apply.
 *
 * Usage:
 *   node scripts/backfill-soldier-extra-fields.js --dry-run
 *   node scripts/backfill-soldier-extra-fields.js --execute
 */

// Parse flags
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const isDryRun = hasFlag('--dry-run') || !hasFlag('--execute');

// Initialize Firebase Admin using existing service account file
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();

// Fields to backfill with empty string if missing/undefined/null
const DEFAULT_FIELDS = {
  id_number: '',
  secondary_profession: '',
  crew: '',
  sex: '',
  marital_status: '',
  date_of_birth: '',
  trainings: '',
  driving_license: '',
  driving_license_type: ''
};

const BATCH_LIMIT = 450; // stay under Firestore 500-op limit
const PAGE_SIZE = 300;

async function backfillSoldiers() {
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (will write)'}`);
  let lastDoc = null;
  let processed = 0;
  let updated = 0;
  let batch = db.batch();
  let batchCount = 0;

  while (true) {
    let query = db.collection('soldiers').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      processed += 1;
      const data = doc.data();
      const update = {};

      for (const [field, defaultValue] of Object.entries(DEFAULT_FIELDS)) {
        const value = data[field];
        if (value === undefined || value === null) {
          update[field] = defaultValue;
        }
      }

      if (Object.keys(update).length > 0) {
        updated += 1;
        if (!isDryRun) {
          batch.update(doc.ref, update);
          batchCount += 1;
          if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log(`Processed soldiers: ${processed}`);
  console.log(`Docs needing update: ${updated}`);
  console.log(isDryRun ? 'No writes performed (dry run).' : 'Backfill completed.');
}

backfillSoldiers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });


