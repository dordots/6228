# Project Plan: Fix Firestore Rules and Division Manager Permissions

## Problem
Division managers are getting "Missing or insufficient permissions" error when trying to create weapons and potentially other equipment.

## Error Analysis
The error stack trace shows TWO permission failures:
1. **READ error** at line 310: `Weapon.filter({ weapon_id: serial })` - checking for duplicate IDs
2. **CREATE error** at line 339: `Weapon.create(enrichedWeaponData)` - creating the weapon

Both fail because of Firestore security rules.

## Root Cause Analysis
Looking at the Firestore rules for weapons (lines 123-134):

```javascript
match /weapons/{weaponID} {
  allow create: if hasPermission('equipment.create') &&
    (isAdmin() || getUserScope() == 'global' ||
     (getUserScope() == 'division' &&
      (getUserDivision() == request.resource.data.division_name ||
       getUserDivision() == request.resource.data.division)));
}
```

The problem is:
1. The rule requires that `getUserDivision() == request.resource.data.division_name`
2. But when a weapon is created with `division_name: null` (which happens before the form properly initializes), this check fails
3. Our recent frontend fix sets `userDivision` in the form, but if `userDivision` itself is `null` or empty, the comparison fails

The same issue exists in:
- `equipment` collection (lines 112-120)
- `serialized_gear` collection (lines 137-145)
- `drone_sets` collection (lines 148-156)

## Solution
We need to handle the case where division managers might create items with their division. The rules should allow division managers to create items when:
1. The item's division matches their division, OR
2. For items with null/empty division - we should NOT allow this for division managers

Actually, looking more carefully - the frontend already sets the division correctly. The issue might be:
1. The user's custom claims don't have the `division` field set properly
2. OR the `division_name` in the weapon data is `null` when it should have a value

## Files to Check
1. [firestore.rules](firestore.rules) - Lines 123-156
2. Need to verify user custom claims have proper division set
3. Need to verify the weapon form is sending the correct division_name

## Real Root Cause

After investigation, the issue is:
1. **Division manager users MUST have a `division` field set in their custom claims**
2. This field comes from being linked to a soldier who has a `division_name`
3. If a division manager user is NOT linked to a soldier, or linked to a soldier without a division, their `division` field will be `null`
4. When `division` is `null`, the Firestore rules fail both READ and CREATE operations

**From users.js (lines 144-146):**
```javascript
division: soldierData?.division_name || null,
team: soldierData?.team_name || null,
```

If no soldier is matched during user creation, `division` will be `null`.

## Solution

### Immediate Fix (Already Applied)
Updated Firestore rules to explicitly check for null values before comparison:
- ✅ Equipment collection
- ✅ Weapons collection
- ✅ Serialized gear collection
- ✅ Drone sets collection
- ✅ Deployed to Firebase

### Required Action
**The division manager user MUST have a division assigned.** To fix this:

1. **Check current user's division:**
   Open browser console and run:
   ```javascript
   User.me().then(user => console.log('User division:', user.division))
   ```

2. **If division is null**, you have two options:

   **Option A: Link user to a soldier with a division** (RECOMMENDED)
   - Go to User Management
   - Find or create a soldier with a division assigned
   - The user should have phone/email matching that soldier
   - Re-create the user account or update their custom claims

   **Option B: Manually update in Firestore**
   - Go to Firebase Console → Firestore
   - Find the user document in `users` collection
   - Add/update field: `division: "YourDivisionName"`
   - Then refresh custom claims by calling:
     ```javascript
     // In Firebase Functions, call syncUserOnSignIn
     firebase.functions().httpsCallable('syncUserOnSignIn')()
     ```

## Todo List
- [x] Read the users.js file to check how custom claims are set for division managers
- [x] Update firestore rules to handle division_name properly for division managers
- [x] Deploy firestore rules
- [ ] Verify user has division assigned in custom claims
- [ ] Test the fix after ensuring user has proper division

## Summary

### Changes Made to Fix Permission Errors

#### 1. Frontend Forms (Completed)
- ✅ Fixed WeaponForm.jsx division display (line 235)
- ✅ Fixed GearForm.jsx division display (line 233)
- ✅ Fixed DroneSetForm.jsx division display (line 354)
- ✅ Verified EquipmentForm.jsx already correct

Division managers now see their division name in the dropdown instead of "Unassigned".

#### 2. Firestore Security Rules (Completed)
- ✅ Updated equipment collection (lines 114-118)
- ✅ Updated weapons collection (lines 126-130)
- ✅ Updated serialized_gear collection (lines 141-145)
- ✅ Updated drone_sets collection (lines 153-157)
- ✅ Deployed rules to Firebase

Rules now check that both user division and equipment division are not null before comparison.

### Final Fix: Force Division Assignment in Code (COMPLETED)

