# Firebase Migration Guide - Base44 to Firebase

## Why Firebase for Your Armory System?

Firebase is the ideal choice for your migration because:
- ✅ **Proven at Scale**: Used by millions of apps worldwide
- ✅ **Comprehensive Documentation**: Best-in-class guides and examples
- ✅ **Real-time Updates**: Perfect for equipment status tracking
- ✅ **Quick Migration**: 2 weeks to complete independence
- ✅ **Google Infrastructure**: Reliable and secure

## Pre-Migration Checklist

### Prerequisites:
- [ ] Google account
- [ ] Access to Base44 admin panel
- [ ] SendGrid API key
- [ ] Node.js 18+ installed
- [ ] Basic understanding of NoSQL concepts

### Tools to Install:
```bash
# Firebase CLI
npm install -g firebase-tools

# Firebase Admin SDK (for migration scripts)
npm install firebase-admin
```

## Week 1: Core Migration

### Day 1-2: Firebase Project Setup

#### 1. Create Firebase Project
```bash
# Login to Firebase
firebase login

# Create new project
firebase init

# Select:
# - Firestore
# - Functions
# - Hosting
# - Storage
# - Emulators (for local testing)
```

#### 2. Firestore Database Design

**Important**: Firestore is NoSQL, so we'll design collections that maintain your relationships while leveraging document structure.

```javascript
// Firestore Collections Structure

// soldiers/{soldierID}
{
  soldier_id: "SOLD_001",
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@army.mil",
  phone_number: "+1234567890",
  street_address: "123 Base Street",
  city: "Fort Bragg",
  division_name: "82nd Airborne",
  team_name: "Alpha",
  profession: "Infantry",
  enlistment_status: "active",
  arrival_date: "2024-01-15",
  created_at: Timestamp,
  updated_at: Timestamp,
  
  // Denormalized data for quick access
  assigned_equipment_count: 5,
  assigned_weapons_count: 2
}

// equipment/{equipmentID}
{
  equipment_id: "EQUIP_001",
  equipment_name: "Tactical Vest",
  equipment_type: "body_armor",
  status: "assigned",
  soldier_id: "SOLD_001", // Reference
  soldier_name: "John Doe", // Denormalized for display
  division_name: "82nd Airborne",
  created_at: Timestamp,
  updated_at: Timestamp
}

// weapons/{weaponID}
{
  weapon_id: "WPN_001",
  weapon_name: "M4 Carbine",
  serial_number: "12345678",
  weapon_type: "rifle",
  status: "assigned",
  soldier_id: "SOLD_001",
  soldier_name: "John Doe", // Denormalized
  division_name: "82nd Airborne",
  last_maintenance: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp
}

// serialized_gear/{gearID}
{
  gear_id: "GEAR_001",
  gear_name: "Night Vision Goggles",
  serial_number: "NVG123456",
  gear_type: "optics",
  status: "assigned",
  soldier_id: "SOLD_001",
  soldier_name: "John Doe",
  division_name: "82nd Airborne",
  created_at: Timestamp,
  updated_at: Timestamp
}

// activity_logs/{logID}
{
  entity_type: "weapon",
  entity_id: "WPN_001",
  action: "assigned",
  performed_by: "admin@army.mil",
  soldier_id: "SOLD_001",
  details: {
    previous_status: "available",
    new_status: "assigned",
    soldier_name: "John Doe"
  },
  created_at: Timestamp
}

// daily_verifications/{verificationID}
{
  soldier_id: "SOLD_001",
  soldier_name: "John Doe",
  division_name: "82nd Airborne",
  verification_date: "2024-01-20",
  status: "verified",
  equipment_checked: ["EQUIP_001", "EQUIP_002"],
  weapons_checked: ["WPN_001"],
  gear_checked: ["GEAR_001"],
  signature: "base64_signature_data",
  verified_by: "sergeant@army.mil",
  created_at: Timestamp
}
```

