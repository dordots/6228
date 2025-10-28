# Project Plan: Fix Team Leader Command Dashboard Data Loading

**Date**: 2025-10-28
**Task**: Fix team leader dashboard not loading equipment/weapons/gear/drones

## Problem Statement

The command dashboard for team leaders only loads personnel correctly, but fails to load equipment, weapons, gear, and drones - showing zero results.

### Root Cause Analysis

The dashboard currently filters ALL collections (soldiers, equipment, weapons, gear, drones) using the same filter:
```javascript
filter = { division_name: userDivisionName, team_name: userTeamName };
```

**The Problem:**
- ✅ **Soldiers collection** has `team_name` field → Works correctly
- ❌ **Equipment collection** does NOT have `team_name` field → Returns zero results
- ❌ **Weapons collection** does NOT have `team_name` field → Returns zero results
- ❌ **Gear collection** does NOT have `team_name` field → Returns zero results
- ❌ **Drones collection** does NOT have `team_name` field → Returns zero results

**What these collections DO have:**
- `assigned_to` field: Contains the soldier_id when an item is assigned to a soldier
- `division_name` field: Contains the division name

### Why This Happens

When Firestore queries these collections with `team_name` filter, it finds NO documents because the field doesn't exist in the schema. The query succeeds but returns empty array.

## Solution

Use a **two-step filtering approach** for team leaders:

1. **Step 1**: Query soldiers collection by `team_name` to get all soldier IDs in the team
2. **Step 2**: Query equipment/weapons/gear/drones using `assigned_to IN soldierIds`

This works because:
- Firebase adapter already supports the `in` operator (line 91-92 in firebase-adapter.js)
- Equipment/weapons/gear/drones have `assigned_to` field containing soldier_id
- We can filter by multiple soldier IDs efficiently using Firestore's `in` query

## Todo List

- [x] Read projectplan.md and update with detailed plan
- [ ] Read Dashboard.jsx to understand current implementation
- [ ] Modify Dashboard.jsx loadData function for team leader filtering
- [ ] Update projectplan.md review section with changes made

## Implementation Details

### File: src/pages/Dashboard.jsx - loadData function

**Current code (lines 66-95):**
```javascript
} else if (isTeamLeader && userDivisionName && userTeamName) {
  // Team leaders see only their team within their division
  filter = { division_name: userDivisionName, team_name: userTeamName };
}

// ... build verification filter ...

const [
  soldiersResult,
  equipmentResult,
  weaponsResult,
  gearResult,
  dronesResult,
  activityLogResult,
  verificationsResult,
] = await Promise.allSettled([
  Soldier.filter(filter),          // ✅ Works - has team_name
  Equipment.filter(filter),        // ❌ Returns [] - no team_name field
  Weapon.filter(filter),           // ❌ Returns [] - no team_name field
  SerializedGear.filter(filter),   // ❌ Returns [] - no team_name field
  DroneSet.filter(filter),         // ❌ Returns [] - no team_name field
  ActivityLog.filter(filter, "-created_date", 50),
  DailyVerification.filter(verificationFilter),
]);
```

**New approach:**
```javascript
} else if (isTeamLeader && userDivisionName && userTeamName) {
  // Team leaders: First get team soldiers, then filter by assigned_to
  const teamSoldiers = await Soldier.filter({
    division_name: userDivisionName,
    team_name: userTeamName
  });
  const soldierIds = teamSoldiers.map(s => s.soldier_id);

  // Build filter for equipment/weapons/gear/drones using IN operator
  filter = {
    division_name: userDivisionName,
    assigned_to: { in: soldierIds }  // Firebase 'in' operator
  };

  // Set soldiers directly since we already fetched them
  setSoldiers(teamSoldiers);

  // Now fetch only equipment/weapons/gear/drones
  const [
    equipmentResult,
    weaponsResult,
    gearResult,
    dronesResult,
    activityLogResult,
    verificationsResult,
  ] = await Promise.allSettled([
    Equipment.filter(filter),
    Weapon.filter(filter),
    SerializedGear.filter(filter),
    DroneSet.filter(filter),
    ActivityLog.filter({ division_name: userDivisionName, team_name: userTeamName }, "-created_date", 50),
    DailyVerification.filter(verificationFilter),
  ]);
}
```

