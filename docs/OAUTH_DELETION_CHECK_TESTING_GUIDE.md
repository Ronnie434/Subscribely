# OAuth Account Deletion Check - Manual Testing Guide

## Document Information
- **Feature**: OAuth Account Deletion Detection
- **Created**: 2025-12-10
- **Version**: 1.0.0
- **Purpose**: Comprehensive manual testing guide for OAuth account deletion checks

---

## 1. Pre-Testing Checklist

Before starting testing, verify the following:

### 1.1 Environment Setup
- [ ] App builds successfully without errors (`npm run ios` or `npm run android`)
- [ ] Development build is running in debug mode (`__DEV__ = true`)
- [ ] Console/terminal is visible to monitor debug logs
- [ ] Device/simulator has internet connectivity

### 1.2 Supabase Configuration
- [ ] Edge Functions are deployed and accessible
- [ ] `check-account-status` Edge Function exists at `/functions/v1/check-account-status`
- [ ] Service role key is properly configured in Edge Function environment
- [ ] Google OAuth provider is enabled in Supabase Auth settings
- [ ] Apple OAuth provider is enabled in Supabase Auth settings (if testing on iOS)

### 1.3 Database Prerequisites
- [ ] `profiles` table has `deleted_at` column (TIMESTAMPTZ)
- [ ] RLS policies are updated to exclude deleted accounts from SELECT/UPDATE
- [ ] Test user accounts are available for deletion testing

