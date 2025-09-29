// Import utilities for CSV parsing and validation

// Parse CSV text into array of objects
export const parseCSV = (text) => {
  // Remove BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');
  
  // Split into lines
  const lines = cleanText.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      data.push(row);
    }
  }
  
  return data;
};

// Parse a single CSV line handling quoted values
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
};

// Detect file type from filename
export const detectFileType = (filename) => {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('personnel_')) return 'soldiers';
  if (lowerFilename.includes('weapons_')) return 'weapons';
  if (lowerFilename.includes('serialized_gear_')) return 'serialized_gear';
  if (lowerFilename.includes('drone_sets_')) return 'drone_sets';
  if (lowerFilename.includes('drone_components_')) return 'drone_components';
  if (lowerFilename.includes('equipment_') && !lowerFilename.includes('_equipment_')) return 'equipment';
  if (lowerFilename.includes('_serialized_items_')) return 'division_serialized';
  if (lowerFilename.includes('_equipment_')) return 'division_equipment';
  
  return 'unknown';
};

// Extract date from filename
export const detectDateFromFilename = (filename) => {
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : null;
};

// Format phone number for Israel
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.startsWith('972')) {
    return '+' + digits;
  } else if (digits.startsWith('0')) {
    return '+972' + digits.substring(1);
  } else if (digits.length === 9) {
    return '+972' + digits;
  }
  
  return phone; // Return original if can't format
};

// Validate entity data based on type
export const validateEntityData = (data, entityType) => {
  const errors = [];
  const warnings = [];
  
  // Define required fields for each entity
  const requiredFields = {
    soldiers: ['soldier_id', 'first_name', 'last_name'],
    weapons: ['weapon_id', 'weapon_type', 'status'],
    serialized_gear: ['gear_id', 'gear_type', 'status'],
    drone_sets: ['drone_set_id', 'set_serial_number'],
    drone_components: ['component_id', 'component_type'],
    equipment: ['equipment_id', 'equipment_type', 'quantity'],
  };
  
  // Define valid enum values
  const enumValues = {
    weapon_status: ['functioning', 'not_functioning'],
    gear_status: ['available', 'assigned', 'maintenance', 'lost'],
    drone_status: ['available', 'assigned', 'maintenance', 'lost'],
    armory_status: ['with_soldier', 'in_deposit'],
  };
  
  const fields = requiredFields[entityType] || [];
  
  data.forEach((row, index) => {
    // Check required fields
    fields.forEach(field => {
      if (!row[field] || row[field].toString().trim() === '') {
        errors.push({
          row: index + 2, // +2 for header and 0-index
          field,
          message: `Missing required field: ${field}`
        });
      }
    });
    
    // Entity-specific validations
    switch (entityType) {
      case 'soldiers':
        // Validate soldier ID format
        if (row.soldier_id && !/^\d{5,}$/.test(row.soldier_id)) {
          warnings.push({
            row: index + 2,
            field: 'soldier_id',
            message: 'Soldier ID should be at least 5 digits'
          });
        }
        // Validate phone if present
        if (row.phone_number && !/^[\d\+\-\s()]+$/.test(row.phone_number)) {
          warnings.push({
            row: index + 2,
            field: 'phone_number',
            message: 'Invalid phone number format'
          });
        }
        break;
        
      case 'weapons':
        // Validate weapon status enum
        if (row.status && !enumValues.weapon_status.includes(row.status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'status',
            message: `Invalid status. Must be one of: ${enumValues.weapon_status.join(', ')}`
          });
        }
        // Validate armory status enum if present
        if (row.armory_status && !enumValues.armory_status.includes(row.armory_status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'armory_status',
            message: `Invalid armory_status. Must be one of: ${enumValues.armory_status.join(', ')}`
          });
        }
        break;
        
      case 'serialized_gear':
        // Validate gear status enum
        if (row.status && !enumValues.gear_status.includes(row.status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'status',
            message: `Invalid status. Must be one of: ${enumValues.gear_status.join(', ')}`
          });
        }
        // Validate armory status enum if present
        if (row.armory_status && !enumValues.armory_status.includes(row.armory_status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'armory_status',
            message: `Invalid armory_status. Must be one of: ${enumValues.armory_status.join(', ')}`
          });
        }
        break;
        
      case 'drone_sets':
        // Validate drone status enum
        if (row.status && !enumValues.drone_status.includes(row.status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'status',
            message: `Invalid status. Must be one of: ${enumValues.drone_status.join(', ')}`
          });
        }
        // Validate armory status enum if present
        if (row.armory_status && !enumValues.armory_status.includes(row.armory_status.toLowerCase())) {
          errors.push({
            row: index + 2,
            field: 'armory_status',
            message: `Invalid armory_status. Must be one of: ${enumValues.armory_status.join(', ')}`
          });
        }
        break;
        
      case 'equipment':
        // Validate quantity is a number
        if (row.quantity && isNaN(parseInt(row.quantity))) {
          errors.push({
            row: index + 2,
            field: 'quantity',
            message: 'Quantity must be a number'
          });
        }
        // Generate equipment_id if not provided
        if (!row.equipment_id) {
          row.equipment_id = `EQ_${row.equipment_type}_${Date.now()}_${index}`;
        }
        break;
    }
  });
  
  return {
    errors,
    warnings,
    isValid: errors.length === 0
  };
};

// Column mapping for different languages and formats
export const getColumnMapping = (entityType) => {
  const mappings = {
    soldiers: {
      'ID': 'soldier_id',
      'מספר אישי': 'soldier_id',
      'Soldier ID': 'soldier_id',
      'First Name': 'first_name',
      'שם פרטי': 'first_name',
      'Last Name': 'last_name',
      'שם משפחה': 'last_name',
      'Phone': 'phone_number',
      'Phone Number': 'phone_number',
      'טלפון': 'phone_number',
      'Division': 'division_name',
      'Division Name': 'division_name',
      'חטיבה': 'division_name',
      'Team': 'team_name',
      'Team Name': 'team_name',
      'צוות': 'team_name',
    },
    weapons: {
      'Weapon ID': 'weapon_id',
      'ID': 'weapon_id',
      'מזהה נשק': 'weapon_id',
      'Type': 'weapon_type',
      'Weapon Type': 'weapon_type',
      'סוג נשק': 'weapon_type',
      'Status': 'status',
      'סטטוס': 'status',
      'Assigned To': 'assigned_to',
      'Assigned To (ID)': 'assigned_to',
      'משויך ל': 'assigned_to',
      'Division': 'division_name',
      'Division Name': 'division_name',
      'חטיבה': 'division_name',
    },
    // Add more mappings as needed
  };
  
  return mappings[entityType] || {};
};

// Map columns from import data to entity fields
export const mapColumns = (data, entityType) => {
  const mapping = getColumnMapping(entityType);
  
  return data.map(row => {
    const mappedRow = {};
    
    Object.entries(row).forEach(([key, value]) => {
      // Try to find a mapping for this column
      const mappedKey = mapping[key] || key;
      mappedRow[mappedKey] = value;
    });
    
    return mappedRow;
  });
};

// Generate import summary
export const generateImportSummary = (results) => {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  return {
    timestamp: new Date().toISOString(),
    totals: {
      processed: results.length,
      successful: successful.length,
      failed: failed.length,
      skipped: results.filter(r => r.skipped).length,
      updated: results.filter(r => r.updated).length,
    },
    errors: failed.map(r => ({
      id: r.id,
      error: r.error,
      data: r.data
    })),
    successes: successful.map(r => ({
      id: r.id,
      action: r.updated ? 'updated' : 'created'
    }))
  };
};