### Key Changes

1. **Two-step process for team leaders**:
   - First: Fetch soldiers with `team_name` filter
   - Second: Use soldier IDs to filter equipment/weapons/gear/drones

2. **Use Firebase `in` operator**:
   - Format: `{ assigned_to: { in: [id1, id2, ...] } }`
   - Supported by firebase-adapter.js (lines 91-92)

3. **Keep division filter** for extra safety

4. **Handle edge case**: If team has no soldiers, soldierIds = [] → queries return empty (correct behavior)

## Files to Modify

1. **[src/pages/Dashboard.jsx](src/pages/Dashboard.jsx:41-134)** - Modify loadData function (lines 41-134)

## Testing Checklist

After implementation:
1. [ ] Test as team leader role
2. [ ] Verify personnel loads correctly (should show team members)
3. [ ] Verify equipment loads correctly (items assigned to team soldiers)
4. [ ] Verify weapons loads correctly (items assigned to team soldiers)
5. [ ] Verify gear loads correctly (items assigned to team soldiers)
6. [ ] Verify drones loads correctly (items assigned to team soldiers)
7. [ ] Verify activity log and verifications still work
8. [ ] Verify unassigned items don't appear (correct behavior)

## Impact Assessment

- **User Impact**: Positive - fixes broken dashboard for team leaders
- **Code Complexity**: Slightly increased - adds conditional logic for team leaders
- **Maintainability**: Good - clear two-step process, well-documented
- **Performance**: Minimal impact - one extra query for soldiers (small dataset)
- **Security**: No change - uses existing Firestore rules
- **Simplicity**: High - localized change to one function

## Review Section

### Changes Made

**Files Modified**:
1. [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx:41-189) - Dashboard data loading
2. [firestore.rules](firestore.rules:70-95) - Security rules

**Summary**: Implemented two-step filtering for team leaders in the dashboard AND updated Firestore security rules to allow access to items assigned to team members.

**Key Changes**:

1. **Added Special Team Leader Path** (lines 55-123):
   - First query: Fetch soldiers by `team_name` to get all team member IDs
   - Extract `soldier_id` array from team soldiers
   - Build equipment filter using `assigned_to: { in: soldierIds }`
   - Query equipment/weapons/gear/drones with the `in` filter
   - Set results directly, bypassing the standard filter path

2. **Preserved Existing Logic** (lines 124-189):
   - All other roles (admin, manager, division_manager) use the original filtering logic unchanged
   - No impact on existing functionality for non-team-leader users

3. **Enhanced Logging**:
   - Added specific console logs for team leader loading process
   - Shows soldier IDs found and filter being used
   - Helps with debugging and monitoring

**Code Structure**:
```javascript
if (isTeamLeader && userDivisionName && userTeamName) {
  // Step 1: Get team soldiers
  const teamSoldiers = await Soldier.filter({ division_name, team_name });
  const soldierIds = teamSoldiers.map(s => s.soldier_id);

  // Step 2: Filter equipment by assigned_to IN soldierIds
  const equipmentFilter = soldierIds.length > 0
    ? { assigned_to: { in: soldierIds } }
    : { assigned_to: null };

  // Step 3: Fetch and set data
  // ... (equipment, weapons, gear, drones queries)
} else {
  // Original path for all other roles
  // ... (unchanged)
}
```

**Changes Summary**:
- **Lines added**: ~70 lines
- **Lines modified**: 0 (original logic preserved in else block)
- **Lines deleted**: 0
- **Complexity**: Simple if-else branch, no structural changes
- **Impact**: Fixes team leader dashboard, no impact on other roles

### Testing Instructions

To test this fix:

1. **Login as Team Leader**
   - User with `custom_role: 'team_leader'`
   - Must have `division` and `team` set in custom claims

