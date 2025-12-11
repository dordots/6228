import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import readline from 'readline';

/**
 * Import/Update soldiers from an Excel file with Hebrew headers.
 * Updates all provided fields EXCEPT email and soldier_id (personal number).
 * Soldiers are looked up by name (first_name + last_name) from the Excel.
 *
 * Usage:
 *   node scripts/import-soldiers-from-excel.js --file path.xlsx --dry-run
 *   node scripts/import-soldiers-from-excel.js --file path.xlsx --execute
 */

// ---- CLI ----
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);
const isDryRun = hasFlag('--dry-run') || !hasFlag('--execute');
const cliFile = getArg('--file');

async function promptFilePath() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((res) => rl.question(q, res));
  const answer = await question('Enter Excel file path: ');
  rl.close();
  return answer.trim();
}

async function resolveFilePath() {
  if (cliFile) return cliFile;
  const prompted = await promptFilePath();
  if (!prompted) {
    console.error('Error: file path is required.');
    process.exit(1);
  }
  return prompted;
}

// ---- Firebase Admin init ----
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();

// ---- Header mapping ----
// Excel is in Hebrew. We map to internal soldier fields.
// Keys are expected header strings as they appear in the Excel.
const HEADER_MAP = {
  'מספר אישי צבאי': 'soldier_id', // ignored for lookup/update
  'מספר תעודת זהות': 'id_number',
  'ת.ז': 'id_number',
  'ת"ז': 'id_number',
  'תז': 'id_number',
  'מספר ת.ז': 'id_number',
  'תעודת זהות': 'id_number',
  'שם': 'name', // optional; we will prefer first/last if present
  'שם פרטי': 'first_name',
  'שם משפחה': 'last_name',
  'מספר טלפון נייד': 'phone_number',
  'אימייל': 'email', // WILL NOT be written
  'עיר': 'city',
  'רחוב': 'street_address',
  'תפקיד ראשי': 'profession',
  'תפקיד משני': 'secondary_profession',
  'פלוגה': 'division_name',
  'מחלקה': 'team_name',
  'צוות': 'crew',
  'מין': 'sex',
  'מצב משפחתי': 'marital_status',
  'תאריך לידה': 'date_of_birth',
  'הכשרות': 'trainings',
  'רשיון נהיגה': 'driving_license',
  'סוג רשיון נהיגה': 'driving_license_type',

  // English fallbacks (if sheet uses English headers)
  'Military personal number': 'soldier_id',
  'ID number': 'id_number',
  'name': 'name',
  'first name': 'first_name',
  'last name': 'last_name',
  'Mobile phone number': 'phone_number',
  'Email': 'email',
  'city': 'city',
  'street': 'street_address',
  'profession': 'profession',
  'secondary profession': 'secondary_profession',
  'Division': 'division_name',
  'team': 'team_name',
  'crew': 'crew',
  'sex': 'sex',
  'marital status': 'marital_status',
  'date of birth': 'date_of_birth',
  'trainings': 'trainings',
  'driving license': 'driving_license',
  "Type of driver's license": 'driving_license_type',
};

// Fields we are allowed to write (email and soldier_id excluded)
const WRITABLE_FIELDS = new Set([
  'id_number',
  'first_name',
  'last_name',
  'phone_number',
  'city',
  'street_address',
  'profession',
  'secondary_profession',
  'division_name',
  'team_name',
  'crew',
  'sex',
  'marital_status',
  'date_of_birth',
  'trainings',
  'driving_license',
  'driving_license_type',
]);

// ---- Helpers ----
function readXLSX(filePath) {
  const fileBuffer = readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRecords = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  return { sheetName, rawRecords };
}

function normalizeDate(value) {
  if (!value) return '';
  // If already string, try to parse; if number, parse Excel date serial
  if (typeof value === 'number') {
    const parsed = XLSX.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(value) : null;
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return date.toISOString().slice(0, 10);
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Replace '.' to handle common dd.mm.yyyy
    const normalized = trimmed.replace(/\./g, '-').replace(/\//g, '-');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return trimmed;
  }
  return '';
}

function mapRecord(raw) {
  const mapped = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_MAP[header?.trim()];
    if (key) {
      const val = typeof value === 'string' ? value.trim() : value;
      if (key === 'date_of_birth') {
        mapped[key] = normalizeDate(val);
      } else {
        mapped[key] = val;
      }
    }
  }
  // Derive first/last from name if missing
  if (!mapped.first_name && !mapped.last_name && mapped.name) {
    const parts = mapped.name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      mapped.first_name = parts[0];
      mapped.last_name = parts.slice(1).join(' ');
    }
  }
  return mapped;
}

async function processRecords(records) {
  let processed = 0;
  let updated = 0;
  let missingName = 0;
  let notFound = 0;
  let multiple = 0;
  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 450;

  for (const [idx, raw] of records.entries()) {
    processed += 1;
    const rec = mapRecord(raw);
    const { first_name, last_name } = rec;
    if (!first_name || !last_name) {
      console.log(`[row ${idx + 1}] skipping: missing name fields`);
      missingName += 1;
      continue;
    }
    // fetch soldier by name
    const snapshot = await db.collection('soldiers')
      .where('first_name', '==', first_name)
      .where('last_name', '==', last_name)
      .get();
    if (snapshot.empty) {
      console.log(`[row ${idx + 1}] ${first_name} ${last_name}: soldier not found`);
      notFound += 1;
      continue;
    }
    if (snapshot.size > 1) {
      console.log(`[row ${idx + 1}] ${first_name} ${last_name}: multiple matches (${snapshot.size}), skipped`);
      multiple += 1;
      continue;
    }
    const doc = snapshot.docs[0];
    const update = {};
    for (const [field, value] of Object.entries(rec)) {
      if (!WRITABLE_FIELDS.has(field)) continue;
      update[field] = value ?? '';
    }
    if (Object.keys(update).length === 0) {
      console.log(`[row ${idx + 1}] ${first_name} ${last_name}: nothing to update`);
      continue;
    }
    console.log(`[row ${idx + 1}] ${first_name} ${last_name}: will update ${Object.keys(update).join(', ')}`);
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

  if (!isDryRun && batchCount > 0) {
    await batch.commit();
  }

  return { processed, updated, missingName, notFound, multiple };
}

async function main() {
  try {
    const xlsxFile = await resolveFilePath();
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (no writes)' : 'EXECUTE (will write)'}`);
    console.log(`File: ${xlsxFile}`);

    const { sheetName, rawRecords } = readXLSX(xlsxFile);
    console.log(`Sheet: ${sheetName}, records: ${rawRecords.length}`);
    if (rawRecords.length === 0) {
      console.error('No records found in Excel.');
      process.exit(1);
    }
    const { processed, updated, missingName, notFound, multiple } = await processRecords(rawRecords);
    console.log('=== Summary ===');
    console.log(`Processed rows: ${processed}`);
    console.log(`Updated soldiers: ${updated}`);
    console.log(`Missing name (first/last) in row: ${missingName}`);
    console.log(`Soldier not found by name: ${notFound}`);
    console.log(`Multiple matches by name (skipped): ${multiple}`);
    console.log(isDryRun ? 'Dry-run only. No writes performed.' : 'Execute mode: updates committed.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

