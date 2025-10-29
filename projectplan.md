# Fix Unassigned Deposit Tab - Complete

## Date: 29 October 2025

## Changes Made

### 1. Fixed Unassigned Filter to Include Empty String
**File:** [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx)

**Problem:** Items with `assigned_to: ""` (empty string) were not being shown in the "Deposit Unassigned" tab because the filter only checked for `assigned_to: null`.

**Solution:**
- Changed from Firestore filter `assigned_to: null` to fetching by `armory_status` only
- Filter client-side for unassigned items: `!item.assigned_to || item.assigned_to === null || item.assigned_to === ''`

**Lines Changed:** 93-100 (team leader section) and 153-160 (admin/manager section)

---

### 2. Added Sample Data Exclusion
**File:** [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx)

**Problem:** Sample/test items were appearing in the unassigned deposit list.

**Solution:** Added `!item.is_sample` check to filter function:
```javascript
const isUnassigned = (item) =>
  (!item.assigned_to || item.assigned_to === null || item.assigned_to === '')
  && !item.is_sample;
```

**Lines Changed:** 94 and 154

---

### 3. Added Search Bar to Unassigned Deposit Tab
**File:** [UnassignedDepositTab.jsx](src/components/armory/UnassignedDepositTab.jsx)

**Added:**
1. Search input with icon (lines 163-171)
2. Search state management (line 54)
3. Filtering logic using `useMemo` (lines 117-143):
   - Weapons: searches `weapon_id` and `weapon_type`
   - Gear: searches `gear_id` and `gear_type`
   - Drones: searches `set_serial_number` and `set_type`
4. Updated tab counts to show filtered results (lines 176, 179, 182)
5. Updated lists to use filtered arrays (lines 187, 192, 197)

**Features:**
- Real-time filtering as you type
- Case-insensitive search
- Searches both ID and type fields
- Works across all three tabs (Weapons, Gear, Drones)

---

## Summary

The "Deposit Unassigned" tab now:
- ✅ Shows items with `assigned_to: null` OR `assigned_to: ""`
- ✅ Shows items with `armory_status: 'with_soldier'`
- ✅ Excludes sample/test items (`is_sample: true`)
- ✅ Has a search bar to filter by ID or type
- ✅ Displays accurate counts in tab headers

## Testing

To test the changes:
1. Navigate to Armory Deposit page as admin
2. Click "Deposit Unassigned" tab
3. Verify you see all unassigned items with `armory_status: 'with_soldier'`
4. Verify sample items are NOT shown
5. Use search bar to filter by weapon ID (e.g., "M4-001")
6. Use search bar to filter by type (e.g., "M4 Rifle")
7. Verify tab counts update with filtered results
