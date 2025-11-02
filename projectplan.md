# Update Maintenance Status Options by Equipment Type

## Date: 2 November 2025

## Problem
The maintenance inspection form currently uses the same status options for all equipment types:
- functioning
- not functioning
- missing

However, different equipment types should have different status options:
- **Weapons and Gear**: functioning, not functioning, missing
- **Drones**: operational, maintenance, damaged, missing

## Solution
Update the MaintenanceInspectionForm component to show different status options based on the item type (weapon/gear vs drone).

## Todo Items
- [ ] Update the status dropdown in the inspection form to conditionally show options based on item type
- [ ] Update the getStatusBadge function to handle drone-specific statuses (operational, maintenance, damaged)
- [ ] Update the default status initialization based on item type
- [ ] Test that weapons/gear show: functioning, not functioning, missing
- [ ] Test that drones show: operational, maintenance, damaged, missing

## Implementation Details

### Changes to [MaintenanceInspectionForm.jsx](src/components/maintenance/MaintenanceInspectionForm.jsx)

1. **Line 81**: Update default status initialization to use 'functioning' for weapons/gear and 'operational' for drones
2. **Lines 95-112**: Update `getStatusBadge` function to include drone statuses (operational, maintenance, damaged)
3. **Lines 400-414**: Update the status Select component to conditionally render options based on `item.type`

## Review

**Changes Made:**

### [MaintenanceInspectionForm.jsx](src/components/maintenance/MaintenanceInspectionForm.jsx)

1. **Updated default status initialization** (line 81)
   - Changed from: Always use `'functioning'` as default
   - Changed to: Use `'operational'` for drones, `'functioning'` for weapons/gear
   - Code: `const defaultStatus = type === 'drone' ? 'operational' : 'functioning';`

2. **Updated getStatusBadge function** (lines 100-109)
   - Added drone-specific status configurations:
     - `operational`: Green badge (same as functioning)
     - `maintenance`: Yellow badge
     - `damaged`: Red badge (same as not functioning)
     - `missing`: Amber badge (shared with weapons/gear)

3. **Updated status dropdown** (lines 406-432)
   - Added conditional rendering based on `item.type`
   - **For drones**: Shows operational, maintenance, damaged, missing
   - **For weapons/gear**: Shows functioning, not functioning, missing
   - Updated default value to match item type

**Result:**
- Weapons and gear now show status options: functioning, not functioning, missing
- Drones now show status options: operational, maintenance, damaged, missing
- Each equipment type has appropriate default status when selected
- Status badges display correctly for all status types with appropriate colors

---

# Previous: Fix Drone Display Fields and Filter SAMPLE Items in Maintenance Form

## Date: 2 November 2025

## Problem
The MaintenanceInspectionForm component had multiple issues:
1. Reference error: `Drone is not defined` at line 302
2. Displaying wrong drone field name (`drone_set_type` instead of `set_type`)
3. SAMPLE items (weapons, gear, drones) should not appear in maintenance inspections

## Analysis
- **Error 1**: `ReferenceError: Drone is not defined` at line 302
- **Error 2**: Drone items showed wrong field - should use `set_type` (not `drone_set_type`) and `set_serial_number`
- **Error 3**: Items with IDs containing "SAMPLE" should be filtered out from all equipment lists

## Solution
1. Replace `<Drone>` with `<Plane>` at line 302
2. Update all drone display fields to use `set_type` instead of `drone_set_type`
3. Filter out SAMPLE items from weapons, gear, and drones
4. Update search filters to use correct fields

## Todo Items
- [x] Fix the icon reference at line 302 from `Drone` to `Plane`
- [x] Update renderDroneItem to display `set_type` and `set_serial_number`
- [x] Update getSelectedItemsDetails to use correct drone fields
- [x] Update filteredDrones search to filter by `set_type` and `set_serial_number`
- [x] Filter out SAMPLE weapons from filteredWeapons
- [x] Filter out SAMPLE gear from filteredGear
- [x] Filter out SAMPLE drones from filteredDrones
- [x] Update item counts to exclude SAMPLE items

## Changes Made

### [MaintenanceInspectionForm.jsx](src/components/maintenance/MaintenanceInspectionForm.jsx)

1. **Fixed Icon Import Error** (line 318)
   - Changed `<Drone>` to `<Plane>` to match existing imports

2. **Created Non-SAMPLE Filter Memos** (lines 20-33)
   - Added `nonSampleWeapons` - filters out weapons where `weapon_id` contains "SAMPLE"
   - Added `nonSampleGear` - filters out gear where `gear_id` contains "SAMPLE"
   - Added `nonSampleDrones` - filters out drones where `set_serial_number` contains "SAMPLE"
   - These are used as the base for all filtering and counting

3. **Updated Search Filters** (lines 35-63)
   - `filteredWeapons` now filters from `nonSampleWeapons` instead of `assignedWeapons`
   - `filteredGear` now filters from `nonSampleGear` instead of `assignedGear`
   - `filteredDrones` now filters from `nonSampleDrones` and uses `set_type` field

4. **Updated renderDroneItem function** (lines 179-180)
   - Changed from: `drone.drone_set_type`
   - Changed to: `drone.set_type` (correct field name)

5. **Updated getSelectedItemsDetails** (lines 226-227)
   - Changed from: `name: drone.drone_set_type`
   - Changed to: `name: drone.set_type`

