# ARMORY Knowledge Base

## Overview

This knowledge base contains all documentation, implementation details, and migration plans for the Armory system.

## Directory Structure

### `/migration-docs/` ⭐ ACTIVE WORK
Complete migration planning from Base44:
- **projectplan.md** - Main migration plan with Firebase/Supabase/Standalone options
- **FIREBASE_MIGRATION_GUIDE.md** - Detailed Firebase implementation (chosen solution)
- **testplan.md** - Comprehensive test strategy
- Base44 research findings and Q&A documents
- [See full document index](./migration-docs/README.md)

### `/entities/`
JSON schemas for all data entities:
- Soldier, Equipment, Weapon, SerializedGear
- DroneSet, DroneComponent
- ActivityLog, DailyVerification

### `/functions/implementations/`
Base44 server function implementations:
- Data management functions (deleteAll*)
- Email sending functions (SendGrid integration)
- Form generation (signing/release forms)
- TOTP authentication (2FA)
- Data export functionality

### `/server-architecture/`
Original standalone server architecture planning

### `/System_Analysis.md`
Complete system analysis in Hebrew with:
- Full feature documentation
- User roles and permissions
- Technical architecture
- Security measures

## Current Migration Status

🔥 **Active**: Migrating from Base44 to Firebase
- **Timeline**: 2 weeks
- **Approach**: Backend-as-a-Service (BaaS) 
- **Progress**: Planning complete, ready for implementation

## Quick Links

1. [Main Migration Plan](./migration-docs/projectplan.md)
2. [Firebase Implementation Guide](./migration-docs/FIREBASE_MIGRATION_GUIDE.md)
3. [Test Strategy](./migration-docs/testplan.md)
4. [Base44 Findings](./migration-docs/BASE44_FINDINGS.md)