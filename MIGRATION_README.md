# User Permissions & TOTP Fields Migration

## What This Script Does

The `migrate-user-permissions.mjs` script will:

1. ✅ **Update permissions** for each user based on their `custom_role`:
   - `admin` → Full access to everything
   - `division_manager` → Manage division-level operations
   - `team_leader` → Manage team-level operations
   - `soldier` → View-only access

2. ✅ **Update scope** based on role:
   - `admin` → `global`
   - `division_manager` → `division`
   - `team_leader` → `team`
   - `soldier` → `self`

3. ✅ **Ensure TOTP fields exist** (creates them if missing):
   - `totp_enabled`
   - `totp_enabled_at`
   - `totp_verified_until`
   - `totp_verified_at`
   - `totp_device_fingerprint`

## Usage

### 1. Dry Run (Preview Changes)

First, run in dry-run mode to see what would change **without actually modifying anything**:

```bash
node migrate-user-permissions.mjs --dry-run
```

This will show you:
- Which users will be updated
- What permissions will be added/changed
- What TOTP fields are missing
- **No changes will be applied**

### 2. Run the Migration

Once you've reviewed the dry-run output and are satisfied, run the actual migration:

```bash
node migrate-user-permissions.mjs
```

This will:
- Update all user documents in Firestore
- Add missing TOTP fields
- Set correct permissions based on role

## Example Output

```
============================================================
🚀 USER PERMISSIONS & TOTP FIELDS MIGRATION
============================================================

📚 Fetching all users from Firestore...
✓ Found 15 user(s)

============================================================
Processing user: abc123
  Display Name: עילאי אמונה
  Email: N/A
  Phone: +972535314663
  Custom Role: soldier
  Current Scope: N/A

  ✏️  Will update permissions for role: soldier
  ✏️  Will update scope: undefined → self
  ✏️  Will add missing TOTP fields: totp_enabled, totp_enabled_at, totp_verified_until, totp_verified_at, totp_device_fingerprint

  ✅ Successfully updated user

============================================================
Processing user: xyz789
  Display Name: Admin User
  Email: admin@example.com
  Phone: N/A
  Custom Role: admin
  Current Scope: global

  ✓ Permissions already correct
  ✓ Scope already correct
  ✓ All TOTP fields exist

  ✓ No changes needed

============================================================
📊 MIGRATION SUMMARY
============================================================
  Total users processed: 15
  Users updated: 12
  Users unchanged: 3
  Errors: 0
============================================================

✅ Migration complete!
```

## Permission Structure by Role

### Admin
```javascript
{
  personnel: { view: true, create: true, update: true, delete: true },
  equipment: { view: true, create: true, update: true, delete: true },
  operations: { sign: true, transfer: true, deposit: true, release: true, verify: true, maintain: true },
  system: { reports: true, history: true, import: true, export: true, users: true },
  scope: 'global'
}
```

### Division Manager
```javascript
{
  personnel: { view: true, create: true, update: true, delete: false },
  equipment: { view: true, create: true, update: true, delete: false },
  operations: { sign: true, transfer: true, deposit: true, release: true, verify: true, maintain: true },
  system: { reports: true, history: true, import: false, export: true, users: false },
  scope: 'division'
}
```

### Team Leader
```javascript
{
  personnel: { view: true, create: false, update: true, delete: false },
  equipment: { view: true, create: false, update: true, delete: false },
  operations: { sign: true, transfer: true, deposit: true, release: true, verify: true, maintain: false },
  system: { reports: true, history: true, import: false, export: false, users: false },
  scope: 'team'
}
```

### Soldier
```javascript
{
  personnel: { view: true, create: false, update: false, delete: false },
  equipment: { view: true, create: false, update: false, delete: false },
  operations: { all false },
  system: { history: true, all others false },
  scope: 'self'
}
```

## Safety Features

✅ **Non-destructive** - Only adds/updates fields, never deletes
✅ **Dry-run mode** - Preview changes before applying
✅ **Error handling** - Continues even if one user fails
✅ **Detailed logging** - See exactly what changed
✅ **Idempotent** - Safe to run multiple times

## After Migration

After running the migration, users will have:
1. ✅ Proper permissions based on their role
2. ✅ Correct scope setting
3. ✅ All TOTP fields present (even if null)

**Note:** Users will need to refresh their session (logout/login) to see the new permissions take effect in the UI.
