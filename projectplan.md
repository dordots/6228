# Project Plan: Implement Rate Limiting for Authentication (Security Issue #3)

## Date: 28 October 2025

## Problem Statement

The security audit identified a **CRITICAL vulnerability** (Issue #3):
**No rate limiting on authentication attempts** - making the system vulnerable to brute force attacks.

### Current Vulnerabilities
1. **Unlimited login attempts** - allows credential stuffing and dictionary attacks
2. **Unlimited TOTP verification attempts** - 6 digits = 1M combinations, with 90-second window = ~3M possible attempts
3. **Unlimited SMS requests** - allows SMS flooding and service abuse
4. **No account lockout** - attackers can try indefinitely

### Attack Scenarios
- **Brute force TOTP:** With window=1 (±30 seconds), attacker could try millions of combinations
- **Credential stuffing:** Unlimited email/password attempts
- **SMS flooding:** Abuse the SMS service with unlimited verification requests
- **Resource exhaustion:** Repeated failed attempts overload the system

**Severity:** 🔴 **CRITICAL** - Must fix within 30 days

---

## Solution Design

### Strategy
Implement comprehensive rate limiting using the `rate-limiter-flexible` library.

### Rate Limits (Following Security Best Practices)

| Action | Limit | Window | Block Duration | Rationale |
|--------|-------|--------|----------------|-----------|
| **TOTP Verification** | 3 attempts | 5 minutes | 15 minutes | Prevents brute force (1M combinations) |
| **Login Attempts** | 5 attempts | 5 minutes | 30 minutes | Prevents credential stuffing |
| **SMS Requests** | 3 requests | 15 minutes | 60 minutes | Prevents SMS flooding & cost abuse |

### Why `rate-limiter-flexible`?
- ✅ Supports multiple backends (Memory, Redis, Firestore)
- ✅ Built for Firebase Cloud Functions
- ✅ Production-ready with proper error handling
- ✅ Minimal performance overhead
- ✅ Easy to configure and extend

---

## Implementation Plan

### Phase 1: Backend Rate Limiting

#### Step 1: Install Dependencies
**File:** `functions/package.json`
- Add `rate-limiter-flexible` package
- Run `npm install` in functions directory

#### Step 2: Create Rate Limiter Middleware
**New File:** `functions/src/middleware/rateLimiter.js`

Create three rate limiters:
```javascript
// TOTP Limiter: 3 attempts per 5 minutes
const totpLimiter = new RateLimiterMemory({
  points: 3,
  duration: 300,      // 5 minutes
  blockDuration: 900  // 15 minutes
});

// Login Limiter: 5 attempts per 5 minutes
const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 300,      // 5 minutes
  blockDuration: 1800 // 30 minutes
});

// SMS Limiter: 3 requests per 15 minutes
const smsLimiter = new RateLimiterMemory({
  points: 3,
  duration: 900,      // 15 minutes
  blockDuration: 3600 // 60 minutes
});
```

#### Step 3: Apply Rate Limiting to TOTP Functions
**File:** `functions/src/auth.js`

**Function:** `verifyTotp` (line 68)
- Add rate limiting check before verification
- Consume 1 point per attempt
- On exceed, throw `resource-exhausted` error with retry time
- On success, reward with 1 point back (to not penalize legitimate users)

**Function:** `generateTotp` (line 11)
- Add SMS rate limiting for phone auth users
- Prevent SMS flooding attacks
- Track by uid (user ID)

#### Step 4: Error Messages
Return user-friendly errors:
```javascript
throw new functions.https.HttpsError(
  'resource-exhausted',
  `Too many attempts. Try again in ${Math.ceil(secondsRemaining)} seconds.`
);
```

### Phase 2: Frontend Error Handling

#### Step 5: Update Login Page
**File:** `src/pages/Login.jsx`

Changes:
1. Detect rate limit errors (error code: `resource-exhausted`)
2. Parse the retry time from error message
3. Display countdown timer
4. Disable submit button during rate limit
5. Show clear error message: "Too many attempts. Try again in X seconds/minutes"

#### Step 6: Update Auth Adapter
**File:** `src/firebase/auth-adapter.js`

Changes:
1. Parse Firebase errors for rate limiting
2. Extract retry time from error message
3. Return structured error with `retryAfter` field
4. Handle in UI components

---

## Todo List

### Backend Implementation
- [ ] Install `rate-limiter-flexible` package in functions directory
- [ ] Create `functions/src/middleware/rateLimiter.js` with three limiters
- [ ] Update `verifyTotp` function in `functions/src/auth.js`
- [ ] Update `generateTotp` function in `functions/src/auth.js`
- [ ] Test rate limiting in Firebase emulator

### Frontend Implementation
- [ ] Update `src/pages/Login.jsx` to handle rate limit errors
- [ ] Add countdown timer component for blocked state
- [ ] Update `src/firebase/auth-adapter.js` to parse rate limit errors
- [ ] Test UI behavior with rate limit errors

### Testing & Deployment
- [ ] Test TOTP rate limiting (3 failed attempts)
- [ ] Test login rate limiting (5 failed attempts)
- [ ] Test SMS rate limiting (3 SMS requests)
- [ ] Verify error messages are user-friendly
- [ ] Deploy functions to Firebase
- [ ] Update security audit report status

---

## Files to Create

1. **functions/src/middleware/rateLimiter.js** (NEW)
   - Rate limiter configurations
   - Export three limiters: totpLimiter, loginLimiter, smsLimiter

---

## Files to Modify

### Backend
1. **functions/package.json**
   - Add: `"rate-limiter-flexible": "^3.0.0"`

2. **functions/src/auth.js**
   - Line 68: `verifyTotp` - Add TOTP rate limiting
   - Line 11: `generateTotp` - Add SMS rate limiting

### Frontend
3. **src/pages/Login.jsx**
   - Add rate limit error detection
   - Add countdown timer state
   - Display blocked message with retry time

4. **src/firebase/auth-adapter.js**
   - Parse `resource-exhausted` errors
   - Extract retry time from error message
   - Return structured error object

---

## Expected Impact

### Security Improvements
✅ **Prevents brute force attacks** on TOTP codes
✅ **Blocks credential stuffing** and dictionary attacks
✅ **Prevents SMS flooding** and service cost abuse
✅ **Protects against resource exhaustion**
✅ **Reduces attack surface** significantly

### Performance
- ✅ **Minimal overhead** - in-memory rate limiter is fast
- ✅ **No database calls** for rate limiting
- ✅ **Scales with Cloud Functions** auto-scaling

### User Experience
- ✅ **Legitimate users unaffected** - limits are generous
- ✅ **Clear error messages** with countdown timers
- ✅ **Automatic unblock** after timeout
- ⚠️ **Slight inconvenience** if user makes genuine mistakes (acceptable tradeoff)

---

## Testing Strategy

### Manual Testing
1. **TOTP Rate Limit Test:**
   - Attempt 3 wrong TOTP codes
   - Verify 15-minute block
   - Check countdown timer shows correct time

2. **Login Rate Limit Test:**
   - Attempt 5 wrong passwords
   - Verify 30-minute block
   - Check error message clarity

3. **SMS Rate Limit Test:**
   - Request 3 SMS codes quickly
   - Verify 60-minute block
   - Check SMS service not abused

### Edge Cases
- Multiple users from same IP (uses uid, not IP)
- Legitimate user makes mistakes (generous limits)
- Rate limiter memory persistence (resets on function cold start - acceptable)

---

## Future Enhancements (Not in this PR)

- [ ] **Firestore-based rate limiting** - for distributed rate limiting across function instances
- [ ] **IP-based rate limiting** - additional layer of protection
- [ ] **Account lockout** - permanent block after X failed attempts
- [ ] **Admin unlock functionality** - manual override for locked accounts
- [ ] **Rate limit analytics** - track attack attempts
- [ ] **Geofencing** - block logins from suspicious countries

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| False positives (legitimate users blocked) | Low | Medium | Generous limits (3-5 attempts), clear error messages |
| Memory-based limiter resets on cold start | Medium | Low | Acceptable for MVP, can upgrade to Firestore later |
| Increased function execution time | Low | Low | Rate limiting is fast (<1ms overhead) |
| Users frustrated by blocks | Low | Low | Clear messaging with countdown timer |

---

## Simplicity Score: 9/10

**Why it's simple:**
- ✅ Single well-tested library (`rate-limiter-flexible`)
- ✅ No database schema changes
- ✅ Isolated changes to 2 backend functions
- ✅ Minimal frontend changes
- ✅ No authentication flow changes
- ✅ Easy to test and verify

**Complexity:**
- ⚠️ Need to handle error messages properly in UI
- ⚠️ Testing requires making multiple failed attempts

---

## Review Section

### Changes Made
_(Will be filled after implementation)_

- [ ] Backend rate limiters created
- [ ] TOTP verification protected
- [ ] SMS generation protected
- [ ] Frontend error handling updated
- [ ] Testing completed
- [ ] Deployed to production

### Verification Steps
_(Will be filled after implementation)_

1. Tested TOTP rate limiting
2. Tested login rate limiting
3. Tested SMS rate limiting
4. Verified error messages are user-friendly
5. Confirmed countdown timer works
6. Validated no impact on legitimate users

### Next Steps
_(Will be filled after implementation)_

- Move to next security issue (#1: Client-side TOTP bypass)
- Or continue with other Priority 1 issues
- Schedule security re-audit after all fixes

---

## Security Audit Status Update

**Before:** Issue #3 - 🔴 CRITICAL - No rate limiting
**After:** Issue #3 - ✅ FIXED - Comprehensive rate limiting implemented

**Overall Security Score:**
- Before: 72/100 (6.9/10)
- After: ~78/100 (7.5/10) - estimated improvement

---

**Plan Status:** ⏳ **PENDING APPROVAL**
**Ready to implement?** Yes, all steps are clear and simple.
