# Phone Authentication Test Guide

## Test Credentials
- Phone: **+972541234567**
- Password: **123456** (for verification code)

## Testing Phone Authentication

### 1. Run the test script:
```bash
node test-auth-with-dotenv.js
```

### 2. What happens:
- The script will initiate phone authentication
- Firebase will attempt to send an SMS to +972541234567
- You'll see a message about verification code needed

### 3. Verification Options:

#### Option A: Using Real Phone Number
- Check your SMS for the 6-digit verification code
- Firebase Console shows recent verifications

#### Option B: Using Test Phone Numbers
1. Go to [Firebase Console](https://console.firebase.google.com/project/project-1386902152066454120/authentication/providers)
2. Click **Phone** provider
3. Add test phone number:
   - Phone: `+972541234567`
   - Verification code: `123456`
4. Re-run the test - it will accept `123456` as the code

#### Option C: Using Firebase Emulator
```bash
# Terminal 1: Start emulator
firebase emulators:start

# Terminal 2: Run test with emulator
USE_FIREBASE_EMULATOR=true node test-auth-with-dotenv.js
```
- Emulator always accepts `123456` as verification code
- No real SMS sent

## Verify Phone Code Programmatically

After getting the SMS code, you can verify it by modifying the test script:

```javascript
// In test-auth.js, uncomment these lines:
const verificationCode = '123456'; // Replace with actual code
const user = await verifyPhoneCode(verificationCode);
console.log('✅ Phone authentication successful!');
console.log('User ID:', user.uid);
```

## Troubleshooting

### "Invalid phone number"
- Ensure format: `+972541234567` (with country code)
- No spaces or dashes

### "Missing reCAPTCHA"
- For Node.js testing, we use a mock reCAPTCHA
- In production web app, you'll need real reCAPTCHA

### "Quota exceeded"
- Firebase has SMS limits
- Use test phone numbers or emulator to avoid limits

## Next Steps
1. Enable Cloud Storage and Functions
2. Start migrating data from Base44
3. Update frontend components to use Firebase auth