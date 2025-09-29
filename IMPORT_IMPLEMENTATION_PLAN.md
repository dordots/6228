# Import Feature Implementation Plan

## Overview
This plan aligns the import functionality with the existing export structure, ensuring seamless data round-tripping and maintaining consistency with the Base44 original implementation.

## Export Structure Reference

### Core Entity Exports
| File Name Pattern | Entity | Key Fields |
|------------------|--------|------------|
| `Personnel_YYYY-MM-DD.csv` | Soldiers | soldier_id, first_name, last_name, phone_number, division_name, team_name |
| `Weapons_YYYY-MM-DD.csv` | Weapons | weapon_id, weapon_type, status, division_name, assigned_to |
| `Serialized_Gear_YYYY-MM-DD.csv` | SerializedGear | gear_id, gear_type, status, division_name, assigned_to |
| `Drone_Sets_YYYY-MM-DD.csv` | DroneSets | drone_set_id, set_serial_number, status, division_name, assigned_to |
| `Drone_Components_YYYY-MM-DD.csv` | DroneComponents | component_id, component_type, drone_set_id |
| `Equipment_YYYY-MM-DD.csv` | Equipment | equipment_id, equipment_type, quantity, division_name |

### Division-Specific Exports
| File Name Pattern | Content | Format |
|------------------|---------|--------|
| `{Division}_Serialized_Items_YYYY-MM-DD.csv` | Combined weapons, gear, drones | Item Type, Sub-Type, Serial Number/ID, Status, Assigned To, Last Signed By |
| `{Division}_Equipment_YYYY-MM-DD.csv` | Division equipment | Standard equipment format with division pre-filled |

## Implementation Phases

### Phase 1: UI Restructuring ✅
**Timeline**: 2-3 hours
**Priority**: High

#### Tasks:
1. **Update Import.jsx Layout**
   ```jsx
   // New structure:
   - Section 1: Core Entities (6 file upload areas)
   - Section 2: Division-Specific Imports (dynamic)
   - Section 3: Equipment Assignments (existing)
   ```

2. **Add File Type Detection**
   ```javascript
   const detectFileType = (filename) => {
     if (filename.includes('Personnel_')) return 'soldiers';
     if (filename.includes('Weapons_')) return 'weapons';
     if (filename.includes('Serialized_Gear_')) return 'serialized_gear';
     if (filename.includes('Drone_Sets_')) return 'drone_sets';
     if (filename.includes('Drone_Components_')) return 'drone_components';
     if (filename.includes('Equipment_')) return 'equipment';
     if (filename.includes('_Serialized_Items_')) return 'division_serialized';
     if (filename.includes('_Equipment_')) return 'division_equipment';
     return 'unknown';
   };
   ```

3. **Add Visual Feedback**
   - File type icons matching DataExport page
   - Color coding for different entity types
   - Import progress indicators

### Phase 2: Entity Import Handlers 📊
**Timeline**: 4-5 hours
**Priority**: High

#### 2.1 Personnel/Soldiers Import
```javascript
const importSoldiers = async (data) => {
  // Required validation
  const requiredFields = ['soldier_id', 'first_name', 'last_name'];
  
  // Process each soldier
  for (const soldier of data) {
    // Format phone number
    if (soldier.phone_number) {
      soldier.phone_number = formatPhoneNumber(soldier.phone_number);
    }
    
    // Create soldier
    await Soldier.create(soldier);
    
    // Auto-create user account (existing logic)
    if (soldier.phone_number) {
      await createUserAccount(soldier);
    }
  }
};
```

#### 2.2 Weapons Import
```javascript
const importWeapons = async (data) => {
  const requiredFields = ['weapon_id', 'weapon_type', 'status'];
  // Validate and import
};
```

#### 2.3 Serialized Gear Import
```javascript
const importSerializedGear = async (data) => {
  const requiredFields = ['gear_id', 'gear_type', 'status'];
  // Validate and import
};
```

#### 2.4 Drone Sets Import
```javascript
const importDroneSets = async (data) => {
  const requiredFields = ['drone_set_id', 'set_serial_number'];
  // Validate and import
};
```

#### 2.5 Drone Components Import
```javascript
const importDroneComponents = async (data) => {
  const requiredFields = ['component_id', 'component_type'];
  // Validate drone_set_id relationships
  // Import components
};
```

#### 2.6 Equipment Import
```javascript
const importEquipment = async (data) => {
  const requiredFields = ['equipment_id', 'equipment_type', 'quantity'];
  // Convert quantity to number
  // Validate and import
};
```

### Phase 3: Division-Specific Import Handlers 🏢
**Timeline**: 3-4 hours
**Priority**: Medium