#### 3. Security Rules Configuration

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        request.auth.token.role == 'admin';
    }
    
    function isManager() {
      return isAuthenticated() && 
        (request.auth.token.role == 'admin' || 
         request.auth.token.role == 'manager');
    }
    
    function isSoldier(soldierID) {
      return isAuthenticated() && 
        request.auth.token.soldier_id == soldierID;
    }
    
    function belongsToDivision(division) {
      return isAuthenticated() && 
        request.auth.token.division == division;
    }
    
    // Soldiers collection
    match /soldiers/{soldierID} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin() || 
        (isManager() && belongsToDivision(resource.data.division_name));
      allow delete: if isAdmin();
    }
    
    // Equipment collection
    match /equipment/{equipmentID} {
      allow read: if isAuthenticated();
      allow create: if isManager();
      allow update: if isManager() && 
        (isAdmin() || belongsToDivision(resource.data.division_name));
      allow delete: if isAdmin();
    }
    
    // Weapons collection
    match /weapons/{weaponID} {
      allow read: if isAuthenticated();
      allow create: if isManager();
      allow update: if isManager();
      allow delete: if isAdmin();
    }
    
    // Activity logs - read only for most users
    match /activity_logs/{logID} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if false; // Never update logs
      allow delete: if isAdmin();
    }
    
    // Daily verifications
    match /daily_verifications/{verificationID} {
      allow read: if isAuthenticated();
      allow create: if isManager();
      allow update: if false; // Immutable once created
      allow delete: if isAdmin();
    }
  }
}
```

#### 4. Authentication Setup

```javascript
// Enable Authentication providers in Firebase Console:
// 1. Phone or Email Authentication
// 2. Phone (for 2FA)

// Initialize Firebase Admin SDK for custom claims
const admin = require('firebase-admin');
admin.initializeApp();

// Function to set custom claims for roles
async function setUserRole(uid, role, soldierID, division) {
  await admin.auth().setCustomUserClaims(uid, {
    role: role,
    soldier_id: soldierID,
    division: division
  });
}
```

### Day 3-4: Data Migration

#### 1. Export Data from Base44
```javascript
// First, use your existing Base44 function
const exportedData = await exportAllData();
// This gives you a ZIP with CSV files
```

#### 2. Migration Script
```javascript
// migrate-to-firebase.js
const admin = require('firebase-admin');
const fs = require('fs').promises;
const csv = require('csv-parse/sync');
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'your-project-id'
});

const db = admin.firestore();
const auth = admin.auth();

