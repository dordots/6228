# Firestore Schema Documentation

## Collections Structure

### 1. soldiers
```javascript
{
  // Document ID: soldier_id (e.g., "SOLD_001")
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
  enlistment_status: "active", // "expected" | "arrived"
  arrival_date: "2024-01-15",
  created_at: Timestamp,
  updated_at: Timestamp,
  
  // Denormalized counters for performance
  assigned_equipment_count: 5,
  assigned_weapons_count: 2,
  assigned_gear_count: 3
}
```

### 2. equipment
```javascript
{
  // Document ID: equipment_id
  equipment_id: "EQUIP_001",
  equipment_name: "Tactical Vest",
  equipment_type: "body_armor",
  status: "assigned", // "available" | "assigned" | "maintenance"
  soldier_id: "SOLD_001", // null if available
  soldier_name: "John Doe", // Denormalized for display
  division_name: "82nd Airborne",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 3. weapons
```javascript
{
  // Document ID: weapon_id
  weapon_id: "WPN_001",
  weapon_name: "M4 Carbine",
  serial_number: "12345678",
  weapon_type: "rifle",
  status: "assigned",
  soldier_id: "SOLD_001",
  soldier_name: "John Doe",
  division_name: "82nd Airborne",
  last_maintenance: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 4. serialized_gear
```javascript
{
  // Document ID: gear_id
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
```

### 5. drone_sets
```javascript
{
  // Document ID: drone_set_id
  drone_set_id: "DRONE_001",
  set_name: "Recon Drone Set A",
  drone_type: "reconnaissance",
  status: "operational",
  soldier_id: "SOLD_001",
  soldier_name: "John Doe",
  division_name: "82nd Airborne",
  component_count: 5,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 6. drone_components
```javascript
{
  // Document ID: component_id
  component_id: "COMP_001",
  component_name: "Drone Battery Pack",
  component_type: "battery",
  serial_number: "BAT123456",
  drone_set_id: "DRONE_001",
  status: "operational",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### 7. activity_logs
```javascript
{
  // Document ID: Auto-generated
  entity_type: "weapon", // "soldier" | "equipment" | "weapon" | etc.
  entity_id: "WPN_001",
  action: "assigned", // "created" | "updated" | "assigned" | "released" | "deleted"
  performed_by: "admin@army.mil",
  performed_by_role: "admin",
  soldier_id: "SOLD_001", // If relevant
  division_name: "82nd Airborne",
  details: {
    // Flexible object for action-specific data
    previous_status: "available",
    new_status: "assigned",
    soldier_name: "John Doe",
    changes: {} // For updates
  },
  created_at: Timestamp
}
```

### 8. daily_verifications
```javascript
{
  // Document ID: Auto-generated
  soldier_id: "SOLD_001",
  soldier_name: "John Doe",
  division_name: "82nd Airborne",
  verification_date: "2024-01-20", // YYYY-MM-DD format
  status: "verified", // "verified" | "pending" | "failed"
  equipment_checked: ["EQUIP_001", "EQUIP_002"],
  weapons_checked: ["WPN_001"],
  gear_checked: ["GEAR_001"],
  drone_sets_checked: ["DRONE_001"],
  signature: "base64_signature_data",
  notes: "All equipment accounted for",
  verified_by: "sergeant@army.mil",
  verified_by_name: "Sgt. Smith",
  created_at: Timestamp
}
```

## Denormalization Strategy

To optimize for read performance in Firestore, we denormalize certain data:

1. **Soldier Name**: Stored with equipment/weapons for display without joins
2. **Division Name**: Copied to related documents for filtering
3. **Counts**: Maintained on soldier documents to avoid counting queries
4. **Status**: Duplicated where needed for efficient queries

## Indexing Strategy

Composite indexes are defined in `firestore.indexes.json` for common query patterns:

1. **Soldiers by division and status**
2. **Equipment by division and status**
3. **Weapons by soldier and status**
4. **Activity logs by type and date**
5. **Verifications by date and division**

## Update Patterns

When updating related data:

1. **Assigning Equipment**:
   - Update equipment document with soldier info
   - Increment soldier's equipment count
   - Create activity log

2. **Releasing Equipment**:
   - Clear soldier info from equipment
   - Decrement soldier's equipment count
   - Create activity log

3. **Updating Soldier Info**:
   - If name changes, update all assigned items
   - Use batch operations for consistency