# Transaction Strategy for Standalone Server

## Overview
Since Base44 doesn't support transactions, we need a careful strategy to handle data consistency while maintaining compatibility.

## Strategy Options

### Option 1: Base44-Compatible Mode (Default)
Matches Base44's behavior exactly - no automatic transactions.

```javascript
class Base44CompatibleDB {
  async create(entity, data) {
    // Direct insert, commits immediately
    const result = await pool.query(
      `INSERT INTO ${entity} (...) VALUES (...) RETURNING *`,
      values
    );
    return result.rows[0];
  }
  
  async update(entity, id, data) {
    // Direct update, commits immediately
    const result = await pool.query(
      `UPDATE ${entity} SET ... WHERE id = $1 RETURNING *`,
      [...values, id]
    );
    return result.rows[0];
  }
}
```

### Option 2: Enhanced Transaction Mode
Provides proper transaction support with automatic rollback.

```javascript
class TransactionalDB {
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async create(entity, data, options = {}) {
    const client = options.transaction || pool;
    const result = await client.query(
      `INSERT INTO ${entity} (...) VALUES (...) RETURNING *`,
      values
    );
    return result.rows[0];
  }
}
```

### Option 3: Hybrid Approach (Recommended)
Configurable behavior with compatibility warnings.

```javascript
class HybridDB {
  constructor(config) {
    this.mode = config.transactionMode || 'base44-compatible';
    this.warnOnInconsistency = config.compatibilityWarnings ?? true;
  }
  
  async executeOperations(operations) {
    if (this.mode === 'strict') {
      // Wrap in transaction
      return this.transaction(async (trx) => {
        const results = [];
        for (const op of operations) {
          results.push(await op(trx));
        }
        return results;
      });
    } else {
      // Base44-compatible: execute separately
      const results = [];
      const completed = [];
      
      try {
        for (const op of operations) {
          const result = await op();
          results.push(result);
          completed.push({ op, result });
        }
        return results;
      } catch (error) {
        if (this.warnOnInconsistency && completed.length > 0) {
          console.warn('⚠️  Partial operation failure. Completed operations:', {
            completed: completed.length,
            total: operations.length,
            error: error.message
          });
        }
        throw error;
      }
    }
  }
}
```

## Implementation Patterns

### 1. Manual Cleanup Pattern (Base44 Compatible)
```javascript
async function createSoldierWithEquipment(soldierData, equipmentIds) {
  let createdSoldier = null;
  const updatedEquipment = [];
  
  try {
    // Step 1: Create soldier
    createdSoldier = await Soldier.create(soldierData);
    
    // Step 2: Assign equipment
    for (const equipId of equipmentIds) {
      const updated = await Equipment.update(equipId, {
        soldier_id: createdSoldier.id,
        status: 'assigned'
      });
      updatedEquipment.push(updated);
    }
    
    // Step 3: Log activity
    await ActivityLog.create({
      entity_type: 'soldier',
      entity_id: createdSoldier.id,
      action: 'equipment_assigned',
      context: { equipment_count: equipmentIds.length }
    });
    
    return { soldier: createdSoldier, equipment: updatedEquipment };
    
  } catch (error) {
    // Manual rollback
    console.error('Operation failed, attempting cleanup...');
    
    // Revert equipment assignments
    for (const equipment of updatedEquipment) {
      try {
        await Equipment.update(equipment.id, {
          soldier_id: null,
          status: 'available'
        });
      } catch (cleanupError) {
        console.error(`Failed to revert equipment ${equipment.id}:`, cleanupError);
      }
    }
    
    // Delete soldier if created
    if (createdSoldier) {
      try {
        await Soldier.delete(createdSoldier.id);
      } catch (cleanupError) {
        console.error('Failed to delete soldier:', cleanupError);
      }
    }
    
    throw error;
  }
}
```

