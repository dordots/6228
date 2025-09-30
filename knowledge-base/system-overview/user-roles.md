# תפקידי משתמשים והרשאות - מערכת ARMORY

## תפקידים

### Admin
- גישה מלאה לכל הפונקציות
- ניהול משתמשים ותפקידים
- צפייה בכל היחידות
- יכולת override על כל ההגבלות

### Manager
- גישה מוגבלת לניהול ציוד ויחידות
- ניהול חיילים ביחידה שלו
- צפייה בדוחות היחידה
- אישור פעולות מחסן

### User
- גישה בסיסית לצפייה
- יכולת עדכון מוגבלת
- צפייה בנתוני היחידה
- הגשת בקשות

### Soldier
- גישה מוגבלת לציוד אישי בלבד
- צפייה בציוד המוקצה לו
- אימות יומי של הציוד
- הגשת בקשות לציוד

## הרשאות מפורטות

### ניהול חיילים
- יצירת חיילים חדשים (Admin, Manager)
- עריכת פרטי חיילים (Admin, Manager)
- מחיקת חיילים (Admin בלבד)
- צפייה ברשימת חיילים (כולם לפי יחידה)

### ניהול נשק וציוד סדרתי
- הוספת נשק/ציוד חדש (Admin, Manager)
- עדכון סטטוס (Admin, Manager)
- הקצאה לחיילים (Admin, Manager)
- מחיקה (Admin בלבד)

### ניהול רחפנים ורכיבים
- יצירת מערכות רחפנים (Admin, Manager)
- ניהול רכיבים (Admin, Manager)
- הקצאה ושחרור (Admin, Manager)
- תחזוקה (Admin, Manager, User)

### ניהול ציוד סטנדרטי
- עדכון מלאי (Admin, Manager)
- הקצאות (Admin, Manager)
- דיווח על חוסרים (כולם)

### פעולות מחסן
- הפקדת ציוד (Admin, Manager)
- שחרור ציוד (Admin, Manager)
- אישור פעולות (Manager ומעלה)
- צפייה בהיסטוריה (כולם)

### אימות יומי
- יצירת רשימות אימות (Admin, Manager)
- ביצוע אימות (Soldier)
- אישור אימותים (Manager)
- דוחות אימות (Admin, Manager)

### תחזוקה
- יצירת משימות תחזוקה (Admin, Manager, User)
- עדכון סטטוס (Admin, Manager, User)
- דיווח תקלות (כולם)
- אישור תיקונים (Manager)

### העברת ציוד בין יחידות
- יוזמת העברה (Admin, Manager)
- אישור קבלה (Manager של יחידה מקבלת)
- ביטול העברה (Admin)

### ייבוא/ייצוא נתונים
- ייבוא נתונים (Admin בלבד)
- ייצוא נתונים (Admin, Manager)
- גיבוי מערכת (Admin)
- שחזור (Admin)

### ניהול משתמשים
- יצירת משתמשים (Admin)
- שינוי הרשאות (Admin)
- איפוס סיסמאות (Admin)
- ביטול משתמשים (Admin)

### צפייה בדוחות והיסטוריה
- דוחות יחידה (Manager ומעלה)
- דוחות מערכת (Admin)
- היסטוריית פעילות (כולם - מסונן לפי הרשאות)
- דוחות ביקורת (Admin)

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