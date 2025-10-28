# Project Plan: User Management Improvements

## Overview
Modify user creation in user management to:
1. Remove the manual "Link to Soldier" dropdown option
2. Automatically link users to soldiers based on phone number or email matching
3. Save user data in both Firebase Authentication AND Firestore users table

## Current State Analysis

### UserManagement.jsx (Frontend)
- Lines 375-393: Manual "Link to Soldier" dropdown in create user dialog
- Lines 178-189: Already has phone/email matching logic to find soldiers
- Lines 191-199: Calls `User.create()` with linkedSoldierId

### functions/src/users.js (Backend)
- Lines 60-132: `createPhoneUser` function
  - Currently creates user in Firebase Auth
  - Sets custom claims but does NOT save to Firestore users table
  - Accepts linkedSoldierId parameter
- Lines 1021-1145: `onUserCreate` trigger
  - Automatically creates Firestore user document when auth user is created
  - Already has automatic soldier matching by email/phone (lines 1042-1070)
  - Sets default "soldier" role

## Tasks

### Task 1: Remove manual linking UI from frontend ✅
- [x] Remove the "Link to Soldier" dropdown from UserManagement.jsx (lines 375-393)
- [x] Remove linkedSoldierId from newUserData state (lines 54-59, 172, 195, 203-208)
- [x] Simplified User.create() call to remove division/team/linkedSoldierId parameters

### Task 2: Update createPhoneUser to save to Firestore users table ✅
- [x] Modify `createPhoneUser` function in functions/src/users.js (lines 60-132)
- [x] After creating Firebase Auth user, find matching soldier by phone/email
- [x] Create Firestore user document with matched soldier data
- [x] Set linked_soldier_id automatically if soldier match found
- [x] Update custom claims with complete user data
- [x] Update soldier document with user UID when linked
- [x] Remove unused parameters (permissions, linkedSoldierId)

### Task 3: Test the changes
- [ ] Test user creation with phone number that matches a soldier
- [ ] Test user creation with phone number that doesn't match any soldier
- [ ] Verify user appears in Firestore users collection
- [ ] Verify user appears in Firebase Authentication
- [ ] Verify automatic soldier linking works correctly
- [ ] Verify division and team are populated from matched soldier

## Notes
- The `onUserCreate` trigger (lines 1021-1145) already handles automatic user document creation on sign-in, so we need to ensure `createPhoneUser` creates the document immediately to avoid conflicts
- The automatic matching logic already exists and works well - we're just moving it to backend and making it the only way to link
- This simplifies the UI and ensures consistency

## Review

### Changes Made

#### Frontend Changes ([src/pages/UserManagement.jsx](src/pages/UserManagement.jsx))
1. **Removed manual soldier linking dropdown** - The UI no longer shows a "Link to Soldier" dropdown
2. **Simplified state management** - Removed `linkedSoldierId` from `newUserData` state
3. **Simplified User.create() call** - Now only passes: phoneNumber, role, customRole, displayName
4. **Cleaner UI** - The create user dialog is simpler with only essential fields: Phone Number, Display Name, and Role

#### Backend Changes ([functions/src/users.js](functions/src/users.js))
1. **Automatic soldier matching** - The `createPhoneUser` function now:
   - Searches for matching soldiers by phone number first
   - Falls back to email matching if phone doesn't match
   - Logs the search process for debugging
2. **Firestore user document creation** - Now saves user immediately to Firestore users collection with:
   - Basic user info (email, phone, displayName)
   - Role and permissions
   - Automatically populated division and team from matched soldier
   - Automatically set linked_soldier_id
3. **Soldier document update** - When a soldier is matched, their document is updated with the user's UID
4. **Complete response** - Returns linkedSoldier info so frontend can show confirmation

### How It Works Now

1. Admin creates user with phone number (e.g., +972501234567)
2. Backend creates Firebase Auth user
3. Backend searches soldiers collection for matching phone/email
4. If match found:
   - User document created in Firestore with soldier's division, team, and soldier_id
   - Soldier document updated with user UID
   - User automatically linked
5. If no match found:
   - User document created with default soldier role and null division/team
   - User can be manually assigned later or linked when soldier is added
6. Custom claims set with complete user data
7. User is ready to sign in immediately

### Benefits
- **Simpler UI** - No confusing manual linking dropdown
- **Automatic linking** - Works seamlessly based on phone/email
- **Immediate availability** - User data in Firestore right away (no waiting for first sign-in)
- **Consistent data** - One source of truth in Firestore
- **Better UX** - Less steps, less confusion for admins

### Additional Change: Simplified User Deletion

**Updated `deleteUser` function** to always perform hard delete:
- Removed soft delete (disabling) option
- Always deletes from Firebase Authentication
- Always deletes from Firestore users collection
- Handles cases where user might only exist in one location
- Returns detailed success info (deletedFromAuth, deletedFromFirestore)
- Frontend updated to remove hardDelete parameter

**Before**: Had soft delete (disable) and hard delete options
**After**: Always hard deletes from both Authentication and Firestore

This makes deletion simpler and more predictable - when you delete a user, they're gone from both systems.

### Testing Recommendations
1. Create user with phone matching existing soldier - should auto-link
2. Create user with phone not matching any soldier - should create with null division/team
3. Verify user shows up in user management table immediately
4. Verify user can sign in successfully
5. Check Firebase console to confirm user in both Auth and Firestore
6. Delete a user and verify it's removed from both Authentication and Firestore
