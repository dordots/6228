# Base44 Behavior Testing Plan

This document outlines tests to determine Base44's behavior for unknown aspects.

## 1. Bulk Operations Testing

### Test 1A: Bulk Create with Partial Failure
```javascript
async function testBulkCreatePartialFailure() {
  console.log('Testing bulkCreate with partial failure...');
  
  // Clean slate
  await deleteAllSoldiers();
  
  // Create test data with known good and bad records
  const testData = [
    { 
      soldier_id: 'BULK_TEST_1',
      first_name: 'Valid',
      last_name: 'Soldier1',
      email: 'valid1@test.com'
    },
    { 
      soldier_id: 'BULK_TEST_2',
      first_name: 'Valid',
      last_name: 'Soldier2',
      email: 'valid2@test.com'
    },
    { 
      soldier_id: 'BULK_TEST_3',
      first_name: '', // Invalid - empty required field
      last_name: 'InvalidSoldier',
      email: 'invalid@test.com'
    },
    { 
      soldier_id: 'BULK_TEST_4',
      first_name: 'Valid',
      last_name: 'Soldier4',
      email: 'valid4@test.com'
    }
  ];
  
  try {
    const result = await Soldier.bulkCreate(testData);
    console.log('Bulk create succeeded:', result);
  } catch (error) {
    console.log('Bulk create failed:', error.message);
    console.log('Error details:', JSON.stringify(error, null, 2));
  }
  
  // Check what was actually saved
  const savedSoldiers = await Soldier.findMany({
    where: {
      soldier_id: {
        startsWith: 'BULK_TEST_'
      }
    }
  });
  
  console.log(`Saved soldiers: ${savedSoldiers.length} out of ${testData.length}`);
  console.log('Saved IDs:', savedSoldiers.map(s => s.soldier_id));
  
  return {
    attempted: testData.length,
    saved: savedSoldiers.length,
    behavior: savedSoldiers.length === 0 ? 'all-or-nothing' : 'partial-success'
  };
}
```

### Test 1B: Bulk Create with Duplicate Key
```javascript
async function testBulkCreateDuplicateKey() {
  console.log('Testing bulkCreate with duplicate key...');
  
  // Create initial soldier
  await Soldier.create({
    soldier_id: 'DUPLICATE_TEST',
    first_name: 'Original',
    last_name: 'Soldier'
  });
  
  // Try bulk create with duplicate
  const testData = [
    {
      soldier_id: 'BULK_DUP_1',
      first_name: 'New',
      last_name: 'Soldier1'
    },
    {
      soldier_id: 'DUPLICATE_TEST', // This should fail
      first_name: 'Duplicate',
      last_name: 'Soldier'
    },
    {
      soldier_id: 'BULK_DUP_2',
      first_name: 'New',
      last_name: 'Soldier2'
    }
  ];
  
  try {
    await Soldier.bulkCreate(testData);
  } catch (error) {
    console.log('Error type:', error.name);
    console.log('Error message:', error.message);
  }
  
  // Check what was saved
  const saved = await Soldier.findMany({
    where: {
      soldier_id: {
        startsWith: 'BULK_DUP_'
      }
    }
  });
  
  console.log('Saved new soldiers:', saved.length);
  return saved.length;
}
```

## 2. Concurrency Testing

### Test 2A: Simultaneous Updates
```javascript
async function testConcurrentUpdates() {
  console.log('Testing concurrent updates...');
  
  // Create test equipment
  const equipment = await Equipment.create({
    equipment_id: 'CONCUR_TEST_1',
    equipment_name: 'Test Rifle',
    status: 'available'
  });
  
  // Create two soldiers
  const soldier1 = await Soldier.create({
    soldier_id: 'CONCUR_SOLDIER_1',
    first_name: 'Soldier',
    last_name: 'One'
  });
  
  const soldier2 = await Soldier.create({
    soldier_id: 'CONCUR_SOLDIER_2',
    first_name: 'Soldier', 
    last_name: 'Two'
  });
  
  // Try to assign same equipment to both soldiers simultaneously
  const results = await Promise.allSettled([
    Equipment.update(equipment.id, { soldier_id: soldier1.id }),
    Equipment.update(equipment.id, { soldier_id: soldier2.id })
  ]);
  
  console.log('Update results:', results.map(r => ({
    status: r.status,
    soldierAssigned: r.status === 'fulfilled' ? r.value.soldier_id : 'failed'
  })));
  
  // Check final state
  const finalEquipment = await Equipment.findFirst({
    where: { id: equipment.id }
  });
  
  console.log('Final assignment:', finalEquipment.soldier_id);
  
  return {
    soldier1Success: results[0].status === 'fulfilled',
    soldier2Success: results[1].status === 'fulfilled',
    finalAssignment: finalEquipment.soldier_id
  };
}
```

