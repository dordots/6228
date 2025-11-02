# Remove English from Email Text (Signing and Release Forms)

## Date: 2 November 2025

## Objective
Remove all English text from the email body (HTML content) for both signing and release forms. Keep only Hebrew text. This does NOT affect the PDF attachment, only the email message body.

## Files to Modify
1. `functions/src/forms.js` - Backend email generation for signing and release forms

## Tasks

### Task 1: Update Signing Form Email (sendSigningFormByActivity function)
- [ ] Remove English from subject line
- [ ] Remove English email body content (lines 644-651)
- [ ] Keep only Hebrew text in the email HTML

**Location:** `functions/src/forms.js` lines 636-653

**Current:**
```javascript
subject: `טופס חתימה על ציוד - Equipment Assignment Form - ${soldier.first_name} ${soldier.last_name}`,
html: `
  <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>טופס חתימה על ציוד</h2>
    <h3>Equipment Assignment Form</h3>
    <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
    <p>Dear ${soldier.first_name} ${soldier.last_name},</p>
    <p>מצורף טופס חתימה על ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
    <p>Please find attached your equipment signing form. Please save this file for your records.</p>
    <hr>
    <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
    <p><small>This email was sent automatically by the Armory Management System</small></p>
  </div>
`,
```

**Target:**
```javascript
subject: `טופס חתימה על ציוד - ${soldier.first_name} ${soldier.last_name}`,
html: `
  <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>טופס חתימה על ציוד</h2>
    <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
    <p>מצורף טופס חתימה על ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
    <hr>
    <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
  </div>
`,
```

### Task 2: Update Release Form Email (sendReleaseFormByActivity function)
- [ ] Remove English from subject line
- [ ] Remove English email body content (lines 965-975)
- [ ] Keep only Hebrew text in the email HTML

**Location:** `functions/src/forms.js` lines 960-976

**Current:**
```javascript
subject: `טופס שחרור ציוד - Equipment Release Form - ${soldier.first_name} ${soldier.last_name}`,
html: `
  <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>טופס שחרור ציוד</h2>
    <h3>Equipment Release Form</h3>
    <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
    <p>Dear ${soldier.first_name} ${soldier.last_name},</p>
    <p>מצורף טופס שחרור ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
    <p>Please find attached your equipment release form. Please save this file for your records.</p>
    <hr>
    <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
    <p><small>This email was sent automatically by the Armory Management System</small></p>
  </div>
`,
```

**Target:**
```javascript
subject: `טופס שחרור ציוד - ${soldier.first_name} ${soldier.last_name}`,
html: `
  <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>טופס שחרור ציוד</h2>
    <p>שלום ${soldier.first_name} ${soldier.last_name},</p>
    <p>מצורף טופס שחרור ציוד. אנא שמור/י את הקובץ לעיון עתידי.</p>
    <hr>
    <p><small>מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה</small></p>
  </div>
`,
```

## Summary of Changes
- Remove all English text from email subject lines
- Remove all English headings and paragraphs from email HTML bodies
- Keep only Hebrew text for a cleaner, more localized experience
- PDF attachments remain bilingual (Hebrew + English headers as currently implemented)

## Impact
- **Minimal**: Only affects the email message body text
- **No breaking changes**: Email structure and PDFs remain the same
- **Users**: Will receive Hebrew-only emails with bilingual PDFs attached

## Review

### Changes Made

**File Modified:** [functions/src/forms.js](functions/src/forms.js)

#### 1. Signing Form Email (sendSigningFormByActivity function) - Lines 637-649
**Changed:**
- Subject line: Removed `" - Equipment Assignment Form"`
- Email HTML body: Removed all English text including:
  - `<h3>Equipment Assignment Form</h3>`
  - `<p>Dear ${soldier.first_name} ${soldier.last_name},</p>`
  - `<p>Please find attached your equipment signing form. Please save this file for your records.</p>`
  - `<p><small>This email was sent automatically by the Armory Management System</small></p>`

**Kept:**
- Hebrew subject: `טופס חתימה על ציוד - ${soldier.first_name} ${soldier.last_name}`
- Hebrew greeting: `שלום ${soldier.first_name} ${soldier.last_name},`
- Hebrew body: `מצורף טופס חתימה על ציוד. אנא שמור/י את הקובץ לעיון עתידי.`
- Hebrew footer: `מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה`

#### 2. Release Form Email (sendReleaseFormByActivity function) - Lines 956-968
**Changed:**
- Subject line: Removed `" - Equipment Release Form"`
- Email HTML body: Removed all English text including:
  - `<h3>Equipment Release Form</h3>`
  - `<p>Dear ${soldier.first_name} ${soldier.last_name},</p>`
  - `<p>Please find attached your equipment release form. Please save this file for your records.</p>`
  - `<p><small>This email was sent automatically by the Armory Management System</small></p>`

**Kept:**
- Hebrew subject: `טופס שחרור ציוד - ${soldier.first_name} ${soldier.last_name}`
- Hebrew greeting: `שלום ${soldier.first_name} ${soldier.last_name},`
- Hebrew body: `מצורף טופס שחרור ציוד. אנא שמור/י את הקובץ לעיון עתידי.`
- Hebrew footer: `מייל זה נשלח אוטומטית ממערכת ניהול הנשקייה`

### Result
- Email subjects are now Hebrew-only with soldier names
- Email body text is now 100% Hebrew
- PDF attachments remain bilingual (unchanged)
- Cleaner, more localized email experience for Hebrew-speaking users
- No functional changes - emails still send correctly with PDF attachments

---

# Previous: Update Weapons Page Filter UI to Popover Dialog

## Date: 2 November 2025

