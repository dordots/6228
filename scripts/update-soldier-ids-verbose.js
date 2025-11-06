import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

// Parse command-line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const xlsxFile = getArg('--file');
const isDryRun = hasFlag('--dry-run') || !hasFlag('--execute');

if (!xlsxFile) {
  console.error('Error: --file parameter is required');
  console.log('\nUsage:');
  console.log('  node scripts/update-soldier-ids-verbose.js --file personnel.xlsx --dry-run');
  console.log('  node scripts/update-soldier-ids-verbose.js --file personnel.xlsx --execute');
  process.exit(1);
}

console.log(`\n📁 File: ${xlsxFile}`);
console.log(`🔧 Mode: ${isDryRun ? 'DRY-RUN (no changes)' : 'EXECUTE (will modify database)'}\n`);

// Initialize Firebase Admin SDK
console.log('🔌 Initializing Firebase Admin SDK...');
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();
console.log('✓ Firebase initialized successfully\n');

// Collections that have assigned_to field referencing soldier IDs
const RELATED_COLLECTIONS = [
  'weapons',
  'equipment',
  'serialized_gear',
  'drone_sets',
  'drone_components'
];

/**
 * Read and parse XLSX file
 */
function readXLSX(filePath) {
  try {
    console.log(`📖 Reading XLSX file...`);
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    console.log(`   Sheet name: "${sheetName}"`);

    // Convert to JSON with header row
    const records = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convert dates and numbers to strings
      defval: '', // Default value for empty cells
    });

    // Clean up the records - trim strings and convert soldier_id to string
    const cleanedRecords = records.map(record => ({
      ...record,
      first_name: record.first_name?.toString().trim(),
      last_name: record.last_name?.toString().trim(),
      soldier_id: record.soldier_id?.toString().trim()
    }));

    console.log(`   Records found: ${cleanedRecords.length}`);
    if (cleanedRecords.length > 0) {
      console.log(`   Columns: ${Object.keys(cleanedRecords[0]).join(', ')}`);
    }

    return cleanedRecords;
  } catch (error) {
    console.error(`❌ Error reading XLSX file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find soldier by first and last name
 */
async function findSoldierByName(firstName, lastName) {
  console.log(`\n  🔍 Searching database for: "${firstName}" "${lastName}"`);

  const snapshot = await db.collection('soldiers')
    .where('first_name', '==', firstName)
    .where('last_name', '==', lastName)
    .get();

  console.log(`     Found ${snapshot.size} matching soldier(s)`);

  if (snapshot.empty) {
    console.log(`     ❌ No soldier found`);
    return null;
  }

  if (snapshot.size > 1) {
    console.log(`     ⚠️  Multiple soldiers found:`);
    const soldiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    soldiers.forEach((s, idx) => {
      console.log(`        ${idx + 1}. soldier_id: "${s.soldier_id}", Firestore doc_id: "${s.id}"`);
    });
    return soldiers;
  }

  const soldier = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  console.log(`     ✓ Current soldier_id: "${soldier.soldier_id}"`);
  console.log(`     ✓ Firestore doc ID: "${soldier.id}"`);
  return soldier;
}

/**
 * Count records in related collections that reference a soldier ID
 */
async function countRelatedRecords(soldierIdField, soldierIdValue) {
  console.log(`\n  🔢 Counting related records with assigned_to = "${soldierIdValue}":`);
  const counts = {};

  for (const collectionName of RELATED_COLLECTIONS) {
    const snapshot = await db.collection(collectionName)
      .where('assigned_to', '==', soldierIdValue)
      .get();
    counts[collectionName] = snapshot.size;
    console.log(`     - ${collectionName}: ${snapshot.size} records`);
  }

  return counts;
}

/**
 * Get all documents from related collections that reference a soldier ID
 */
async function getRelatedDocuments(soldierIdValue) {
  console.log(`\n  📥 Fetching related documents for soldier_id "${soldierIdValue}":`);
  const documents = {};

  for (const collectionName of RELATED_COLLECTIONS) {
    const snapshot = await db.collection(collectionName)
      .where('assigned_to', '==', soldierIdValue)
      .get();
    documents[collectionName] = snapshot.docs;
    console.log(`     - ${collectionName}: ${snapshot.size} documents`);
  }

  return documents;
}

/**
 * Perform dry-run: analyze what would be changed
 */
async function performDryRun(xlsxRecords) {
  console.log('═══════════════════════════════════════════');
  console.log('        DRY-RUN MODE (NO CHANGES)          ');
  console.log('═══════════════════════════════════════════\n');

  const changes = [];
  const errors = [];
  let totalRecordsToUpdate = 0;
  const collectionTotals = {};

  for (let i = 0; i < xlsxRecords.length; i++) {
    const record = xlsxRecords[i];
    const { first_name, last_name, soldier_id: newSoldierId } = record;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${xlsxRecords.length}] Processing: ${first_name} ${last_name}`);
    console.log(`     New soldier_id to assign: "${newSoldierId}"`);

    if (!first_name || !last_name || !newSoldierId) {
      console.log(`     ❌ Invalid row - missing required fields`);
      errors.push(`Row ${i + 1}: Missing required fields`);
      continue;
    }

    // Find soldier by name
    const soldier = await findSoldierByName(first_name, last_name);

    if (!soldier) {
      console.log(`     ❌ SKIPPED: Soldier not found in database`);
      errors.push(`Row ${i + 1}: Soldier "${first_name} ${last_name}" not found`);
      continue;
    }

    if (Array.isArray(soldier)) {
      console.log(`     ❌ SKIPPED: Cannot determine which soldier to update`);
      errors.push(`Row ${i + 1}: Multiple soldiers named "${first_name} ${last_name}"`);
      continue;
    }

    const oldSoldierId = soldier.soldier_id;
    console.log(`\n  🔄 Change: "${oldSoldierId}" → "${newSoldierId}"`);

    // Skip if IDs are already the same
    if (oldSoldierId === newSoldierId) {
      console.log(`     ⏭️  SKIPPED: ID already correct`);
      continue;
    }

    // Check if new ID already exists
    console.log(`\n  🔍 Checking if new soldier_id "${newSoldierId}" is available...`);
    const existingWithNewId = await db.collection('soldiers')
      .where('soldier_id', '==', newSoldierId)
      .get();

    if (!existingWithNewId.empty) {
      console.log(`     ❌ SKIPPED: New ID already exists in database`);
      errors.push(`Row ${i + 1}: New soldier_id "${newSoldierId}" already in use`);
      continue;
    }
    console.log(`     ✓ New ID is available`);

    // Count related records
    const counts = await countRelatedRecords('assigned_to', oldSoldierId);
    const totalForSoldier = Object.values(counts).reduce((sum, count) => sum + count, 0) + 1; // +1 for soldier

    console.log(`\n  ✅ WILL UPDATE: ${totalForSoldier} total records`);
    console.log(`     (1 soldier + ${totalForSoldier - 1} related records)`);

    changes.push({
      rowNumber: i + 1,
      firstName: first_name,
      lastName: last_name,
      oldId: oldSoldierId,
      newId: newSoldierId,
      counts,
      total: totalForSoldier
    });

    totalRecordsToUpdate += totalForSoldier;

    // Update collection totals
    Object.entries(counts).forEach(([collection, count]) => {
      collectionTotals[collection] = (collectionTotals[collection] || 0) + count;
    });
  }

  // Display summary
  console.log(`\n\n═══════════════════════════════════════════`);
  console.log('              SUMMARY');
  console.log(`═══════════════════════════════════════════\n`);

  if (changes.length > 0) {
    console.log(`✅ Soldiers to update: ${changes.length}`);
    console.log(`📊 Total database records to update: ${totalRecordsToUpdate}\n`);

    console.log(`Breakdown by collection:`);
    console.log(`  - Soldiers: ${changes.length}`);
    console.log(`  - Weapons: ${collectionTotals.weapons || 0}`);
    console.log(`  - Equipment: ${collectionTotals.equipment || 0}`);
    console.log(`  - Serialized Gear: ${collectionTotals.serialized_gear || 0}`);
    console.log(`  - Drone Sets: ${collectionTotals.drone_sets || 0}`);
    console.log(`  - Drone Components: ${collectionTotals.drone_components || 0}`);
  } else {
    console.log(`⚠️  No changes to apply`);
  }

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach(error => console.log(`   - ${error}`));
  }

  if (changes.length > 0) {
    console.log(`\n✅ Run with --execute flag to apply these changes.`);
  }

  return { changes, errors };
}

