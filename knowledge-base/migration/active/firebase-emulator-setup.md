# Firebase Emulator Setup Guide

## 🧪 Using Firebase Emulators for Testing

Firebase emulators allow you to test your app locally without affecting production data or sending real SMS messages.

### Enable Emulators

To use Firebase emulators, set the environment variable:
```bash
export USE_FIREBASE_EMULATOR=true
```

Or add to your `.env.local`:
```
USE_FIREBASE_EMULATOR=true
```

### Start Emulators

```bash
firebase emulators:start
```

This will start:
- Auth emulator: http://localhost:9099
- Firestore emulator: http://localhost:8080
- Functions emulator: http://localhost:5001
- Storage emulator: http://localhost:9199
- Emulator UI: http://localhost:4000

### Testing Phone Authentication with Emulator

When using the Auth emulator:
1. Phone numbers don't need to be real
2. No SMS messages are sent
3. Test verification codes are:
   - Default: `123456`
   - Or check the emulator UI at http://localhost:4000/auth

### Test Phone Numbers

You can add test phone numbers in Firebase Console:
1. Go to Authentication → Sign-in method → Phone
2. Click "Phone numbers for testing"
3. Add: +972541234567 with code: 123456

### Running Tests

With emulators:
```bash
# Start emulators
firebase emulators:start

# In another terminal, run tests
USE_FIREBASE_EMULATOR=true node test-auth.js
USE_FIREBASE_EMULATOR=true node test-firebase.js
```

Without emulators (production):
```bash
node test-auth.js
node test-firebase.js
```

### Benefits of Using Emulators

1. **No SMS costs** - Test phone auth without sending real messages
2. **Isolated data** - Test data doesn't affect production
3. **Faster testing** - No network latency
4. **Debug tools** - Emulator UI provides insights
5. **CI/CD friendly** - Can run in automated tests