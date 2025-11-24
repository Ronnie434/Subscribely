# Forgot Password Feature - Testing Guide

## Implementation Complete ✅

All code has been implemented. This guide will help you test the complete password reset flow.

---

## Files Modified/Created

### Modified Files:
1. [`app.json`](../app.json:65) - URL scheme changed to `"renvo"`
2. [`config/stripe.ts`](../config/stripe.ts:16) - URL scheme updated to `"renvo"`
3. [`App.tsx`](../App.tsx:65-77) - Deep link listener added
4. [`navigation/AppNavigator.tsx`](../navigation/AppNavigator.tsx) - ResetPassword route and linking config added
5. [`contexts/AuthContext.tsx`](../contexts/AuthContext.tsx:789-819) - `updatePassword()` method added

### Created Files:
1. [`screens/ResetPasswordScreen.tsx`](../screens/ResetPasswordScreen.tsx) - Complete password reset UI

---

## Testing Checklist

### Phase 1: Email Request Flow (Already Working ✅)
- [ ] Navigate to Login screen
- [ ] Click "Forgot Password?"
- [ ] Enter a valid email address
- [ ] Click "Send Reset Link"
- [ ] Verify success message appears
- [ ] Check email inbox for reset link

### Phase 2: Deep Link Testing (New Implementation)
- [ ] Open the reset email on your device
- [ ] Click the reset password link
- [ ] Verify app opens (not browser)
- [ ] Verify ResetPasswordScreen loads
- [ ] Check console logs for token presence

### Phase 3: Password Reset Form
- [ ] Enter a weak password (< 8 chars)
- [ ] Verify strength indicator shows "Weak" in red
- [ ] Enter a medium password (8-10 chars)
- [ ] Verify strength indicator shows "Medium" in orange
- [ ] Enter a strong password (10+ chars with upper, lower, number)
- [ ] Verify strength indicator shows "Strong" in green
- [ ] Enter different passwords in both fields
- [ ] Verify "Passwords do not match" error
- [ ] Enter matching passwords
- [ ] Click "Reset Password"

### Phase 4: Success Flow
- [ ] Verify success screen appears with checkmark icon
- [ ] Click "Continue to Sign In"
- [ ] Verify navigation to Login screen
- [ ] Sign in with new password
- [ ] Verify successful login

### Phase 5: Error Scenarios

#### Invalid/Expired Token
- [ ] Try to access reset screen without token
- [ ] Verify alert: "Invalid reset link"
- [ ] Verify navigation to ForgotPassword screen

#### Network Error
- [ ] Turn off internet/WiFi
- [ ] Try to reset password
- [ ] Verify error message appears
- [ ] Turn internet back on

#### Password Validation
- [ ] Try password < 8 characters
- [ ] Verify validation error
- [ ] Try empty password
- [ ] Verify required error
- [ ] Try mismatched passwords
- [ ] Verify mismatch error

---

## Test Scenarios by Platform

### iOS Testing
- [ ] Test deep link from Mail app
- [ ] Verify haptic feedback on button press
- [ ] Check dark mode appearance
- [ ] Test with VoiceOver enabled
- [ ] Verify keyboard handling

### Android Testing
- [ ] Test deep link from Gmail app
- [ ] Check elevation on buttons
- [ ] Test dark mode appearance
- [ ] Test with TalkBack enabled
- [ ] Verify keyboard handling

---

## Deep Link URL Format

The password reset email from Supabase will contain a URL like:

```
renvo://reset-password#access_token=eyJhbGc...&type=recovery
```

Or:

```
renvo://reset-password?access_token=eyJhbGc...&type=recovery
```

The ResetPasswordScreen extracts the `access_token` parameter automatically.

---

## Debugging Tips

### Check Deep Link Configuration
```bash
# iOS - Check URL scheme registration
npx expo prebuild --platform ios
# Look for "renvo" in ios/[AppName]/Info.plist

# Android - Check intent filters
npx expo prebuild --platform android
# Look for "renvo" in android/app/src/main/AndroidManifest.xml
```