/**
 * Execute updates: actually update the database
 */
async function executeUpdates(xlsxRecords) {
  console.log('═══════════════════════════════════════════');
  console.log('    EXECUTE MODE (MODIFYING DATABASE)     ');
  console.log('═══════════════════════════════════════════\n');
  console.log('⚠️  WARNING: This will PERMANENTLY modify your database!\n');

  const successes = [];
  const errors = [];
  let totalRecordsUpdated = 0;

  for (let i = 0; i < xlsxRecords.length; i++) {
    const record = xlsxRecords[i];
    const { first_name, last_name, soldier_id: newSoldierId } = record;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${xlsxRecords.length}] EXECUTING: ${first_name} ${last_name}`);
    console.log(`     New soldier_id: "${newSoldierId}"`);

    if (!first_name || !last_name || !newSoldierId) {
      console.log(`     ❌ Invalid row - missing fields`);
      errors.push({ record, error: 'Missing required fields' });
      continue;
    }

    try {
      // Find soldier by name
      const soldier = await findSoldierByName(first_name, last_name);

      if (!soldier) {
        console.log(`     ❌ SKIPPED: Soldier not found`);
        errors.push({ record, error: 'Soldier not found' });
        continue;
      }

      if (Array.isArray(soldier)) {
        console.log(`     ❌ SKIPPED: Multiple matches`);
        errors.push({ record, error: `Multiple soldiers found (${soldier.length})` });
        continue;
      }

      const oldSoldierId = soldier.soldier_id;
      const soldierDocId = soldier.id;

      console.log(`\n  🔄 Changing: "${oldSoldierId}" → "${newSoldierId}"`);

      // Skip if IDs are already the same
      if (oldSoldierId === newSoldierId) {
        console.log(`     ⏭️  SKIPPED: ID already correct`);
        continue;
      }

      // Check if new ID already exists
      console.log(`\n  🔍 Verifying new ID is available...`);
      const existingWithNewId = await db.collection('soldiers')
        .where('soldier_id', '==', newSoldierId)
        .get();

      if (!existingWithNewId.empty) {
        console.log(`     ❌ SKIPPED: New ID already exists`);
        errors.push({ record, error: `New soldier_id ${newSoldierId} already exists` });
        continue;
      }
      console.log(`     ✓ New ID is available`);

      // Get all related documents
      const relatedDocs = await getRelatedDocuments(oldSoldierId);

      // Use Firestore batch for atomic updates
      console.log(`\n  💾 Starting batch update...`);
      let batch = db.batch();
      let batchCount = 0;
      let recordsUpdated = 0;
      let batchNumber = 1;

      // Update soldier document
      console.log(`     - Updating soldier in 'soldiers' collection...`);
      const soldierRef = db.collection('soldiers').doc(soldierDocId);
      batch.update(soldierRef, { soldier_id: newSoldierId });
      batchCount++;
      recordsUpdated++;

      // Update all related documents
      for (const [collectionName, docs] of Object.entries(relatedDocs)) {
        if (docs.length > 0) {
          console.log(`     - Updating ${docs.length} records in '${collectionName}'...`);
        }

        for (const doc of docs) {
          // Firestore batch has a limit of 500 operations
          if (batchCount >= 500) {
            console.log(`     💾 Committing batch ${batchNumber} (500 ops)...`);
            await batch.commit();
            console.log(`     ✓ Batch ${batchNumber} committed`);
            batch = db.batch();
            batchCount = 0;
            batchNumber++;
          }

          const docRef = db.collection(collectionName).doc(doc.id);
          batch.update(docRef, { assigned_to: newSoldierId });
          batchCount++;
          recordsUpdated++;
        }
      }

      // Commit final batch
      if (batchCount > 0) {
        console.log(`     💾 Committing final batch (${batchCount} ops)...`);
        await batch.commit();
        console.log(`     ✓ Final batch committed`);
      }

      console.log(`\n  ✅ SUCCESS: Updated ${recordsUpdated} records`);
      console.log(`     "${oldSoldierId}" → "${newSoldierId}"`);

      successes.push({
        firstName: first_name,
        lastName: last_name,
        oldId: oldSoldierId,
        newId: newSoldierId,
        recordsUpdated
      });
      totalRecordsUpdated += recordsUpdated;

    } catch (error) {
      console.error(`\n  ❌ FAILED: ${error.message}`);
      errors.push({ record, error: error.message });
    }
  }

  // Display summary
  console.log(`\n\n═══════════════════════════════════════════`);
  console.log('           EXECUTION SUMMARY');
  console.log(`═══════════════════════════════════════════\n`);

  console.log(`✅ Successfully updated: ${successes.length} soldiers`);
  console.log(`📊 Total records updated: ${totalRecordsUpdated}`);
  console.log(`❌ Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(({ record, error }) => {
      console.log(`   - ${record.first_name} ${record.last_name}: ${error}`);
    });
  }

  if (successes.length > 0) {
    console.log(`\n✅ All updates completed!`);
  }

  return { successes, errors };
}

/**
 * Main function
 */
async function main() {
  try {
    // Read XLSX
    const xlsxRecords = readXLSX(xlsxFile);

    if (xlsxRecords.length === 0) {
      console.error('❌ Error: XLSX file is empty or has no valid records');
      process.exit(1);
    }

    // Validate XLSX headers
    const requiredColumns = ['first_name', 'last_name', 'soldier_id'];
    const xlsxColumns = Object.keys(xlsxRecords[0]);
    const missingColumns = requiredColumns.filter(col => !xlsxColumns.includes(col));

    if (missingColumns.length > 0) {
      console.error(`❌ Error: XLSX is missing required columns: ${missingColumns.join(', ')}`);
      console.log(`\nExpected columns: ${requiredColumns.join(', ')}`);
      console.log(`Found columns: ${xlsxColumns.join(', ')}`);
      process.exit(1);
    }

    console.log(`✓ XLSX file valid\n`);

    if (isDryRun) {
      await performDryRun(xlsxRecords);
    } else {
      await executeUpdates(xlsxRecords);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
main();
