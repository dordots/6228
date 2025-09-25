# Base44 to Standalone Server Migration Plan

## Executive Summary
This document outlines a comprehensive plan to migrate the Armory application from Base44 to a standalone server infrastructure, providing full control over the backend while maintaining all existing functionality.

## Current State Analysis

### Base44 Dependencies
- **SDK Version**: @base44/sdk v0.1.2 (client), v0.5.0 (server functions)
- **App ID**: 68cf9fe0686c5871dd720958
- **Authentication**: Required for all operations
- **Transaction Support**: NONE - Operations are independent, no automatic rollback

### Core Components Using Base44
1. **8 Entity Types** (CRUD operations)
   - Soldier, Equipment, Weapon, SerializedGear
   - DroneSet, DroneComponent
   - ActivityLog, DailyVerification

2. **15 Server Functions**
   - Data Management: deleteAll* functions
   - Reports: sendDailyReport, exportAllData
   - Forms: generateSigningForm, generateReleaseForm, send* functions
   - Email: sendEmailViaSendGrid, testSendGrid
   - Security: generateTotp, verifyTotp

3. **7 Core Integrations**
   - InvokeLLM, SendEmail, UploadFile, UploadPrivateFile
   - GenerateImage, ExtractDataFromUploadedFile, CreateFileSignedUrl

## Migration Architecture

### Technology Stack
- **Backend Framework**: Node.js with Express/Fastify
- **Database**: PostgreSQL 15+ with JSON support
- **Transaction Manager**: Node-postgres with explicit transaction support
- **Authentication**: JWT + TOTP (using otpauth library)
- **File Storage**: S3-compatible (AWS S3 or MinIO)
- **Email Service**: SendGrid API
- **Cache/Queue**: Redis for sessions and job queues
- **Process Manager**: PM2 or Docker containers

