# Project Plan: Fix Team Leader Permissions Using Soldier Data

**Date**: 2025-10-27
**Task**: Fix team leader permission errors by using soldier's division/team from soldiers table

## Problem Statement

Team leader user is getting "Missing or insufficient permissions" errors when querying Firestore collections, despite having correct permissions in custom claims.

### Debug Log Evidence

```
[User.me] Custom claims contain:
  - role: user
  - custom_role: team_leader
  - linked_soldier_id: 10586
  - division: פלס"מ
  - team: תקשוב          ← From custom claims
  - Permissions: { personnel.view: true, equipment.view: true, ... }

[User.me] Found user document in Firestore:
  - role: user
  - custom_role: team_leader
  - division: פלס"מ
  - team: מחלקת מבצעים   ← From Firestore users table

[Layout] Searching for soldier...
  Query: soldiers WHERE soldier_id == "10586" AND division_name == "פלס"מ"

Error in findMany for soldiers: FirebaseError: Missing or insufficient permissions.
```

### Root Cause

**Mismatch between custom claims and actual data:**
- Custom claims have: `team: "תקשוב"`
- User Firestore doc has: `team: "מחלקת מבצעים"`
- Firestore rules use `getUserTeam()` which returns "תקשוב" from custom claims
- When filtering soldiers by team, no match is found → permission denied

**The real problem:** We should be using the soldier's division and team from the **soldiers table**, not from the users table. The soldier record is the source of truth.

## Solution

Fix `syncUserOnSignIn` cloud function to:
1. Find soldier using `linked_soldier_id` (already done)
2. Read `division_name` and `team_name` from soldier record
3. Set those values in custom claims (not from users table)
4. This ensures `getUserDivision()` and `getUserTeam()` return the correct values for Firestore rule matching

## Todo List

- [ ] Fix `syncUserOnSignIn` to use soldier's division/team from soldiers table
- [ ] Test: Verify custom claims have correct team after sign-in
- [ ] Test: Verify team leader can query soldiers collection
- [ ] Test: Verify dashboard loads correctly for team leader
- [ ] (Bonus) Remove "Divisions" tab for team leaders
- [ ] (Bonus) Update dashboard title for team context
- [ ] Deploy cloud function
- [ ] Update projectplan.md with review

## Implementation Details

### File: functions/src/users.js - syncUserOnSignIn function

**Current code (lines ~810-868):**
```javascript
// After finding soldier record and user document...
const customClaims = {
  role: userDoc.role || 'user',
  custom_role: userDoc.custom_role || 'soldier',
  linked_soldier_id: soldierDoc.soldier_id,
  user_doc_id: userDoc.id,
  division: userDoc.division || soldierDoc.division_name,  // ← WRONG: prefers userDoc
  team: userDoc.team || soldierDoc.team_name,              // ← WRONG: prefers userDoc
  displayName: displayName,
  email: authUser.email || userDoc.email,
  phoneNumber: authUser.phoneNumber || userDoc.phoneNumber,
  permissions: userDoc.permissions || getDefaultPermissions(userDoc.custom_role)
};
```

**New code (change):**
```javascript
// After finding soldier record and user document...
const customClaims = {
  role: userDoc.role || 'user',
  custom_role: userDoc.custom_role || 'soldier',
  linked_soldier_id: soldierDoc.soldier_id,
  user_doc_id: userDoc.id,
  division: soldierDoc.division_name,        // ← FIXED: Use soldier's division
  team: soldierDoc.team_name,                // ← FIXED: Use soldier's team
  displayName: displayName,
  email: authUser.email || userDoc.email,
  phoneNumber: authUser.phoneNumber || userDoc.phoneNumber,
  permissions: userDoc.permissions || getDefaultPermissions(userDoc.custom_role)
};
```

**Key change:** Always use soldier's `division_name` and `team_name` as the source of truth for custom claims.

### Why This Works

1. **Soldier record is source of truth** for division/team placement
2. **Users table stores role/permissions** (what the user can do)
3. **Soldiers table stores location** (where the user belongs)
4. When Firestore rules check `getUserTeam() == resourceData.team_name`, both values come from soldier records → match succeeds

### Expected Result

After the fix, custom claims will have:
```
Custom claims:
  - division: פלס"מ          (from soldier.division_name)
  - team: מחלקת מבצעים       (from soldier.team_name)
```

Firestore rules will then correctly match:
```
getUserTeam() == "מחלקת מבצעים"
resourceData.team_name == "מחלקת מבצעים"
→ Match! Permission granted ✅
```

## Bonus: UI Improvements for Team Leaders

### File: src/pages/Layout.jsx - getNavigationItems function

**Current:** Team leaders see all navigation items including "Divisions" tab

**Change:** Filter out division-level tabs for team leaders:
```javascript
const allItems = [
  // ... existing items ...
  {
    title: "Divisions",
    url: createPageUrl("Divisions"),
    icon: Shield,
    hideForRoles: ['team_leader']  // ← ADD: Hide for team leaders
  },
  // ... rest of items ...
];

// Filter based on hideForRoles
return allItems.filter(item => {
  if (item.hideForRoles && item.hideForRoles.includes(userRole)) {
    return false; // Hide this item
  }
  // ... existing permission checks ...
});
```

### File: src/pages/Dashboard.jsx - Update title

**Current:** Shows "Command Dashboard" for all roles

**Change:** Show "Team Dashboard" for team leaders:
```javascript
<h1 className="text-xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">
  {selectedDivisionFilter !== "all" ? `${selectedDivisionFilter} Division Dashboard` :
   currentUser?.custom_role === 'team_leader' ? 'Team Dashboard' :  // ← ADD THIS
   userDivision && !isManagerOrAdmin ? `${userDivision} Division Dashboard` :
   'Command Dashboard'}
</h1>
```

## Files to Modify

1. **functions/src/users.js** (~2 lines) - Use soldier's division/team in custom claims
2. **src/pages/Layout.jsx** (~15 lines) - Hide "Divisions" tab for team leaders
3. **src/pages/Dashboard.jsx** (~2 lines) - Update dashboard title for team leaders

## Deployment

```bash
# Deploy cloud function with the fix
firebase deploy --only functions:syncUserOnSignIn
```

After deployment, team leader must **re-login** to get updated custom claims with correct team name.

## Testing Checklist

After deployment and re-login:
1. [ ] Check custom claims have `team: "מחלקת מבצעים"` (from soldier record)
2. [ ] Verify Layout component can load soldier data (no permission error)
3. [ ] Verify Dashboard loads statistics (no permission error on soldiers query)
4. [ ] Verify Soldiers page loads team members
5. [ ] Verify Equipment/Weapons/Gear pages load team data
6. [ ] Verify "Divisions" tab is hidden for team leaders
7. [ ] Verify dashboard title shows "Team Dashboard"

## Impact Assessment

- **User Impact**: Positive - fixes permission errors for team leaders
- **Code Complexity**: Reduced - simpler logic (soldier is source of truth)
- **Maintainability**: Improved - clear data ownership (soldiers table owns location)
- **Performance**: No impact - same number of queries
- **Security**: Enhanced - permissions now work correctly for team scope
- **Simplicity**: Very high - minimal 2-line change in cloud function

## Summary

The fix is simple: use the soldier's `division_name` and `team_name` from the soldiers table as the source of truth for custom claims. This ensures Firestore rules can correctly match team data and grant permissions to team leaders.

**Total changes: ~20 lines across 3 files** ✅