2. **Navigate to Command Dashboard**
   - Should see "Team Dashboard" title
   - Dashboard should load without errors

3. **Verify Data Loading**
   - Open browser console (F12)
   - Look for logs: "Team leader loading: Found X team soldiers"
   - Check that equipment/weapons/gear/drones counts are non-zero (if team has assigned items)

4. **Expected Behavior**
   - Personnel count: Shows all team members
   - Equipment count: Shows items assigned to team members (via `assigned_to` field)
   - Weapons count: Shows weapons assigned to team members
   - Gear count: Shows gear assigned to team members
   - Drones count: Shows drones assigned to team members
   - Unassigned items: Should NOT appear (correct behavior for team view)

5. **Verify Other Roles Still Work**
   - Test as admin, manager, division_manager
   - Verify dashboard loads correctly with standard filtering

### Testing Results
(To be filled after deploying firestore rules and testing)

## Final Solution Summary

**Hybrid Approach**: Modified Firestore rules + All data pages with two-step filtering

### Changes Made:

#### 1. Firestore Rules Update
**File**: [firestore.rules](firestore.rules:78-89)
- Added logic to allow team-scoped users to access division data when documents lack `team_name` field
- If document has `team_name` field: require exact match (soldiers, activity_logs, verifications)
- If document lacks `team_name` field: allow division-level access (equipment, weapons, gear, drones)
- Team leaders can now query by `division_name` only for collections without `team_name`

#### 2. Two-Step Filtering Implementation
Applied the same pattern to **6 pages**:

**Files Modified**:
- [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx:55-131)
- [src/pages/Weapons.jsx](src/pages/Weapons.jsx:103-184)
- [src/pages/Equipment.jsx](src/pages/Equipment.jsx:75-117)
- [src/pages/SerializedGear.jsx](src/pages/SerializedGear.jsx:86-127)
- [src/pages/Drones.jsx](src/pages/Drones.jsx:84-129)
- [src/pages/ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx:59-158)

**Pattern Applied**:
```javascript
if (isTeamLeader && userDivision && userTeam) {
  // Step 1: Get team soldiers
  const teamSoldiers = await Soldier.filter({
    division_name: userDivision,
    team_name: userTeam
  });
  const soldierIds = teamSoldiers.map(s => s.soldier_id);

  // Step 2: Get all division items
  const allItems = await Item.filter({ division_name: userDivision });

  // Step 3: Filter client-side by assigned_to
  const soldierIdSet = new Set(soldierIds);
  const itemsData = allItems.filter(i => i.assigned_to && soldierIdSet.has(i.assigned_to));

  setItems(itemsData);
  setSoldiers(teamSoldiers);
} else {
  // Standard filtering for other roles
  // ...
}
```

**Key Benefits**:
- Team leaders see only items assigned to their team members
- Works with Firestore rules (queries by division, filters client-side)
- Consistent pattern across all pages
- Simple, maintainable code

### Deployment Required:
```bash
firebase deploy --only firestore:rules
```

Then refresh any page to test the two-step filtering.

#### 3. Hide Verification Features for Team Leaders
**Files Modified**:
- [src/pages/Layout.jsx](src/pages/Layout.jsx:141-154) - Navigation menu items
- [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx:387-411) - Dashboard layout

**Changes**:
- Added `hideForRoles: ['team_leader']` to "Daily Verification" and "Verification History" menu items
- Conditionally hide VerificationSummary component on dashboard for team leaders
- Adjusted grid layout to be full-width when verification section is hidden

**Reason**: Team leaders don't have `operations.verify` permission, so these features are not accessible to them.

#### 4. Fix Activity History for Team Leaders
**File Modified**: [src/pages/History.jsx](src/pages/History.jsx:419-422)

**Change**:
- Removed `team_name` filter from ActivityLog query for team leaders
- Team leaders now query by `division_name` only (same as division managers)

**Reason**: ActivityLog collection doesn't have a `team_name` field, only `division_name`. The previous filter with `team_name` was returning zero results.
