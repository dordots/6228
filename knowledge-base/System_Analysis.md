# ניתוח מערכת ARMORY - מסמך טכני מלא

## סקירה כללית

מערכת ARMORY היא מערכת ניהול ציוד צבאי מתקדמת הבנויה על React + Vite עם שרת Base44. המערכת מספקת פתרון מקיף לניהול ציוד, נשק, רחפנים וציוד סדרתי עבור יחידות צבאיות.

## ארכיטקטורת המערכת

### צד שרת (Backend)

המערכת משתמשת בפלטפורמת **Base44** כשרת backend, הכוללת:

#### 1. בסיס נתונים (Entities)

- **Soldier** - ניהול חיילים
- **Equipment** - ציוד סטנדרטי
- **Weapon** - נשק
- **SerializedGear** - ציוד סדרתי
- **DroneSet** - מערכות רחפנים
- **DroneComponent** - רכיבי רחפנים
- **ActivityLog** - יומן פעילות
- **DailyVerification** - אימות יומי
- **User** - משתמשים (אימות)

#### 2. פונקציות שרת (Functions)

- `sendDailyReport` - שליחת דוח יומי
- `deleteAllEquipment` - מחיקת כל הציוד
- `deleteAllSoldiers` - מחיקת כל החיילים
- `deleteAllWeapons` - מחיקת כל הנשק
- `deleteAllSerializedGear` - מחיקת כל הציוד הסדרתי
- `generateTotp` / `verifyTotp` - אימות דו-שלבי
- `exportAllData` - ייצוא נתונים
- `generateSigningForm` / `sendSigningForm` - טופסי חתימה
- `generateReleaseForm` / `sendReleaseFormByActivity` - טופסי שחרור
- `sendBulkEquipmentForms` - שליחת טפסים מרובים
- `sendEmailViaSendGrid` - שליחת אימיילים

#### 3. אינטגרציות (Integrations)

- **Core.InvokeLLM** - בינה מלאכותית
- **Core.SendEmail** - שליחת אימיילים
- **Core.UploadFile** - העלאת קבצים
- **Core.GenerateImage** - יצירת תמונות
- **Core.ExtractDataFromUploadedFile** - חילוץ נתונים מקבצים
- **Core.CreateFileSignedUrl** - יצירת קישורים חתומים
- **Core.UploadPrivateFile** - העלאת קבצים פרטיים

### צד לקוח (Frontend)

#### 1. טכנולוגיות בסיס

- **React 18.2.0** - ספריית UI
- **Vite 6.1.0** - כלי בנייה ופיתוח
- **React Router DOM 7.2.0** - ניתוב
- **Tailwind CSS 3.4.17** - עיצוב
- **Radix UI** - רכיבי UI מתקדמים
- **Lucide React** - אייקונים

#### 2. מבנה הקבצים

##### דפים ראשיים (Pages)

- **Dashboard** - לוח בקרה מרכזי
- **Soldiers** - ניהול חיילים
- **Weapons** - ניהול נשק
- **SerializedGear** - ניהול ציוד סדרתי
- **Equipment** - ניהול ציוד סטנדרטי
- **Drones** - ניהול רחפנים
- **DroneComponents** - ניהול רכיבי רחפנים
- **Divisions** - ניהול יחידות
- **Maintenance** - תחזוקה
- **Import** - ייבוא נתונים
- **DataExport** - ייצוא נתונים
- **UserManagement** - ניהול משתמשים
- **ArmoryDeposit** - הפקדה/שחרור ממחסן
- **SoldierRelease** - שחרור חיילים
- **EquipmentTransfer** - העברת ציוד
- **History** - היסטוריית פעילות
- **SecuritySettings** - הגדרות אבטחה
- **DailyVerification** - אימות יומי
- **VerificationHistory** - היסטוריית אימותים
- **MyEquipment/MyWeapons/MyGear/MyDrones** - ציוד אישי

##### רכיבי UI (Components)

**רכיבי UI בסיסיים:**

- `button.jsx` - כפתורים
- `card.jsx` - כרטיסים
- `dialog.jsx` - חלונות דיאלוג
- `form.jsx` - טפסים
- `input.jsx` - שדות קלט
- `select.jsx` - רשימות נפתחות
- `table.jsx` - טבלאות
- `sidebar.jsx` - סרגל צד
- `tabs.jsx` - טאבים
- `toast.jsx` - הודעות

**רכיבי עסק:**