### Test 2B: Race Condition on Create
```javascript
async function testConcurrentCreates() {
  console.log('Testing concurrent creates with same ID...');
  
  const soldierData = {
    soldier_id: 'RACE_CONDITION_TEST',
    first_name: 'Race',
    last_name: 'Test'
  };
  
  // Try to create same soldier twice simultaneously
  const results = await Promise.allSettled([
    Soldier.create({ ...soldierData, email: 'first@test.com' }),
    Soldier.create({ ...soldierData, email: 'second@test.com' })
  ]);
  
  console.log('Create results:', results.map(r => ({
    status: r.status,
    error: r.status === 'rejected' ? r.reason.message : null
  })));
  
  // Check which one won
  const saved = await Soldier.findFirst({
    where: { soldier_id: 'RACE_CONDITION_TEST' }
  });
  
  console.log('Saved soldier email:', saved?.email);
  
  return {
    firstSuccess: results[0].status === 'fulfilled',
    secondSuccess: results[1].status === 'fulfilled',
    winnerEmail: saved?.email
  };
}
```

## 3. Cascade Delete Testing

### Test 3A: Delete Soldier with Assignments
```javascript
async function testCascadeDelete() {
  console.log('Testing cascade delete behavior...');
  
  // Create soldier
  const soldier = await Soldier.create({
    soldier_id: 'CASCADE_TEST',
    first_name: 'Delete',
    last_name: 'Test'
  });
  
  // Assign equipment
  const equipment = await Equipment.create({
    equipment_id: 'CASCADE_EQUIP',
    equipment_name: 'Test Equipment',
    soldier_id: soldier.id
  });
  
  // Create activity logs
  await ActivityLog.create({
    entity_type: 'soldier',
    entity_id: soldier.id,
    action: 'equipment_assigned',
    context: { equipment_id: equipment.id }
  });
  
  // Delete soldier
  try {
    await Soldier.delete(soldier.id);
    console.log('Soldier deleted successfully');
  } catch (error) {
    console.log('Delete failed:', error.message);
    return { deleteSuccess: false, error: error.message };
  }
  
  // Check what happened to related data
  const equipmentAfter = await Equipment.findFirst({
    where: { id: equipment.id }
  });
  
  const activityAfter = await ActivityLog.findMany({
    where: { 
      entity_id: soldier.id,
      entity_type: 'soldier'
    }
  });
  
  return {
    deleteSuccess: true,
    equipmentExists: !!equipmentAfter,
    equipmentSoldierId: equipmentAfter?.soldier_id,
    activityLogsExist: activityAfter.length > 0,
    activityLogCount: activityAfter.length
  };
}
```

## 4. Error Response Testing

### Test 4A: Validation Error Format
```javascript
async function testValidationErrorFormat() {
  console.log('Testing validation error format...');
  
  try {
    await Soldier.create({
      soldier_id: '', // Empty required field
      first_name: 'Test',
      last_name: 'Error'
    });
  } catch (error) {
    return {
      errorType: error.constructor.name,
      message: error.message,
      statusCode: error.statusCode || error.status,
      details: error.details || error.errors,
      fullError: JSON.stringify(error, null, 2)
    };
  }
}
```

### Test 4B: Unique Constraint Error
```javascript
async function testUniqueConstraintError() {
  console.log('Testing unique constraint error...');
  
  // Create first soldier
  await Soldier.create({
    soldier_id: 'UNIQUE_TEST',
    first_name: 'First',
    last_name: 'Soldier'
  });
  
  // Try to create duplicate
  try {
    await Soldier.create({
      soldier_id: 'UNIQUE_TEST',
      first_name: 'Second',
      last_name: 'Soldier'
    });
  } catch (error) {
    // Capture ALL error properties
    const errorDetails = {
      errorType: error.constructor.name,
      message: error.message,
      field: error.field,
      code: error.code,
      statusCode: error.statusCode || error.status,
      details: error.details,
      // Capture all enumerable properties
      allProperties: Object.getOwnPropertyNames(error).reduce((acc, key) => {
        acc[key] = error[key];
        return acc;
      }, {}),
      // Full error string
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    };
    
    console.log('Unique constraint error structure:', errorDetails);
    return errorDetails;
  }
}
```