### 1.4 Verification Commands
```bash
# Build the app
npm run ios  # or npm run android

# Check Edge Functions (replace with your project URL)
curl -X POST https://your-project.supabase.co/functions/v1/check-account-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response from Edge Function:**
```json
{
  "deleted": false,
  "deletedAt": null,
  "email": "user@example.com"
}
```

---

## 2. Manual Test Cases

### Test Case 1: Google OAuth with Deleted Account

**Objective**: Verify that logging in with Google detects a deleted account and shows recovery screen.

**Prerequisites**:
- A Google account that you can use for testing
- Access to Supabase database to manually mark account as deleted

**Steps**:

1. **Create Account via Google OAuth**
   ```
   a. Launch the app
   b. Tap "Continue with Google"
   c. Complete Google OAuth flow
   d. Verify successful login (should see Home screen)
   e. Note the email address used
   ```
   
   **Expected Console Logs**:
   ```
   [OAuth] Starting Google sign-in
   [OAuth] Opening browser for Google OAuth
   [OAuth] OAuth success, extracting tokens
   [OAuth] Session set successfully
   [checkAccountDeletionStatus] Checking account deletion status via Edge Function
   [checkAccountDeletionStatus] Account is active (not deleted)
   ```

2. **Mark Account as Deleted**
   ```
   a. Sign out from the app
   b. In Supabase Dashboard, go to SQL Editor
   c. Run this query (replace with actual user email):
      
      UPDATE profiles 
      SET deleted_at = NOW() 
      WHERE email = 'your-test-email@gmail.com';
   
   d. Verify the update:
      
      SELECT id, email, deleted_at 
      FROM profiles 
      WHERE email = 'your-test-email@gmail.com';
   ```
   
   **Expected Result**: `deleted_at` should have a timestamp

3. **Attempt Login Again**
   ```
   a. Launch the app (should be on Login screen)
   b. Tap "Continue with Google"
   c. Select the same Google account
   d. Complete OAuth flow
   e. Wait for app to process the login
   ```
   
   **Expected Console Logs**:
   ```
   [OAuth] Starting Google sign-in
   [OAuth] Opening browser for Google OAuth
   [OAuth] OAuth success, extracting tokens
   [OAuth] Session set successfully
   [checkAccountDeletionStatus] Checking account deletion status via Edge Function
   [check-account-status] 🔐 Checking account status for user: [user-id]
   [check-account-status] Account status: { userId: [id], deleted: true, deletedAt: [timestamp] }
   [checkAccountDeletionStatus] ✅ Deleted account detected, setting info for recovery
   [AppNavigator] Deleted account detected, navigating to AccountRecovery
   [AppNavigator.DEBUG] Current auth state: { hasUser: true, hasSession: true, ... }
   [AppNavigator.DEBUG] Rendering AuthNavigator { reason: 'deleted account' }
   ```

4. **Verify Recovery Screen**
   ```
   a. App should navigate to Account Recovery screen
   b. Screen should show:
      - Warning icon (orange triangle)
      - "Account Scheduled for Deletion" title
      - User's email address
      - Countdown showing "30 days" (or days remaining)
      - "What will be recovered" section with checkmarks
      - "Recover My Account" button (green)
      - "Continue with Deletion" button (red outline)
   ```

**Pass Criteria**:
- ✅ Account deletion is detected during OAuth login
- ✅ Console shows `[checkAccountDeletionStatus] ✅ Deleted account detected`
- ✅ AccountRecoveryScreen is displayed
- ✅ All UI elements are present and correct
- ✅ Countdown shows correct remaining time
- ✅ No crashes or errors occur

**Fail Criteria**:
- ❌ User is allowed to login normally
- ❌ No console logs about deletion check
- ❌ App crashes during login
- ❌ Wrong screen is shown

---

### Test Case 2: Apple OAuth with Deleted Account

**Objective**: Verify that logging in with Apple detects a deleted account and shows recovery screen.

**Prerequisites**:
- An Apple ID for testing
- iOS device or simulator
- Access to Supabase database

**Steps**:

1. **Create Account via Apple OAuth**
   ```
   a. Launch the app on iOS
   b. Tap "Continue with Apple"
   c. Complete Apple Sign In flow
   d. Verify successful login (should see Home screen)
   e. Note the email address used (may be private relay)
   ```
   
   **Expected Console Logs**:
   ```
   [OAuth] Starting Apple sign-in
   [OAuth] Opening browser for Apple OAuth
   [OAuth] OAuth success, extracting tokens
   [OAuth] Session set successfully
   [checkAccountDeletionStatus] Checking account deletion status via Edge Function
   [checkAccountDeletionStatus] Account is active (not deleted)
   ```

2. **Mark Account as Deleted**
   ```
   a. Sign out from the app
   b. In Supabase Dashboard, go to SQL Editor
   c. Find the user's actual email in profiles table:
      
      SELECT id, email, deleted_at 
      FROM profiles 
      ORDER BY created_at DESC 
      LIMIT 5;
   
   d. Mark as deleted:
      
      UPDATE profiles 
      SET deleted_at = NOW() 
      WHERE email = 'apple-user-email@privaterelay.appleid.com';
   ```

3. **Attempt Login Again**
   ```
   a. Launch the app (should be on Login screen)
   b. Tap "Continue with Apple"
   c. Complete Apple Sign In flow
   d. Wait for app to process the login
   ```
   
   **Expected Console Logs**:
   ```
   [OAuth] Starting Apple sign-in
   [OAuth] Opening browser for Apple OAuth
   [OAuth] OAuth success, extracting tokens
   [OAuth] Session set successfully
   [checkAccountDeletionStatus] Checking account deletion status via Edge Function
   [checkAccountDeletionStatus] ✅ Deleted account detected, setting info for recovery
   [AppNavigator] Deleted account detected, navigating to AccountRecovery
   ```

4. **Verify Recovery Screen**
   - Same verification steps as Test Case 1, step 4

**Pass Criteria**: Same as Test Case 1

---

### Test Case 3: Google OAuth with Active Account (Regression Test)

**Objective**: Verify that normal Google OAuth login still works correctly for active accounts.

**Steps**:

1. **Use Fresh Google Account or Recovered Account**
   ```
   a. Ensure account is NOT marked as deleted in database
   b. Launch the app
   c. Tap "Continue with Google"
   d. Complete OAuth flow
   ```

2. **Verify Normal Login**
   ```
   a. Login should complete successfully
   b. User should see Home screen
   c. No recovery screen should appear
   ```
   
   **Expected Console Logs**:
   ```
   [OAuth] Starting Google sign-in
   [OAuth] OAuth success, extracting tokens
   [OAuth] Session set successfully
   [checkAccountDeletionStatus] Checking account deletion status via Edge Function
   [checkAccountDeletionStatus] Account is active (not deleted)
   [AppNavigator.DEBUG] Rendering MainNavigator
   ```

**Pass Criteria**:
- ✅ User can login normally
- ✅ Home screen is shown
- ✅ Console shows "Account is active (not deleted)"
- ✅ No recovery screen appears
- ✅ All app features work normally

---

### Test Case 4: Apple OAuth with Active Account (Regression Test)

**Objective**: Verify that normal Apple OAuth login still works correctly for active accounts.

**Steps**: Same as Test Case 3 but using Apple OAuth

**Pass Criteria**: Same as Test Case 3

---

### Test Case 5: Email/Password with Deleted Account (Regression Test)

**Objective**: Verify that existing email/password deletion check still works (not affected by OAuth changes).

**Steps**:

1. **Create Email/Password Account**
   ```
   a. Launch app
   b. Tap "Sign up with email"
   c. Create account with email/password
   d. Verify account and login
   ```

2. **Mark Account as Deleted**
   ```
   Same SQL commands as Test Case 1, step 2
   ```

3. **Attempt Email/Password Login**
   ```
   a. Sign out
   b. Tap "Continue with Email"
   c. Enter email and password
   d. Tap "Sign In"
   ```

4. **Verify Behavior**
   ```
   Expected: Same recovery flow as OAuth
   - Account deletion detected
   - AccountRecoveryScreen displayed
   - All recovery options available
   ```

**Pass Criteria**:
- ✅ Email/password login also detects deletion
- ✅ Recovery screen is shown
- ✅ Functionality is consistent with OAuth

---

## 3. Edge Cases to Test

### Edge Case 1: Network Failure During Deletion Check

**Steps**:
1. Enable Airplane Mode or disable network
2. Attempt to login with Google/Apple OAuth
3. Network will fail during deletion check

**Expected Behavior**:
- Edge Function call fails gracefully
- User is allowed to login (non-blocking failure)
- Console shows warning: `[checkAccountDeletionStatus] Error checking account status`

**Pass Criteria**:
- ✅ App doesn't crash
- ✅ User can still login
- ✅ Error is logged but non-blocking

---

### Edge Case 2: Edge Function Unavailable

**Steps**:
1. Temporarily disable the Edge Function in Supabase (or use invalid URL)
2. Attempt OAuth login

**Expected Behavior**:
- Function returns error response
- App logs warning and continues
- User is allowed to login

**Console Pattern**:
```
[checkAccountDeletionStatus] Edge Function error: [error message]
[checkAccountDeletionStatus] Returning false (non-blocking)
```

---

### Edge Case 3: Expired Grace Period

**Steps**:
1. Create account and mark as deleted
2. In SQL, set `deleted_at` to 31 days ago:
   ```sql
   UPDATE profiles 
   SET deleted_at = NOW() - INTERVAL '31 days' 
   WHERE email = 'test@example.com';
   ```
3. Attempt login

**Expected Behavior**:
- Deletion is detected
- Recovery screen shows "0 days" remaining
- "Recover Account" should show grace period expired error

**Console Pattern**:
```
[checkAccountDeletionStatus] ✅ Deleted account detected
[AccountRecovery] Recovery failed: Recovery period has expired
```

---

### Edge Case 4: Multiple Rapid Login Attempts

**Steps**:
1. Attempt OAuth login
2. Cancel OAuth flow
3. Immediately try again
4. Repeat 3-4 times quickly

**Expected Behavior**:
- Each attempt processes independently
- No crashes or state corruption
- Correct behavior on final successful login

---

### Edge Case 5: Account Recovered Then Deleted Again

**Steps**:
1. Test account with deleted status
2. Login and use "Recover Account"
3. Verify account is active
4. Delete account again via settings
5. Login again

**Expected Behavior**:
- Each deletion/recovery cycle works correctly
- No stale state from previous cycle
- Recovery screen shows correct countdown

---

## 4. What to Look For

### 4.1 Console Log Patterns (Success)

**Google OAuth - Deleted Account Detected:**
```
[OAuth] Starting Google sign-in
[OAuth] Opening browser for Google OAuth
[OAuth] Browser result: success
[OAuth] OAuth success, extracting tokens
[OAuth] Session set successfully
[checkAccountDeletionStatus] Checking account deletion status via Edge Function
[check-account-status] 🔐 Checking account status for user: <user-id>
[check-account-status] Account status: { userId: <id>, deleted: true, deletedAt: <timestamp> }
[checkAccountDeletionStatus] ✅ Deleted account detected, setting info for recovery
[AppNavigator] Deleted account detected, navigating to AccountRecovery
[AppNavigator.DEBUG] Current auth state: { hasUser: true, hasSession: true, deletedAccountInfo: true }
```

**Apple OAuth - Deleted Account Detected:**
```
[OAuth] Starting Apple sign-in
[OAuth] Opening browser for Apple OAuth
[OAuth] Browser result: success
[OAuth] OAuth success, extracting tokens
[OAuth] Session set successfully
[checkAccountDeletionStatus] Checking account deletion status via Edge Function
[checkAccountDeletionStatus] ✅ Deleted account detected, setting info for recovery
[AppNavigator] Deleted account detected, navigating to AccountRecovery
```

**Active Account (No Deletion):**
```
[OAuth] Starting Google/Apple sign-in
[OAuth] Session set successfully
[checkAccountDeletionStatus] Checking account deletion status via Edge Function
[checkAccountDeletionStatus] Account is active (not deleted)
[AppNavigator.DEBUG] Rendering MainNavigator
```

### 4.2 UI Transitions

**Successful Deletion Detection:**
1. Login screen → OAuth browser/modal
2. OAuth browser → Brief loading
3. Loading → AccountRecoveryScreen
4. Recovery screen shows countdown and options

**Normal Login (Active Account):**
1. Login screen → OAuth browser/modal
2. OAuth browser → Brief loading
3. Loading → Home screen (MainNavigator)

### 4.3 Error States to Handle Gracefully

**Network Errors:**
- `[checkAccountDeletionStatus] Error checking account status: Network request failed`
- User still allowed to login

**Edge Function Errors:**
- `[checkAccountDeletionStatus] Edge Function error: <error details>`
- Returns false, non-blocking

**Invalid Response:**
- `[checkAccountDeletionStatus] Invalid response from Edge Function`
- Defaults to allowing login

---

## 5. Troubleshooting Guide

### Issue: Deletion check not being called

**Symptoms:**
- No `[checkAccountDeletionStatus]` logs
- User logs in normally even with deleted account

**Debug Steps:**
1. Verify `checkAccountDeletionStatus()` function exists in [`AuthContext.tsx`](contexts/AuthContext.tsx:800-861)
2. Check that function is called in:
   - [`signInWithGoogle()`](contexts/AuthContext.tsx:1239-1245) after line 1237
   - [`signInWithApple()`](contexts/AuthContext.tsx:1478-1484) after line 1477
3. Ensure session exists before check
4. Verify `__DEV__` is true for debug logs

**Solution:**
```typescript
// Should see this pattern in both OAuth functions:
const isDeleted = await checkAccountDeletionStatus(sessionData.session, userEmail);
if (isDeleted) {
  return { success: true };
}
```

---

### Issue: Edge Function returns 401 Unauthorized

**Symptoms:**
- `[checkAccountDeletionStatus] Edge Function error: 401`
- Deletion check fails every time

**Debug Steps:**
1. Check Edge Function logs in Supabase Dashboard
2. Verify authorization header is being sent
3. Check session access token is valid

**Solution:**
1. Ensure Edge Function uses correct authentication:
   ```typescript
   const { data: { user }, error: authError } = await supabase.auth.getUser(token);
   ```
2. Verify service role key in Edge Function environment variables

---

### Issue: Recovery screen not showing

**Symptoms:**
- Deletion detected in logs
- `deletedAccountInfo` is set
- But user sees Home screen instead

**Debug Steps:**
1. Check [`AppNavigator.tsx`](navigation/AppNavigator.tsx:556-588) useEffect
2. Verify navigation logic at line 674
3. Check `deletedAccountInfo` state persistence

**Solution:**
- Ensure AppNavigator checks `deletedAccountInfo` in render condition:
  ```typescript
  {(!user || !session || isHandlingDuplicate || deletedAccountInfo) ? (
    <AuthNavigator />
  ) : (
    <MainNavigator />
  )}
  ```

---

### Issue: Can't see Edge Function logs

**Steps to View Logs:**
1. Open Supabase Dashboard
2. Go to "Edge Functions"
3. Click on `check-account-status`
4. Click "Logs" tab
5. Logs show recent invocations and errors

**Alternative - cURL Testing:**
```bash
# Get access token from a logged-in session
# Then test Edge Function directly:
curl -X POST https://your-project.supabase.co/functions/v1/check-account-status \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -v
```

---

### Issue: Account status always returns false

**Symptoms:**
- Account is marked deleted in database
- Edge Function returns `deleted: false`

**Debug Steps:**
1. Verify RLS policies on profiles table
2. Check Edge Function is using SERVICE_ROLE_KEY (not ANON_KEY)
3. Confirm `deleted_at` column exists and has data

**Solution:**
```sql
-- Verify deleted_at column and data
SELECT id, email, deleted_at 
FROM profiles 
WHERE email = 'test@example.com';