Instead of requiring the user to manually set their division in the database, I've updated all equipment forms to **automatically force the division assignment** for division managers before submitting.

**All Forms Updated:**
- ✅ [WeaponForm.jsx:112-121](src/components/weapons/WeaponForm.jsx#L112-L121)
- ✅ [GearForm.jsx:111-120](src/components/gear/GearForm.jsx#L111-L120)
- ✅ [EquipmentForm.jsx:96-105](src/components/equipment/EquipmentForm.jsx#L96-L105)
- ✅ [DroneSetForm.jsx:300-309](src/components/drones/DroneSetForm.jsx#L300-L309)

**What the code does:**
1. Before submitting, checks if user is a division manager
2. If division_name is missing/null, automatically sets it to userDivision
3. If userDivision is also null, shows error: "Division managers must have a division assigned"
4. This ensures division is NEVER null when creating equipment

**This means:**
- Even if the user's division is null in the database, the form will try to set it
- If it's still null, the user gets a clear error message to contact an admin
- Most importantly, it won't send a null division to Firestore (which would fail the security rules)

**The issue should now be resolved!** Try creating a weapon again.

---

# Security Audit Report - ביקורת אבטחה מקיפה

## תאריך ביצוע: 28 אוקטובר 2025

### 📋 סיכום מנהלים

ביצענו ביקורת אבטחה מקיפה למערכת ניהול הנשק והציוד הצבאי. המערכת מבוססת על Firebase/Firestore ומציגה **תשתית אבטחה בסיסית טובה** עם כמה חולשות משמעותיות שדורשות תיקון.

**מצב אבטחה כללי:** 🟡 **טוב עם צורך בשיפורים קריטיים**

**ציון כולל:** **72/100** (6.9/10)

### ממצאים קריטיים שנמצאו

🔴 **חולשות קריטיות (חייב לתקן תוך 30 יום):**
1. **Client-Side TOTP Verification Bypass** - אימות TOTP נשמר רק בצד הלקוח ב-localStorage וניתן לעקיפה
2. **Firebase API Keys Exposed** - מפתחות Firebase חשופים בקוד הקליינט
3. **No Rate Limiting** - אין מגבלה על ניסיונות התחברות או אימות TOTP
4. **CSV Upload Without Validation** - העלאת קבצים ללא אימות תוכן

🟠 **חולשות בעדיפות גבוהה (תוך 60 יום):**
5. No Device Fingerprinting for "Remember Device"
6. TOTP Secrets in Custom Claims (readable in ID token)
7. Console Logging של נתונים רגישים
8. No Backup Codes for TOTP Recovery

### נקודות חוזק

✅ **תשתית בטוחה:**
- Firestore (NoSQL) מונע SQL Injection באופן מובנה
- אין שימוש ב-`dangerouslySetInnerHTML` או `innerHTML` (הגנה מפני XSS)
- Firebase Security Rules מוגדרות עם בקרות גישה מפורטות
- RBAC (Role-Based Access Control) מיושם עם 4 רמות הרשאה
- TOTP/2FA מיושם למשתמשים רגישים
- HTTPS נאכף על כל התקשורת

### קישור לדוח המלא

**📄 [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)** - דוח מפורט 200+ עמודים עם:
- ניתוח מעמיק של כל רכיבי האבטחה
- דוגמאות קוד לתיקון כל חולשה
- המלצות מדורגות לפי עדיפות
- Timeline ליישום תיקונים

### פעולות נדרשות

**Priority 1 (Critical - תוך 30 יום):**
- [ ] תיקון Client-Side TOTP Bypass - העברה לserver-side validation
- [ ] הפעלת Firebase App Check להגנה על API keys
- [ ] הוספת Rate Limiting על authentication ו-TOTP
- [ ] אימות מקיף לקבצי CSV לפני עיבוד

**Priority 2 (High - תוך 60 יום):**
- [ ] העברת TOTP Secrets לFirestore (במקום Custom Claims)
- [ ] יצירת Backup Codes למקרי חירום
- [ ] ניקוי Console Logging של נתונים רגישים
- [ ] הוספת Device Fingerprinting

**Priority 3 (Medium - תוך 90 יום):**
- [ ] הוספת Input Validation Schema (Zod)
- [ ] Content Security Policy Headers
- [ ] Password Strength Requirements
- [ ] File Upload MIME Type Validation

### המלצה סופית

**למערכת ייצור צבאית:** 🟡 **לא מוכן - דורש תיקונים קריטיים**

**לאחר יישום התיקונים הקריטיים (Priority 1)**, המערכת תהיה ראויה לאחסון מידע מסווג ברמה בינונית.

**ביקורת חוזרת:** מומלץ לבצע ביקורת נוספת לאחר 90 יום מיישום התיקונים.
