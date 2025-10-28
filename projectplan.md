# Project Plan: Investigation - Division Manager "Add" Buttons Disabled

**Date**: 2025-10-28
**Issue**: Division managers cannot click "Add" buttons for gears and drones even though they have `equipment.create` permission

## Investigation Summary

### Expected Behavior
Division managers have the following permissions (from [functions/src/users.js:638](functions/src/users.js#L638)):
- ✅ `equipment.create`: true
- ✅ `equipment.update`: true
- ✅ `equipment.delete`: true

They should be able to add, edit, and delete all equipment (weapons, gears, drones, components).

### Current Button Logic

**SerializedGear Page** ([src/pages/SerializedGear.jsx:608](src/pages/SerializedGear.jsx#L608)):
```javascript
disabled={!currentUser?.permissions?.['equipment.create'] && currentUser?.role !== 'admin'}
```

**Drones Page** ([src/pages/Drones.jsx:542](src/pages/Drones.jsx#L542)):
```javascript
disabled={!currentUser?.permissions?.['equipment.create'] && currentUser?.role !== 'admin'}
```

The button logic is CORRECT - it checks for `equipment.create` permission.

### Permissions Loading

The `User.me()` function ([src/firebase/auth-adapter.js:258](src/firebase/auth-adapter.js#L258)) loads permissions from:
1. Firestore user document (if exists)
2. Custom claims (fallback)

```javascript
permissions: firestoreUserData?.permissions ?? claims.permissions,
```

## Root Cause Analysis

There are several possible reasons why the buttons are disabled:

### Possibility 1: Permissions Not in Custom Claims
The division manager's custom claims might not have the `permissions` object set correctly. This happens during:
- User creation ([functions/src/users.js:100-106](functions/src/users.js#L100-L106))
- Role update ([functions/src/users.js:248-289](functions/src/users.js#L248-L289))

### Possibility 2: Firestore User Document Out of Sync
The Firestore `users` collection document might not have the correct permissions.

### Possibility 3: Token Not Refreshed
After updating permissions, the user's ID token might not have been refreshed, causing old claims to be cached.

### Possibility 4: User Document Not Found
The `syncUserOnSignIn` function might not be finding/creating the user document properly.

## Solution Plan

### Step 1: Debug Current State
Add console logging to check what the division manager actually has:

**File**: Console in browser (division manager account)
- Open browser console while logged in as division manager
- Check what `User.me()` returns
- Verify `currentUser.permissions['equipment.create']` value

### Step 2: Verify Backend Permissions
Check if the division manager user in Firebase has correct:
1. Custom claims with permissions object
2. Firestore users document with permissions object

### Step 3: Fix Options

#### Option A: Force Token Refresh
If permissions are correct in backend but not loading, force a token refresh:
- Call `User.me(true)` with `forceRefresh=true`
- Or sign out and sign back in

#### Option B: Fix User Document
If Firestore document is missing/incorrect:
- Run the `updateUserRole` cloud function to reset the role
- This will recreate custom claims and Firestore document with correct permissions

#### Option C: Verify getDefaultPermissions
Ensure `getDefaultPermissions('division_manager')` is returning the correct permissions structure with `equipment.create: true`.

## Investigation Steps

### 1. Check Browser Console (Manual Step - User)
When logged in as division manager, run in browser console:
```javascript
// Get current user
const user = await User.me();
console.log('Current user:', user);
console.log('Permissions:', user.permissions);
console.log('equipment.create:', user.permissions?.['equipment.create']);
console.log('Role:', user.role);
console.log('Custom role:', user.custom_role);
```

### 2. Check Firebase Console (Manual Step - User)
1. Go to Firebase Console → Authentication → Users
2. Find the division manager user
3. Check custom claims (should have `permissions` object)

### 3. Check Firestore Console (Manual Step - User)
1. Go to Firebase Console → Firestore → `users` collection
2. Find the division manager's document
3. Verify `permissions` field has `equipment.create: true`

## Temporary Workaround

If permissions are missing, the admin can update the division manager's role:
1. Go to User Management page (as admin)
2. Find the division manager user
3. Update their role (select "Division Manager" again)
4. This will trigger `updateUserRole` which recreates permissions
5. Division manager needs to sign out and sign back in

## Files to Review

1. [functions/src/users.js:629-653](functions/src/users.js#L629-L653) - Division manager permissions definition
2. [src/firebase/auth-adapter.js:170-300](src/firebase/auth-adapter.js#L170-L300) - User.me() permissions loading
3. [src/pages/SerializedGear.jsx:608](src/pages/SerializedGear.jsx#L608) - Add button logic
4. [src/pages/Drones.jsx:542](src/pages/Drones.jsx#L542) - Add button logic

## Next Steps

**REQUIRED**: Please provide the following information:

1. What does the browser console show when you run the debug script above (as division manager)?
2. What permissions appear in the Firebase Console for the division manager user?
3. Does the Firestore `users` document exist for this user, and what permissions does it have?

Once we have this information, I can provide a specific fix based on the root cause.

---

## Previous Changes Completed

### Part 1: Navigation Items (Layout.jsx) ✅
Hidden 6 navigation items for division managers.

### Part 2: Drone Components Filtering (DroneComponents.jsx) ✅
Implemented three-step filtering for division managers.

### Part 3: Drone Set Details Dialog Fix ✅
Fixed component lookup in drone set details dialog.
