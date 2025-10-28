# Project Plan: Redirect Soldiers to Equipment Page After Login

**Date**: 2025-10-28
**Task**: Redirect soldiers to their equipment page instead of command dashboard after sign-in

## Problem Statement

When a soldier signs in (with `custom_role === 'soldier'`), they are redirected to the Command Dashboard at `/` (root path). However, soldiers should not access the Command Dashboard - they should be redirected directly to their equipment page at `/my-equipment`.

### Current Behavior

**Login.jsx** - Lines 84, 107, 133:
```javascript
// After successful authentication:
window.location.href = '/';  // ALL users go to dashboard
```

### Expected Behavior

- **Soldiers** → Should go to `/my-equipment` page
- **All other roles** (admin, manager, division_manager, team_leader) → Should go to `/` (dashboard)

### Root Cause

The login redirect is hardcoded to `/` for all users, regardless of their role. No role checking is performed after authentication before redirect.

## Solution

After successful login, check the user's `custom_role` and redirect accordingly:

1. Get the authenticated user via `User.me()`
2. Check if `user.custom_role === 'soldier'`
3. Redirect to `/my-equipment` for soldiers
4. Redirect to `/` for all other roles

This is a **simple, localized change** that only affects the post-login redirect logic in Login.jsx.

## Todo List

- [ ] Modify Login.jsx line 84 (phone login without verification)
- [ ] Modify Login.jsx line 107 (phone login with verification)
- [ ] Modify Login.jsx line 133 (email login)
- [ ] Create helper function to get redirect URL based on user role
- [ ] Test soldier login (phone and email)
- [ ] Test non-soldier login (admin, manager, team_leader)
- [ ] Update projectplan.md review section with changes made

## Implementation Details

### File: src/pages/Login.jsx

#### Create Helper Function

Add this helper function near the top of the file (after imports):

```javascript
// Helper function to get redirect URL based on user role
const getRedirectUrl = async () => {
  try {
    const user = await User.me();
    // Redirect soldiers to their equipment page
    if (user?.custom_role === 'soldier') {
      return '/my-equipment';
    }
    // All other roles go to dashboard
    return '/';
  } catch (error) {
    console.error('Error getting user for redirect:', error);
    // Default to dashboard on error
    return '/';
  }
};
```

#### Modify Three Redirect Locations

**Location 1: Line 84** (phone login - no verification needed)
```javascript
// OLD:
window.location.href = '/';

// NEW:
window.location.href = await getRedirectUrl();
```

**Location 2: Line 107** (phone login - verification successful)
```javascript
// OLD:
window.location.href = '/';

// NEW:
window.location.href = await getRedirectUrl();
```

**Location 3: Line 133** (email login - successful)
```javascript
// OLD:
window.location.href = '/';

// NEW:
window.location.href = await getRedirectUrl();
```

### Key Points

1. **Minimal code change**: Only 3 lines changed + 1 helper function added
2. **Centralized logic**: All role-based redirect logic in one function
3. **Fallback behavior**: Defaults to `/` on error
4. **Async/await**: Already in async functions, no changes needed
5. **No impact on other features**: Only affects post-login redirect

## Files to Modify

1. **[src/pages/Login.jsx](src/pages/Login.jsx:20-383)** - Add helper function and modify 3 redirect lines

## Impact Assessment

- **User Impact**: Positive - soldiers go directly to their equipment instead of seeing empty dashboard
- **Code Complexity**: Very low - only adds one helper function and modifies 3 lines
- **Maintainability**: Excellent - centralized redirect logic, easy to extend
- **Performance**: No impact - same number of API calls
- **Security**: No change - uses existing permissions and routes
- **Simplicity**: Very high - minimal, localized change

## Review Section

### Changes Made

**Date**: 2025-10-28
**File Modified**: [src/pages/Login.jsx](src/pages/Login.jsx)

#### Summary
Successfully implemented role-based redirect after login. Soldiers now navigate to their equipment page while all other roles go to the dashboard.

#### Detailed Changes

**1. Added Helper Function** (lines 20-35):
```javascript
const getRedirectUrl = async () => {
  try {
    const user = await User.me();
    if (user?.custom_role === 'soldier') {
      return '/my-equipment';
    }
    return '/';
  } catch (error) {
    console.error('Error getting user for redirect:', error);
    return '/';
  }
};
```

**2. Modified Three Redirect Locations**:
- **Line 101**: Phone login (no verification needed) - Changed `window.location.href = '/'` to `window.location.href = await getRedirectUrl()`
- **Line 124**: Phone verification successful - Changed `window.location.href = '/'` to `window.location.href = await getRedirectUrl()`
- **Line 150**: Email login successful - Changed `window.location.href = '/'` to `window.location.href = await getRedirectUrl()`

#### Impact
- **Lines added**: 16 (helper function)
- **Lines modified**: 3 (redirect statements)
- **Complexity**: Very low - simple conditional logic
- **Scope**: Only affects post-login redirect behavior

#### Testing Recommendations

**Soldier Login Test**:
1. Sign in with soldier credentials (phone or email)
2. Verify redirect to `/my-equipment` page
3. Confirm equipment page loads correctly

**Non-Soldier Login Test**:
1. Sign in with admin/manager/team_leader credentials
2. Verify redirect to `/` (dashboard)
3. Confirm dashboard loads correctly

**Error Handling Test**:
1. Simulate error in `User.me()` call
2. Verify fallback to dashboard (`/`)
3. Check console for error log