async function migrateData() {
  console.log('Starting migration to Firebase...');
  
  // 1. Migrate Soldiers
  console.log('Migrating soldiers...');
  const soldiersCSV = await fs.readFile('./export/soldiers.csv', 'utf-8');
  const soldiers = csv.parse(soldiersCSV, { columns: true });
  
  const soldierBatch = db.batch();
  let soldierCount = 0;
  
  for (const soldier of soldiers) {
    const docRef = db.collection('soldiers').doc(soldier.soldier_id);
    soldierBatch.set(docRef, {
      soldier_id: soldier.soldier_id,
      first_name: soldier.first_name,
      last_name: soldier.last_name,
      email: soldier.email || null,
      phone_number: soldier.phone_number || null,
      street_address: soldier.street_address || null,
      city: soldier.city || null,
      division_name: soldier.division_name || null,
      team_name: soldier.team_name || null,
      profession: soldier.profession || null,
      enlistment_status: soldier.enlistment_status || 'active',
      arrival_date: soldier.arrival_date || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      assigned_equipment_count: 0,
      assigned_weapons_count: 0
    });
    
    soldierCount++;
    
    // Firestore has a limit of 500 operations per batch
    if (soldierCount % 500 === 0) {
      await soldierBatch.commit();
      soldierBatch = db.batch();
      console.log(`Migrated ${soldierCount} soldiers...`);
    }
  }
  
  await soldierBatch.commit();
  console.log(`✓ Migrated ${soldierCount} soldiers`);
  
  // 2. Migrate Equipment
  console.log('Migrating equipment...');
  const equipmentCSV = await fs.readFile('./export/equipment.csv', 'utf-8');
  const equipment = csv.parse(equipmentCSV, { columns: true });
  
  const equipBatch = db.batch();
  let equipCount = 0;
  
  for (const item of equipment) {
    const docRef = db.collection('equipment').doc(item.equipment_id);
    
    // If assigned to soldier, get soldier name for denormalization
    let soldierName = null;
    if (item.soldier_id) {
      const soldierDoc = await db.collection('soldiers').doc(item.soldier_id).get();
      if (soldierDoc.exists) {
        const soldierData = soldierDoc.data();
        soldierName = `${soldierData.first_name} ${soldierData.last_name}`;
      }
    }
    
    equipBatch.set(docRef, {
      equipment_id: item.equipment_id,
      equipment_name: item.equipment_name,
      equipment_type: item.equipment_type || 'general',
      status: item.status || 'available',
      soldier_id: item.soldier_id || null,
      soldier_name: soldierName,
      division_name: item.division_name || null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    equipCount++;
    
    if (equipCount % 500 === 0) {
      await equipBatch.commit();
      equipBatch = db.batch();
      console.log(`Migrated ${equipCount} equipment items...`);
    }
  }
  
  await equipBatch.commit();
  console.log(`✓ Migrated ${equipCount} equipment items`);
  
  // 3. Update soldier equipment counts
  console.log('Updating soldier equipment counts...');
  for (const soldier of soldiers) {
    const equipmentSnapshot = await db.collection('equipment')
      .where('soldier_id', '==', soldier.soldier_id)
      .get();
    
    const weaponsSnapshot = await db.collection('weapons')
      .where('soldier_id', '==', soldier.soldier_id)
      .get();
    
    await db.collection('soldiers').doc(soldier.soldier_id).update({
      assigned_equipment_count: equipmentSnapshot.size,
      assigned_weapons_count: weaponsSnapshot.size
    });
  }
  
  console.log('✓ Migration complete!');
}

// Run migration
migrateData().catch(console.error);
```

### Day 5-7: Cloud Functions Implementation

#### 1. Initialize Functions
```bash
cd functions
npm install @sendgrid/mail otpauth qrcode firebase-admin
```

#### 2. Implement Backend Functions
```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const OTPAuth = require('otpauth');
const QRCode = require('qrcode');

admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid
sgMail.setApiKey(functions.config().sendgrid.api_key);

// 1. Delete All Functions (with rate limiting)
exports.deleteAllEquipment = functions
  .runWith({ timeoutSeconds: 300 })
  .https.onCall(async (data, context) => {
    // Check admin role
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can delete all equipment'
      );
    }
    
    const batchSize = 100;
    const equipmentRef = db.collection('equipment');
    
    let deleted = 0;
    let batch = db.batch();
    
    const snapshot = await equipmentRef.limit(batchSize).get();
    
    while (!snapshot.empty) {
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deleted++;
      });
      
      await batch.commit();
      batch = db.batch();
      
      // Rate limiting - wait 100ms between batches
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const nextSnapshot = await equipmentRef.limit(batchSize).get();
      if (nextSnapshot.empty) break;
    }
    
    // Log activity
    await db.collection('activity_logs').add({
      entity_type: 'equipment',
      action: 'bulk_delete',
      performed_by: context.auth.uid,
      details: { count: deleted },
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { deleted };
  });

// 2. Generate TOTP
exports.generateTotp = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const uid = context.auth.uid;
    const user = await admin.auth().getUser(uid);
    
    // Generate secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'Armory System',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret
    });
    
    // Store temporary secret in user metadata
    await admin.auth().updateUser(uid, {
      customClaims: {
        ...user.customClaims,
        totp_temp_secret: secret.base32
      }
    });
    
    // Generate QR code
    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    
    return {
      qrCodeUrl: qrCodeDataUrl,
      secret: secret.base32
    };
  });

// 3. Verify TOTP
exports.verifyTotp = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }
    
    const { token } = data;
    const uid = context.auth.uid;
    const user = await admin.auth().getUser(uid);
    
    const tempSecret = user.customClaims?.totp_temp_secret;
    const permanentSecret = user.customClaims?.totp_secret;
    
    const secret = tempSecret || permanentSecret;
    if (!secret) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No TOTP secret found'
      );
    }
    
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30
    });
    
    const delta = totp.validate({ token, window: 1 });
    
    if (delta === null) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid TOTP token'
      );
    }
    
    // If using temp secret, make it permanent
    if (tempSecret) {
      await admin.auth().updateUser(uid, {
        customClaims: {
          ...user.customClaims,
          totp_secret: tempSecret,
          totp_temp_secret: null,
          totp_enabled: true
        }
      });
    }
    
    return { success: true };
  });

