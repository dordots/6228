import admin from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Sync soldier document IDs to match soldier_id and ensure soldier_id/assigned_to
 * fields are stored as strings across collections.
 *
 * - For each soldier:
 *    - desiredDocId = String(soldier.soldier_id).trim()
 *    - If document ID differs, clone to new doc ID (same data) and delete old doc.
 *    - Ensure soldier.soldier_id is a string.
 * - For all collections (below), ensure soldier_id/assigned_to fields are strings
 *   preserving the same value.
 *
 * Collections scanned:
 *   activity_logs, daily_verifications, drone_components, drone_set_types,
 *   drone_sets, equipment, serialized_gear, soldiers, system, users, weapons
 *
 * Usage:
 *   node scripts/sync-soldier-ids.js --dry-run   (default)
 *   node scripts/sync-soldier-ids.js --execute
 */

// ---------- CLI ----------
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const isDryRun = hasFlag('--dry-run') || !hasFlag('--execute');

console.log(`Mode: ${isDryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (will write)'}`);

// ---------- Firebase Admin init ----------
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();

// ---------- Constants ----------
const COLLECTIONS = [
  'activity_logs',
  'daily_verifications',
  'drone_components',
  'drone_set_types',
  'drone_sets',
  'equipment',
  'serialized_gear',
  'soldiers',
  'system',
  'users',
  'weapons'
];

const BATCH_LIMIT = 450;

// ---------- Helpers ----------
function asString(val) {
  if (val === undefined || val === null) return val;
  return String(val);
}

async function batchCommitIfNeeded(batch, count) {
  if (count >= BATCH_LIMIT) {
    await batch.commit();
    return { batch: db.batch(), count: 0 };
  }
  return { batch, count };
}

async function syncSoldiers() {
  const snap = await db.collection('soldiers').get();
  const tasks = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const desiredId = asString(data.soldier_id)?.trim();
    if (!desiredId) return;

    const needsClone = doc.id !== desiredId;
    const needsString = typeof data.soldier_id !== 'string';

    if (needsClone || needsString) {
      tasks.push({ docId: doc.id, desiredId, data, needsClone, needsString });
    }
  });

  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const t of tasks) {
    const newData = { ...t.data, soldier_id: asString(t.data.soldier_id) };

    if (t.needsClone) {
      console.log(`Soldier doc clone: ${t.docId} -> ${t.desiredId}`);
      if (!isDryRun) {
        const newRef = db.collection('soldiers').doc(t.desiredId);
        batch.set(newRef, newData, { merge: true });
        count += 1;
        ({ batch, count } = await batchCommitIfNeeded(batch, count));

        const oldRef = db.collection('soldiers').doc(t.docId);
        batch.delete(oldRef);
        count += 1;
        ({ batch, count } = await batchCommitIfNeeded(batch, count));
      }
      updated += 1;
    } else if (t.needsString) {
      console.log(`Soldier doc update to string soldier_id: ${t.docId}`);
      if (!isDryRun) {
        const ref = db.collection('soldiers').doc(t.docId);
        batch.update(ref, { soldier_id: asString(t.data.soldier_id) });
        count += 1;
        ({ batch, count } = await batchCommitIfNeeded(batch, count));
      }
      updated += 1;
    }
  }

  if (!isDryRun && count > 0) await batch.commit();
  return { soldierDocsUpdated: updated };
}

async function syncReferences() {
  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get();
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const fieldsToFix = {};

      if (data.soldier_id !== undefined && typeof data.soldier_id !== 'string') {
        fieldsToFix.soldier_id = asString(data.soldier_id);
      }
      if (data.assigned_to !== undefined && typeof data.assigned_to !== 'string') {
        fieldsToFix.assigned_to = asString(data.assigned_to);
      }

      if (Object.keys(fieldsToFix).length > 0) {
        console.log(`Fix ${col}/${doc.id}:`, fieldsToFix);
        updated += 1;
        if (!isDryRun) {
          batch.update(doc.ref, fieldsToFix);
          count += 1;
        }
      }
    });
    if (!isDryRun && count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (!isDryRun && count > 0) await batch.commit();
  return { refDocsUpdated: updated };
}

// ---------- Main ----------
async function main() {
  try {
    const soldierResult = await syncSoldiers();
    const refResult = await syncReferences();

    console.log('\n=== Summary ===');
    console.log(`Soldier docs updated/cloned: ${soldierResult.soldierDocsUpdated}`);
    console.log(`Referenced docs updated (stringify soldier_id/assigned_to): ${refResult.refDocsUpdated}`);
    console.log(isDryRun ? 'DRY-RUN complete (no writes).' : 'EXECUTE complete.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

