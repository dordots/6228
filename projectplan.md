# Project Plan: Fix Update Calls to Use Field IDs (EXCLUDING DRONES)

## Date: 7 November 2025

## Problem
The `.update()` methods on Weapon and SerializedGear entities are using Firestore document IDs (`item.id`) instead of the proper field IDs. This causes issues because:

1. The adapters are configured with `idField` options:
   - Weapon: `weapon_id`
   - SerializedGear: `gear_id`

2. When `update()` is called with an ID string and the adapter has an `idField`, it searches by that field, not by document ID

3. Using `item.id` (Firestore document ID) with these adapters will fail to find the correct document

## Solution
Replace all incorrect ID references in update calls with the appropriate field ID.

**IMPORTANT**: Per user instructions, EXCLUDE all DroneSet.update() calls from this fix.

## Analysis Summary

### Total Calls Found:
- **Weapon.update()**: 16 total calls
- **SerializedGear.update()**: 16 total calls

### Files Requiring Changes:

#### 1. src/pages/SoldierRelease.jsx - 4 CHANGES NEEDED
**Context**: Items come from `assignedSerialized` which spreads weapon/gear objects with their field IDs
- Line 267: `Weapon.update(item.id, ...)` → `Weapon.update(item.weapon_id, ...)`
- Line 270: `SerializedGear.update(item.id, ...)` → `SerializedGear.update(item.gear_id, ...)`
- Line 741: `Weapon.update(item.id, ...)` → `Weapon.update(item.weapon_id, ...)`
- Line 744: `SerializedGear.update(item.id, ...)` → `SerializedGear.update(item.gear_id, ...)`

#### 2. src/pages/SerializedGear.jsx - 2 CHANGES NEEDED
**Context**: `g` is gear object from filtered list, `editingGear` is gear being edited
- Line 151: `SerializedGear.update(g.id, ...)` → `SerializedGear.update(g.gear_id, ...)`
- Line 192: `SerializedGear.update(editingGear.id, ...)` → `SerializedGear.update(editingGear.gear_id, ...)`
- Line 417: Already correct ✓ - uses `gearItem.gear_id`

#### 3. src/pages/Weapons.jsx - 2 CHANGES NEEDED
**Context**: `w` is weapon from filtered list, `editingWeapon` is weapon being edited
- Line 159: `Weapon.update(w.id, ...)` → `Weapon.update(w.weapon_id, ...)`
- Line 235: `Weapon.update(editingWeapon.id, ...)` → `Weapon.update(editingWeapon.weapon_id, ...)`
- Line 486: Already correct ✓ - uses `weapon.weapon_id`

#### 4. src/pages/Import.jsx - 2 CHANGES NEEDED
**Context**: `weapon` and `gear` fetched from database with findById
- Line 1120: `Weapon.update(weapon.id, ...)` → `Weapon.update(weapon.weapon_id, ...)`
- Line 1128: `SerializedGear.update(gear.id, ...)` → `SerializedGear.update(gear.gear_id, ...)`

### Files Already Correct (NO CHANGES):

#### 5. src/pages/Soldiers.jsx - ALREADY CORRECT ✓
**Context**: Loop variables `weaponId` and `gearId` are already the field IDs
- Line 445: `Weapon.update(weaponId, ...)` - weaponId is already correct
- Line 455: `SerializedGear.update(gearId, ...)` - gearId is already correct

#### 6. src/pages/Maintenance.jsx - ALREADY CORRECT ✓
**Context**: Loop keys `weaponId` and `gearId` come from `inspectionResults` object keys which are field IDs
- Line 152: `Weapon.update(weaponId, ...)` - weaponId is already correct
- Line 167: `SerializedGear.update(gearId, ...)` - gearId is already correct

#### 7. src/pages/ArmoryDeposit.jsx - ALREADY CORRECT ✓
**Context**: All loops iterate over `weaponIds` and `gearIds` arrays which contain field IDs
- Line 219: `Weapon.update(weaponId, ...)` - weaponId is already correct
- Line 230: `SerializedGear.update(gearId, ...)` - gearId is already correct
- Line 291: `Weapon.update(weaponId, ...)` - weaponId is already correct
- Line 301: `SerializedGear.update(gearId, ...)` - gearId is already correct
- Line 348: `Weapon.update(weaponId, ...)` - weaponId is already correct
- Line 358: `SerializedGear.update(gearId, ...)` - gearId is already correct

