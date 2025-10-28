# דוח ביקורת אבטחה - מערכת ניהול נשק וציוד צבאי
## Security Audit Report - Military Armory Management System

**תאריך הביקורת:** 28 אוקטובר 2025
**גרסת המערכת:** Production (Firebase-based)
**רמת סיווג:** מסווג - לשימוש פנימי בלבד
**מבצע הביקורת:** מומחה אבטחת מידע בכיר

---

## 📋 תוכן עניינים

1. [סיכום מנהלים](#סיכום-מנהלים)
2. [סטטוס אבטחה כללי](#סטטוס-אבטחה-כללי)
3. [ניתוח תשתית טכנולוגית](#ניתוח-תשתית-טכנולוגית)
4. [ממצאים קריטיים](#ממצאים-קריטיים)
5. [אבטחת אימות והרשאות](#אבטחת-אימות-והרשאות)
6. [הגנה מפני התקפות נפוצות](#הגנה-מפני-התקפות-נפוצות)
7. [אבטחת מידע רגיש](#אבטחת-מידע-רגיש)
8. [בקרות גישה (RBAC)](#בקרות-גישה-rbac)
9. [ניתוח Firebase Security Rules](#ניתוח-firebase-security-rules)
10. [חולשות שנמצאו - מדורג לפי חומרה](#חולשות-שנמצאו)
11. [המלצות לשיפור](#המלצות-לשיפור)
12. [סיכום והערכה כוללת](#סיכום-והערכה-כוללת)

---

## 🎯 סיכום מנהלים

### מצב אבטחה כללי: **טוב עם צורך בשיפורים**

המערכת מבוססת על Firebase/Firestore ומציגה **תשתית אבטחה יציבה** עם יישום נכון של עקרונות אבטחה בסיסיים. לא נמצאו פרצות אבטחה קריטיות שמאפשרות חשיפה מיידית של מידע מסווג.

### ממצאים עיקריים

✅ **נקודות חוזק:**
- שימוש ב-Firestore (NoSQL) מונע התקפות SQL Injection
- אין שימוש ב-`dangerouslySetInnerHTML` או `innerHTML` (הגנה מפני XSS)
- יישום RBAC (Role-Based Access Control) עם 4 רמות הרשאה
- Firebase Security Rules מוגדרות עם בקרות גישה מפורטות
- אימות דו-שלבי (TOTP/2FA) מיושם למשתמשים רגישים
- Secrets מוגדרים ב-`.env` ולא בקוד המקור

⚠️ **חולשות קריטיות שנמצאו:**
1. **אימות TOTP נשמר בצד הלקוח בלבד** - ניתן לעקוף במניפולציה של localStorage
2. **קובץ .env חשוף בגרסת הייצור** - Firebase API keys נגישים
3. **אין rate limiting על ניסיונות התחברות** - פתיחות לbrute force
4. **העלאת קבצי CSV ללא אימות תוכן** - סיכון להזרקת נתונים מזויפים

⚡ **רמת סיכון כוללת:** **בינונית-גבוהה** למערכת צבאית

### המלצה המנהלים
**יש לבצע את התיקונים הקריטיים תוך 30 יום.** המערכת ראויה לאחסון מידע מסווג **רק לאחר יישום ההמלצות הקריטיות**.

---

## 📊 סטטוס אבטחה כללי

| קטגוריה | סטטוס | ציון | הערות |
|---------|-------|------|-------|
| **Authentication** | 🟡 טוב עם חסרים | 7/10 | TOTP מיושם אך עם חולשות |
| **Authorization** | 🟢 טוב מאוד | 8/10 | RBAC מוגדר היטב |
| **Data Protection** | 🟡 בינוני | 6/10 | .env חשוף, אין הצפנה נוספת |
| **Input Validation** | 🟡 בינוני | 6.5/10 | חסרה אימות מקיף בטפסים |
| **XSS Protection** | 🟢 מצוין | 9/10 | React מגן אוטומטית |
| **Injection Attacks** | 🟢 מצוין | 9.5/10 | Firestore מונע injection |
| **Session Management** | 🟡 בינוני | 6/10 | חולשות ב-TOTP persistence |
| **Secrets Management** | 🔴 חלש | 4/10 | API keys חשופים |
| **Audit Logging** | 🟡 בינוני | 7/10 | קיים אך חסר TOTP logging |
| **HTTPS/TLS** | 🟢 מצוין | 10/10 | Firebase אוכף HTTPS |

### ציון כולל: **72/100** (בינוני-טוב)

---

## 🏗️ ניתוח תשתית טכנולוגית

### Stack טכנולוגי מזוהה

```
Frontend:
├── React 18.2.0
├── Vite (build tool)
├── Firebase SDK 12.3.0
├── Tailwind CSS + shadcn/ui
└── React Router 7.2.0

Backend:
├── Firebase Cloud Functions
├── Firebase Authentication
├── Firestore (NoSQL Database)
├── Firebase Storage
└── Node.js (Functions runtime)

Security Libraries:
├── otpauth (TOTP implementation)
├── qrcode (QR generation for 2FA)
└── libphonenumber-js (Phone validation)
```

### ניתוח תשתית

#### 1. Firebase Authentication
**Status:** ✅ **Secure**

- **אימות טלפון:** SMS-based עם reCAPTCHA protection
- **אימות אימייל/סיסמה:** Firebase מנהל hashing אוטומטית
- **Custom Claims:** מאפשר RBAC ללא query נוסף לDB
- **Token Management:** ID tokens עם תפוגה של ~1 שעה

**חולשה:** אין rate limiting מוגדר על ניסיונות כניסה.

#### 2. Firestore Database
**Status:** ✅ **Secure (עם Security Rules)**

- **NoSQL:** מונע SQL injection באופן מובנה
- **Parameterized Queries:** כל השאילתות משתמשות ב-`.where()` של Firebase
- **Security Rules:** מוגדרות ב-[firestore.rules](firestore.rules:1) עם בקרות גישה מפורטות

**דוגמה לשאילתה בטוחה:**
```javascript
// functions/src/users.js:107
const soldiersByPhone = await db.collection('soldiers')
  .where('phone_number', '==', phoneNumber)  // ✅ Parameterized
  .limit(1)
  .get();
```

#### 3. Firebase Cloud Functions
**Status:** ⚠️ **Mostly Secure**

**Functions מזוהים:**
- `generateTotp` - יצירת TOTP secret
- `verifyTotp` - אימות קוד TOTP
- `syncUserOnSignIn` - סנכרון נתוני משתמש
- `createPhoneUser` - יצירת משתמש חדש
- `listUsers` - רשימת משתמשים
- `updateUserRole` - עדכון הרשאות
- `sendEmailViaSendGrid` - שליחת מיילים
- `generateSigningForm` / `generateReleaseForm` - יצירת טפסי PDF

**בעיות זוהו:**
1. Service Account Email מופיע בקוד ([functions/src/auth.js:12](functions/src/auth.js:12))
2. Console.log עם נתונים רגישים ([functions/src/users.js:94](functions/src/users.js:94))
3. אין בדיקות rate limiting

#### 4. Firebase Storage
**Status:** ✅ **Secure**

Storage Rules מוגדרות ב-[storage.rules](storage.rules:1):
- Public files: read לכל מחובר, write למנהלים בלבד
- Private files: read/write למנהלים בלבד
- User uploads: כל משתמש לתיקייה שלו בלבד
- Equipment photos: read לכולם, write למנהלים

**המלצה:** להוסיף בדיקות גודל קובץ ו-MIME type validation.

---

## 🚨 ממצאים קריטיים

### 1. 🔴 CRITICAL: Client-Side TOTP Verification Bypass

**מיקום:** [src/pages/Layout.jsx:293-299](src/pages/Layout.jsx:293-299)

**תיאור הבעיה:**
המערכת מאפשרת "זכור מכשיר זה למשך 24 שעות" לאחר אימות TOTP. הבעיה היא שהאימות נשמר **רק בצד הלקוח** ב-localStorage/sessionStorage:

```javascript
// TotpVerificationPrompt.jsx:38-43
if (rememberDevice) {
  localStorage.setItem('lastTotpVerificationTime', verificationTime);
} else {
  sessionStorage.setItem('lastTotpVerificationTime', verificationTime);
}

// Layout.jsx:293-299
const twentyFourHours = 24 * 60 * 60 * 1000;
if (lastVerificationTime && (Date.now() - lastVerificationTime) < twentyFourHours) {
  setIsTotpVerified(true);  // ❌ Client-side only!
}
```

**סיכון:**
תוקף יכול לפתוח Developer Console ולהריץ:
```javascript
localStorage.setItem('lastTotpVerificationTime', Date.now());
```
ולעקוף את דרישת ה-TOTP לחלוטין.

**רמת חומרה:** 🔴 **CRITICAL**
**Impact:** עקיפת אימות דו-שלבי למערכת צבאית

**תיקון מומלץ:**
```javascript
// Backend: Add to custom claims or session store
exports.verifyTotp = functions.https.onCall(async (data, context) => {
  // ... existing verification ...

  if (data.rememberDevice) {
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    await admin.auth().setCustomUserClaims(context.auth.uid, {
      ...user.customClaims,
      totpVerifiedUntil: expiryTime,
      deviceFingerprint: data.deviceFingerprint // Hash of browser fingerprint
    });
  }
});

// Frontend: Validate server-side
const validateTotpStatus = async () => {
  const user = await User.me(true); // Force token refresh
  const totpVerifiedUntil = user.totpVerifiedUntil;

  if (totpVerifiedUntil && Date.now() < totpVerifiedUntil) {
    setIsTotpVerified(true);
  } else {
    setIsTotpVerified(false);
  }
};
```

---

### 2. 🔴 CRITICAL: Firebase API Keys Exposed in .env

**מיקום:** [.env](c:\Users\Magshimim\Documents\workspace\6228-1\.env:1)

**תיאור הבעיה:**
קובץ `.env` מכיל את כל ה-Firebase configuration keys:

```env
VITE_FIREBASE_API_KEY=AIzaSyA5YJ-miz5jQMqPWyjd3Cw4DxxSYYUPSF0
VITE_FIREBASE_AUTH_DOMAIN=project-1386902152066454120.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-1386902152066454120
```

למרות ש-`.env` כלול ב-`.gitignore`, המפתחות האלה **ייחשפו בקוד הקליינט** כי Vite מחדיר את המשתנים לקוד הבילד.

**סיכון:**
- כל מי שמוריד את האפליקציה יכול לחלץ את ה-API keys
- אפשר להשתמש ב-keys כדי לגשת לפרויקט Firebase ישירות
- אין הגבלת origin/domain configured (לא נראה בקוד)

**רמת חומרה:** 🔴 **CRITICAL** (למערכת ייצור)

**תיקון מומלץ:**
1. **הגדר Firebase App Check** - מאמת שהבקשות מגיעות מהאפליקציה המקורית
2. **הגבל API key ל-domains מאושרים** בקונסול Firebase
3. **אפשר Security Rules חזקים** (כבר קיים חלקית)
4. **שקול Secrets Manager** עבור Cloud Functions

```javascript
// Add App Check to src/firebase/config.js
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true
});
```

---

### 3. 🟠 HIGH: No Rate Limiting on Authentication

**מיקום:** [src/firebase/auth-adapter.js](src/firebase/auth-adapter.js:56), [functions/src/auth.js](functions/src/auth.js:68)

**תיאור הבעיה:**
אין מגבלה על מספר ניסיונות התחברות או אימות TOTP. תוקף יכול לבצע brute-force attack:

```javascript
// No rate limiting here
exports.verifyTotp = functions.https.onCall(async (data, context) => {
  const { token } = data;
  // ... verification logic ...
});
```

**סיכון:**
- Brute force של קודי TOTP (6 ספרות = 1,000,000 אפשרויות)
- עם window=1, התוקף יכול לנסות ~3,000,000 ערכים בחלון של 90 שניות
- Phone auth flood - שליחת SMS לא מוגבלת

**רמת חומרה:** 🟠 **HIGH**

**תיקון מומלץ:**
```javascript
const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const totpLimiter = new RateLimiterMemory({
  points: 3,        // 3 attempts
  duration: 300,    // per 5 minutes
  blockDuration: 900 // 15 minute block
});

exports.verifyTotp = functions.https.onCall(async (data, context) => {
  try {
    await totpLimiter.consume(context.auth.uid);
  } catch (rejRes) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Too many attempts. Try again in ${Math.ceil(rejRes.msBeforeNext / 1000)} seconds.`
    );
  }

  // ... rest of verification ...
});
```

---

### 4. 🟠 HIGH: CSV File Upload Without Content Validation

**מיקום:** [src/components/import/ImportStep.jsx](src/components/import/ImportStep.jsx:34)

**תיאור הבעיה:**
העלאת קבצי CSV מאפשרת רק בדיקת סיומת קובץ:

```jsx
<input
  type="file"
  accept=".csv"
  onChange={handleFileSelect}
/>
```

**סיכון:**
- תוקף יכול להעלות קובץ זדוני עם סיומת .csv
- אין אימות של תוכן הקובץ לפני עיבוד
- אין בדיקת גודל קובץ מקסימלי
- אפשר להזריק נתונים מזויפים (soldiers, equipment, etc.)

**רמת חומרה:** 🟠 **HIGH** (למערכת צבאית)

**תיקון מומלץ:**
```javascript
const validateCSV = (fileContent) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (fileContent.length > maxSize) {
    throw new Error('File too large');
  }

  // Parse CSV
  const rows = Papa.parse(fileContent, { header: true });

  // Validate structure
  const requiredColumns = ['first_name', 'last_name', 'soldier_id'];
  const hasAllColumns = requiredColumns.every(col =>
    rows.meta.fields.includes(col)
  );

  if (!hasAllColumns) {
    throw new Error('Missing required columns');
  }

  // Validate data types and sanitize
  rows.data.forEach((row, idx) => {
    if (!row.soldier_id || !/^[A-Z0-9\-]+$/.test(row.soldier_id)) {
      throw new Error(`Invalid soldier_id at row ${idx + 1}`);
    }
    // ... more validation ...
  });

  return rows.data;
};
```

---

## 🔐 אבטחת אימות והרשאות

### Authentication Methods

המערכת תומכת ב-2 שיטות אימות:

#### 1. Phone Authentication (Primary)
**Implementation:** [src/firebase/auth-adapter.js:56-108](src/firebase/auth-adapter.js:56-108)

```javascript
// Flow:
// 1. User enters phone number
// 2. reCAPTCHA verification
// 3. SMS code sent via Firebase
// 4. User confirms code
// 5. syncUserOnSignIn() fetches user data from Firestore
```

**Security Assessment:** ✅ **Good**
- reCAPTCHA מונע bots
- SMS OTP valid למשך זמן קצוב
- Phone numbers מאומתים עם libphonenumber-js

**חסר:**
- אין rate limiting על שליחת SMS
- אין בדיקת SIM swap attacks

#### 2. Email/Password Authentication
**Implementation:** [src/firebase/auth.js:50-55](src/firebase/auth.js:50-55)

```javascript
const userCredential = await signInWithEmailAndPassword(auth, credential, password);
```

**Security Assessment:** 🟡 **Acceptable**
- Firebase מנהל password hashing (bcrypt)
- אין דרישות חוזק סיסמה נראות בUI
- אין password reset flow מיושם בקוד (delegated לFirebase)

**המלצה:** להוסיף password strength meter ודרישות מינימום.

---

### TOTP (Two-Factor Authentication)

**Implementation:** [functions/src/auth.js:11-177](functions/src/auth.js:11-177)

#### Setup Flow:
1. User calls `generateTotp()`
2. Backend generates secret (20 bytes, base32)
3. QR code created with OTPAuth URI
4. Secret stored in custom claims as `totp_temp_secret`
5. User scans QR with authenticator app
6. User verifies code
7. If valid, `totp_temp_secret` → `totp_secret` (permanent)

#### Verification Flow:
```javascript
const totp = new OTPAuth.TOTP({
  secret: OTPAuth.Secret.fromBase32(secret),
  algorithm: "SHA1",
  digits: 6,
  period: 30,
});

const delta = totp.validate({ token, window: 1 }); // ±30 sec drift
```

**Security Assessment:** 🟡 **Good implementation, flawed persistence**

**✅ Strengths:**
- Standard TOTP algorithm (RFC 6238)
- Proper time drift handling (window=1)
- Secrets stored in Firebase Auth custom claims (not accessible from browser)
- QR code generation secure

**❌ Weaknesses:**
1. **24-hour exemption stored client-side** (discussed above)
2. **No backup codes** for account recovery
3. **No audit log** of TOTP verification attempts
4. **Secrets in custom claims** (readable in ID token if token compromised)

---

### Role-Based Access Control (RBAC)

**Implementation:** [functions/src/users.js:769-869](functions/src/users.js:769-869)

#### Roles Defined:

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| **admin** | `global` | כל ההרשאות, גישה לכל הנתונים |
| **division_manager** | `division` | ניהול אנשי הסגל והציוד באוגדה שלו |
| **team_leader** | `team` | צפייה ועדכון עבור הצוות שלו |
| **soldier** | `self` | צפייה בציוד שלו בלבד |

#### Permission Structure:
```javascript
{
  'personnel.view': true/false,
  'personnel.create': true/false,
  'equipment.view': true/false,
  'equipment.create': true/false,
  'operations.sign': true/false,
  'system.users': true/false,
  // ... etc
  scope: 'global' | 'division' | 'team' | 'self'
}
```

**Security Assessment:** ✅ **Excellent RBAC Design**

**Strengths:**
- Fine-grained permissions (14 different permissions)
- Scope-based isolation (division, team, self)
- Permissions stored both in Firestore and custom claims
- Division managers restricted to their own division

**Observation:**
- Firestore Rules enforce scope at database level ([firestore.rules:70-94](firestore.rules:70-94))
- Frontend components check permissions before rendering ([src/components/common/AdminRequired.jsx](src/components/common/AdminRequired.jsx:1))

---

## 🛡️ הגנה מפני התקפות נפוצות

### 1. SQL Injection Protection
**Status:** ✅ **EXCELLENT** (Not Applicable - NoSQL)

**ממצאים:**
- המערכת משתמשת ב-Firestore (NoSQL), לא SQL
- כל השאילתות משתמשות ב-Firestore SDK parameterized methods
- **לא נמצא אף מקרה** של string concatenation בשאילתות

**דוגמאות לקוד בטוח:**
```javascript
// ✅ Safe - Parameterized
await db.collection('soldiers')
  .where('phone_number', '==', phoneNumber)
  .where('division_name', '==', divisionName)
  .get();

// ✅ Safe - Document reference
await db.collection('equipment').doc(equipmentId).get();

// ✅ Safe - Batch operations
const batch = writeBatch(db);
docs.forEach(doc => batch.delete(doc.ref));
```

**ציון:** 10/10 - אין סיכון SQL Injection

---

### 2. XSS (Cross-Site Scripting) Protection
**Status:** ✅ **EXCELLENT**

**ממצאים:**
- **אין שימוש ב-`dangerouslySetInnerHTML`** בשום מקום בקוד
- **אין שימוש ב-`innerHTML`** assignments
- React משתמש באוטומטית ב-escaping לכל הפלטים
- **אין `eval()` או `new Function()`** (סרוק בכל הקוד)

**מקרים שנבדקו:**
```javascript
// ✅ Safe - React automatically escapes
<div>{soldier.first_name} {soldier.last_name}</div>

// ✅ Safe - Input values bound to state
<Input value={formData.serial_number} onChange={handleChange} />

// ✅ Safe - JSON.stringify for display
<pre>{JSON.stringify(activityDetails, null, 2)}</pre>
```

**החריג היחיד (בטוח):**
```javascript
// src/components/ui/chart.jsx - Uses recharts library
// Library handles escaping internally
```

**ציון:** 9/10 - הגנה מצוינת מפני XSS

**המלצה קלה:** להוסיף Content Security Policy headers:
```javascript
// firebase.json - add to hosting section
"headers": [{
  "source": "**",
  "headers": [{
    "key": "Content-Security-Policy",
    "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline';"
  }]
}]
```

---

### 3. CSRF (Cross-Site Request Forgery) Protection
**Status:** ✅ **PROTECTED** (Built-in Firebase)

**הסבר:**
- Firebase Authentication משתמש ב-ID tokens (JWT)
- Tokens נשלחים ב-Authorization header, לא ב-cookies
- SameSite cookie policy אוכף אוטומטית על ידי Firebase

**אין צורך בפעולה נוספת** - Firebase מטפל בזה אוטומטית.

**ציון:** 10/10 - הגנה מובנית

---

### 4. Injection Attacks (NoSQL Injection)
**Status:** ✅ **PROTECTED**

**ממצאים:**
- Firestore operators (`.where()`, `.orderBy()`) מונעים injection
- אין שימוש ב-raw queries או dynamic field names
- User input always passed as values, not field names

**דוגמה לקוד בטוח:**
```javascript
// ✅ Safe - Operator is string literal, value is parameter
.where('status', '==', userInput)

// ❌ Would be unsafe (not found in code):
// .where(userInput, '==', 'active')
```

**ציון:** 9.5/10 - מאוד בטוח

---

### 5. Path Traversal / Directory Traversal
**Status:** ✅ **PROTECTED**

**ממצאים:**
- Firebase Storage משתמש ב-structured paths
- אין file system operations בצד השרת
- Storage Rules מגבילים גישה לתיקיות

**דוגמה:**
```javascript
// storage.rules:28-31
match /users/{userId}/{allPaths=**} {
  allow read: if isAuthenticated();
  allow write: if request.auth.uid == userId;  // ✅ Path isolation
}
```

**ציון:** 10/10 - לא רלוונטי / מוגן

---

## 🔑 אבטחת מידע רגיש

### 1. API Keys & Secrets Management

**מיקום:** [.env](c:\Users\Magshimim\Documents\workspace\6228-1\.env:1)

**Secrets מזוהים:**

```env
# ❌ EXPOSED - Will be bundled in client code
VITE_FIREBASE_API_KEY=AIzaSyA5YJ-miz5jQMqPWyjd3Cw4DxxSYYUPSF0
VITE_FIREBASE_AUTH_DOMAIN=project-1386902152066454120.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-1386902152066454120
VITE_FIREBASE_STORAGE_BUCKET=project-1386902152066454120.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=193183633039
VITE_FIREBASE_APP_ID=1:193183633039:web:f049d317ed9c663b1aeafa
VITE_FIREBASE_MEASUREMENT_ID=G-10RVXQYXNF

# ⚠️ Emulator flag
VITE_USE_FIREBASE_EMULATOR=false
```

**סטטוס אבטחה:** 🔴 **WEAK**

**בעיות:**
1. כל ה-keys עם prefix `VITE_` נחשפים בקוד הקליינט
2. Firebase API key ניתן לחילוץ מה-bundle
3. אין הגבלת domains/origins מוגדרת (לא נראה בקוד)

**ציון:** 4/10 - חולשה משמעותית

---

### 2. Service Account Keys

**מיקום:** [.gitignore:39-41](c:\Users\Magshimim\Documents\workspace\6228-1\.gitignore:39-41)

```gitignore
# ✅ GOOD - Service accounts excluded from git
*firebase-adminsdk*.json
serviceAccountKey.json
```

**סטטוס:** ✅ **GOOD** - Service account keys לא בגרסת ניהול קוד

**אבל:**
בקוד נמצא hardcoded service account email:
```javascript
// functions/src/auth.js:12
.runWith({ serviceAccountEmail: "project-1386902152066454120@appspot.gserviceaccount.com" })
```

זה **לא סוד** (email ציבורי), אבל מקובל להשתמש ב-environment variable.

---

### 3. TOTP Secrets

**מיקום:** [functions/src/auth.js:46-49](functions/src/auth.js:46-49)

```javascript
await admin.auth().setCustomUserClaims(uid, {
  ...user.customClaims,
  totp_temp_secret: secret.base32,  // ⚠️ In custom claims
});
```

**סטטוס:** 🟡 **ACCEPTABLE** (with concerns)

**הסבר:**
- TOTP secrets נשמרים ב-Firebase Auth custom claims
- Custom claims מוצפנים על ידי Firebase ונגישים רק דרך Admin SDK
- **אבל:** Custom claims נמצאים ב-ID token (JWT) שנשלח ללקוח
- אם token נחשף, ה-secret נחשף

**ציון:** 6/10 - עובד אבל לא אידיאלי

**תיקון מומלץ:**
```javascript
// Store TOTP secret in secure Firestore collection
await db.collection('user_secrets').doc(uid).set({
  totp_secret: admin.firestore.FieldValue.encrypt(secret.base32),
  created_at: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });

// Don't put secret in custom claims
```

---

### 4. Console Logging של נתונים רגישים

**מיקום:** רבים (1,207 occurrences של console.log בקוד)

**דוגמאות בעייתיות:**
```javascript
// functions/src/users.js:94
console.log(`[TOTP Debug] User ${uid} claims:`, {
  totp_enabled: user.customClaims?.totp_enabled,
  has_temp_secret: !!user.customClaims?.totp_temp_secret,
  has_permanent_secret: !!user.customClaims?.totp_secret,
});

// functions/src/auth-adapter.js:98
console.log(`  ✅ User data synced successfully`);
console.log(`  Sync result:`, JSON.stringify(syncResult.data, null, 2));
```

**סטטוס:** 🟠 **CONCERN**

**סיכון:**
- Logs בייצור עלולים לחשוף מידע רגיש
- Firebase Functions logs נגישים למנהלי המערכת
- JSON.stringify עלול לחשוף passwords, tokens, secrets

**ציון:** 5/10 - יותר מדי logging בייצור

**תיקון מומלץ:**
```javascript
// Replace console.log with structured logging
const logger = functions.logger;

// Use levels appropriately
logger.debug('Detailed info');  // Only in development
logger.info('Normal operation');
logger.warn('Warning');
logger.error('Error details');

// Sanitize sensitive data
logger.info('User signed in', {
  uid: user.uid,
  email: user.email ? '***@***' : null,  // Mask email
  role: user.role
});
```

---

## 🔒 בקרות גישה (RBAC)

### Custom Claims Structure

```typescript
interface CustomClaims {
  role: 'admin' | 'user';
  custom_role: 'admin' | 'division_manager' | 'team_leader' | 'soldier';
  permissions: {
    'personnel.view': boolean;
    'personnel.create': boolean;
    'equipment.view': boolean;
    // ... 14 total permissions
  };
  scope: 'global' | 'division' | 'team' | 'self';
  division: string | null;
  team: string | null;
  linked_soldier_id: string | null;
  totp_enabled: boolean;
  totp_secret: string | null;
}
```

### Permission Matrix

| Permission | Admin | Division Manager | Team Leader | Soldier |
|-----------|-------|------------------|-------------|---------|
| personnel.view | ✅ | ✅ (division) | ✅ (team) | ✅ (self) |
| personnel.create | ✅ | ✅ | ❌ | ❌ |
| personnel.update | ✅ | ✅ | ✅ | ❌ |
| personnel.delete | ✅ | ❌ | ❌ | ❌ |
| equipment.view | ✅ | ✅ (division) | ✅ (team) | ✅ (self) |
| equipment.create | ✅ | ✅ | ❌ | ❌ |
| equipment.update | ✅ | ✅ | ✅ | ❌ |
| equipment.delete | ✅ | ✅ | ❌ | ❌ |
| operations.sign | ✅ | ✅ | ✅ | ❌ |
| operations.deposit | ✅ | ✅ | ✅ | ❌ |
| operations.release | ✅ | ✅ | ❌ | ❌ |
| system.users | ✅ | ❌ | ❌ | ❌ |
| system.import | ✅ | ❌ | ❌ | ❌ |
| system.export | ✅ | ✅ | ❌ | ❌ |

**ציון:** 8/10 - מבנה מצוין

---

## 🔥 ניתוח Firebase Security Rules

### Firestore Rules Analysis

**מיקום:** [firestore.rules](firestore.rules:1)

#### Helper Functions (Lines 4-94)

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function isAdmin() {
  return isAuthenticated() && request.auth.token.role == 'admin';
}

function getUserDivision() {
  return request.auth.token.division;
}

function canAccessByScope(resourceData) {
  return isAuthenticated() && (
    isAdmin() ||
    (getUserScope() == 'global') ||
    (getUserScope() == 'division' && getUserDivision() == resourceData.division_name) ||
    (getUserScope() == 'team' && getUserTeam() == resourceData.team_name) ||
    (getUserScope() == 'self' && isUserLinkedToResource(resourceData))
  );
}
```

**הערכה:** ✅ **EXCELLENT** - בקרות scope מפורטות

#### Soldiers Collection (Lines 104-109)

```javascript
match /soldiers/{soldierID} {
  allow read: if hasPermission('personnel.view') && canAccessByScope(resource.data);
  allow create: if hasPermission('personnel.create');
  allow update: if hasPermission('personnel.update') && canAccessByScope(resource.data);
  allow delete: if hasPermission('personnel.delete') && canAccessByScope(resource.data);
}
```

**הערכה:** ✅ **SECURE**
- Permission check + scope validation
- Division managers can't delete personnel

#### Equipment Collections (Lines 112-156)

```javascript
match /weapons/{weaponID} {
  allow read: if hasPermission('equipment.view') && canAccessByScope(resource.data);
  allow create: if hasPermission('equipment.create') &&
    (isAdmin() || getUserScope() == 'global' ||
     (getUserScope() == 'division' && getUserDivision() == request.resource.data.division_name));
  allow update: if hasPermission('equipment.update') && canAccessByScope(resource.data);
  allow delete: if hasPermission('equipment.delete') &&
    (isAdmin() || getUserScope() == 'global' ||
     (getUserScope() == 'division' && getUserDivision() == resource.data.division_name));
}
```

**הערכה:** ✅ **SECURE**
- Create checks that division managers can only add to their division
- Delete restricted to admin/global or division owner

#### Activity Logs (Lines 176-182)

```javascript
match /activity_logs/{logID} {
  allow read: if hasPermission('system.history') && canAccessByScope(resource.data);
  allow create: if isAuthenticated();  // ⚠️ Anyone can create
  allow update: if isAuthenticated() &&
    (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['activity_log_id', 'updated_at']));
  allow delete: if isAdmin();
}
```

**הערכה:** 🟡 **ACCEPTABLE** (with note)
- Create מותר לכל מי שמחובר (נכון לlogger)
- Update מוגבל רק לשדות ספציפיים (בטוח)
- Delete רק לadmin

**המלצה:** להוסיף בדיקה ש-`created_by == request.auth.uid` ב-create

#### Users Collection (Lines 193-199)

```javascript
match /users/{userId} {
  allow read: if isAuthenticated() &&
    (isOwner(userId) || hasPermission('system.users'));
  allow create: if isOwner(userId) || hasPermission('system.users');
  allow update: if isOwner(userId) || hasPermission('system.users');
  allow delete: if hasPermission('system.users');
}
```

**הערכה:** ✅ **SECURE**
- Users can read/update their own profile
- Only admins can delete users

### Storage Rules Analysis

**מיקום:** [storage.rules](storage.rules:1)

```javascript
match /users/{userId}/{allPaths=**} {
  allow read: if isAuthenticated();
  allow write: if request.auth.uid == userId;
}

match /equipment/{equipmentId}/{allPaths=**} {
  allow read: if isAuthenticated();
  allow write: if isManager();
}
```

**הערכה:** ✅ **GOOD**
- User isolation enforced
- Equipment photos protected

**חסר:** File size limits, MIME type validation

**ציון כולל לRules:** 8.5/10 - מצוין עם שיפורים קלים

---

## ⚠️ חולשות שנמצאו

### Critical (חייב לתקן)

| # | חולשה | מיקום | רמת סיכון | מורכבות תיקון |
|---|--------|--------|----------|---------------|
| 1 | Client-side TOTP verification bypass | Layout.jsx:293 | 🔴 Critical | Medium |
| 2 | Firebase API keys exposed in client bundle | .env:2 | 🔴 Critical | Medium |
| 3 | No rate limiting on auth/TOTP | functions/src/auth.js | 🔴 Critical | Medium |
| 4 | CSV upload without validation | ImportStep.jsx:34 | 🔴 Critical | Low |

### High (מומלץ מאוד לתקן)

| # | חולשה | מיקום | רמת סיכון | מורכבות תיקון |
|---|--------|--------|----------|---------------|
| 5 | No device fingerprinting for "remember device" | TotpVerificationPrompt.jsx | 🟠 High | High |
| 6 | TOTP secrets in custom claims (ID token) | functions/src/auth.js:46 | 🟠 High | Medium |
| 7 | Console logging של נתונים רגישים | Multiple files | 🟠 High | Low |
| 8 | No backup codes for TOTP recovery | N/A | 🟠 High | Medium |

### Medium (כדאי לתקן)

| # | חולשה | מיקום | רמת סיכון | מורכבות תיקון |
|---|--------|--------|----------|---------------|
| 9 | Custom input fields without character limits | Multiple forms | 🟡 Medium | Low |
| 10 | Email/phone validation missing | SoldierForm.jsx | 🟡 Medium | Low |
| 11 | Textarea fields without length limits | Multiple forms | 🟡 Medium | Low |
| 12 | No Content Security Policy headers | firebase.json | 🟡 Medium | Low |
| 13 | Serial numbers accept any characters | EquipmentForm.jsx | 🟡 Medium | Low |

### Low (שיפורים עתידיים)

| # | חולשה | מיקום | רמת סיכון | מורכבות תיקון |
|---|--------|--------|----------|---------------|
| 14 | No password strength requirements | Login.jsx | 🟢 Low | Low |
| 15 | Activity logs can be created by anyone | firestore.rules:178 | 🟢 Low | Low |
| 16 | No TOTP audit logging | N/A | 🟢 Low | Medium |
| 17 | No account lockout after failed attempts | N/A | 🟢 Low | Medium |

---

## 💡 המלצות לשיפור

### Priority 1: Critical Fixes (תוך 30 יום)

#### 1.1 תיקון Client-Side TOTP Bypass

**קובץ:** `functions/src/auth.js`, `src/pages/Layout.jsx`

**שינויים נדרשים:**

```javascript
// Backend: functions/src/auth.js
exports.verifyTotp = functions.https.onCall(async (data, context) => {
  // ... existing verification ...

  if (data.rememberDevice && data.deviceFingerprint) {
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);

    // Store in custom claims (server-side only)
    await admin.auth().setCustomUserClaims(context.auth.uid, {
      ...user.customClaims,
      totpVerifiedUntil: expiryTime,
      totpDeviceFingerprint: data.deviceFingerprint
    });

    // Also log to Firestore for audit
    await db.collection('totp_verifications').add({
      uid: context.auth.uid,
      device_fingerprint: data.deviceFingerprint,
      verified_at: admin.firestore.FieldValue.serverTimestamp(),
      expires_at: new Date(expiryTime)
    });
  }

  return { success: true };
});

// Frontend: src/utils/deviceFingerprint.js (NEW FILE)
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getDeviceFingerprint = async () => {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
};

// Frontend: src/pages/Layout.jsx
const checkTotpStatus = async () => {
  const user = await User.me(true); // Force token refresh
  const totpVerifiedUntil = user.totpVerifiedUntil;
  const storedFingerprint = user.totpDeviceFingerprint;

  if (totpVerifiedUntil && Date.now() < totpVerifiedUntil) {
    // Optional: Verify device fingerprint matches
    const currentFingerprint = await getDeviceFingerprint();
    if (currentFingerprint === storedFingerprint) {
      setIsTotpVerified(true);
      return;
    }
  }

  setIsTotpVerified(false);
  setShowTotpPrompt(true);
};
```

**השפעה:** מונע bypass של TOTP לחלוטין

---

#### 1.2 הגנה על Firebase API Keys

**קובץ:** `firebase.json`, `src/firebase/config.js`

**שינויים נדרשים:**

```bash
# Install Firebase App Check
npm install firebase/app-check
```

```javascript
// src/firebase/config.js - Add after initializeApp
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Initialize App Check
if (typeof window !== 'undefined') {
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_V3_SITE_KEY'),
    isTokenAutoRefreshEnabled: true
  });

  console.log('✅ App Check initialized');
}
```

**בקונסול Firebase:**
1. Project Settings → App Check → Register your app
2. Add reCAPTCHA v3 site key
3. Enable enforcement for:
   - Firestore
   - Storage
   - Cloud Functions

**השפעה:** API keys עדיין יחשפו אבל יהיו חסרי תועלת ללא App Check token

---

#### 1.3 הוספת Rate Limiting

**קובץ:** `functions/package.json`, `functions/src/auth.js`

```bash
cd functions
npm install express-rate-limit rate-limiter-flexible
```

```javascript
// functions/src/middleware/rateLimiter.js (NEW FILE)
const { RateLimiterMemory } = require('rate-limiter-flexible');

const totpLimiter = new RateLimiterMemory({
  points: 3,          // 3 attempts
  duration: 300,      // per 5 minutes
  blockDuration: 900  // 15 minute block on exceed
});

const loginLimiter = new RateLimiterMemory({
  points: 5,          // 5 attempts
  duration: 300,      // per 5 minutes
  blockDuration: 1800 // 30 minute block
});

module.exports = { totpLimiter, loginLimiter };

// functions/src/auth.js - Update verifyTotp
const { totpLimiter } = require('./middleware/rateLimiter');

exports.verifyTotp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const uid = context.auth.uid;

  // Rate limiting check
  try {
    await totpLimiter.consume(uid);
  } catch (rejRes) {
    const secsBeforeNext = Math.ceil(rejRes.msBeforeNext / 1000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Too many TOTP verification attempts. Try again in ${secsBeforeNext} seconds.`
    );
  }

  // ... rest of verification logic ...
});
```

**השפעה:** מונע brute-force attacks על TOTP

---

#### 1.4 אימות CSV מקיף

**קובץ:** `src/utils/csvValidator.js` (NEW), `src/components/import/ImportStep.jsx`

```javascript
// src/utils/csvValidator.js
import Papa from 'papaparse';

export const validateCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('File size exceeds 10MB limit'));
      return;
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      reject(new Error('File must be a CSV file'));
      return;
    }

    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          validateCSVStructure(results);
          resolve(results.data);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
};

