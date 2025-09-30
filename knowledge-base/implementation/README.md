# Implementation Details

This directory contains the actual implementation files and technical specifications for the Armory system.

## Directory Structure

### 📦 [Entities](entities/)
Database models and schemas:
- `Soldier.json` - Soldier data model
- `Weapon.json` - Weapon specifications
- `Equipment.json` - Standard equipment model
- `SerializedGear.json` - Serialized gear tracking
- `DroneSet.json` - Drone system definitions
- `DroneComponent.json` - Drone component specs
- `ActivityLog.json` - Activity tracking model
- `DailyVerification.json` - Verification records

### ⚡ [Functions](functions/)
Server-side function implementations:
- Authentication functions (TOTP generation/verification)
- Email sending (SendGrid integration)
- Form generation (signing/release forms)
- Data management (bulk operations)
- Reporting functions

### 🔌 [Integrations](integrations/)
External service integrations:
- Email services
- File storage
- AI/ML services
- Authentication providers

## Key Implementation Patterns

### 1. Entity Structure
All entities follow a consistent schema pattern:
```json
{
  "name": "EntityName",
  "fields": {
    "id": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    // Entity-specific fields
  }
}
```

### 2. Function Organization
Functions are organized by feature area:
- **Auth**: Authentication and authorization
- **Email**: Communication functions
- **Forms**: Document generation
- **Data**: CRUD operations
- **Reports**: Analytics and reporting

### 3. Security Considerations
- All functions validate permissions
- Input sanitization on all endpoints
- Audit logging for sensitive operations
- Encryption for sensitive data

## Development Guidelines

1. **Entity Modifications**: Update both schema and validation
2. **New Functions**: Include error handling and logging
3. **Integrations**: Use environment variables for credentials
4. **Testing**: Write tests for all new functionality

## Related Documentation

- [System Overview](../system-overview/)
- [Architecture](../architecture/)
- [Migration Guide](../migration/)