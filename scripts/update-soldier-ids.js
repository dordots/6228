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
  console.log('  node scripts/update-soldier-ids.js --file personnel.xlsx --dry-run');
  console.log('  node scripts/update-soldier-ids.js --file personnel.xlsx --execute');
  process.exit(1);
}

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();

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
    const fileBuffer = readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    console.log(`Reading sheet: "${sheetName}"`);

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

    return cleanedRecords;
  } catch (error) {
    console.error(`Error reading XLSX file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find soldier by first and last name
 */
async function findSoldierByName(firstName, lastName) {
  const snapshot = await db.collection('soldiers')
    .where('first_name', '==', firstName)
    .where('last_name', '==', lastName)
    .get();

  if (snapshot.empty) {
    return null;
  }

  if (snapshot.size > 1) {
    console.warn(`Warning: Multiple soldiers found with name ${firstName} ${lastName}`);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Count records in related collections that reference a soldier ID
 */
async function countRelatedRecords(soldierIdField, soldierIdValue) {
  const counts = {};

  for (const collectionName of RELATED_COLLECTIONS) {
    const snapshot = await db.collection(collectionName)
      .where('assigned_to', '==', soldierIdValue)
      .get();
    counts[collectionName] = snapshot.size;
  }

  return counts;
}

/**
 * Get all documents from related collections that reference a soldier ID
 */
async function getRelatedDocuments(soldierIdValue) {
  const documents = {};

  for (const collectionName of RELATED_COLLECTIONS) {
    const snapshot = await db.collection(collectionName)
      .where('assigned_to', '==', soldierIdValue)
      .get();
    documents[collectionName] = snapshot.docs;
  }

  return documents;
}

/**
 * Perform dry-run: analyze what would be changed
 */
async function performDryRun(xlsxRecords) {
  console.log('=== Soldier ID Update Dry-Run Report ===\n');
  console.log(`Processing ${xlsxRecords.length} soldiers from XLSX...\n`);

  const changes = [];
  const errors = [];
  let totalRecordsToUpdate = 0;
  const collectionTotals = {};

  for (const record of xlsxRecords) {
    const { first_name, last_name, soldier_id: newSoldierId } = record;

    if (!first_name || !last_name || !newSoldierId) {
      errors.push(`Skipping invalid row: ${JSON.stringify(record)}`);
      continue;
    }

    // Find soldier by name
    const soldier = await findSoldierByName(first_name, last_name);

    if (!soldier) {
      errors.push(`Soldier not found: ${first_name} ${last_name}`);
      continue;
    }

    if (Array.isArray(soldier)) {
      errors.push(`Multiple soldiers found with name: ${first_name} ${last_name} (${soldier.length} matches)`);
      continue;
    }

    const oldSoldierId = soldier.soldier_id;

    // Skip if IDs are already the same
    if (oldSoldierId === newSoldierId) {
      console.log(`⏭️  Skipping ${first_name} ${last_name} - ID already correct (${oldSoldierId})`);
      continue;
    }

    // Check if new ID already exists
    const existingWithNewId = await db.collection('soldiers')
      .where('soldier_id', '==', newSoldierId)
      .get();

    if (!existingWithNewId.empty) {
      errors.push(`New soldier_id ${newSoldierId} already exists in database for ${first_name} ${last_name}`);
      continue;
    }

    // Count related records
    const counts = await countRelatedRecords('assigned_to', oldSoldierId);
    const totalForSoldier = Object.values(counts).reduce((sum, count) => sum + count, 0) + 1; // +1 for soldier record itself

    changes.push({
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

  // Display changes
  if (changes.length > 0) {
    console.log('Changes to be made:\n');
    changes.forEach((change, index) => {
      console.log(`${index + 1}. ${change.firstName} ${change.lastName}`);
      console.log(`   Old ID: ${change.oldId} → New ID: ${change.newId}`);
      console.log(`   - ${change.counts.weapons || 0} weapons`);
      console.log(`   - ${change.counts.equipment || 0} equipment items`);
      console.log(`   - ${change.counts.serialized_gear || 0} serialized gear`);
      console.log(`   - ${change.counts.drone_sets || 0} drone sets`);
      console.log(`   - ${change.counts.drone_components || 0} drone components`);
      console.log(`   - Total: ${change.total} records\n`);
    });
  }

  // Display errors
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:\n');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  // Display summary
  console.log('\n=== Summary ===');
  console.log(`Total soldiers to update: ${changes.length}`);
  console.log(`Total database records to update: ${totalRecordsToUpdate}`);
  console.log(`- Soldiers: ${changes.length}`);
  console.log(`- Weapons: ${collectionTotals.weapons || 0}`);
  console.log(`- Equipment: ${collectionTotals.equipment || 0}`);
  console.log(`- Serialized Gear: ${collectionTotals.serialized_gear || 0}`);
  console.log(`- Drone Sets: ${collectionTotals.drone_sets || 0}`);
  console.log(`- Drone Components: ${collectionTotals.drone_components || 0}`);
  console.log(`\nErrors: ${errors.length}`);

  if (changes.length > 0) {
    console.log('\n✅ Run with --execute flag to apply these changes.');
  } else {
    console.log('\n⚠️  No changes to apply.');
  }

  return { changes, errors };
}

/**
 * Execute updates: actually update the database
 */
async function executeUpdates(xlsxRecords) {
  console.log('=== Soldier ID Update Execution ===\n');
  console.log(`Processing ${xlsxRecords.length} soldiers from XLSX...\n`);
  console.log('⚠️  WARNING: This will modify your database!\n');

  const successes = [];
  const errors = [];
  let totalRecordsUpdated = 0;

  for (const record of xlsxRecords) {
    const { first_name, last_name, soldier_id: newSoldierId } = record;

    if (!first_name || !last_name || !newSoldierId) {
      errors.push({ record, error: 'Invalid row - missing required fields' });
      continue;
    }

    try {
      // Find soldier by name
      const soldier = await findSoldierByName(first_name, last_name);

      if (!soldier) {
        errors.push({ record, error: 'Soldier not found' });
        continue;
      }

      if (Array.isArray(soldier)) {
        errors.push({ record, error: `Multiple soldiers found (${soldier.length} matches)` });
        continue;
      }

      const oldSoldierId = soldier.soldier_id;
      const soldierDocId = soldier.id;

      // Skip if IDs are already the same
      if (oldSoldierId === newSoldierId) {
        console.log(`⏭️  Skipping ${first_name} ${last_name} - ID already correct`);
        continue;
      }

      // Check if new ID already exists
      const existingWithNewId = await db.collection('soldiers')
        .where('soldier_id', '==', newSoldierId)
        .get();

      if (!existingWithNewId.empty) {
        errors.push({ record, error: `New soldier_id ${newSoldierId} already exists` });
        continue;
      }

      // Get all related documents
      const relatedDocs = await getRelatedDocuments(oldSoldierId);

      // Use Firestore batch for atomic updates
      const batch = db.batch();
      let batchCount = 0;
      let recordsUpdated = 0;

      // Update soldier document
      const soldierRef = db.collection('soldiers').doc(soldierDocId);
      batch.update(soldierRef, { soldier_id: newSoldierId });
      batchCount++;
      recordsUpdated++;

      // Update all related documents
      for (const [collectionName, docs] of Object.entries(relatedDocs)) {
        for (const doc of docs) {
          // Firestore batch has a limit of 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }

          const docRef = db.collection(collectionName).doc(doc.id);
          batch.update(docRef, { assigned_to: newSoldierId });
          batchCount++;
          recordsUpdated++;
        }
      }

      // Commit final batch
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`✓ Updated ${first_name} ${last_name} (${oldSoldierId} → ${newSoldierId}): ${recordsUpdated} records`);
      successes.push({ firstName: first_name, lastName: last_name, oldId: oldSoldierId, newId: newSoldierId, recordsUpdated });
      totalRecordsUpdated += recordsUpdated;

    } catch (error) {
      errors.push({ record, error: error.message });
      console.error(`✗ Failed to update ${first_name} ${last_name}: ${error.message}`);
    }
  }

  // Display summary
  console.log('\n=== Execution Summary ===');
  console.log(`Successfully updated: ${successes.length} soldiers`);
  console.log(`Total records updated: ${totalRecordsUpdated}`);
  console.log(`Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach(({ record, error }) => {
      console.log(`   - ${record.first_name} ${record.last_name}: ${error}`);
    });
  }

  if (successes.length > 0) {
    console.log('\n✅ All updates completed successfully!');
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
      console.error('Error: XLSX file is empty or has no valid records');
      process.exit(1);
    }

    // Validate XLSX headers
    const requiredColumns = ['first_name', 'last_name', 'soldier_id'];
    const xlsxColumns = Object.keys(xlsxRecords[0]);
    const missingColumns = requiredColumns.filter(col => !xlsxColumns.includes(col));

    console.log(`Found ${xlsxRecords.length} records in XLSX file`);
    console.log(`Columns found: ${xlsxColumns.join(', ')}\n`);

    if (missingColumns.length > 0) {
      console.error(`Error: XLSX is missing required columns: ${missingColumns.join(', ')}`);
      console.log(`\nExpected columns: ${requiredColumns.join(', ')}`);
      console.log(`Found columns: ${xlsxColumns.join(', ')}`);
      process.exit(1);
    }

    if (isDryRun) {
      console.log('🔍 Running in DRY-RUN mode (no changes will be made)\n');
      await performDryRun(xlsxRecords);
    } else {
      console.log('⚡ Running in EXECUTE mode (changes will be applied)\n');
      await executeUpdates(xlsxRecords);
    }

    process.exit(0);
  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
main();