// 4. Send Daily Report
exports.sendDailyReport = functions.https.onCall(async (data, context) => {
    // Check manager role
    if (!context.auth || 
        (context.auth.token.role !== 'admin' && 
         context.auth.token.role !== 'manager')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only managers can send reports'
      );
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Gather statistics
    const [soldiers, equipment, weapons, verifications] = await Promise.all([
      db.collection('soldiers').count().get(),
      db.collection('equipment').where('status', '==', 'assigned').count().get(),
      db.collection('weapons').where('status', '==', 'assigned').count().get(),
      db.collection('daily_verifications')
        .where('created_at', '>=', today)
        .count().get()
    ]);
    
    const htmlContent = `
      <h2>Daily Armory Report - ${today.toLocaleDateString()}</h2>
      <table>
        <tr><td>Total Soldiers:</td><td>${soldiers.data().count}</td></tr>
        <tr><td>Equipment Assigned:</td><td>${equipment.data().count}</td></tr>
        <tr><td>Weapons Assigned:</td><td>${weapons.data().count}</td></tr>
        <tr><td>Daily Verifications:</td><td>${verifications.data().count}</td></tr>
      </table>
    `;
    
    const msg = {
      to: functions.config().sendgrid.report_email,
      from: functions.config().sendgrid.from_email,
      subject: `Daily Armory Report - ${today.toLocaleDateString()}`,
      html: htmlContent
    };
    
    await sgMail.send(msg);
    
    return { success: true, sent_to: msg.to };
  });

// 5. Export All Data
exports.exportAllData = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can export data'
      );
    }
    
    // This function would create CSV files and upload to Firebase Storage
    // Then return a signed URL for download
    // Implementation details omitted for brevity
    
    return { downloadUrl: 'signed-url-here' };
  });

// Add more functions as needed...
```

#### 3. Deploy Functions
```bash
# Set environment variables
firebase functions:config:set sendgrid.api_key="YOUR_KEY"
firebase functions:config:set sendgrid.from_email="noreply@armory.mil"
firebase functions:config:set sendgrid.report_email="commander@armory.mil"

# Deploy
firebase deploy --only functions
```

## Week 2: Frontend Integration

### Day 8-9: Update Frontend Code

#### 1. Install Firebase SDK
```bash
npm uninstall @base44/sdk
npm install firebase
```

#### 2. Initialize Firebase
```javascript
// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
```

#### 3. Create API Compatibility Layer
```javascript
// src/api/firebase-adapter.js
import { 
  collection, doc, getDoc, getDocs, addDoc, updateDoc, 
  deleteDoc, query, where, orderBy, limit, Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Helper to convert Firestore document to Base44-like format
const convertDoc = (doc) => ({
  id: doc.id,
  ...doc.data(),
  created_at: doc.data().created_at?.toDate?.() || null,
  updated_at: doc.data().updated_at?.toDate?.() || null
});

// Create entity adapter factory
const createEntityAdapter = (collectionName) => ({
  // Create
  create: async (data) => {
    const docData = {
      ...data,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, collectionName), docData);
    const newDoc = await getDoc(docRef);
    
    return convertDoc(newDoc);
  },
  
  // Find Many
  findMany: async (options = {}) => {
    let q = collection(db, collectionName);
    
    // Build query
    if (options.where) {
      Object.entries(options.where).forEach(([field, value]) => {
        if (typeof value === 'object') {
          // Handle operators like gt, gte, lt, lte
          Object.entries(value).forEach(([op, val]) => {
            switch(op) {
              case 'equals':
                q = query(q, where(field, '==', val));
                break;
              case 'gt':
                q = query(q, where(field, '>', val));
                break;
              case 'gte':
                q = query(q, where(field, '>=', val));
                break;
              case 'lt':
                q = query(q, where(field, '<', val));
                break;
              case 'lte':
                q = query(q, where(field, '<=', val));
                break;
              case 'contains':
                // Firestore doesn't have contains, use array-contains
                q = query(q, where(field, 'array-contains', val));
                break;
            }
          });
        } else {
          q = query(q, where(field, '==', value));
        }
      });
    }
    
    // Sorting
    if (options.orderBy) {
      Object.entries(options.orderBy).forEach(([field, direction]) => {
        q = query(q, orderBy(field, direction));
      });
    }
    
    // Limit
    if (options.take) {
      q = query(q, limit(options.take));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(convertDoc);
  },
  
  // Find First
  findFirst: async (options = {}) => {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  },
  
  // Update
  update: async (id, data) => {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updated_at: Timestamp.now()
    });
    
    const updatedDoc = await getDoc(docRef);
    return convertDoc(updatedDoc);
  },
  
  // Delete
  delete: async (id) => {
    await deleteDoc(doc(db, collectionName, id));
  }
});