## Problem
The current weapons page filter UI displays all filters in a horizontal inline layout using ComboBox and Select components. This takes up significant space and can be cluttered. The desired UX is to have a single "Filter" button that opens a popover dialog containing all filter options in a clean vertical layout.

## Solution
Replace the inline filter layout with:
1. A single "Filter" button with a badge showing active filter count
2. A popover dialog that opens when the button is clicked
3. Vertical layout of all filter options inside the popover
4. "Clear all" button to reset all filters
5. Multi-select capabilities for filters where applicable

## Todo Items
- [ ] Read current WeaponFilters component to understand structure
- [ ] Create new popover-based filter UI with vertical layout
- [ ] Add 'Clear all' functionality to reset filters
- [ ] Add multi-select capability for filter options
- [ ] Update Weapons.jsx to use new filter button
- [ ] Test the new filter functionality

## Implementation Details

### Changes to [WeaponFilters.jsx](src/components/weapons/WeaponFilters.jsx)

1. Replace horizontal inline layout with Popover component
2. Add Filter button trigger with badge showing active filter count
3. Create vertical layout inside popover with:
   - Header with "Filter Weapons" title
   - "Clear all" button
   - Weapon Type (multi-select)
   - Condition (multi-select)
   - Division (multi-select)
   - Armory Status (multi-select)
   - Assigned Soldier (multi-select)
   - Maintenance Check dropdown
   - Last Checked Date Range (date pickers)

4. Update filter state to support multiple selections per filter category

### Changes to [Weapons.jsx](src/pages/Weapons.jsx)

1. Update filter state structure to support arrays for multi-select filters
2. Update filteredWeapons logic to handle array-based filters
3. Adjust layout to accommodate new filter button positioning

## Review

**Changes Made:**

### [WeaponFilters.jsx](src/components/weapons/WeaponFilters.jsx) - Complete Rewrite

1. **Replaced inline horizontal layout with Popover UI**
   - Changed from horizontal row of ComboBox/Select components
   - Now uses a single "Filters" button that opens a popover dialog

2. **Added MultiSelectButton component**
   - Custom component for multi-select functionality
   - Shows checkboxes for each option
   - Displays count of selected items (e.g., "3 selected")
   - Individual popover for each filter category

3. **Implemented new filter structure**
   - **Weapon Type**: Multi-select with checkboxes
   - **Condition**: Multi-select (Functioning, Not Functioning)
   - **Division**: Multi-select with all available divisions
   - **Armory Status**: Multi-select (With Soldier, In Deposit)
   - **Assigned Soldier**: Multi-select with soldier list + unassigned option
   - **Maintenance Check**: Single select dropdown (All, Checked, Not Checked, Overdue)
   - **Date Range**: Placeholder for future implementation

4. **Added active filter count badge**
   - Red badge on Filter button showing number of active filters
   - Automatically calculates based on all filter selections

5. **Added "Clear all" functionality**
   - Button in popover header to reset all filters at once
   - Returns filters to default empty state

### [Weapons.jsx](src/pages/Weapons.jsx)

1. **Updated filter state structure** (lines 41-50)
   - Changed from single-value filters to array-based multi-select:
     - `type` → `types: []`
     - `condition` → `conditions: []`
     - `division` → `divisions: []`
     - `armory_status` → `armory_statuses: []`
     - `assigned_to` → `assigned_soldiers: []`
   - Added: `maintenance_check`, `date_from`, `date_to`

2. **Updated URL parameter handling** (line 76)
   - Changed from `type: typeFilter` to `types: [typeFilter]` to support new array structure

3. **Rewrote filteredWeapons logic** (lines 596-633)
   - Multi-select filters: Show all if array is empty, otherwise match if value is in array
   - Added maintenance check filter logic
   - Cleaner, more modular filter conditions

4. **Updated debug logging** (lines 587-595)
   - Changed to show count of selected items per filter category
   - Removed old single-value filter debug code

**Result:**
- Clean, compact filter UI with single button instead of horizontal row
- Multi-select capability for all major filter categories
- Active filter count badge for quick visibility
- "Clear all" functionality for easy filter reset
- Vertical layout in popover for better UX and space efficiency
- Maintains all original filtering functionality with enhanced multi-select capabilities

### Additional Updates - Date Range Implementation and Scrolling

**Changes Made:**

1. **Added scrolling to filter dialog** ([WeaponFilters.jsx](src/components/weapons/WeaponFilters.jsx))
   - Fixed header at top of popover with border
   - Filter options section now scrollable with `max-h-96 overflow-y-auto`
   - Prevents dialog from growing too large on smaller screens

2. **Implemented Last Checked Date Range pickers** ([WeaponFilters.jsx](src/components/weapons/WeaponFilters.jsx))
   - Added Calendar component import from ui/calendar
   - Added date-fns format function for date display
   - Two calendar popovers: "From" and "To" date pickers
   - Shows formatted date when selected (e.g., "January 1, 2025")
   - Calendar icon on buttons for visual clarity

3. **Added date range filter logic** ([Weapons.jsx](src/pages/Weapons.jsx) lines 632-658)
   - Filters weapons based on `last_checked_date` field
   - **Both dates**: Shows weapons checked between from and to dates (inclusive)
   - **From date only**: Shows weapons checked on or after from date
   - **To date only**: Shows weapons checked on or before to date
   - **No date filters**: Shows all weapons (default behavior)
   - Excludes weapons without `last_checked_date` when date filters are active

**Result:**
- Full date range filtering functionality implemented
- Scrollable filter dialog prevents overflow on small screens
- Fixed header keeps "Clear all" button always visible
- Flexible date filtering supports both single and range date selections

---

# Previous: Update Maintenance Status Options by Equipment Type

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
