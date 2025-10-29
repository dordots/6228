# Add Verification Timestamp to Daily Verification

## Date: 29 October 2025

## Problem

Currently, daily verification records only store the date but not the time of verification. Need to add timestamp to track exactly when each soldier was verified.

## Solution

1. Add timestamp field (`verification_timestamp`) to verification records
2. Display the time in the verification history screen

## Plan

- [ ] 1. Find and read the verification history screen file
- [ ] 2. Update DailyVerification.jsx to add timestamp when creating verification records
- [ ] 3. Update verification history screen to display the timestamp
- [ ] 4. Test the changes

---

# Previous: Fix Variable Declaration Order Error in Daily Verification

## Date: 29 October 2025

## Problem

Daily Verification page crashes with error:
```
ReferenceError: Cannot access 'verifiedSoldierIds' before initialization
    at DailyVerification.jsx:275
```

## Root Cause

Variable hoisting issue in [DailyVerification.jsx](src/pages/DailyVerification.jsx):
- Lines 273-279: `selectedUnverifiedCount` and `selectedVerifiedCount` useMemo hooks reference `verifiedSoldierIds` in their dependencies
- Line 281-283: `verifiedSoldierIds` is declared AFTER it's being used

This is a Temporal Dead Zone (TDZ) error where a variable is accessed before its declaration.

## Solution

Move the `verifiedSoldierIds` useMemo declaration above the two hooks that depend on it.

## Changes Made

- Fixed variable declaration order in [DailyVerification.jsx](src/pages/DailyVerification.jsx#L272-L283)

---

# Previous: Fix Division Manager Permission Error for Unassigned Item Deposit

## Date: 29 October 2025

## Problem

When division managers try to deposit unassigned items, they get a "Missing or insufficient permissions" error from Firestore, even though they have `equipment.update` permission and `scope: division`.

## Root Cause Found!

The issue is in `handleDepositUnassigned` function at line 283 of [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx#L283).

The update payload is:
```javascript
{ armory_status: 'in_deposit', assigned_to: null, deposit_location: depositLocation }
```

**The problem**: The payload doesn't include `division_name`, which causes it to be removed from the document during the update.

The Firestore security rule checks (lines 141-149 in firestore.rules):
```
getUserDivision() == resource.data.division_name ||
getUserDivision() == request.resource.data.division_name
```

Since `request.resource.data.division_name` becomes undefined after the update (because it's not in the payload), the security check fails!

## Solution

Preserve the `division_name` field in the update payload when depositing/releasing unassigned items. This is a simple one-line fix for each equipment type update.

## Plan

- [x] 1. Identify root cause - Update payload missing division_name
- [x] 2. Modify `handleDepositUnassigned` to preserve division_name in payload
- [x] 3. Modify `handleReleaseUnassigned` to preserve division_name in payload
- [x] 4. Test the fix

## Changes Made

### 1. Fixed `handleDepositUnassigned` function
**File:** [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx#L280-L336)

Modified to preserve `division_name` field in update payload:
- Fetch each item from `unassignedToDeposit` state before updating
- Include `division_name` in the payload to satisfy Firestore security rules

### 2. Fixed `handleReleaseUnassigned` function
**File:** [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx#L338-L392)

Applied same fix:
- Fetch each item from `unassignedInDeposit` state before updating
- Include `division_name` in the payload

## Review

**Problem**: Division managers got "Missing or insufficient permissions" error when depositing unassigned items.

**Root Cause**: Update payloads were missing `division_name` field. Firestore security rules check both old and new document's `division_name` to validate division scope access. Without it in the payload, the security check failed.

**Solution**: Preserve `division_name` from existing items in the update payload.

**Result**: Division managers can now successfully deposit and release unassigned items within their division. Tab refreshes automatically after operations complete.

---

# Previous: Armory Deposit/Release - Division Manager Access Complete

## Date: 29 October 2025

## Summary

Enabled full armory deposit/release functionality for division managers, scoped to their division only.

## Changes Made

### 1. Fixed Dialog Auto-Close and Refresh on Error
**File:** [ArmoryDeposit.jsx](src/pages/ArmoryDeposit.jsx#L270-L278)

**Problem:** After releasing equipment, if there was an error, the dialog wouldn't close an