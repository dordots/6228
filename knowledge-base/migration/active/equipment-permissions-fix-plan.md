# Project Plan: Fix Admin Equipment Creation Permission Issue

## Problem Analysis
The admin user is unable to create weapons despite having admin role. The issue is a mismatch between:
1. **Backend permissions format**: Uses new RBAC format like `equipment.create`
2. **Frontend permission checks**: Still checking for old format like `can_create_weapons`

### Root Cause
- Firebase cloud functions grant permissions using new format: `permissions: {'equipment.create': true, ...}`
- Frontend code checks for old format: `user?.permissions?.can_create_weapons`

## Todo List

### 1. ✅ Investigate the permission system
- [x] Check how permissions are set in Firebase functions
- [x] Review how User.me() exposes permissions
- [x] Identify where permission checks fail in frontend
- [x] Found mismatch between backend (equipment.create) and frontend (can_create_weapons)

### 2. ✅ Fix permission checks in Weapons.jsx
- [x] Update line 202: Change `can_create_weapons` to `equipment.create`
- [x] Update line 150: Change `can_edit_weapons` to `equipment.update`
- [ ] Test that admin can now create/edit weapons

### 3. ✅ Fix permission checks in other affected files
- [x] Check WeaponTable.jsx - Fixed permission checks
- [x] Check Equipment.jsx - Fixed equipment.create check
- [x] Fixed SerializedGear.jsx permissions
- [x] Fixed Drones.jsx permissions

### 4. ⬜ Test the fix
- [ ] Verify admin user can create weapons
- [ ] Verify admin user can edit weapons
- [ ] Ensure non-admin users still cannot create/edit without proper permissions

## Implementation Notes
- Keep changes minimal - only update permission check format
- Maintain backward compatibility where possible
- Focus on fixing the immediate issue without refactoring the entire permission system

## Review

### Changes Made
1. **Fixed Weapons.jsx** - Updated permission checks from old format (`can_create_weapons`, `can_edit_weapons`) to new RBAC format (`equipment.create`, `equipment.update`)

2. **Fixed WeaponTable.jsx** - Updated permission checks for edit and reassign actions to use new format

3. **Fixed Equipment.jsx** - Updated the Add Equipment button permission check to use `equipment.create`

4. **Fixed SerializedGear.jsx** - Updated all permission checks:
   - `can_delete_gear` → `equipment.delete`
   - `can_create_gear` → `equipment.create`
   - `can_sign_equipment` → `operations.sign`

5. **Fixed Drones.jsx** - Updated all permission checks:
   - `can_delete_drones` → `equipment.delete`
   - `can_create_drones` → `equipment.create`
   - `can_transfer_equipment` → `operations.transfer`

### Summary
The issue was caused by a mismatch between the backend permission system (which uses the new RBAC format like `equipment.create`) and the frontend code (which was still checking for old format like `can_create_weapons`). 

All critical equipment creation and management permission checks have been updated to use the correct format. The admin user should now be able to create and manage weapons/equipment as expected.

### Testing Required
The user should now test that:
1. Admin users can create new weapons
2. Admin users can edit existing weapons
3. Non-admin users without proper permissions still cannot create/edit
4. All equipment types (weapons, gear, drones) work correctly with the new permission format