### Test 4C: Foreign Key Constraint Error
```javascript
async function testForeignKeyError() {
  console.log('Testing foreign key constraint error...');
  
  try {
    // Try to create equipment with non-existent soldier
    await Equipment.create({
      equipment_id: 'FK_TEST',
      equipment_name: 'Test Equipment',
      soldier_id: 'NON_EXISTENT_ID' // This soldier doesn't exist
    });
  } catch (error) {
    return {
      errorType: error.constructor.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode || error.status,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    };
  }
}
```

## 5. Performance Testing

### Test 5A: Response Time Patterns
```javascript
async function testResponseTimes() {
  console.log('Testing response times...');
  
  const timings = {
    create: [],
    read: [],
    update: [],
    delete: []
  };
  
  // Test multiple operations
  for (let i = 0; i < 10; i++) {
    const soldierData = {
      soldier_id: `PERF_TEST_${i}`,
      first_name: 'Performance',
      last_name: `Test${i}`
    };
    
    // Create
    const createStart = Date.now();
    const soldier = await Soldier.create(soldierData);
    timings.create.push(Date.now() - createStart);
    
    // Read
    const readStart = Date.now();
    await Soldier.findFirst({ where: { id: soldier.id } });
    timings.read.push(Date.now() - readStart);
    
    // Update
    const updateStart = Date.now();
    await Soldier.update(soldier.id, { email: `test${i}@example.com` });
    timings.update.push(Date.now() - updateStart);
    
    // Delete
    const deleteStart = Date.now();
    await Soldier.delete(soldier.id);
    timings.delete.push(Date.now() - deleteStart);
  }
  
  // Calculate averages
  const avg = (arr) => arr.reduce((a, b) => a + b) / arr.length;
  
  return {
    create: { avg: avg(timings.create), min: Math.min(...timings.create), max: Math.max(...timings.create) },
    read: { avg: avg(timings.read), min: Math.min(...timings.read), max: Math.max(...timings.read) },
    update: { avg: avg(timings.update), min: Math.min(...timings.update), max: Math.max(...timings.update) },
    delete: { avg: avg(timings.delete), min: Math.min(...timings.delete), max: Math.max(...timings.delete) }
  };
}
```

## Test Runner

```javascript
async function runAllTests() {
  const results = {};
  
  console.log('Starting Base44 behavior tests...\n');
  
  // Run tests sequentially to avoid interference
  try {
    results.bulkPartialFailure = await testBulkCreatePartialFailure();
    await sleep(1000); // Pause between tests
    
    results.bulkDuplicate = await testBulkCreateDuplicateKey();
    await sleep(1000);
    
    results.concurrentUpdates = await testConcurrentUpdates();
    await sleep(1000);
    
    results.concurrentCreates = await testConcurrentCreates();
    await sleep(1000);
    
    results.cascadeDelete = await testCascadeDelete();
    await sleep(1000);
    
    results.validationError = await testValidationErrorFormat();
    await sleep(1000);
    
    results.uniqueError = await testUniqueConstraintError();
    await sleep(1000);
    
    results.performance = await testResponseTimes();
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  console.log('\n=== TEST RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runAllTests().then(results => {
  // Save results to file for analysis
  console.log('\nTests completed. Results saved to base44-test-results.json');
});
```

## Expected Outcomes

Based on test results, we'll know:

1. **Bulk Operations**: All-or-nothing vs partial success
2. **Concurrency**: Last-write-wins vs locking vs error
3. **Cascade Deletes**: Automatic cleanup vs orphaned records
4. **Error Formats**: Structure for proper error handling
5. **Performance**: Expected response times for capacity planning

## Next Steps

1. Run these tests in a development environment
2. Document the results in BASE44_FINDINGS.md
3. Update migration plan based on discovered behaviors
4. Design compatibility layer to match Base44 behavior exactly