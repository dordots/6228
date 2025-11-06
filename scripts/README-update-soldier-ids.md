# Update Soldier IDs Script

This script updates soldier IDs from a personnel XLSX (Excel) file and updates all related records across the database.

## Installation

Before running the script, install the required dependency:

```bash
npm install xlsx
```

## XLSX Format

Your Excel file (.xlsx) must have these three columns (the order doesn't matter, but the names must match exactly):
- `soldier_id` - The new soldier ID to assign (can be text or number)
- `first_name` - Soldier's first name (in Hebrew or any language)
- `last_name` - Soldier's last name (in Hebrew or any language)

**Note:** Your Excel file can have other columns too - the script will only use these three columns and ignore the rest.

Example `personnel.xlsx`:
| soldier_id | first_name | last_name | email                  | ... other columns ... |
|------------|------------|-----------|------------------------|------------------------|
| 9630004    | רועי       | אריה ניצן | NOMAIL@NOMAIL.COM      | ...                    |
| 8271034    | נהו        | יוחנן     | NOMAIL@NOMAIL.COM      | ...                    |
| 9693606    | אליה ג     | נתן       | ALJIO753@GMAIL.COM     | ...                    |

The script will read the first sheet of the Excel file.

## Usage

### Dry-Run Mode (Recommended First)

Run in dry-run mode to see what changes would be made WITHOUT actually modifying the database:

```bash
node scripts/update-soldier-ids.js --file personnel.xlsx --dry-run
```

Or simply (dry-run is the default):

```bash
node scripts/update-soldier-ids.js --file personnel.xlsx
```

### Execute Mode

After verifying the dry-run output, run in execute mode to actually update the database:

```bash
node scripts/update-soldier-ids.js --file personnel.xlsx --execute
```

## What the Script Does

1. **Reads XLSX file** with new soldier IDs
2. **Matches soldiers** by first_name and last_name in the database
3. **Updates soldier_id** in the soldiers collection
4. **Updates all references** in related collections:
   - weapons (assigned_to field)
   - equipment (assigned_to field)
   - serialized_gear (assigned_to field)
   - drone_sets (assigned_to field)
   - drone_components (assigned_to field)

## Features

### Dry-Run Mode Output

Shows a detailed report including:
- Each soldier to be updated with old → new ID
- Count of related records per collection
- Total records that would be affected
- Any errors or warnings

Example output:
```
=== Soldier ID Update Dry-Run Report ===

Processing 2 soldiers from XLSX...

Changes to be made:

1. John Doe
   Old ID: 123456 → New ID: NEW_ID_123
   - 3 weapons
   - 5 equipment items
   - 2 serialized gear
   - 1 drone set
   - 0 drone components
   - Total: 12 records

=== Summary ===
Total soldiers to update: 1
Total database records to update: 12
- Soldiers: 1
- Weapons: 3
- Equipment: 5
- Serialized Gear: 2
- Drone Sets: 1
- Drone Components: 0

Errors: 0

✅ Run with --execute flag to apply these changes.
```

### Execute Mode Output

Shows progress and results:
```
=== Soldier ID Update Execution ===

✓ Updated John Doe (123456 → NEW_ID_123): 12 records

=== Execution Summary ===
Successfully updated: 1 soldiers
Total records updated: 12
Failed: 0

✅ All updates completed successfully!
```

## Error Handling

The script handles several error cases:

- **Soldier not found**: If a soldier with the given name doesn't exist
- **Multiple matches**: If multiple soldiers have the same first and last name
- **Duplicate ID**: If the new soldier_id already exists in the database
- **Invalid CSV**: If required columns are missing or rows have invalid data

## Safety Features

1. **Dry-run by default**: The script defaults to dry-run mode to prevent accidental changes
2. **Atomic updates**: Uses Firestore batch writes to ensure all updates for a soldier happen together
3. **Validation**: Checks for existing IDs and duplicate names before updating
4. **Batch limit handling**: Automatically handles Firestore's 500 operation batch limit
5. **Detailed reporting**: Shows exactly what will change before executing

## Recommendations

1. **Always run dry-run first** to verify the changes
2. **Backup your database** before running in execute mode
3. **Test with a small CSV** first (1-2 soldiers) before processing all personnel
4. **Review the dry-run output** carefully for errors or unexpected changes

## Troubleshooting

### "Soldier not found" error
- Check that first_name and last_name exactly match the database records
- Ensure there are no extra spaces or special characters in the Excel file

### "Multiple soldiers found" error
- Multiple soldiers exist with the same name
- You'll need to manually update these soldiers or provide additional identifying information

### "New soldier_id already exists" error
- The new ID you're trying to assign is already in use
- Check the Excel file for duplicate IDs or verify the database

### XLSX parsing errors
- Ensure the Excel file has the correct column headers: `first_name`, `last_name`, `soldier_id`
- Make sure the headers are in the first row
- Check that you're using a .xlsx file (not .xls or other formats)

## Example Workflow

1. Export personnel data with new IDs to Excel (.xlsx)
2. Run dry-run to verify:
   ```bash
   node scripts/update-soldier-ids.js --file personnel.xlsx --dry-run
   ```
3. Review the output for errors
4. Take a database backup (if not already automated)
5. Execute the updates:
   ```bash
   node scripts/update-soldier-ids.js --file personnel.xlsx --execute
   ```
6. Verify the changes in the application