// src/api/entities.js
import { createEntityAdapter } from './firebase-adapter';

export const Soldier = createEntityAdapter('soldiers');
export const Equipment = createEntityAdapter('equipment');
export const Weapon = createEntityAdapter('weapons');
export const SerializedGear = createEntityAdapter('serialized_gear');
export const DroneSet = createEntityAdapter('drone_sets');
export const DroneComponent = createEntityAdapter('drone_components');
export const ActivityLog = createEntityAdapter('activity_logs');
export const DailyVerification = createEntityAdapter('daily_verifications');
```

#### 4. Update Authentication
```javascript
// src/api/auth.js
import { 
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase/config';

export const User = {
  // Login with phone or email
  login: async ({ emailOrPhone, password, verificationCode }) => {
    // Check if input is phone or email
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
    
    if (isPhone) {
      // Phone authentication flow
      if (!window.confirmationResult) {
        // First step: send verification code
        window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            // reCAPTCHA solved
          }
        }, auth);
        
        window.confirmationResult = await signInWithPhoneNumber(auth, emailOrPhone, window.recaptchaVerifier);
        return { requiresVerification: true };
      } else {
        // Second step: verify code
        const result = await window.confirmationResult.confirm(verificationCode);
        return result.user;
      }
    } else {
      // Email authentication flow
      const userCredential = await signInWithEmailAndPassword(auth, emailOrPhone, password);
      return userCredential.user;
    }
  },
  
  // Register with phone or email
  register: async ({ emailOrPhone, password, verificationCode }) => {
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(emailOrPhone);
    
    if (isPhone) {
      // Phone registration uses same flow as login
      return User.login({ emailOrPhone, verificationCode });
    } else {
      // Email registration
      const userCredential = await createUserWithEmailAndPassword(auth, emailOrPhone, password);
      return userCredential.user;
    }
  },
  
  // Get current user
  me: async () => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  },
  
  // Logout
  logout: async () => {
    await signOut(auth);
  },
  
  // TOTP functions
  generateTotp: async () => {
    const generateTotpFn = httpsCallable(functions, 'generateTotp');
    const result = await generateTotpFn();
    return result.data;
  },
  
  verifyTotp: async (token) => {
    const verifyTotpFn = httpsCallable(functions, 'verifyTotp');
    const result = await verifyTotpFn({ token });
    return result.data;
  }
};
```

#### 5. Update Function Calls
```javascript
// src/api/functions.js
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

// Create function wrapper
const createFunction = (name) => async (data) => {
  const fn = httpsCallable(functions, name);
  const result = await fn(data);
  return result.data;
};

export const sendDailyReport = createFunction('sendDailyReport');
export const deleteAllEquipment = createFunction('deleteAllEquipment');
export const deleteAllSoldiers = createFunction('deleteAllSoldiers');
export const deleteAllWeapons = createFunction('deleteAllWeapons');
export const deleteAllSerializedGear = createFunction('deleteAllSerializedGear');
export const generateTotp = createFunction('generateTotp');
export const verifyTotp = createFunction('verifyTotp');
export const exportAllData = createFunction('exportAllData');
export const generateSigningForm = createFunction('generateSigningForm');
export const generateReleaseForm = createFunction('generateReleaseForm');
export const sendSigningForm = createFunction('sendSigningForm');
export const sendReleaseFormByActivity = createFunction('sendReleaseFormByActivity');
export const sendBulkEquipmentForms = createFunction('sendBulkEquipmentForms');
export const sendEmailViaSendGrid = createFunction('sendEmailViaSendGrid');
export const testSendGrid = createFunction('testSendGrid');
```

### Day 10-14: Testing & Optimization

#### 1. Testing Checklist
- [ ] Authentication flow (login, register, logout)
- [ ] TOTP setup and verification
- [ ] All CRUD operations for each entity
- [ ] Complex queries with filters
- [ ] Pagination
- [ ] All Cloud Functions
- [ ] File uploads to Firebase Storage
- [ ] Security rules enforcement
- [ ] Real-time updates (bonus feature)

#### 2. Performance Optimization

```javascript
// Enable offline persistence
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time
  } else if (err.code === 'unimplemented') {
    // The current browser doesn't support persistence
  }
});