#### 3.1 Serialized Items Import
```javascript
const importDivisionSerializedItems = async (data, divisionName) => {
  for (const item of data) {
    const itemType = item['Item Type'];
    const serialNumber = item['Serial Number / ID'];
    
    switch(itemType) {
      case 'Weapon':
        await Weapon.create({
          weapon_id: serialNumber,
          weapon_type: item['Sub-Type'],
          status: item['Status'],
          division_name: divisionName,
          assigned_to: item['Assigned To (ID)'],
          last_signed_by: item['Last Signed By']
        });
        break;
      case 'Serialized Gear':
        // Similar for gear
        break;
      case 'Drone Set':
        // Similar for drones
        break;
    }
  }
};
```

### Phase 4: Validation & Error Handling 🛡️
**Timeline**: 3-4 hours
**Priority**: High

#### 4.1 Pre-Import Validation
```javascript
const validateImportData = async (data, entityType) => {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  // Check for duplicates
  // Validate enum values
  // Check foreign key references
  
  return { errors, warnings, isValid: errors.length === 0 };
};
```

#### 4.2 Duplicate Handling
```javascript
const checkDuplicates = async (data, entityType, idField) => {
  const duplicates = [];
  
  for (const item of data) {
    const existing = await entities[entityType].findById(item[idField]);
    if (existing) {
      duplicates.push({
        id: item[idField],
        existing,
        new: item,
        action: 'pending' // skip, update, or create_new
      });
    }
  }
  
  return duplicates;
};
```

#### 4.3 Import Summary
```javascript
const generateImportSummary = (results) => {
  return {
    timestamp: new Date().toISOString(),
    totals: {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    },
    errors: results.filter(r => !r.success).map(r => ({
      id: r.id,
      error: r.error
    }))
  };
};
```

### Phase 5: Enhanced Features 🚀
**Timeline**: 2-3 hours
**Priority**: Low

#### 5.1 Column Mapping
```javascript
const columnMappings = {
  soldiers: {
    'ID': 'soldier_id',
    'מספר אישי': 'soldier_id',
    'First Name': 'first_name',
    'שם פרטי': 'first_name',
    'Last Name': 'last_name',
    'שם משפחה': 'last_name',
    // ... more mappings
  }
};
```

#### 5.2 Import Templates
- Create downloadable CSV templates
- Include sample data row
- Add column descriptions as second row

#### 5.3 Progress Tracking
```javascript
const ImportProgress = ({ current, total, entity }) => (
  <div className="import-progress">
    <Progress value={(current / total) * 100} />
    <span>Importing {entity}: {current} of {total}</span>
  </div>
);
```

## Implementation Steps

### Step 1: Create Import Utilities
**File**: `src/utils/importUtils.js`
```javascript
export const parseCSV = (text) => {
  // Handle BOM, parse CSV
};

export const validateEntityData = (data, entityType) => {
  // Validation logic
};

export const formatPhoneNumber = (phone) => {
  // Phone formatting logic
};

export const detectDateFromFilename = (filename) => {
  // Extract date from filename
};
```

### Step 2: Update Import Page
**File**: `src/pages/Import.jsx`
- Add new UI sections
- Implement file type detection
- Add entity-specific import handlers
- Implement validation UI
- Add progress tracking

### Step 3: Add Bulk Operations
**Files**: Update entity adapters if needed
- Optimize bulk create operations
- Add transaction support
- Implement rollback capability

### Step 4: Activity Logging
```javascript
const logImport = async (summary) => {
  await ActivityLog.create({
    activity_type: "IMPORT",
    entity_type: summary.entityType,
    details: `Imported ${summary.totals.successful} ${summary.entityType}`,
    context: summary
  });
};
```

## Testing Checklist

### Functional Tests
- [ ] Import each entity type individually
- [ ] Import division-specific files
- [ ] Test Hebrew character handling
- [ ] Test large files (1000+ records)
- [ ] Test empty files
- [ ] Test malformed CSV

### Validation Tests
- [ ] Missing required fields
- [ ] Invalid enum values
- [ ] Duplicate ID handling
- [ ] Invalid foreign keys

### Integration Tests
- [ ] Soldier import creates user accounts
- [ ] Equipment assignments work after import
- [ ] Division filtering works correctly
- [ ] Activity logs are created

### Edge Cases
- [ ] Import same file twice
- [ ] Import with partial data
- [ ] Import with extra columns
- [ ] Import with missing columns

## Success Criteria
1. ✅ All exported files can be re-imported
2. ✅ Data round-trips without loss
3. ✅ Hebrew text preserved correctly
4. ✅ User accounts auto-created for soldiers
5. ✅ Clear error messages for issues
6. ✅ Import summary shows results
7. ✅ Activity logged for audit trail

## Rollout Plan
1. **Development**: 2-3 days
2. **Testing**: 1 day
3. **Bug fixes**: 1 day
4. **Documentation**: 0.5 day
5. **Deployment**: 0.5 day

**Total Timeline**: ~5 days

## Notes
- Maintain backward compatibility with existing import
- Use same CSV parsing logic as export for consistency
- Consider adding import queue for very large files
- Add option to email import summary