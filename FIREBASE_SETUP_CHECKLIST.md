# Firebase Setup Checklist - Day 1-2

## Prerequisites
- [ ] Have a Google account
- [ ] Have Node.js 18+ installed
- [ ] Have access to Base44 to export data

## Day 1: Firebase Project Setup

### 1. Create Firebase Project
- [ ] Go to https://console.firebase.google.com
- [ ] Click "Create a project"
- [ ] Name your project (e.g., "armory-system")
- [ ] Enable/disable Google Analytics as preferred
- [ ] Wait for project creation to complete

### 2. Get Firebase Configuration
- [ ] In Firebase Console, click the gear icon → Project settings
- [ ] Scroll down to "Your apps" section
- [ ] Click "</>" (Web) icon
- [ ] Register app with a nickname (e.g., "armory-web")
- [ ] Copy the configuration values
- [ ] Update `.env.local` with your Firebase config values:
  ```
  REACT_APP_FIREBASE_API_KEY=your-actual-api-key
  REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
  REACT_APP_FIREBASE_PROJECT_ID=your-project-id
  REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
  REACT_APP_FIREBASE_APP_ID=your-app-id
  ```

### 3. Enable Firebase Services
- [ ] **Authentication**:
  - Go to Authentication → Get started
  - Enable Email/Password provider
  - Save
- [ ] **Firestore Database**:
  - Go to Firestore Database → Create database
  - Start in "test mode" for now (we'll secure it later)
  - Choose your region (closest to users)
- [ ] **Storage**:
  - Go to Storage → Get started
  - Start in test mode
  - Choose same region as Firestore
- [ ] **Functions** (Requires Blaze plan):
  - Go to Functions → Get started
  - Upgrade to Blaze plan (pay-as-you-go)
  - No charges if you stay within free tier limits

### 4. Install Firebase CLI
```bash
- [ ] npm install -g firebase-tools
- [ ] firebase login
- [ ] firebase use --add (select your project)
```

### 5. Update Project Configuration
- [ ] Edit `.firebaserc` and replace "your-project-id" with your actual project ID
- [ ] Verify all Firebase config files are in place:
  - ✅ firebase.json
  - ✅ .firebaserc
  - ✅ firestore.rules
  - ✅ firestore.indexes.json
  - ✅ storage.rules

### 6. Initialize Functions
```bash
cd functions
- [ ] npm install
- [ ] Set up SendGrid config:
      firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_KEY"
      firebase functions:config:set sendgrid.from_email="noreply@yourdomain.com"
      firebase functions:config:set sendgrid.report_email="reports@yourdomain.com"
```

### 7. Test Firebase Setup
```bash
# In project root
- [ ] firebase emulators:start
- [ ] Visit http://localhost:4000 (Emulator UI)
- [ ] Verify all services are running
```

## Day 2: Initial Data Structure

### 1. Create Firestore Collections
Using Firebase Console or Emulator UI, create test documents in each collection:
- [ ] Create a test soldier in `soldiers` collection
- [ ] Create test equipment in `equipment` collection
- [ ] Create a test weapon in `weapons` collection
- [ ] Verify security rules work (try as authenticated/unauthenticated)

### 2. Deploy Security Rules
```bash
- [ ] firebase deploy --only firestore:rules
- [ ] firebase deploy --only firestore:indexes
- [ ] firebase deploy --only storage:rules
```

### 3. Create First Cloud Function
- [ ] Create `functions/auth.js` with generateTotp function
- [ ] Create `functions/data.js` with deleteAllEquipment function
- [ ] Create `functions/email.js` with testSendGrid function
- [ ] Test locally with emulator

### 4. Prepare for Migration
- [ ] Export data from Base44 using exportAllData function
- [ ] Save the ZIP file
- [ ] Extract CSVs for inspection
- [ ] Review data structure and plan any transformations

## Next Steps (Day 3-4)
- [ ] Create data migration script
- [ ] Import all Base44 data to Firestore
- [ ] Implement remaining Cloud Functions
- [ ] Begin frontend integration

## Troubleshooting

### Common Issues:
1. **"firebase command not found"**
   - Make sure you installed firebase-tools globally
   - Try `npx firebase` instead

2. **Authentication errors**
   - Run `firebase login --reauth`
   - Check you selected the right project

3. **Firestore permission denied**
   - Check security rules
   - Make sure you're authenticated in test

4. **Functions not deploying**
   - Ensure you're on Blaze plan
   - Check functions/package.json syntax

## Resources
- [Firebase Console](https://console.firebase.google.com)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Data Modeling](https://firebase.google.com/docs/firestore/data-model)
- [Cloud Functions Guide](https://firebase.google.com/docs/functions)

---

Mark items with ✅ as you complete them. Good luck with your migration!