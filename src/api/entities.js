// Import both adapters at the top
import { createBoundEntityAdapter } from './firebase-adapter';
import { User as FirebaseUser } from '../firebase/auth-adapter';
import { base44 } from './base44Client';

// Use Firebase adapter if enabled, otherwise fall back to Base44
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE !== 'false';

let Soldier, Equipment, Weapon, SerializedGear, DroneSet, DroneSetType, DroneComponent, ActivityLog, DailyVerification, User, UserProfile;

if (USE_FIREBASE) {
  // Use Firebase adapter
  Soldier = createBoundEntityAdapter('soldiers', { idField: 'soldier_id' });
  Equipment = createBoundEntityAdapter('equipment', { idField: 'equipment_id' });
  Weapon = createBoundEntityAdapter('weapons', { idField: 'weapon_id' });
  SerializedGear = createBoundEntityAdapter('serialized_gear', { idField: 'gear_id' });
  DroneSet = createBoundEntityAdapter('drone_sets', { idField: 'drone_set_id' });
  DroneSetType = createBoundEntityAdapter('drone_set_types');
  DroneComponent = createBoundEntityAdapter('drone_components', { idField: 'component_id' });
  ActivityLog = createBoundEntityAdapter('activity_logs');
  DailyVerification = createBoundEntityAdapter('daily_verifications');
  UserProfile = createBoundEntityAdapter('users'); // For querying users collection by linked_soldier_id
  User = FirebaseUser;

  console.log('Using Firebase backend');
} else {
  // Use Base44 SDK
  if (base44) {
    Soldier = base44.entities.Soldier;
    Equipment = base44.entities.Equipment;
    Weapon = base44.entities.Weapon;
    SerializedGear = base44.entities.SerializedGear;
    DroneSet = base44.entities.DroneSet;
    DroneSetType = base44.entities.DroneSetType;
    DroneComponent = base44.entities.DroneComponent;
    ActivityLog = base44.entities.ActivityLog;
    DailyVerification = base44.entities.DailyVerification;
    UserProfile = null; // Not needed for Base44
    User = base44.auth;
  }

  console.log('Using Base44 backend');
}

// Export entity models
export { Soldier, Equipment, Weapon, SerializedGear, DroneSet, DroneSetType, DroneComponent, ActivityLog, DailyVerification, User, UserProfile };