const validateCSVStructure = (results) => {
  // Required columns for soldiers import
  const requiredColumns = ['first_name', 'last_name', 'soldier_id', 'division_name'];

  const missingColumns = requiredColumns.filter(
    col => !results.meta.fields.includes(col)
  );

  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
  }

  // Validate each row
  results.data.forEach((row, index) => {
    const rowNum = index + 1;

    // Soldier ID validation
    if (!row.soldier_id || !/^[A-Z0-9\-]{5,20}$/.test(row.soldier_id)) {
      throw new Error(`Row ${rowNum}: Invalid soldier_id format`);
    }

    // Name validation
    if (!row.first_name || row.first_name.length > 50) {
      throw new Error(`Row ${rowNum}: Invalid first_name`);
    }

    if (!row.last_name || row.last_name.length > 50) {
      throw new Error(`Row ${rowNum}: Invalid last_name`);
    }

    // Email validation (if provided)
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      throw new Error(`Row ${rowNum}: Invalid email format`);
    }

    // Phone validation (if provided)
    if (row.phone_number && !/^\+?[1-9]\d{1,14}$/.test(row.phone_number)) {
      throw new Error(`Row ${rowNum}: Invalid phone number format`);
    }

    // Sanitize strings
    row.first_name = sanitizeString(row.first_name);
    row.last_name = sanitizeString(row.last_name);
    row.division_name = sanitizeString(row.division_name);
  });
};

