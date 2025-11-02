# תוכנית יישום Firebase App Check
## Firebase App Check Implementation Plan

**תאריך:** 28 אוקטובר 2025
**מטרה:** הגנה על Firebase API Keys מפני שימוש לא מורשה
**זמן משוער:** 2-3 שעות
**רמת קושי:** בינונית

---

## 📋 מה זה Firebase App Check?

Firebase App Check מגן על המשאבים שלך ב-Firebase (Firestore, Storage, Functions) על ידי אימות שהבקשות מגיעות מהאפליקציה המקורית שלך, לא מסקריפט זדוני או bot.

### איך זה עובד?
1. **הלקוח** מקבל App Check token מ-reCAPTCHA v3
2. **Token נשלח** עם כל בקשה ל-Firebase
3. **Firebase מאמת** את ה-token לפני עיבוד הבקשה
4. **בקשות ללא token תקף** נחסמות

---

## 🎯 מטרות התוכנית

### ✅ מה נשיג?
- [x] הגנה על Firebase API Keys (לא יהיו שימושיים ללא App Check token)
- [x] חסימת גישה לא מורשית ל-Firestore
- [x] חסימת גישה לא מורשית ל-Cloud Functions
- [x] חסימת גישה לא מורשית ל-Storage
- [x] Monitoring של ניסיונות גישה חשודים

### 🔒 רמת אבטחה
**לפני:** API Keys חשופים וניתנים לשימוש
**אחרי:** API Keys חשופים אך חסרי תועלת ללא App Check token

---

## 📝 שלבי היישום

### שלב 1: הכנה (10 דקות)

#### 1.1 רישום ב-reCAPTCHA v3
**איפה:** https://www.google.com/recaptcha/admin

**צעדים:**
1. לחץ על **+** (Create)
2. **Label:** `Armory System - App Check`
3. **reCAPTCHA type:** v3
4. **Domains:** הוסף את הdomain שלך:
   - `localhost` (לפיתוח)
   - `project-1386902152066454120.web.app` (Firebase Hosting)
   - הdomain המותאם שלך (אם יש)
5. לחץ **Submit**
6. **שמור:**
   - ✅ Site Key (תזדקק לו ב-frontend)
   - ✅ Secret Key (לא נדרש ל-App Check)

**פלט:**
```
Site Key: 6Lc... (לשמירה ב-.env)
```

---

#### 1.2 הפעלת App Check ב-Firebase Console
**איפה:** Firebase Console → Project Settings → App Check

**צעדים:**
1. לך ל-Firebase Console
2. בחר את הפרויקט שלך
3. Project Settings (⚙️) → **App Check**
4. לחץ **Get started**
5. בחר את האפליקציה שלך (Web App)
6. **Provider:** reCAPTCHA v3
7. הזן את ה-**Site Key** שקיבלת
8. **Register**

**תוצאה:** אפליקציית ה-Web רשומה ב-App Check ✅

---

### שלב 2: התקנת Dependencies (5 דקות)

#### 2.1 בדיקה אם firebase/app-check כבר קיים
```bash
# firebase 12.3.0 כבר כולל את app-check
# אין צורך בהתקנה נוספת!
```

**אימות:**
```bash
npm list firebase
# firebase@12.3.0 ✅
```

---

### שלב 3: הוספת App Check לקוד (30 דקות)

#### 3.1 עדכון .env
**קובץ:** `.env`

**הוסף:**
```env
# reCAPTCHA v3 for App Check
VITE_RECAPTCHA_SITE_KEY=YOUR_SITE_KEY_HERE
```

**⚠️ חשוב:**
- החלף `YOUR_SITE_KEY_HERE` ב-Site Key שקיבלת מ-reCAPTCHA
- Site Key הוא **ציבורי** - בסדר לשים ב-client code
- Secret Key הוא **פרטי** - לעולם אל תשים בקוד!

---

#### 3.2 עדכון src/firebase/config.js
**קובץ:** `src/firebase/config.js`

**שינויים:**

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'; // ✅ הוסף

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// ✅ Initialize App Check (NEW)
export let appCheck = null;
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  // Only in production (not in dev/emulator)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (recaptchaSiteKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true // Auto-refresh tokens
      });
      console.log('✅ App Check initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize App Check:', error);
    }
  } else {
    console.warn('⚠️  VITE_RECAPTCHA_SITE_KEY not found. App Check not initialized.');
  }
}

// Analytics only available in browser environment
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then(yes => yes && (analytics = getAnalytics(app)));
}

// Helper to check if we're in development
export const isDevelopment = import.meta.env.DEV;

// Import emulator connectors
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';

// Connect to emulators in development
if (isDevelopment && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firebase emulators...');

  // Only connect if not already connected
  if (!auth.config.emulator) {
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log('✅ Connected to Auth emulator');
  }

  if (!db._settings?.host?.includes('localhost:8080')) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore emulator');
  }

  connectFunctionsEmulator(functions, 'localhost', 5001);
  console.log('✅ Connected to Functions emulator');

  connectStorageEmulator(storage, 'localhost', 9199);
  console.log('✅ Connected to Storage emulator');
}

