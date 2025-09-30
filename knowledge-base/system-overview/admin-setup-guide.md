# Admin Setup Guide for Armory System

## First-Time Admin Setup

When deploying the Armory system for the first time, you need to set up an initial admin user. This admin will have full access to create and manage other users.

### Prerequisites
- Firebase project configured
- Service account key file (`firebase-service-account.json`)
- Node.js installed

### Setting Up the First Admin

1. **Using the Setup Script** (Recommended)
   ```bash
   node setup-admin.js +972501234567
   ```
   Replace `+972501234567` with the actual phone number (in E.164 format).

2. **Using the Cloud Function** (Alternative)
   If you're already logged in with a phone number, you can make yourself admin:
   ```javascript
   // In browser console (while logged in)
   const setAdminByPhone = firebase.functions().httpsCallable('setAdminByPhone');
   await setAdminByPhone({ phoneNumber: '+972501234567' });
   ```

### Phone Number Format
Phone numbers must be in E.164 format:
- Israel: `+972501234567`
- US: `+12125551234`
- UK: `+447911123456`

### After Admin Setup

1. **Login to the App**
   - Open the application
   - Click "Sign in with Phone"
   - Enter your phone number
   - Verify with SMS code

2. **Set Up 2FA**
   - You'll be prompted to set up two-factor authentication
   - Scan the QR code with an authenticator app
   - Complete the setup

3. **Access Admin Features**
   - User Management - Create and manage users
   - Full access to all equipment and personnel
   - System configuration options

### Creating Additional Admins

Once logged in as admin:
1. Go to User Management
2. Create a new user or find an existing one
3. Change their role to "Admin"
4. They'll have admin access on next login

### Security Notes
- Only ONE initial admin can be set via the setup script
- Additional admins must be created through the UI
- All admins should have 2FA enabled
- Keep the service account key secure

### Troubleshooting

**"Admin already exists" error**
- An admin has already been set up
- Use the existing admin account to create more admins

**"User not found" error**
- The phone number doesn't exist in the system
- The script will create a new user automatically

**SMS not received**
- Check Firebase Auth settings
- Ensure phone auth is enabled
- Check SMS quota in Firebase Console

### Role Hierarchy

1. **Admin** - Full system access
2. **Manager** - Department management, can create/edit but not delete
3. **Soldier** - View own equipment only

### Default Permissions by Role

**Admin**: All permissions enabled
**Manager**: Most permissions except user management and deletion
**Soldier**: Limited to viewing and signing equipment

For more details, see the User Management page in the application.