-- Check RLS is not blocking service role
-- Service role should bypass RLS
```

---

## 6. Success Checklist

Mark each item as complete after successful testing:

### Functional Requirements
- [ ] Google OAuth detects deleted accounts
- [ ] Apple OAuth detects deleted accounts  
- [ ] Email/password still works (regression)
- [ ] AccountRecoveryScreen displays correctly
- [ ] Countdown shows accurate time remaining
- [ ] Recovery button functionality works
- [ ] Continue deletion button works
- [ ] Active accounts login normally (no false positives)

### Edge Cases
- [ ] Network failure handled gracefully (non-blocking)
- [ ] Edge Function unavailable handled gracefully
- [ ] Expired grace period shows appropriate error
- [ ] Multiple rapid attempts don't cause issues
- [ ] Account can be deleted → recovered → deleted again

### User Experience
- [ ] All console logs appear as expected
- [ ] UI transitions are smooth (no flashing)
- [ ] Loading states display correctly
- [ ] Error messages are user-friendly
- [ ] No crashes during any test scenario
- [ ] Recovery flow is intuitive

### Code Quality
- [ ] Debug logging is comprehensive
- [ ] Error handling is present for all API calls
- [ ] Non-blocking failures for Edge Function errors
- [ ] Proper state management (no stale data)

---

## 7. Test Execution Log

Use this template to document your test runs:

```
Date: ____________
Tester: ____________
Build Version: ____________
Platform: iOS / Android

