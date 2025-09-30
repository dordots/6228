# ארכיטקטורת מערכת ARMORY

## מבנה הקבצים

### דפים ראשיים (Pages)

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

### רכיבי UI (Components)

#### רכיבי UI בסיסיים:

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

#### רכיבי עסק:

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

## זרימת נתונים

### 1. טעינת נתונים:

- כל דף טוען נתונים מ-Base44
- סינון לפי הרשאות משתמש
- סינון לפי יחידה (למנהלים)

### 2. עדכון נתונים:

- עדכונים דרך Base44 SDK
- לוג פעילות אוטומטי
- עדכון UI בזמן אמת

### 3. ניהול מצב:

- React Hooks לניהול state
- Context API לנתונים גלובליים
- Local storage לנתונים זמניים

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