#### 8. src/components/soldiers/UnifiedAssignmentDialog.jsx - ALREADY CORRECT ✓
**Context**: Already fixed per user instructions
- Line 364: `Weapon.update(item.weapon_id, ...)` - already correct
- Line 368: `SerializedGear.update(item.gear_id, ...)` - already correct

## Todo List

- [ ] 1. Fix src/pages/SoldierRelease.jsx (4 changes: lines 267, 270, 741, 744)
- [ ] 2. Fix src/pages/SerializedGear.jsx (2 changes: lines 151, 192)
- [ ] 3. Fix src/pages/Weapons.jsx (2 changes: lines 159, 235)
- [ ] 4. Fix src/pages/Import.jsx (2 changes: lines 1120, 1128)
- [ ] 5. Verify no other files need changes
- [ ] 6. Update review section with summary

## Simplicity Notes

- This is a simple find-and-replace task
- Change only the ID parameter in update calls
- No other logic changes
- Each change is a one-line edit
- Total of 10 lines to change across 4 files

## Review
**Status**: Previous task completed successfully

---

# NEW TASK: Fix Remaining Firestore Document ID Usage in Display/Search Operations

## Date: 7 November 2025

## Problem
While the previous task fixed `.update()` calls to use field IDs, there are still places where Firestore document IDs are used in display, search, and key generation operations. These should also use field IDs for consistency.

## Files Already Fixed (verified, no changes needed):
- ✅ src/components/soldiers/UnifiedAssignmentDialog.jsx
- ✅ src/pages/Weapons.jsx
- ✅ src/pages/SerializedGear.jsx

## Analysis Summary

### 1. src/components/armory/DepositReleaseDialog.jsx
**Status:** ALREADY CORRECT - No changes needed
- Line 240: `key={weapon.id}` - Document ID for React key (acceptable)
- Line 245-246: Uses `weapon.weapon_id` correctly ✅
- Line 272: `key={gearItem.id}` - Document ID for React key (acceptable)
- Line 277-278: Uses `gearItem.gear_id` correctly ✅

### 2. src/components/maintenance/MaintenanceInspectionForm.jsx
**Status:** NEEDS FIXING - 10 changes required

**Weapon Issues:**
- Line 155: `weapon-${weapon.id}` → `weapon-${weapon.weapon_id}`
- Line 159: `key={weapon.id}` → `key={weapon.weapon_id}`
- Line 159: `toggleItemSelection('weapon', weapon.id)` → use `weapon.weapon_id`
- Line 162: `toggleItemSelection('weapon', weapon.id)` → use `weapon.weapon_id`
- Line 233: `nonSampleWeapons.find(w => w.id === id)` → `w.weapon_id === id`

**Gear Issues:**
- Line 178: `gear-${gear.id}` → `gear-${gear.gear_id}`
- Line 182: `key={gear.id}` → `key={gear.gear_id}`
- Line 182: `toggleItemSelection('gear', gear.id)` → use `gear.gear_id`
- Line 185: `toggleItemSelection('gear', gear.id)` → use `gear.gear_id`
- Line 245: `nonSampleGear.find(g => g.id === id)` → `g.gear_id === id`

### 3. src/pages/Maintenance.jsx
**Status:** NEEDS FIXING - 2 changes required
- Line 143: `weapons.find(w => w.id === weaponId)` → `w.weapon_id === weaponId`
- Line 158: `serializedGear.find(g => g.id === gearId)` → `g.gear_id === gearId`

### 4. src/pages/Soldiers.jsx
**Status:** ALREADY CORRECT - No changes needed
- Receives field IDs from UnifiedAssignmentDialog which was already fixed ✅

## Todo List

- [ ] 1. Fix MaintenanceInspectionForm.jsx - Update renderWeaponItem function (4 changes)
- [ ] 2. Fix MaintenanceInspectionForm.jsx - Update renderGearItem function (4 changes)
- [ ] 3. Fix MaintenanceInspectionForm.jsx - Update getSelectedItemsDetails weapon search (1 change)
- [ ] 4. Fix MaintenanceInspectionForm.jsx - Update getSelectedItemsDetails gear search (1 change)
- [ ] 5. Fix Maintenance.jsx - Update weapon find operation (1 change)
- [ ] 6. Fix Maintenance.jsx - Update gear find operation (1 change)
- [ ] 7. Verify DepositReleaseDialog.jsx (no changes needed)
- [ ] 8. Verify Soldiers.jsx (no changes needed)
- [ ] 9. Update review section with summary

## Simplicity Notes
- Simple find-and-replace task
- Change `.id` to appropriate field ID (`.weapon_id` or `.gear_id`)
- No complex logic changes
- 12 total lines to change across 2 files