### Test Deep Link Manually

#### iOS Simulator
```bash
xcrun simctl openurl booted "renvo://reset-password?access_token=test123"
```

#### Android Emulator
```bash
adb shell am start -W -a android.intent.action.VIEW -d "renvo://reset-password?access_token=test123"
```

### Check Logs
Look for these console messages:
- `[App] Deep link received: renvo://...`
- `[ResetPasswordScreen] Token: present`
- `[AuthContext] Password updated successfully`

---

## Common Issues & Solutions

### Issue: Deep link opens browser instead of app
**Solution:** 
- Rebuild the app with `npx expo prebuild`
- Reinstall the app on device
- Ensure URL scheme is registered in native code

### Issue: "Invalid reset link" error
**Solution:**
- Check that token is in URL
- Verify Supabase email template uses correct redirect URL
- Check AuthContext uses `renvo://reset-password`

### Issue: Token expired error
**Solution:**
- Request a new reset email
- Tokens typically expire after 1 hour
- Use the link within expiration time

### Issue: Password update fails
**Solution:**
- Check network connection
- Verify Supabase credentials
- Check console for detailed error messages

---

## Success Criteria

✅ **Feature is working correctly when:**
1. User receives reset email within 30 seconds
2. Deep link opens app (not browser)
3. ResetPasswordScreen loads with proper UI
4. Password strength indicator works
5. Form validation prevents weak passwords
6. Success message appears after reset
7. User can login with new password
8. Error messages are clear and helpful

---

## Next Steps After Testing

Once testing is complete:
1. Test on both iOS and Android devices
2. Test with real email accounts
3. Verify accessibility features work
4. Check dark mode appearance
5. Review error message clarity
6. Optionally add analytics events
7. Update app documentation

---

## Security Verification

✓ Token validation on mount
✓ Password strength requirements enforced
✓ Generic error messages (no user enumeration)
✓ Session handling after password reset
✓ Single-use token support (Supabase handles this)
✓ HTTPS-only email links (Supabase handles this)

---

## Deep Linking Troubleshooting

### Common Deep Link Issues

This section addresses issues specific to deep linking and custom URL schemes. For comprehensive deep linking setup, see [`SUPABASE_DEEP_LINKING_SETUP.md`](SUPABASE_DEEP_LINKING_SETUP.md).

#### Issue 1: Link Opens in Browser Instead of App

**Symptoms:**
- Email link opens in default browser
- Browser shows "This site is trying to open another application"
- After allowing, browser shows "Something went wrong"

