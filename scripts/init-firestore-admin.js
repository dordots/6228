import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin SDK with service account
const serviceAccount = JSON.parse(
  readFileSync('./knowledge-base/project-1386902152066454120-firebase-adminsdk-fbsvc-93de658225.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'project-1386902152066454120'
});

const db = admin.firestore();

async function initializeCollections() {
  console.log('Initializing Firestore collections with Admin SDK...');

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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        last_maintenance: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp()
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
        created_at: admin.firestore.FieldValue.serverTimestamp()
      }
    }
  };

  // Create collections with sample documents
  for (const [collectionName, { id, data }] of Object.entries(collections)) {
    try {
      await db.collection(collectionName).doc(id).set(data);
      console.log(`✅ Created ${collectionName} collection with sample document`);
    } catch (error) {
      console.error(`❌ Error creating ${collectionName}:`, error);
    }
  }

  console.log('\n🎉 All collections initialized successfully!');
  console.log('\nNext steps:');
  console.log('1. Delete the sample documents from Firebase Console if not needed');
  console.log('2. Or keep them for testing purposes');
  console.log('3. Run the data migration script when ready');
  
  // Gracefully exit
  process.exit(0);
}

// Run the initialization
initializeCollections().catch(console.error);