### 2. Saga Pattern for Complex Operations
```javascript
class EquipmentAssignmentSaga {
  constructor() {
    this.steps = [];
    this.compensations = [];
  }
  
  async execute() {
    const completedSteps = [];
    
    try {
      // Execute forward steps
      for (const step of this.steps) {
        const result = await step.execute();
        completedSteps.push({ step, result });
      }
      
      return completedSteps.map(s => s.result);
      
    } catch (error) {
      // Execute compensations in reverse order
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        const { step, result } = completedSteps[i];
        try {
          await step.compensate(result);
        } catch (compensationError) {
          console.error(`Compensation failed for step ${i}:`, compensationError);
        }
      }
      
      throw error;
    }
  }
  
  addStep(execute, compensate) {
    this.steps.push({ execute, compensate });
    return this;
  }
}

// Usage
const saga = new EquipmentAssignmentSaga()
  .addStep(
    // Execute
    () => Soldier.create(soldierData),
    // Compensate
    (soldier) => Soldier.delete(soldier.id)
  )
  .addStep(
    // Execute
    () => Equipment.update(equipId, { soldier_id: soldierId }),
    // Compensate
    () => Equipment.update(equipId, { soldier_id: null })
  );

await saga.execute();
```

### 3. Event Sourcing for Audit Trail
```javascript
class EventStore {
  async recordEvent(event) {
    await pool.query(
      `INSERT INTO events (entity_type, entity_id, event_type, data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [event.entityType, event.entityId, event.type, JSON.stringify(event.data)]
    );
  }
  
  async applyEvent(event) {
    switch (event.type) {
      case 'soldier_created':
        return await this.applySoldierCreated(event);
      case 'equipment_assigned':
        return await this.applyEquipmentAssigned(event);
      // ... more event types
    }
  }
  
  async replayEvents(entityId, toTimestamp) {
    // Can rebuild state from events
    const events = await this.getEvents(entityId, toTimestamp);
    let state = {};
    
    for (const event of events) {
      state = await this.applyEvent(event, state);
    }
    
    return state;
  }
}
```

## Concurrency Control Strategy

### Optimistic Locking Implementation
Since Base44 has `updated_at` fields but unclear if they're used for locking:

```javascript
class OptimisticLockingDB {
  async update(entity, id, data, options = {}) {
    // Get current record with updated_at
    const current = await this.findById(entity, id);
    
    if (options.expectedVersion) {
      // Check version matches
      if (current.updated_at !== options.expectedVersion) {
        throw new ConcurrencyError(
          `Record was modified. Expected version: ${options.expectedVersion}, ` +
          `Current version: ${current.updated_at}`
        );
      }
    }
    
    // Update with new timestamp
    const result = await pool.query(
      `UPDATE ${entity} 
       SET ..., updated_at = NOW() 
       WHERE id = $1 AND updated_at = $2
       RETURNING *`,
      [...values, id, current.updated_at]
    );
    
    if (result.rowCount === 0) {
      throw new ConcurrencyError('Record was modified by another user');
    }
    
    return result.rows[0];
  }
}