**Root Causes:**
1. Using Expo Go (doesn't support custom URL schemes)
2. App not built with native code (URL scheme not registered)
3. Email client security behavior (intentional)
4. Stale build or wrong app version installed

**Solutions:**

**Step 1: Verify You're NOT Using Expo Go**
```bash
# Check if you're using a development build
# Development builds show your app name and icon
# Expo Go shows the Expo logo

# If using Expo Go, create a development build:
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

**Step 2: Verify URL Scheme Registration**
```bash
# Check if URL scheme is registered
npx uri-scheme list

# Expected output should include "renvo"
```

**Step 3: Rebuild After app.json Changes**

If you recently changed the `scheme` in [`app.json`](../app.json:65), you MUST rebuild:
```bash
# Generate/update native code
npx expo prebuild --clean

# Then rebuild
eas build --profile development --platform ios
```

**Step 4: Test Deep Link Manually**

Before testing with email, verify the app can handle deep links:

```bash
# iOS Simulator
xcrun simctl openurl booted "renvo://reset-password?access_token=test123&type=recovery"

# Android Emulator
adb shell am start -W -a android.intent.action.VIEW -d "renvo://reset-password?access_token=test123&type=recovery"

# Physical Device (using Expo CLI)
npx uri-scheme open "renvo://reset-password?access_token=test123" --ios
```

**Expected Result:**
- App opens/comes to foreground
- Console shows: `[App] Deep link received: renvo://reset-password?...`
- Navigation to ResetPasswordScreen occurs

#### Issue 2: Browser Shows Security Prompt

**Symptoms:**
- Browser asks: "This site is trying to open another application"
- Requires user to tap "Allow" or "Open"

**This is NORMAL behavior!** Most browsers and email clients show this prompt for security when handling custom URL schemes.

**Solutions:**
1. **For Testing:** Just tap "Allow" - this is expected
2. **For Production:** Consider implementing Universal Links (iOS) or App Links (Android) which don't show this prompt

See [Alternative Solutions in SUPABASE_DEEP_LINKING_SETUP.md](SUPABASE_DEEP_LINKING_SETUP.md#6-alternative-solutions) for Universal Links setup.

#### Issue 3: "Invalid Reset Link" or "Link Expired"

**Symptoms:**
- App opens but shows "Invalid reset link" alert
- Navigates back to ForgotPassword screen
- Console shows: `[ResetPasswordScreen] No token found in URL`

**Root Causes:**
1. Token parameter missing from URL
2. Token expired (usually after 1 hour)
3. URL parsing issue

**Debug Steps:**

```bash
# Check what parameters are being received
# Add this to ResetPasswordScreen.tsx temporarily:
console.log('[DEBUG] Full route params:', JSON.stringify(route.params, null, 2));
console.log('[DEBUG] URL search params:', window.location?.search); // Web only
```

**Solutions:**

1. **Request New Reset Email** (if token expired)
2. **Check Supabase Email Template** - Verify it uses correct redirect URL format
3. **Verify AuthContext Configuration** - Check [`contexts/AuthContext.tsx`](../contexts/AuthContext.tsx:766):
   ```typescript
   await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: 'renvo://reset-password',  // Should match your URL scheme
   });
   ```

#### Issue 4: Works in Simulator but Not on Physical Device

**Symptoms:**
- Deep links work perfectly in iOS Simulator or Android Emulator
- Same deep links fail on physical device
- Different error messages or behaviors

**Root Causes:**
1. Different builds installed (simulator vs device)
2. Development build not installed on device
3. Email client apps behave differently than browsers
4. Cached app configuration

**Solutions:**

```bash
# Rebuild for the specific device
eas build --profile development --platform ios
# Install the build on your physical device

# Verify installation
# iOS: Check Settings → General → VPN & Device Management
# Android: Check Settings → Apps
```

**Clear and Reinstall:**
1. Uninstall app from device completely
2. Install fresh build
3. Test deep link manually before testing with email

#### Issue 5: Multiple App Versions Installed

**Symptoms:**
- Inconsistent behavior
- Sometimes works, sometimes doesn't
- Wrong version of app opens

**Solution:**

```bash
# Remove all versions
# iOS: Long press app icon → Remove App → Delete App
# Android: Settings → Apps → Renvo → Uninstall

# Install only the current development build
# Check build date matches recent build

# Verify version
# Add to App.tsx or HomeScreen:
console.log('App version:', Application.nativeApplicationVersion);
```

#### Issue 6: Email Client Specific Issues

**Symptoms:**
- Gmail app opens link in browser
- iOS Mail works but Gmail doesn't
- Outlook shows security warning

**This is Normal!** Different email clients handle custom URL schemes differently:

| Email Client | Typical Behavior | Solution |
|--------------|------------------|----------|
| iOS Mail | Opens app directly | None needed ✅ |
| Gmail App | Opens in-app browser first | User must tap "Open in app" |
| Outlook | May show security warning | User must approve |
| Yahoo Mail | Opens in browser | User must allow app open |
| Web Mail (Safari/Chrome) | Always opens browser first | User must allow app open |

**Best Practice for Production:**
Consider implementing [Universal Links (iOS) / App Links (Android)](SUPABASE_DEEP_LINKING_SETUP.md#option-b-universal-links-ios--app-links-android) which provide seamless experience across all email clients.

#### Issue 7: Token Parameters Not Extracted

**Symptoms:**
- App opens to ResetPasswordScreen
- But token is undefined or null
- Password reset fails

**Debug:**

Check [`ResetPasswordScreen.tsx`](../screens/ResetPasswordScreen.tsx:58):
```typescript
const route = useRoute<ResetPasswordRouteProp>();
const token = route.params?.token || route.params?.access_token;

// Add debug logging
console.log('[DEBUG] Route params:', route.params);
console.log('[DEBUG] Token value:', token);
```

**Common Issues:**
1. Supabase sends `access_token` but code looks for `token`
2. URL format uses `#` instead of `?` (hash vs query params)
3. Deep link config doesn't parse parameters

**Solutions:**

Update [`AppNavigator.tsx`](../navigation/AppNavigator.tsx:301-307) to handle both hash and query params:
```typescript
linking={{
  prefixes: ['renvo://'],
  config: {
    screens: {
      ResetPassword: {
        path: 'reset-password',
        parse: {
          access_token: (token) => token,
          type: (type) => type,
        },
      },
    },
  },
}}
```

### Quick Troubleshooting Checklist

Use this checklist when deep linking isn't working:

- [ ] I am NOT using Expo Go (using development or production build)
- [ ] `npx uri-scheme list` shows "renvo" in the output
- [ ] Manual deep link test works (using simulator/emulator commands)
- [ ] Build was created AFTER adding/changing URL scheme in app.json
- [ ] Correct app version is installed (check build date)
- [ ] Only one version of the app is installed
- [ ] Supabase redirect URLs include `renvo://reset-password`
- [ ] Console shows deep link received when clicking email link
- [ ] [`App.tsx`](../App.tsx:66-85) has deep link listener
- [ ] [`AppNavigator.tsx`](../navigation/AppNavigator.tsx:301-307) has linking config
- [ ] [`AuthContext.tsx`](../contexts/AuthContext.tsx:766) uses correct redirect URL

### When All Else Fails

If deep linking still doesn't work after trying all troubleshooting steps:

1. **Verify Supabase Dashboard Configuration**
   - Navigate to: Dashboard → Authentication → URL Configuration
   - Verify: Site URL = `renvo://`
   - Verify: Redirect URLs includes `renvo://reset-password`

2. **Create Fresh Build from Scratch**
   ```bash
   # Clean everything
   rm -rf node_modules ios android
   npm install
   npx expo prebuild --clean
   eas build --profile development --platform ios --clear-cache
   ```

3. **Test with Alternative Approach**
   - Implement [Web Redirect Bridge](SUPABASE_DEEP_LINKING_SETUP.md#option-a-web-redirect-bridge)
   - Or use [Universal Links](SUPABASE_DEEP_LINKING_SETUP.md#option-b-universal-links-ios--app-links-android)

4. **Check Expo Doctor**
   ```bash
   npx expo-doctor
   ```

5. **Review Complete Deep Linking Guide**
   - See [`SUPABASE_DEEP_LINKING_SETUP.md`](SUPABASE_DEEP_LINKING_SETUP.md) for comprehensive setup and troubleshooting

---

## Support

If you encounter issues during testing:
1. Check console logs for errors
2. Verify Supabase configuration using [SUPABASE_DEEP_LINKING_SETUP.md](SUPABASE_DEEP_LINKING_SETUP.md)
3. Review [`FORGOT_PASSWORD_ARCHITECTURE.md`](FORGOT_PASSWORD_ARCHITECTURE.md) for design decisions
4. Test deep links manually before testing with email (see troubleshooting section above)
5. Check network requests in browser dev tools
6. Verify email template in Supabase dashboard
7. Try alternative solutions (Universal Links, Web Bridge) if custom URL scheme is problematic