6. **Updated Item Counts**
   - Line 236: `totalItems` now counts only non-SAMPLE items
   - Line 262: Changed condition from `assignedWeapons.length > 0` to `nonSampleWeapons.length > 0`
   - Line 267: Count display shows `({filteredWeapons.length} of {nonSampleWeapons.length})`
   - Line 288: Changed condition from `assignedGear.length > 0` to `nonSampleGear.length > 0`
   - Line 293: Count display shows `({filteredGear.length} of {nonSampleGear.length})`
   - Line 314: Changed condition from `assignedDrones.length > 0` to `nonSampleDrones.length > 0`
   - Line 319: Count display shows `({filteredDrones.length} of {nonSampleDrones.length})`

## Review
**Problem**: MaintenanceInspectionForm crashed, displayed incorrect drone fields, showed SAMPLE equipment items, and counted SAMPLE items in totals.

**Solution**:
- Fixed undefined `Drone` icon reference by using `Plane` instead
- Updated all drone display fields to use `set_type` (the correct field name) and `set_serial_number`
- Created separate memos for non-SAMPLE items (`nonSampleWeapons`, `nonSampleGear`, `nonSampleDrones`)
- Updated search functionality to filter from non-SAMPLE items
- Updated all item counts and conditional rendering to use non-SAMPLE counts

**Result**: The component now:
- Renders correctly without errors
- Displays drone information using the correct `set_type` field (e.g., "Evo", "Matrice")
- Filters out all SAMPLE equipment items from the maintenance inspection lists
- Shows accurate counts that exclude SAMPLE items (e.g., "5 of 8" instead of "5 of 10" when 2 are SAMPLE)
- Only displays equipment sections that have non-SAMPLE items
- Matches the pattern used for weapons (type + ID) and gear (type + ID)

---

# Previous: Maintenance Screen Redesign with Checkbox Selection

## Date: 2 November 2025

## Overview
Redesign the maintenance screen with:
1. **Two Tabs**: "Inspect by Soldier" and "Inspect Unassigned"
2. **Search Functionality**: Separate search bars for weapons and gear
3. **Checkbox Selection**: Select multiple items to inspect at once
4. **Sticky Inspection Form**: Bottom form appears when items are selected, allowing bulk status updates

## Todo Items
- [x] Import Tabs components into Maintenance.jsx
- [x] Create two-tab structure (Inspect by Soldier, Inspect Unassigned)
- [x] Add search bars for weapons and gear in both tabs
- [x] Add checkbox selection for equipment items
- [x] Create sticky bottom inspection form for selected items
- [x] Update inspection submission logic
- [x] Test both tabs and new workflow
- [x] Verify all functionality works correctly

## Implementation Details

### Changes to Maintenance.jsx
- Import `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` from "@/components/ui/tabs"
- Add `unassignedWeapons` and `unassignedGear` memos to filter equipment without assignments
- Create two tab sections:
  - "Inspect by Soldier": Search and select soldier, then inspect their equipment
  - "Inspect Unassigned": Directly inspect all unassigned weapons and gear
- Both tabs use the redesigned `MaintenanceInspectionForm` component

### Complete Rewrite of MaintenanceInspectionForm.jsx
- **Search Functionality**: Added separate search bars for weapons and gear with filtering
- **Checkbox Selection**: Items can be selected individually or by clicking the entire card
- **Visual Feedback**: Selected items highlight with blue background
- **Sticky Inspection Form**: Bottom form appears when items are selected
  - Shows count of selected items
  - Dropdown for status (functioning/not functioning/missing)
  - Comments field for optional notes
  - Submit button to apply status to all selected items
- **Batch Updates**: Single form updates all selected items at once
- Removed signature requirement (simplified workflow)
- Removed per-item radio buttons (replaced with batch selection + form)

### UI/UX Improvements
- Clean, modern card-based layout for equipment items
- Search bars positioned next to section headers
- Clickable equipment cards with visual selection state
- Sticky bottom form stays visible while scrolling
- Status dropdown matches the example with functioning/not functioning/missing options

## Review

### Implementation Complete

**Changes Made:**

#### [Maintenance.jsx](src/pages/Maintenance.jsx)
1. Added Tabs component imports
2. Added `unassignedWeapons` and `unassignedGear` memos
3. Two-tab structure:
   - **"Inspect by Soldier"** - Search soldier, inspect their equipment
   - **"Inspect Unassigned"** - Inspect unassigned equipment directly

#### [MaintenanceInspectionForm.jsx](src/components/maintenance/MaintenanceInspectionForm.jsx) - Complete Rewrite
1. **Search Features**:
   - Separate search bars for weapons and gear
   - Real-time filtering using `useMemo`
   - Search by type or ID

2. **Selection System**:
   - Checkbox on each item
   - Clickable cards toggle selection
   - Visual feedback with blue highlight
   - Tracks selected items with Set data structure

3. **Sticky Inspection Form**:
   - Appears at bottom when items selected
   - Shows count of selected items
   - Status dropdown (functioning/not functioning/missing)
   - Comments input field
   - Single submit updates all selected items

4. **Simplified Workflow**:
   - No signature required
   - No per-item status selection
   - Batch processing of multiple items
   - Form resets after submission

**Key Implementation Details:**
- Used `useMemo` for efficient search filtering
- Set data structure for O(1) selection lookups
- Sticky positioning (`sticky bottom-6`) for inspection form
- Grid layout matching the provided example
- Status options exactly as specified: functioning, not functioning, missing
- Total rewrite: ~250 lines in MaintenanceInspectionForm.jsx

**Result:**
The maintenance screen now provides a modern, efficient workflow:
1. **Search**: Find specific equipment quickly
2. **Select**: Choose multiple items with checkboxes
3. **Inspect**: Update status for all selected items at once
4. **Submit**: Batch processing reduces repetitive actions

This approach is much faster than the previous per-item inspection method, especially when inspecting many items with the same status.