// Usage
try {
  const equipment = await Equipment.findById(equipId);
  
  await Equipment.update(equipId, {
    soldier_id: soldierID
  }, {
    expectedVersion: equipment.updated_at
  });
} catch (error) {
  if (error instanceof ConcurrencyError) {
    // Handle conflict - reload and retry or notify user
  }
}
```

### Race Condition Prevention
```javascript
// Problem: Two users assigning same equipment
async function assignEquipmentWithLocking(equipmentId, soldierId) {
  const maxRetries = 3;
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      // Fetch current state
      const equipment = await Equipment.findById(equipmentId);
      
      // Check if already assigned
      if (equipment.soldier_id) {
        throw new Error(`Equipment already assigned to soldier ${equipment.soldier_id}`);
      }
      
      // Update with optimistic lock
      return await Equipment.update(equipmentId, {
        soldier_id: soldierId,
        status: 'assigned'
      }, {
        expectedVersion: equipment.updated_at
      });
      
    } catch (error) {
      if (error instanceof ConcurrencyError && attempts < maxRetries - 1) {
        attempts++;
        await sleep(100 * attempts); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

## Best Practices

### 1. Operation Ordering
```javascript
// GOOD: Create parent last
const equipment = await Equipment.update(id, { status: 'pending' });
const activityLog = await ActivityLog.create({ ... });
const soldier = await Soldier.create({ ... }); // Most important, do last

// BAD: Create parent first
const soldier = await Soldier.create({ ... }); // If next fails, orphaned record
const equipment = await Equipment.update(id, { soldier_id: soldier.id });
```

### 2. Idempotent Operations
```javascript
// Make operations idempotent where possible
async function assignEquipment(equipmentId, soldierId) {
  // Check if already assigned
  const equipment = await Equipment.findFirst({ 
    where: { id: equipmentId } 
  });
  
  if (equipment.soldier_id === soldierId) {
    return equipment; // Already assigned, no-op
  }
  
  return await Equipment.update(equipmentId, { 
    soldier_id: soldierId 
  });
}
```

### 3. Batch Operations
```javascript
// For bulk operations, track successes and failures
async function bulkAssignEquipment(assignments) {
  const results = {
    successful: [],
    failed: []
  };
  
  for (const { equipmentId, soldierId } of assignments) {
    try {
      const result = await Equipment.update(equipmentId, {
        soldier_id: soldierId
      });
      results.successful.push({ equipmentId, soldierId, result });
    } catch (error) {
      results.failed.push({ equipmentId, soldierId, error: error.message });
    }
  }
  
  return results;
}
```

## Migration Path

### Phase 1: Base44 Compatible Mode
- Implement exact Base44 behavior
- Add comprehensive logging
- Monitor for inconsistent states

### Phase 2: Add Warnings
- Detect potential consistency issues
- Log warnings when partial failures occur
- Collect metrics on failure patterns

### Phase 3: Introduce Transaction Support
- Add opt-in transaction mode
- Provide migration tools for existing code
- Document new patterns

### Phase 4: Make Transactions Default
- Switch default to transaction mode
- Keep compatibility mode available
- Provide tools to detect and fix inconsistencies

## Monitoring and Alerts

```javascript
class ConsistencyMonitor {
  async checkDataIntegrity() {
    const issues = [];
    
    // Check for orphaned equipment
    const orphanedEquipment = await pool.query(`
      SELECT e.* FROM equipment e
      LEFT JOIN soldiers s ON e.soldier_id = s.id
      WHERE e.soldier_id IS NOT NULL AND s.id IS NULL
    `);
    
    if (orphanedEquipment.rows.length > 0) {
      issues.push({
        type: 'orphaned_equipment',
        count: orphanedEquipment.rows.length,
        severity: 'high'
      });
    }
    
    // Check for activity logs without entities
    const orphanedLogs = await pool.query(`
      SELECT a.* FROM activity_logs a
      LEFT JOIN soldiers s ON a.entity_id = s.id AND a.entity_type = 'soldier'
      WHERE a.entity_id IS NOT NULL AND s.id IS NULL
    `);
    
    if (orphanedLogs.rows.length > 0) {
      issues.push({
        type: 'orphaned_activity_logs',
        count: orphanedLogs.rows.length,
        severity: 'medium'
      });
    }
    
    return issues;
  }
}
```

## Configuration Example

```json
{
  "database": {
    "transactionMode": "hybrid",
    "transactionOptions": {
      "defaultMode": "base44-compatible",
      "allowModeOverride": true,
      "compatibilityWarnings": true,
      "autoCleanupOnError": false,
      "consistencyCheckInterval": 3600000,
      "alertOnInconsistency": true
    },
    "monitoring": {
      "enabled": true,
      "checkIntegrity": true,
      "alertThresholds": {
        "orphanedRecords": 10,
        "failedOperations": 5
      }
    }
  }
}
```

## Summary

1. **Default to Base44-compatible mode** for smooth migration
2. **Implement comprehensive error handling** and cleanup
3. **Monitor for data inconsistencies** actively
4. **Gradually introduce transaction support** as opt-in
5. **Document patterns clearly** for developers
6. **Provide tooling** for detecting and fixing issues

This strategy ensures compatibility while providing a path to better data consistency.