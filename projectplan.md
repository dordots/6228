# Project Plan: Fix Division Manager Permissions Issues

**Date**: 2025-10-28

---

## Issue 1: Division Manager Cannot View Soldier History ✅ FIXED

### Status
✅ **FIXED** - Changed field name from `created_date` to `created_at` in SigningHistoryDialog.jsx

---

## Issue 2: Division Manager Cannot Delete Weapons ⚠️ IN PROGRESS

### Problem
Division managers get Firestore permission error when trying to delete weapons, even though:
- ✅ Frontend permission check passes (fixed)
- ✅ User has `equipment.delete: true` permission
- ❌ Firestore rules block the delete operation

### Console Log Analysis

**User Permissions (from console):**
```
"equipment.delete": true
"scope": "division"
"division": "פלס"מ"
```

**Error:**
```
Error deleting weapon: FirebaseError: Missing or insufficient permissions.
```

### Firestore Rule for Weapons Delete

**Current rule ([firestore.rules:124](firestore.rules#L124)):**
```javascript
allow delete: if hasPermission('equipment.delete') && canAccessByScope(resource.data);
```

This requires:
1. ✅ `hasPermission('equipment.delete')` - User HAS this
2. ❓ `canAccessByScope(resource.data)` - **THIS is failing**

### Root Cause Investigation

The `canAccessByScope` function checks:
```javascript
getUserDivision() == resourceData.division_name ||
getUserDivision() == resourceData.division
```

**Possible Issues:**
1. **Field name mismatch**: Weapon might have `division` instead of `division_name`
2. **Character encoding**: Division name might have encoding differences
3. **Null/undefined**: Weapon's division field might be missing
4. **Scope check logic**: The scope check might not be working correctly for deletes

### Next Steps

Need to verify:
1. What division field name does the weapon actually have?
2. Does the weapon's division value exactly match the user's division?
3. Is `resource.data` available during delete operations?

### Temporary Workaround

If debugging is complex, we could modify the Firestore rule to be less strict for division managers:

**Option A: Check division before calling canAccessByScope**
```javascript
allow delete: if hasPermission('equipment.delete') &&
  (isAdmin() || getUserScope() == 'global' ||
   (getUserScope() == 'division' &&
    (getUserDivision() == resource.data.division_name ||
     getUserDivision() == resource.data.division)));
```

**Option B: Make delete less strict for division scope**
```javascript
allow delete: if hasPermission('equipment.delete') &&
  (getUserScope() == 'global' || getUserScope() == 'division' || canAccessByScope(resource.data));
```

---

## Changes Completed

### 1. SigningHistoryDialog.jsx - Field Name Fix ✅
**File**: [src/components/soldiers/SigningHistoryDialog.jsx:56](src/components/soldiers/SigningHistoryDialog.jsx#L56)
- Changed `'-created_date'` to `'-created_at'`

### 2. Weapons.jsx - Permission Check Fix ✅
**File**: [src/pages/Weapons.jsx:378](src/pages/Weapons.jsx#L378)
- Changed `can_delete_weapons` to `equipment.delete`

### 3. WeaponTable.jsx - Permission Check Fix ✅
**File**: [src/components/weapons/WeaponTable.jsx:132](src/components/weapons/WeaponTable.jsx#L132)
- Changed `can_delete_weapons` to `equipment.delete`

---

## Todo Items

- [x] Fix SigningHistoryDialog field name issue
- [x] Fix Weapons.jsx permission check
- [x] Fix WeaponTable.jsx permission check
- [ ] Debug and fix Firestore rules for weapon deletion
- [ ] Test division manager can delete weapons
