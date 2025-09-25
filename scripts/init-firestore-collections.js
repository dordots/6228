import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeCollections() {
  console.log('Initializing Firestore collections...');

  // Define collection schemas with sample documents
  const collections = {
    soldiers: {
      id: 'SAMPLE_SOLDIER',
      data: {
        soldier_id: 'SAMPLE_SOLDIER',
        first_name: 'Sample',
        last_name: 'Soldier',
        email: 'sample@example.com',
        phone_number: '+1234567890',
        street_address: '123 Base Street',
        city: 'Fort Sample',
        division_name: 'Sample Division',
        team_name: 'Alpha',
        profession: 'Infantry',
        enlistment_status: 'active',
        arrival_date: '2024-01-01',
        assigned_equipment_count: 0,
        assigned_weapons_count: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    equipment: {
      id: 'SAMPLE_EQUIPMENT',
      data: {
        equipment_id: 'SAMPLE_EQUIPMENT',
        equipment_name: 'Sample Equipment',
        equipment_type: 'general',
        status: 'available',
        soldier_id: null,
        soldier_name: null,
        division_name: 'Sample Division',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    weapons: {
      id: 'SAMPLE_WEAPON',
      data: {
        weapon_id: 'SAMPLE_WEAPON',
        weapon_name: 'Sample Weapon',
        serial_number: 'SAMPLE123',
        weapon_type: 'rifle',
        status: 'available',
        soldier_id: null,
        soldier_name: null,
        division_name: 'Sample Division',
        last_maintenance: serverTimestamp(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    serialized_gear: {
      id: 'SAMPLE_GEAR',
      data: {
        gear_id: 'SAMPLE_GEAR',
        gear_name: 'Sample Gear',
        serial_number: 'GEAR123',
        gear_type: 'optics',
        status: 'available',
        soldier_id: null,
        soldier_name: null,
        division_name: 'Sample Division',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    drone_sets: {
      id: 'SAMPLE_DRONE_SET',
      data: {
        drone_set_id: 'SAMPLE_DRONE_SET',
        drone_set_name: 'Sample Drone Set',
        drone_type: 'reconnaissance',
        status: 'available',
        soldier_id: null,
        soldier_name: null,
        division_name: 'Sample Division',
        components_count: 0,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    drone_components: {
      id: 'SAMPLE_COMPONENT',
      data: {
        component_id: 'SAMPLE_COMPONENT',
        component_name: 'Sample Component',
        component_type: 'camera',
        serial_number: 'COMP123',
        drone_set_id: 'SAMPLE_DRONE_SET',
        status: 'operational',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }
    },
    activity_logs: {
      id: 'SAMPLE_LOG',
      data: {
        entity_type: 'system',
        entity_id: 'INIT',
        action: 'collections_initialized',
        performed_by: 'system',
        details: {
          message: 'Firestore collections initialized'
        },
        created_at: serverTimestamp()
      }
    },
    daily_verifications: {
      id: 'SAMPLE_VERIFICATION',
      data: {
        soldier_id: 'SAMPLE_SOLDIER',
        soldier_name: 'Sample Soldier',
        division_name: 'Sample Division',
        verification_date: new Date().toISOString().split('T')[0],
        status: 'verified',
        equipment_checked: [],
        weapons_checked: [],
        gear_checked: [],
        drone_sets_checked: [],
        signature: null,
        verified_by: 'system',
        created_at: serverTimestamp()
      }
    }
  };

  // Create collections with sample documents
  for (const [collectionName, { id, data }] of Object.entries(collections)) {
    try {
      await setDoc(doc(db, collectionName, id), data);
      console.log(`✅ Created ${collectionName} collection with sample document`);
    } catch (error) {
      console.error(`❌ Error creating ${collectionName}:`, error);
    }
  }

  console.log('\n🎉 All collections initialized successfully!');
  console.log('\nNext steps:');
  console.log('1. Delete the sample documents from Firebase Console');
  console.log('2. Or keep them for testing purposes');
  console.log('3. Run the data migration script when ready');
}

// Run the initialization
initializeCollections().catch(console.error);