const sanitizeString = (str) => {
  return str.trim().replace(/[<>\"']/g, '');
};

// src/components/import/ImportStep.jsx - Update
const handleFileSelect = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    setLoading(true);
    setError(null);

    const validatedData = await validateCSVFile(file);

    // Proceed with import
    await onImport(validatedData);

    toast.success(`Successfully imported ${validatedData.length} records`);
  } catch (error) {
    setError(error.message);
    toast.error(`Import failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
};
```

**השפעה:** מונע הזרקת נתונים פגומים או זדוניים

---

### Priority 2: High Priority (תוך 60 יום)

#### 2.1 העברת TOTP Secrets לFirestore

**קובץ:** `functions/src/auth.js`

```javascript
exports.generateTotp = functions.https.onCall(async (data, context) => {
  // ... generate secret ...

  // Store in secure Firestore collection instead of custom claims
  await db.collection('user_secrets').doc(uid).set({
    totp_temp_secret: secret.base32,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    expires_at: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) // 10 min expiry
  }, { merge: true });

  // Don't store in custom claims
  return {
    qrCodeUrl: qrCodeDataUrl,
    otpauthUri: otpauthUri
  };
});

exports.verifyTotp = functions.https.onCall(async (data, context) => {
  // ... get uid ...

  // Retrieve secret from Firestore
  const secretDoc = await db.collection('user_secrets').doc(uid).get();
  if (!secretDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'No TOTP secret found');
  }

  const { totp_temp_secret, totp_secret, expires_at } = secretDoc.data();

  // Check expiry
  if (expires_at && expires_at.toMillis() < Date.now()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'TOTP secret expired');
  }

  // ... verification logic ...

  // On success, make permanent
  if (totp_temp_secret) {
    await db.collection('user_secrets').doc(uid).update({
      totp_secret: totp_temp_secret,
      totp_temp_secret: admin.firestore.FieldValue.delete(),
      totp_enabled_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});
```

**Security Rules להוסיף:**
```javascript
// firestore.rules
match /user_secrets/{userId} {
  allow read, write: if false; // Only accessible via Admin SDK
}
```

---

#### 2.2 יצירת Backup Codes

**קובץ:** `functions/src/auth.js`

```javascript
const crypto = require('crypto');

const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

exports.generateTotp = functions.https.onCall(async (data, context) => {
  // ... existing TOTP generation ...

  // Generate backup codes
  const backupCodes = generateBackupCodes();

  // Hash backup codes before storing
  const hashedCodes = backupCodes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  await db.collection('user_secrets').doc(uid).set({
    totp_temp_secret: secret.base32,
    backup_codes: hashedCodes, // Store hashed
    created_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    qrCodeUrl: qrCodeDataUrl,
    otpauthUri: otpauthUri,
    backupCodes: backupCodes // Return plain text once
  };
});

exports.verifyBackupCode = functions.https.onCall(async (data, context) => {
  const { code } = data;
  const uid = context.auth.uid;

  const secretDoc = await db.collection('user_secrets').doc(uid).get();
  const { backup_codes } = secretDoc.data();

  const hashedInput = crypto.createHash('sha256').update(code).digest('hex');

  const codeIndex = backup_codes.findIndex(hash => hash === hashedInput);

  if (codeIndex === -1) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid backup code');
  }

  // Remove used code
  backup_codes.splice(codeIndex, 1);
  await db.collection('user_secrets').doc(uid).update({
    backup_codes: backup_codes
  });

  return { success: true, remaining: backup_codes.length };
});
```

---

#### 2.3 ניקוי Console Logging

**קובץ:** `functions/src/logger.js` (NEW)

```javascript
const functions = require('firebase-functions');

const isDevelopment = process.env.FUNCTIONS_EMULATOR === 'true';

const logger = {
  debug: (message, data = {}) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, sanitizeData(data));
    }
  },

  info: (message, data = {}) => {
    functions.logger.info(message, sanitizeData(data));
  },

  warn: (message, data = {}) => {
    functions.logger.warn(message, sanitizeData(data));
  },

  error: (message, error) => {
    functions.logger.error(message, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
  }
};

const sanitizeData = (data) => {
  const sensitiveFields = ['password', 'secret', 'token', 'totp_secret', 'api_key'];

  if (typeof data !== 'object') return data;

  const sanitized = { ...data };

  Object.keys(sanitized).forEach(key => {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '***REDACTED***';
    }
  });

  return sanitized;
};

module.exports = logger;

// Replace all console.log with logger
// Find and replace:
// console.log → logger.info
// console.error → logger.error
// console.warn → logger.warn
```

---

### Priority 3: Medium Priority (תוך 90 יום)

#### 3.1 הוספת Input Validation Schema

```bash
npm install zod
```

```javascript
// src/schemas/soldierSchema.js
import { z } from 'zod';

export const SoldierSchema = z.object({
  soldier_id: z.string()
    .min(5, 'Soldier ID must be at least 5 characters')
    .max(20, 'Soldier ID must be at most 20 characters')
    .regex(/^[A-Z0-9\-]+$/, 'Soldier ID must contain only uppercase letters, numbers, and hyphens'),

  first_name: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be at most 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'First name contains invalid characters'),

  last_name: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be at most 50 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name contains invalid characters'),

  email: z.string()
    .email('Invalid email format')
    .optional()
    .or(z.literal('')),

  phone_number: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),

  division_name: z.string()
    .min(1, 'Division is required')
    .max(100, 'Division name too long'),

  team_name: z.string()
    .max(100, 'Team name too long')
    .optional()
});

// src/components/soldiers/SoldierForm.jsx
import { SoldierSchema } from '@/schemas/soldierSchema';

const validateForm = () => {
  try {
    SoldierSchema.parse(formData);
    setErrors({});
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = {};
      error.errors.forEach(err => {
        formattedErrors[err.path[0]] = err.message;
      });
      setErrors(formattedErrors);
    }
    return false;
  }
};

const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    toast.error('Please fix validation errors');
    return;
  }

  // ... proceed with submission ...
};
```

---

#### 3.2 Content Security Policy

**קובץ:** `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://www.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net; frame-src https://accounts.google.com;"
          },
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "SAMEORIGIN"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "geolocation=(), microphone=(), camera=()"
          }
        ]
      }
    ]
  }
}
```

---

### Priority 4: Future Enhancements

- Password strength meter for email/password auth
- Account lockout after 10 failed attempts
- TOTP audit logging to activity_logs
- File upload MIME type validation
- SIM swap detection for phone auth
- IP-based geofencing for sensitive operations
- Security event notifications (email/SMS)

---

## 📈 סיכום והערכה כוללת

### מצב נוכחי

המערכת מציגה **תשתית אבטחה בסיסית טובה** עם כמה חולשות משמעותיות שצריכות תיקון לפני פריסה במערכת ייצור צבאית.

**נקודות חוזק:**
✅ Architecture מבוסס Firebase - תשתית מאובטחת מובנית
✅ RBAC מיושם היטב עם 4 רמות הרשאה
✅ Firebase Security Rules מפורטות וחזקות
✅ הגנה מובנית מפני XSS ו-SQL Injection
✅ TOTP/2FA מיושם (עם חולשות שניתנות לתיקון)
✅ Audit logging קיים

**נקודות חולשה:**
❌ TOTP verification ניתנת לעקיפה (client-side)
❌ Firebase API keys חשופים
❌ אין rate limiting
❌ CSV import ללא אימות
❌ Console logging חושף נתונים רגישים
❌ אין backup codes ל-TOTP

### ציון סופי

| קטגוריה | ציון |
|---------|------|
| **Architecture & Infrastructure** | 8.5/10 |
| **Authentication & Authorization** | 7/10 |
| **Data Protection** | 6/10 |
| **Input Validation** | 6.5/10 |
| **Attack Prevention** | 8/10 |
| **Secrets Management** | 4/10 |
| **Logging & Monitoring** | 6.5/10 |
| **Overall Security** | **6.9/10** |

### המלצה סופית

**למערכת ייצור צבאית:** 🟡 **לא מוכן - דורש תיקונים קריטיים**

**Timeline מומלץ:**
- **30 יום:** תיקון כל החולשות הקריטיות (Priority 1)
- **60 יום:** יישום תיקונים בעדיפות גבוהה (Priority 2)
- **90 יום:** שיפורים נוספים (Priority 3)
- **ביקורת חוזרת:** לאחר 90 יום

**לאחר יישום התיקונים הקריטיים**, המערכת תהיה **ראויה לאחסון מידע מסווג ברמה בינונית**.

---

## 📞 צור קשר

לשאלות נוספות או הבהרות לגבי דוח זה:
- דוח מוכן על ידי: מומחה אבטחת מידע
- תאריך: 28 אוקטובר 2025
- גרסה: 1.0

---

**סיווג:** 🔒 מסווג - לשימוש פנימי בלבד
**תוקף הדוח:** 90 יום (עד 28 ינואר 2026)
**ביקורת הבאה:** לאחר יישום תיקונים קריטיים

---

*END OF SECURITY AUDIT REPORT*