### Database Schema Design
```sql
-- Core entities with proper relationships
CREATE TABLE soldiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    soldier_id VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    division_name VARCHAR(100),
    team_name VARCHAR(100),
    enlistment_status VARCHAR(20) CHECK (enlistment_status IN ('expected', 'arrived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment, weapons, gear tables following similar pattern
-- Activity logs with JSONB for flexible context storage
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL,
    context JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Phases

### Phase 1: Foundation Setup (Week 1-2)
1. **Database Setup**
   - Install PostgreSQL with extensions (uuid-ossp, pgcrypto)
   - Create all entity tables based on JSON schemas
   - Set up indexes and constraints
   - Implement audit triggers for activity logging

2. **Basic API Server**
   - Express/Fastify server with TypeScript
   - Database connection pool (pg library)
   - Basic error handling and logging
   - Environment configuration

3. **Development Environment**
   - Docker Compose for local development
   - Database migrations (using Knex/Prisma)
   - Seed data scripts

**Questions for Base44 LLM:**
- How does Base44 handle database transactions?
- What are the exact field validations for each entity?
- How are relationships enforced between entities?

### Phase 2: Authentication System (Week 3-4)
1. **JWT Implementation**
   - User login/logout endpoints
   - Token generation and validation
   - Refresh token mechanism
   - Session management in Redis

2. **TOTP Integration**
   - Generate QR codes (qrcode library)
   - Store temporary secrets securely
   - Verify TOTP codes
   - Enable/disable 2FA flow

3. **User Management**
   - User registration (if needed)
   - Password reset flow
   - Profile management
   - Role-based permissions

**Questions for Base44 LLM:**
- How does base44.auth.me() work internally?
- What user fields are stored and how?
- How are service role permissions handled?

### Phase 3: Entity CRUD Operations (Week 5-6)
1. **RESTful API Endpoints**
   ```
   GET    /api/soldiers      - List with pagination/filters
   GET    /api/soldiers/:id  - Get single soldier
   POST   /api/soldiers      - Create new soldier
   PUT    /api/soldiers/:id  - Update soldier
   DELETE /api/soldiers/:id  - Delete soldier
   ```
   (Repeat for all 8 entity types)

2. **Advanced Queries**
   - Complex filters (by division, status, etc.)
   - Sorting and pagination
   - Include related entities
   - Aggregate statistics

3. **Validation Layer**
   - Request validation (using Joi/Zod)
   - Business logic validations
   - Constraint enforcement

**Questions for Base44 LLM:**
- What are the exact query capabilities of findMany/findFirst?
- How does Base44 handle includes and relations?
- What validation rules are applied by default?

### CRITICAL: Transaction Handling Strategy

**Base44 Current Behavior**: NO automatic transactions - each operation is independent and commits immediately.

1. **Compatibility Mode Implementation**
   ```javascript
   // Base44-compatible mode (default for migration)
   const soldier = await Soldier.create(data); // Commits immediately
   try {
     await Equipment.update(id, { soldier_id: soldier.id }); // Separate operation
   } catch (error) {
     // Manual cleanup required
     await Soldier.delete(soldier.id);
   }
   ```

2. **Enhanced Transaction Mode**
   ```javascript
   // Optional improved mode with proper transactions
   await db.transaction(async (trx) => {
     const soldier = await Soldier.create(data, { transaction: trx });
     await Equipment.update(id, { soldier_id: soldier.id }, { transaction: trx });
     // Automatic rollback on any failure
   });
   ```

3. **Configuration Options**
   ```javascript
   {
     "database": {
       "transactionMode": "base44-compatible", // or "strict" or "auto"
       "compatibilityWarnings": true // Warn when inconsistent state possible
     }
   }
   ```

### Phase 4: Business Functions (Week 7-8)
1. **Report Generation**
   - Daily reports with aggregated data
   - Export to Excel/CSV functionality
   - PDF generation for forms

2. **Bulk Operations**
   - Delete all functions with proper authorization
   - Bulk assignment operations
   - Import/export capabilities

3. **Email Integration**
   - SendGrid configuration
   - Email templates (signing forms, release forms)
   - Bulk email capabilities
   - Email tracking

**Questions for Base44 LLM:**
- How are the PDF forms generated exactly?
- What data is included in daily reports?
- How are email templates structured?

### Phase 5: File Management (Week 9)
1. **Storage Setup**
   - S3 bucket configuration
   - File upload endpoints
   - Signed URL generation
   - Private vs public file handling

2. **Integration Points**
   - Profile pictures
   - Document attachments
   - Form PDFs storage
   - Backup storage

**Questions for Base44 LLM:**
- How does Base44 handle file uploads?
- What are the file size/type restrictions?
- How are signed URLs generated and expired?

### Phase 6: Frontend Migration (Week 10-11)
1. **API Client Update**
   - Replace base44 SDK with axios/fetch
   - Create API service layer
   - Update all component API calls

2. **Authentication Flow**
   - Login/logout UI updates
   - Token storage and refresh
   - Protected route handling

3. **Error Handling**
   - Consistent error messages
   - Network error recovery
   - Loading states

### Phase 7: Testing & Optimization (Week 12)
1. **Testing Suite**
   - Unit tests for all endpoints
   - Integration tests
   - Load testing
   - Security testing

2. **Performance Optimization**
   - Database query optimization
   - Caching strategy
   - API response compression
   - Connection pooling

3. **Monitoring Setup**
   - Application metrics
   - Error tracking (Sentry)
   - Performance monitoring
   - Audit logging

## Migration Strategy

### Data Migration
1. Export all data from Base44 using exportAllData function
2. Transform data to match new schema if needed
3. Import into PostgreSQL with validation
4. Verify data integrity

### Gradual Rollout
1. **Dual Operation Phase**
   - Run both systems in parallel
   - Sync data between systems
   - A/B testing with user groups

2. **Feature Flag System**
   - Toggle between Base44 and new API
   - Gradual feature migration
   - Quick rollback capability

3. **Final Cutover**
   - Full data migration
   - DNS/proxy updates
   - Monitoring and support

## Risk Mitigation

### Technical Risks
- **Data Loss**: Regular backups, transaction logs
- **Data Inconsistency**: Base44 has no transactions - implement cleanup strategies
- **Performance Issues**: Load testing, monitoring
- **Security Vulnerabilities**: Security audit, penetration testing

### Business Risks
- **Downtime**: Blue-green deployment, rollback plan
- **Feature Parity**: Comprehensive testing, user acceptance
- **User Disruption**: Clear communication, training

## Required Resources

### Development Team
- Backend Developer (Node.js/PostgreSQL)
- DevOps Engineer (Docker/K8s)
- QA Engineer
- Project Manager

### Infrastructure
- PostgreSQL Database Server
- Application Servers (2-3 for HA)
- Redis Cache Server
- S3-compatible Storage
- Load Balancer

### Third-Party Services
- SendGrid Account (existing)
- SSL Certificates
- Domain/DNS management
- Monitoring services

## Timeline Summary
- **Weeks 1-2**: Foundation Setup
- **Weeks 3-4**: Authentication System
- **Weeks 5-6**: Entity CRUD Operations
- **Weeks 7-8**: Business Functions
- **Week 9**: File Management
- **Weeks 10-11**: Frontend Migration
- **Week 12**: Testing & Optimization
- **Week 13**: Production Deployment

## Questions for Base44 Team/LLM

### Critical Implementation Details
1. **Entity Operations**
   - Exact query syntax and capabilities
   - ~~Transaction handling mechanisms~~ (CONFIRMED: No transactions)
   - Soft delete vs hard delete policies
   - Cascade delete behaviors
   - Bulk operation atomicity (partial failures?)

2. **Authentication**
   - Token expiration policies
   - Session management details
   - Service role implementation
   - Permission checking logic

3. **Business Logic**
   - Form generation templates and logic
   - Report data aggregation methods
   - Email template customization
   - Validation rule specifics

4. **Integrations**
   - File upload size/type restrictions
   - SendGrid template IDs
   - LLM integration parameters
   - Image generation specifications

### Performance Considerations
- Average response times for operations
- Database query patterns
- Caching strategies used
- Rate limiting policies

## Success Criteria
1. **Functional Parity**: All Base44 features working
2. **Performance**: Equal or better response times
3. **Reliability**: 99.9% uptime
4. **Security**: Passed security audit
5. **User Satisfaction**: Seamless transition

## Next Steps
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule regular progress reviews
5. Prepare questions for Base44 LLM

---

This migration plan provides a structured approach to moving from Base44 to a standalone server while maintaining all functionality and improving control over the system. The phased approach allows for gradual implementation with minimal risk to operations.