Test Case 1 - Google OAuth Deleted: ✅ / ❌
  Notes: _________________________________

Test Case 2 - Apple OAuth Deleted: ✅ / ❌
  Notes: _________________________________

Test Case 3 - Google OAuth Active: ✅ / ❌
  Notes: _________________________________

Test Case 4 - Apple OAuth Active: ✅ / ❌
  Notes: _________________________________

Test Case 5 - Email/Password Deleted: ✅ / ❌
  Notes: _________________________________

Edge Case 1 - Network Failure: ✅ / ❌
  Notes: _________________________________

Edge Case 2 - Edge Function Down: ✅ / ❌
  Notes: _________________________________

Edge Case 3 - Expired Grace Period: ✅ / ❌
  Notes: _________________________________

Overall Result: PASS / FAIL
Final Notes: _________________________________
```

---

## 8. Quick Reference

### Key Files
- [`contexts/AuthContext.tsx`](contexts/AuthContext.tsx:800-861) - `checkAccountDeletionStatus()` function
- [`contexts/AuthContext.tsx`](contexts/AuthContext.tsx:1239-1245) - Google OAuth integration
- [`contexts/AuthContext.tsx`](contexts/AuthContext.tsx:1478-1484) - Apple OAuth integration
- [`screens/AccountRecoveryScreen.tsx`](screens/AccountRecoveryScreen.tsx) - Recovery UI
- [`navigation/AppNavigator.tsx`](navigation/AppNavigator.tsx:556-588) - Navigation logic
- `supabase/functions/check-account-status/index.ts` - Edge Function

### SQL Helpers

**Mark account as deleted:**
```sql
UPDATE profiles 
SET deleted_at = NOW() 
WHERE email = 'test@example.com';
```

**Check account status:**
```sql
SELECT id, email, deleted_at, 
       NOW() - deleted_at as time_since_deletion,
       30 - EXTRACT(DAY FROM (NOW() - deleted_at)) as days_remaining
FROM profiles 
WHERE email = 'test@example.com';
```

**Recover account (clear deletion):**
```sql
UPDATE profiles 
SET deleted_at = NULL 
WHERE email = 'test@example.com';
```

**Simulate expired grace period (31 days ago):**
```sql
UPDATE profiles 
SET deleted_at = NOW() - INTERVAL '31 days' 
WHERE email = 'test@example.com';
```

---

## 9. Sign-Off

Implementation is considered complete when:

1. ✅ All test cases pass successfully
2. ✅ All edge cases are handled gracefully
3. ✅ Success checklist is 100% complete
4. ✅ No crashes or critical errors observed
5. ✅ User experience is smooth and intuitive
6. ✅ Console logging provides clear debugging info
7. ✅ Feature works on both iOS and Android (if applicable)

**Tested By**: ________________  
**Date**: ________________  
**Result**: PASS / FAIL  
**Notes**: ________________________________

---

**End of Testing Guide**