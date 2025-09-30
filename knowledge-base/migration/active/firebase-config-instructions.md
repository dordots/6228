# Firebase Configuration Instructions

## Your Project Details
- **Project ID**: project-1386902152066454120
- **Service Account**: firebase-adminsdk-fbsvc@project-1386902152066454120.iam.gserviceaccount.com

## ⚠️ Security Warning
The service account JSON file contains sensitive credentials. **NEVER commit this to git!**

## Next Steps to Complete Setup:

### 1. Get Your Web App Configuration
Since you have the service account key but not the web app configuration, you need to:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **project-1386902152066454120**
3. Click the gear icon → Project settings
4. Scroll down to "Your apps" section
5. If no web app exists:
   - Click "</>" (Web) icon
   - Register app with nickname "armory-web"
   - Copy the configuration
6. If web app exists:
   - Click on it and copy the configuration

The configuration will look like:
```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "project-1386902152066454120.firebaseapp.com",
  projectId: "project-1386902152066454120",
  storageBucket: "project-1386902152066454120.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 2. Update .env.local
Once you have the web configuration, update your `.env.local` file with the actual values.

### 3. Service Account Key Usage
The service account key is used for:
- Admin SDK operations (server-side)
- Data migration scripts
- Cloud Functions (automatically when deployed)

For local development with the admin SDK:
1. Save the service account JSON to a secure location
2. Set environment variable: 
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
   ```

### 4. Enable Firebase Services
Make sure these are enabled in your Firebase Console:
- [ ] Authentication (with Email/Password provider)
- [ ] Firestore Database
- [ ] Cloud Functions (requires Blaze plan)
- [ ] Storage

### 5. Security Best Practices
1. **Never commit** the service account JSON to git
2. **Restrict access** - only use on secure servers
3. **Rotate keys** periodically in Firebase Console
4. **Use environment variables** for production

### 6. Test Your Setup
```bash
# Test Firebase CLI connection
firebase projects:list

# You should see:
# project-1386902152066454120 (current)
```

## For Data Migration
When you're ready to migrate data from Base44, you'll use this service account key:

```javascript
// migrate-data.js
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

## Questions?
If you need help finding your web app configuration or setting up services, let me know!