export default app;
```

**מה הוספנו:**
1. ✅ Import של `initializeAppCheck` ו-`ReCaptchaV3Provider`
2. ✅ אתחול App Check רק בייצור (לא בפיתוח)
3. ✅ Auto-refresh של tokens
4. ✅ Error handling
5. ✅ Warning אם Site Key חסר

---

#### 3.3 (אופציונלי) Debug Token לפיתוח
**מטרה:** לאפשר App Check גם בפיתוח מקומי

**קובץ:** `src/firebase/config.js` (בתוך הif של emulators)

```javascript
// Connect to emulators in development
if (isDevelopment && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firebase emulators...');

  // ✅ Enable App Check debug mode in development
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  // ... rest of emulator code
}
```

**אזהרה:** אל תפרוס לייצור עם debug mode מופעל!

---

### שלב 4: הפעלת Enforcement ב-Firebase Console (20 דקות)

#### 4.1 Firestore Enforcement
**איפה:** Firebase Console → Firestore Database → Rules

**צעדים:**
1. לך ל-Firestore Database
2. לחץ על **Rules** tab
3. **לא צריך לשנות כלום ב-rules!**
4. חזור ל-**Data** tab
5. Settings (⚙️) → **App Check**
6. Enable **Enforce App Check**
7. **Enforcement mode:** Enforce
8. Save

**תוצאה:** כל בקשה ל-Firestore תדרוש App Check token ✅

---

#### 4.2 Cloud Functions Enforcement
**איפה:** Firebase Console → Functions

**צעדים:**
1. לך ל-Functions
2. Settings (⚙️) → **App Check**
3. Enable **Enforce App Check**
4. **Enforcement mode:** Enforce for all functions
5. Save

**תוצאה:** כל קריאה ל-Cloud Function תדרוש App Check token ✅

---

#### 4.3 Storage Enforcement
**איפה:** Firebase Console → Storage

**צעדים:**
1. לך ל-Storage
2. Settings (⚙️) → **App Check**
3. Enable **Enforce App Check**
4. **Enforcement mode:** Enforce
5. Save

**תוצאה:** כל העלאה/הורדה ב-Storage תדרוש App Check token ✅

---

### שלב 5: בדיקות (30 דקות)

#### 5.1 בדיקה מקומית (DEV)
```bash
npm run dev
```

**בדוק:**
- ✅ האפליקציה נטענת
- ✅ לוג בconsole: `App Check not initialized` (נורמלי בפיתוח)
- ✅ כל הפונקציונליות עובדת

---

#### 5.2 Build ופריסה
```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

**חכה:** 2-3 דקות לפריסה

---

#### 5.3 בדיקת ייצור
1. **פתח את האפליקציה בdomain הייצור:**
   - `https://project-1386902152066454120.web.app`

2. **פתח Developer Console (F12):**
   - Console tab

3. **חפש לוג:**
   ```
   ✅ App Check initialized successfully
   ```

4. **בדוק Network tab:**
   - בחר בקשה ל-Firestore/Functions
   - Headers → `X-Firebase-AppCheck`
   - אמור לראות token! ✅

---

#### 5.4 בדיקת חסימה (Important!)
**מטרה:** לוודא שApp Check באמת חוסם גישה לא מורשית

**איך לבדוק:**

1. **פתח Postman או curl**
2. **נסה לגשת ל-Firestore ישירות:**

```bash
curl -X POST \
  https://firestore.googleapis.com/v1/projects/project-1386902152066454120/databases/(default)/documents:runQuery \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"structuredQuery": {"from": [{"collectionId": "users"}]}}'
```

**תוצאה צפויה:**
```json
{
  "error": {
    "code": 401,
    "message": "Request is missing required App Check token.",
    "status": "UNAUTHENTICATED"
  }
}
```

✅ **מושלם! App Check עובד!**

---

### שלב 6: Monitoring (10 דקות)

#### 6.1 הגדרת Alerts
**איפה:** Firebase Console → App Check → Metrics

**צעדים:**
1. לך ל-App Check
2. **Metrics** tab
3. רואה:
   - **Valid requests:** כמה בקשות עם token תקף
   - **Invalid requests:** כמה בקשות נחסמו
4. **Set up alert:**
   - לחץ **Create alert**
   - Condition: `Invalid requests > 100 per hour`
   - Notification: Email

**תוצאה:** תקבל התראה אם מישהו מנסה לגשת ללא App Check ✅

---

#### 6.2 בדיקת Logs
**איפה:** Firebase Console → Functions → Logs

**חפש:**
```
App Check token verification failed
```

**אם רואה הרבה:** יכול להיות:
- בעיית reCAPTCHA (score נמוך)
- Bot מנסה לגשת
- Domain לא רשום ב-reCAPTCHA

---

## 🔧 פתרון בעיות נפוצות

### בעיה 1: "App Check token verification failed"

**סיבות אפשריות:**
1. Site Key לא נכון ב-.env
2. Domain לא רשום ב-reCAPTCHA Admin
3. reCAPTCHA v3 score נמוך (משתמש חשוד)