// Use real-time listeners for live updates
import { onSnapshot } from 'firebase/firestore';

// Example: Live equipment status
const unsubscribe = onSnapshot(
  query(collection(db, 'equipment'), where('soldier_id', '==', soldierID)),
  (snapshot) => {
    const equipment = snapshot.docs.map(convertDoc);
    // Update UI with live data
  }
);
```

#### 3. Deploy to Production

```bash
# Build React app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Your app is now live!
```

## Common Migration Issues & Solutions

### Issue 1: NoSQL Query Limitations
**Problem**: Can't do complex SQL-like joins
**Solution**: Denormalize data (store soldier name with equipment)

```javascript
// When assigning equipment, include soldier data
await Equipment.update(equipmentId, {
  soldier_id: soldierID,
  soldier_name: `${soldier.first_name} ${soldier.last_name}`,
  division_name: soldier.division_name
});
```

### Issue 2: Transaction Limitations
**Problem**: Firestore transactions limited to 500 operations
**Solution**: Use batched writes for bulk operations

```javascript
const batch = db.batch();
let operationCount = 0;

for (const item of items) {
  batch.set(doc(collection(db, 'equipment')), item);
  operationCount++;
  
  if (operationCount === 500) {
    await batch.commit();
    batch = db.batch();
    operationCount = 0;
  }
}

if (operationCount > 0) {
  await batch.commit();
}
```

### Issue 3: No Auto-increment IDs
**Problem**: Firebase uses auto-generated IDs
**Solution**: Keep your existing IDs as a field

```javascript
// Store with custom ID
await setDoc(doc(db, 'soldiers', soldier.soldier_id), soldierData);
```

## Cost Optimization

### 1. Minimize Reads
```javascript
// Bad: Reading entire collection
const allSoldiers = await getDocs(collection(db, 'soldiers'));

// Good: Use queries
const activeSoldiers = await getDocs(
  query(collection(db, 'soldiers'), 
    where('enlistment_status', '==', 'active'),
    limit(50)
  )
);
```

### 2. Use Compound Queries
```javascript
// Create composite indexes for common queries
// In firestore.indexes.json:
{
  "indexes": [
    {
      "collectionGroup": "equipment",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "division_name", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 3. Cache Frequently Used Data
```javascript
// Use React Context or state management
const divisionsCache = useMemo(() => {
  return getDivisions();
}, []);
```

## Monitoring & Maintenance

### 1. Enable Firebase Analytics
```javascript
import { getAnalytics } from 'firebase/analytics';
const analytics = getAnalytics(app);
```

### 2. Monitor Usage in Firebase Console
- Check daily active users
- Monitor read/write operations
- Set up billing alerts
- Review security rules usage

### 3. Regular Backups
```bash
# Export Firestore data regularly
gcloud firestore export gs://your-backup-bucket/$(date +%Y%m%d)
```

## Future Enhancements with Firebase

### 1. Real-time Equipment Tracking
```javascript
// Show live equipment status
onSnapshot(doc(db, 'equipment', equipmentId), (doc) => {
  updateEquipmentStatus(doc.data());
});
```

### 2. Push Notifications
```javascript
import { getMessaging, getToken } from 'firebase/messaging';

const messaging = getMessaging();
const token = await getToken(messaging);
// Send token to server for push notifications
```

### 3. Advanced Analytics
```javascript
import { logEvent } from 'firebase/analytics';

logEvent(analytics, 'equipment_assigned', {
  equipment_type: 'weapon',
  soldier_id: soldierID
});
```

## Rollback Plan

If you need to rollback:

1. **Keep Base44 active** for 30 days after migration
2. **Export Firebase data** regularly
3. **Quick switch** via environment variables:
   ```javascript
   const USE_FIREBASE = process.env.REACT_APP_USE_FIREBASE === 'true';
   const api = USE_FIREBASE ? firebaseAPI : base44API;
   ```

## Conclusion

This migration guide provides everything needed to move from Base44 to Firebase in 2 weeks. Firebase offers:
- Battle-tested infrastructure
- Comprehensive documentation
- Real-time capabilities
- Excellent scalability
- Strong community support

Follow this guide step-by-step, test thoroughly, and you'll have a robust, scalable armory management system running on Firebase!