# Project Plan: Fix Admin User Import Permissions Issue

## Problem Analysis
The admin user cannot import weapons because their Firebase Auth token doesn't have the proper permissions claims set, even though they should have all permissions. This is causing Firestore security rules to deny access.

## Root Cause
When permissions are updated on a user (like when they're made admin), the Firebase Auth token needs to be refreshed to include the new custom claims. The current implementation doesn't force a token refresh after permission updates.

## Solution Approach
We need to implement a token refresh mechanism that ensures the user's auth token is updated with the latest permissions after any permission changes.

## Todo List

- [ ] 1. Add a force token refresh function to the auth-adapter.js
- [ ] 2. Update the `updateMyUserData` function to force refresh the token after updates
- [ ] 3. Add a refresh token mechanism when the admin logs in to ensure latest permissions
- [ ] 4. Add a manual "Refresh Permissions" button for admins to force refresh their token
- [ ] 5. Update the Import page to check and refresh permissions before import operations

## Implementation Details

### 1. Force Token Refresh Function
- Add a `refreshToken` function that forces Firebase to get a new ID token with updated claims
- This will call `currentUser.getIdToken(true)` to bypass the cache

### 2. Update `updateMyUserData` 
- Already has token refresh but ensure it's working properly
- Add error handling and success confirmation

### 3. Login Token Refresh
- When admin logs in, force refresh the token to ensure latest permissions
- This ensures any permission updates made while logged out are reflected

### 4. Manual Refresh Button
- Add a button in the user menu or settings that allows forcing a token refresh
- This gives users control when they encounter permission issues

### 5. Import Page Permission Check
- Before import operations, check if user has required permissions
- If not, attempt to refresh token and re-check
- Show clear error messages if permissions are still insufficient

## Expected Outcome
After implementing these changes, the admin user will have their auth token properly updated with all permissions, allowing them to import weapons and other data without permission errors.