- **armory/** - רכיבי מחסן
- **auth/** - אימות וזיהוי
- **common/** - רכיבים משותפים
- **dashboard/** - רכיבי לוח בקרה
- **divisions/** - רכיבי יחידות
- **drones/** - רכיבי רחפנים
- **equipment/** - רכיבי ציוד
- **gear/** - רכיבי ציוד סדרתי
- **import/** - רכיבי ייבוא
- **maintenance/** - רכיבי תחזוקה
- **release/** - רכיבי שחרור
- **signing/** - רכיבי חתימה
- **soldiers/** - רכיבי חיילים
- **ui/** - רכיבי ממשק משתמש
- **verification/** - רכיבי אימות
- **weapons/** - רכיבי נשק

#### 3. מערכת הרשאות

**תפקידים:**

- **Admin** - גישה מלאה לכל הפונקציות
- **Manager** - גישה מוגבלת לניהול ציוד ויחידות
- **User** - גישה בסיסית לצפייה
- **Soldier** - גישה מוגבלת לציוד אישי בלבד

**הרשאות מפורטות:**

- ניהול חיילים (יצירה, עריכה, מחיקה)
- ניהול נשק וציוד סדרתי
- ניהול רחפנים ורכיבים
- ניהול ציוד סטנדרטי
- פעולות מחסן (הפקדה/שחרור)
- אימות יומי
- תחזוקה
- העברת ציוד בין יחידות
- ייבוא/ייצוא נתונים
- ניהול משתמשים
- צפייה בדוחות והיסטוריה

#### 4. מערכת אימות ואבטחה

**אימות דו-שלבי (2FA):**

- חובה לכל המשתמשים
- TOTP (Time-based One-Time Password)
- אימות כל 24 שעות
- הגדרה ראשונית חובה

**קישור חייל:**

- כל משתמש מחויב לקשר חשבון לחייל
- חיילים רואים רק את הציוד שלהם
- משתמשים אחרים רואים לפי הרשאות

#### 5. זרימת נתונים

**1. טעינת נתונים:**

- כל דף טוען נתונים מ-Base44
- סינון לפי הרשאות משתמש
- סינון לפי יחידה (למנהלים)

**2. עדכון נתונים:**

- עדכונים דרך Base44 SDK
- לוג פעילות אוטומטי
- עדכון UI בזמן אמת

**3. ניהול מצב:**

- React Hooks לניהול state
- Context API לנתונים גלובליים
- Local storage לנתונים זמניים

## תכונות עיקריות

### 1. לוח בקרה (Dashboard)

- סקירה כללית של הציוד והחיילים
- סטטיסטיקות בזמן אמת
- התראות תחזוקה
- סינון לפי יחידות (למנהלים)

### 2. ניהול ציוד

- **נשק** - ניהול מלא של נשק אישי
- **ציוד סדרתי** - ניהול ציוד עם מספרי סדרה
- **ציוד סטנדרטי** - ניהול ציוד כללי
- **רחפנים** - ניהול מערכות רחפנים ורכיבים

### 3. ניהול חיילים

- רישום חיילים חדשים
- עדכון פרטים אישיים
- קישור לחשבונות משתמש
- מעקב אחר ציוד מוקצה

### 4. פעולות מחסן

- הפקדת ציוד למחסן
- שחרור ציוד מהמחסן
- מעקב אחר מצב ציוד
- דוחות מחסן

### 5. אימות יומי

- רשימת חיילים לאימות
- טופס אימות דיגיטלי
- חתימה דיגיטלית
- מעקב אחר אימותים

### 6. ייבוא/ייצוא נתונים

- ייבוא מ-CSV
- ייצוא ל-CSV/ZIP
- גיבוי נתונים
- שחזור נתונים

### 7. ניהול משתמשים

- יצירת משתמשים חדשים
- הקצאת הרשאות
- ניהול תפקידים
- מעקב אחר פעילות

## אבטחה

### 1. אימות

- Base44 Authentication
- TOTP 2FA חובה
- Session management
- Auto-logout

### 2. הרשאות

- Role-based access control
- Permission-based features
- Division-based data filtering
- Admin override capabilities

### 3. הגנת נתונים

- הצפנת נתונים ב-Base44
- HTTPS only
- Secure file uploads
- Data validation

## ביצועים

### 1. Frontend

- Vite build system
- Code splitting
- Lazy loading
- Optimized bundles

### 2. Backend

- Base44 serverless functions
- Auto-scaling
- CDN distribution
- Caching

### 3. Database

- Base44 managed database
- Automatic backups
- Real-time sync
- Query optimization

## תחזוקה ופיתוח

### 1. כלי פיתוח

- Vite dev server
- Hot reload
- ESLint
- TypeScript support

### 2. Testing

- Error boundaries
- Form validation
- API error handling
- User feedback

### 3. Deployment

- Vite build
- Static hosting
- Environment variables
- CI/CD ready

## סיכום

מערכת ARMORY היא פתרון מקיף ומודרני לניהול ציוד צבאי, הבנוי על טכנולוגיות מתקדמות ומספק חוויית משתמש מעולה עם אבטחה גבוהה. המערכת תומכת בכל צרכי הניהול של יחידה צבאית, מניהול חיילים וציוד ועד אימות יומי ודוחות מפורטים.

הארכיטקטורה המבוזרת עם Base44 מאפשרת גמישות וקלות תחזוקה, בעוד שממשק המשתמש המודרני מבטיח חוויית עבודה יעילה ונוחה.