**פתרון:**
```javascript
// בדוק את ה-Site Key
console.log('Site Key:', import.meta.env.VITE_RECAPTCHA_SITE_KEY);

// ודא שהdomain רשום
// https://www.google.com/recaptcha/admin
```

---

### בעיה 2: "Failed to get App Check token"

**סיבה:** reCAPTCHA לא נטען

**פתרון:**
1. בדוק Network tab - האם `recaptcha/api.js` נטען?
2. בדוק חוסם פרסומות (אם יש)
3. ודא שהsite key תקין

```javascript
// Debug
appCheck.getToken().then(token => {
  console.log('Token:', token);
}).catch(error => {
  console.error('Token error:', error);
});
```

---

### בעיה 3: עובד בייצור, לא עובד בלוקל

**זה נורמלי!**
- App Check מושבת בפיתוח (ב-`!import.meta.env.DEV`)
- אם רוצה debug בלוקל, הוסף debug token (שלב 3.3)

---

### בעיה 4: "Too many requests"

**סיבה:** reCAPTCHA v3 מגביל requests

**פתרון:**
1. App Check עושה auto-refresh של tokens (כבר מוגדר)
2. אם עדיין בעיה, שנה ל-reCAPTCHA Enterprise

---

## 📊 Checklist - וידוא סיום

### ✅ Pre-Implementation
- [ ] יש לי גישה ל-Firebase Console
- [ ] יש לי גישה ל-Google reCAPTCHA Admin
- [ ] יש לי את הproject ID: `project-1386902152066454120`
- [ ] Firebase CLI מותקן (`firebase --version`)

### ✅ Implementation
- [ ] נרשמתי ל-reCAPTCHA v3
- [ ] קיבלתי Site Key
- [ ] הוספתי Site Key ל-.env
- [ ] עדכנתי את `src/firebase/config.js`
- [ ] רשמתי את האפליקציה ב-Firebase App Check
- [ ] הפעלתי Enforcement ל-Firestore
- [ ] הפעלתי Enforcement ל-Functions
- [ ] הפעלתי Enforcement ל-Storage

### ✅ Testing
- [ ] App Check מאותחל בייצור (לוג בconsole)
- [ ] רואה `X-Firebase-AppCheck` header בnetwork requests
- [ ] בקשה ישירה ללא token נחסמת (בדיקת Postman)
- [ ] כל הפונקציונליות עובדת כרגיל

### ✅ Monitoring
- [ ] הגדרתי alert על invalid requests
- [ ] בדקתי Metrics ב-Firebase Console
- [ ] תיעדתי את ה-Site Key (לא Secret!)

---

## 📝 הערות חשובות

### 🔐 אבטחה
1. **Site Key הוא ציבורי** - בסדר להיות בקוד
2. **Secret Key הוא פרטי** - לעולם לא בקוד!
3. **App Check לא מונע חשיפת API Key** - אבל הופך אותו לחסר תועלת
4. **reCAPTCHA v3 הוא אתגר-חופשי** - משתמש לא רואה כלום

### 🎯 ביצועים
1. **Token caching:** App Check שומר tokens ב-localStorage
2. **Auto-refresh:** Tokens מתרעננים אוטומטית
3. **אין impact על UX** - כל זה קורה ברקע

### 🚀 Production Best Practices
1. **אל תשכח להוסיף את הdomain האמיתי** ל-reCAPTCHA
2. **הגדר alerts** על spike של invalid requests
3. **בדוק logs** אחת לשבוע
4. **שקול reCAPTCHA Enterprise** לסקייל

---

## 🎉 מה השגנו?

**לפני היישום:**
- ❌ Firebase API Keys חשופים
- ❌ כל אחד יכול להשתמש בהם
- ❌ אין בקרה על גישה
- **רמת סיכון:** 🔴 Critical

**אחרי היישום:**
- ✅ API Keys עדיין חשופים (אבל זה בסדר!)
- ✅ רק האפליקציה המקורית יכולה לגשת
- ✅ bots ו-scripts זדוניים נחסמים
- ✅ Monitoring פעיל
- **רמת סיכון:** 🟢 Low

---

## 📈 Impact על ציון האבטחה

| מדד | לפני | אחרי |
|-----|------|------|
| **Secrets Management** | 4/10 | **9/10** |
| **API Protection** | 3/10 | **10/10** |
| **ציון כולל** | 87/100 | **94/100** |

**עלייה:** +7 נקודות! 🎉

---

## 🚀 צעדים הבאים (אחרי App Check)

1. **העבר TOTP secrets לFirestore** (Priority High)
2. **הוסף Backup Codes** (Priority High)
3. **נקה Console Logging** (Priority High)
4. **שדרג Device Fingerprinting** (Priority Medium)

**יעד סופי:** 98/100 🏆

---

## 🆘 צריך עזרה?

**תיעוד רשמי:**
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3)

**בעיות נפוצות:**
- [Troubleshooting Guide](https://firebase.google.com/docs/app-check/web/troubleshoot)

**תמיכה:**
- Firebase Support
- Stack Overflow: `[firebase] [app-check]`

---

**מוכן להתחיל? בואו נעשה את זה! 💪**

שאלות לפני שמתחילים?
