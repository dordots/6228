# Fix Team Leader Reassignment Permissions

## Date: 29 October 2025

## Problem Statement
Team leaders get permission errors when trying to reassign weapons, gears, and drones. The issue is in firestore.rules - update permissions don't validate scope, but team leaders have `scope: 'team'` which should restrict them to their team's equipment.

## Root Cause
In [firestore.rules](firestore.rules), all equipment collection update rules only check `hasPermission('equipment.update')` without validating scope:
- Line 119: equipment update
- Line 131: weapons update
- Line 146: serialized_gear update
- Line 158: drone_sets update

Compare to delete rules (lines 132-135) which DO include scope validation.

## Solution Plan

### Todo Items
- [ ] Add scope validation to equipment update rule (line 119)
- [ ] Add scope validation to weapons update rule (line 131)
- [ ] Add scope validation to serialized_gear update rule (line 146)
- [ ] Add scope validation to drone_sets update rule (line 158)
- [ ] Deploy updated rules to Firebase
- [ ] Test team leader can reassign within their team on deployed site

## Changes to Make

For each equipment collection, change:
```
allow update: if hasPermission('equipment.update');
```

To:
```
allow update: if hasPermission('equipment.update') &&
  (isAdmin() || getUserScope() == 'global' ||
   (getUserScope() == 'division' && getUserDivision() != null &&
    (getUserDivision() == resource.data.division_name || getUserDivision() == resource.data.division)) ||
   (getUserScope() == 'team' && getUserDivision() != null && getUserTeam() != null &&
    (getUserDivision() == resource.data.division_name && getUserTeam() == resource.data.team_name)));
```

This matches the pattern used in delete rules and ensures team leaders can only update equipment in their division and team.

## Changes Made

### Frontend Permission Checks Fixed
- **Weapons.jsx:508** - Changed from `can_edit_weapons`/`can_transfer_equipment` to `equipment.update` OR `operations.transfer`
- **SerializedGear.jsx:410** - Changed from `operations.sign` to `equipment.update` OR `operations.transfer`
- **Drones.jsx:331** - Added `equipment.update` permission check

### Added team_name Field to Equipment
- **Weapons.jsx:536** - Now sets `team_name` when reassigning weapons
- **SerializedGear.jsx:424** - Now sets `team_name` when reassigning gear
- **Drones.jsx:340** - Now sets `team_name` when reassigning drone sets

### Firestore Rules Updated
- All equipment collections (equipment, weapons, serialized_gear, drone_sets) now check:
  - Division scope: Can update if equipment is in their division (current OR new)
  - Team scope: Can update if equipment is in their team (current OR new via `team_name` field)

## Next Steps
1. Build frontend: `npm run build`
2. Deploy all: `firebase deploy`
3. Test team leader can reassign equipment within their team

## Review
Team leaders can now reassign equipment because:
1. Frontend checks use correct permission names (`equipment.update` or `operations.transfer`)
2. Equipment now stores `team_name` field for team-based access control
3. Firestore rules validate team leaders can only modify equipment in their division/team
