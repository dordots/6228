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

## סיכום

מערכת ARMORY היא פתרון מקיף ומודרני לניהול ציוד צבאי, הבנוי על טכנולוגיות מתקדמות ומספק חוויית משתמש מעולה עם אבטחה גבוהה. המערכת תומכת בכל צרכי הניהול של יחידה צבאית, מניהול חיילים וציוד ועד אימות יומי ודוחות מפורטים.

הארכיטקטורה המבוזרת עם Base44 מאפשרת גמישות וקלות תחזוקה, בעוד שממשק המשתמש המודרני מבטיח חוויית עבודה יעילה ונוחה.

## מסמכים נוספים

- [ארכיטקטורת המערכת](architecture.md)
- [תכונות עיקריות](features.md)
- [תפקידי משתמשים והרשאות](user-roles.md)