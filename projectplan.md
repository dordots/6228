# Project Plan: Fix Weapon Import Validation Issue

## Problem Analysis
The user is experiencing import failures because they're seeing "with_soldier" as a status value, but the import validation only accepts "functioning" or "not_functioning" for weapon status.

After investigating, I found that there are actually two different fields:
1. `status` - Weapon functionality status (functioning/not_functioning)
2. `armory_status` - Weapon location status (with_soldier/in_deposit)

The confusion likely arises from:
- The division-specific export format might be including armory_status
- The user might be manually editing the CSV and mixing up the fields
- The export might not clearly distinguish between these fields

## Todo List

### 1. ✅ Investigate the issue
- [x] Check export functionality in functions/src/data.js
- [x] Check import validation in src/utils/importUtils.js
- [x] Understand weapon data model and fields
- [x] Identify that there are two separate fields: status and armory_status

### 2. ✅ Fix the import validation to handle armory_status field
- [ ] Update the import utils to recognize and properly handle armory_status field
- [ ] Ensure weapon import doesn't fail when armory_status is present
- [ ] Map armory_status values correctly during import

### 3. ✅ Update column mapping for better clarity
- [ ] Add armory_status to the column mapping in importUtils.js
- [ ] Ensure both status and armory_status are properly mapped

### 4. ✅ Test the fix
- [ ] Verify that weapons with armory_status can be imported
- [ ] Ensure status field validation still works correctly
- [ ] Check that both fields are preserved during import

## Implementation Notes
- Keep changes minimal and focused on fixing the validation issue
- Don't change the export format to maintain backward compatibility
- Add clear column mappings to prevent future confusion