# Firebase Migration Project Plan

## Project Overview
Migrate Armory Management System from Base44 to Firebase infrastructure.

**Start Date**: 2025-09-25
**Target Completion**: 2 weeks
**Current Status**: In Progress

## Migration Checklist

### Phase 1: Project Setup & Data Structure (Day 1)
- [ ] Create projectplan.md with detailed todo tracking
- [ ] Deploy Firestore security rules
- [ ] Create Firestore collections structure
- [ ] Set up Firestore indexes

### Phase 2: Authentication Migration (Day 2-3)
- [ ] Set up Firebase Auth with custom claims for roles
- [ ] Configure phone authentication settings
- [ ] Implement TOTP for 2FA
- [ ] Create auth adapter in src/firebase/auth.js
- [ ] Update login/logout flows in frontend

### Phase 3: Data Migration (Day 4-5)
- [ ] Export all data from Base44 using exportAllData
- [ ] Create migration script for Firestore import
- [ ] Run data migration with progress tracking
- [ ] Verify data integrity and relationships
- [ ] Create backup of migrated data

### Phase 4: API Compatibility Layer (Day 6-7)
- [ ] Create Firebase adapter that mimics Base44 SDK interface
- [ ] Update entity imports to use new adapter
- [ ] Test all CRUD operations
- [ ] Handle query compatibility (where, orderBy, includes)
- [ ] Implement pagination

### Phase 5: Cloud Functions Implementation (Day 8-10)
- [ ] Set up Firebase Functions environment
- [ ] Configure SendGrid integration
- [ ] Implement delete functions:
  - [ ] deleteAllEquipment
  - [ ] deleteAllSoldiers
  - [ ] deleteAllWeapons
  - [ ] deleteAllSerializedGear
- [ ] Implement email functions:
  - [ ] sendDailyReport
  - [ ] sendEmailViaSendGrid
  - [ ] testSendGrid
- [ ] Implement form functions:
  - [ ] generateSigningForm
  - [ ] generateReleaseForm
  - [ ] sendSigningForm
  - [ ] sendReleaseFormByActivity
  - [ ] sendBulkEquipmentForms
- [ ] Implement TOTP functions:
  - [ ] generateTotp
  - [ ] verifyTotp
- [ ] Implement data export:
  - [ ] exportAllData
- [ ] Deploy and test all functions

### Phase 6: Frontend Integration (Day 11-12)
- [ ] Update all API calls to use Firebase
- [ ] Test soldier management features
- [ ] Test equipment management features
- [ ] Test weapon management features
- [ ] Test drone management features
- [ ] Test daily verification flow
- [ ] Test report generation
- [ ] Fix any compatibility issues

### Phase 7: Testing & Optimization (Day 13)
- [ ] Comprehensive feature testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] User acceptance testing

### Phase 8: Deployment (Day 14)
- [ ] Final data migration
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Create rollback plan

## Technical Details

### Firebase Configuration
- **Project ID**: project-1386902152066454120
- **Web App ID**: 1:193183633039:web:f049d317ed9c663b1aeafa
- **Services Enabled**: 
  - ✅ Authentication (Phone + Email)
  - ✅ Firestore Database
  - ✅ Cloud Storage
  - ✅ Cloud Functions (Blaze plan)

### Entity Collections
1. **soldiers** - Military personnel records
2. **equipment** - General equipment items
3. **weapons** - Serialized weapons with tracking
4. **serialized_gear** - Serialized gear items
5. **drone_sets** - Drone set configurations
6. **drone_components** - Individual drone components
7. **activity_logs** - Audit trail of all actions
8. **daily_verifications** - Daily equipment checks

### Key Challenges
1. **No SQL Transactions**: Implement cleanup strategies for failed operations
2. **NoSQL Query Limitations**: Use data denormalization where needed
3. **Different ID Strategy**: Maintain existing IDs as document fields
4. **Rate Limits**: Implement batching for bulk operations

## Progress Tracking

### Completed Tasks
- ✅ Firebase project created and configured
- ✅ Firebase SDK installed
- ✅ All Firebase services enabled
- ✅ Created projectplan.md with detailed tracking
- ✅ Deployed Firestore security rules
- ✅ Created Firestore collections structure (all 8 collections)
- ✅ Set up Firebase Auth adapter with custom claims support
- ✅ Created Firebase API adapter layer (entities.js now supports both backends)
- ✅ Added REACT_APP_USE_FIREBASE environment variable for backend switching

### Current Focus
- Ready to export data from Base44
- Preparing data migration scripts
- Need to implement Cloud Functions next

### Blockers
- None currently

## Review Section
*To be updated throughout the migration*

### Changes Made
- Project plan created for systematic migration tracking

### Lessons Learned
- *To be documented as migration progresses*

### Performance Metrics
- *To be measured after implementation*

### Final Notes
- *To be added upon completion*