# TestFlight Sandbox Issues - Complete Fix Guide

## Issues Found

Based on your TestFlight testing, you're experiencing 3 common sandbox testing issues:

### Issue 1: ❌ Cannot Change Sandbox Account in TestFlight Purchase Dialog
**Symptoms:**
- TestFlight shows purchase dialog with your production Apple ID (`p.ronak00000@gmail.com`)
- Dialog says "For testing purposes only. You will not be charged"
- **BUT you cannot change/sign in with a different (sandbox) account**

**Root Cause:**
- Your device is already signed in with a sandbox account in Settings → App Store → Sandbox Account
- OR your production Apple ID is somehow being picked up instead of sandbox

### Issue 2: ❌ Missing Purchase Popup for $4.99 Monthly Subscription
**Symptoms:**
- When tapping "Choose Monthly" ($4.99), no Apple purchase dialog appears
- But Yearly subscription ($39.99) might show the dialog

**Root Cause:**
- Product not loaded from App Store Connect
- OR product fetch failed silently for monthly product

### Issue 3: ❌ Cancel Subscription Opens Production App Store (No Subscription Found)
**Symptoms:**
- Tap "Cancel Subscription" → Opens App Store
- Subscriptions section in App Store is empty
- Can't find the subscription to cancel

**Root Cause:**
- App redirects to production App Store: `https://apps.apple.com/account/subscriptions`
- **TestFlight subscriptions DON'T appear in production App Store settings**
- Sandbox subscriptions can only be managed via Settings → App Store → Sandbox Account

---

## Solutions

### ✅ Solution 1: Fix Sandbox Account Sign-In

**The problem:** Your device might have cached your production Apple ID or has an old sandbox account signed in.

**Complete Fix Steps:**

#### Step 1: Sign Out from Existing Sandbox Account

```bash
1. Open Settings on your iPhone
2. Scroll down → App Store
3. Scroll to bottom → SANDBOX ACCOUNT section
4. Tap your sandbox account (if shown)
5. Tap "Sign Out"
```

**Note:** If you don't see "SANDBOX ACCOUNT" section, that's okay - it means no sandbox account is signed in.

#### Step 2: Delete Test Build & Clear Cache

```bash
1. Delete the Renvo TestFlight app from your device
2. Go to Settings → General → iPhone Storage
3. Find "TestFlight" → Delete App Data (if available)
4. Restart your iPhone
5. Reinstall TestFlight from App Store
6. Reinstall Renvo from TestFlight
```

#### Step 3: Create Fresh Sandbox Account (If Needed)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **Users and Access**
3. Click **Sandbox** tab
4. Click **+** button
5. Create a new sandbox tester:
   ```
   First Name: Test
   Last Name: Renvo2025
   Email: testrenvo2025@gmail.com (or any unique email)
   Password: [Create a strong password]
   Country: United States
   ```
6. Click **Invite**

**Pro Tip:** Use Gmail aliases to create multiple test accounts from one email:
- `youremail+test1@gmail.com`
- `youremail+test2@gmail.com`

#### Step 4: Test Purchase Flow Correctly

```bash
1. Open Renvo from TestFlight
2. Navigate to Paywall/Upgrade screen
3. Tap "Choose Monthly" or "Choose Yearly"
4. Apple dialog should appear saying "[Sandbox]" at the top
5. Dialog will show: "Sign in with Apple ID to continue"
6. Enter your SANDBOX test account credentials
7. Complete the "purchase" (no real charge)
```

**Expected Behavior:**
- First purchase attempt will ask for sandbox account sign-in
- After signing in once, subsequent purchases will use same sandbox account
- You can change sandbox accounts in Settings → App Store → Sandbox Account

---

### ✅ Solution 2: Fix Missing Purchase Popup for Monthly Subscription

**The problem:** Monthly product might not be loading from App Store Connect.

**Debug Steps:**

#### Step 1: Verify Products in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. My Apps → Renvo → Features → In-App Purchases
3. Verify **BOTH** products exist and are "Ready to Submit":
   - `com.ronnie39.renvo.premium.monthly.v1` - $4.99/month
   - `com.ronnie39.renvo.premium.yearly.v1` - $39.99/year

**If missing or in "Missing Metadata" status:** Complete all required fields and save.

#### Step 2: Check Bundle ID Match

1. In Xcode, open your project
2. Select **Renvo** target → **General** tab
3. Verify Bundle Identifier: `com.ronnie39.renvo`
4. Product IDs **MUST** start with this exact Bundle ID

**Current Config:**
```
Bundle ID: com.ronnie39.renvo
Monthly Product: com.ronnie39.renvo.premium.monthly.v1 ✅
Yearly Product: com.ronnie39.renvo.premium.yearly.v1 ✅
```

#### Step 3: Add Diagnostic Logging

Let me add better error handling to show you exactly what's happening:

**File: `components/PaywallModal.tsx`**
- Add console logs to track which button is pressed
- Add logs to show if products are loaded before purchase

**File: `services/appleIAPService.ts`**
- Enhanced logging to show exactly which products are fetched
- Show errors if specific products are missing

---

### ✅ Solution 3: Fix Cancel Subscription Flow for TestFlight

**The problem:** TestFlight subscriptions are sandbox subscriptions. They **DO NOT** appear in production App Store settings.

**Correct Flow:**

#### For TestFlight/Sandbox Subscriptions:
Sandbox subscriptions must be managed through iOS Settings → App Store → Sandbox Account.

#### For Production Subscriptions:
Production subscriptions are managed through App Store → Apple ID → Subscriptions.

**Fix Required:** Update `CancelSubscriptionModal.tsx` to detect TestFlight environment and provide correct instructions.

---

## Code Fixes

### Fix 1: Update `CancelSubscriptionModal.tsx`

Add proper instructions for TestFlight/Sandbox users:

```typescript
// File: components/CancelSubscriptionModal.tsx
// Lines: 44-75

const handleCancel = async () => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  // For Apple, detect environment and provide appropriate guidance
  if (isApple) {
    try {
      setLoading(true);
      
      // Check if we're in TestFlight/Sandbox (development mode)
      const isTestFlight = __DEV__ || await isRunningInTestFlight();
      
      if (isTestFlight) {
        // TestFlight/Sandbox: Guide to Settings
        Alert.alert(
          'Manage Sandbox Subscription',
          'You\'re using a TestFlight build. To manage or cancel this test subscription:\n\n' +
          '1. Open Settings\n' +
          '2. Scroll down → App Store\n' +
          '3. Scroll to bottom → SANDBOX ACCOUNT\n' +
          '4. Tap Sandbox Account\n' +
          '5. Manage Subscriptions\n\n' +
          'Note: Sandbox subscriptions don\'t appear in the production App Store.',
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openURL('app-settings:');
                onClose();
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      } else {
        // Production: Open App Store subscriptions
        const url = 'https://apps.apple.com/account/subscriptions';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          onClose();
        } else {
          Alert.alert(
            'Manage Subscription',
            'Please go to your iPhone Settings > Apple ID > Subscriptions to manage your subscription.'
          );
        }
      }
    } catch (error) {
      console.error('Error opening subscription settings:', error);
      Alert.alert(
        'Manage Subscription',
        'Please go to Settings > App Store > Subscriptions (or Sandbox Account for TestFlight) to manage your subscription.'
      );
    } finally {
      setLoading(false);
    }
    return;
  }
  
  // ... rest of Stripe cancellation logic ...
};
```

### Fix 2: Add TestFlight Detection Utility

Create a utility to detect TestFlight environment:

```typescript
// File: utils/environment.ts

import Constants from 'expo-constants';

/**
 * Detect if app is running in TestFlight
 * 
 * TestFlight apps have specific characteristics:
 * - appOwnership is 'expo' or undefined
 * - __DEV__ is false but it's not a production release
 * - Has receipt file but it's sandbox
 */
export async function isRunningInTestFlight(): Promise<boolean> {
  // In development, always return true for testing
  if (__DEV__) {
    return true;
  }
  
  // Check expo constants for TestFlight indicators
  const appOwnership = Constants.appOwnership;
  
  // TestFlight builds typically have null or 'expo' ownership
  // Production App Store builds have 'standalone' or similar
  if (appOwnership === null || appOwnership === 'expo') {
    return true;
  }
  
  // Additional check: if there's a receipt sandbox file path
  // (This would require native module, so we'll rely on __DEV__ for now)
  
  return false;
}

/**
 * Get current IAP environment
 */
export function getIAPEnvironment(): 'sandbox' | 'production' {
  return __DEV__ ? 'sandbox' : 'production';
}

/**
 * Check if we should use sandbox IAP features
 */
export function isSandboxEnvironment(): boolean {
  return __DEV__;
}
```

### Fix 3: Enhanced Product Loading Diagnostics

Add better diagnostics to PaywallModal:

```typescript
// File: components/PaywallModal.tsx
// Add to useEffect after line 90

console.log(`[PaywallModal] ✅ Fetched ${products.length} products`);

if (products.length === 0) {
  console.warn('[PaywallModal] ⚠️ No products available');
  console.warn('[PaywallModal] 📋 Diagnostics:');
  console.warn('[PaywallModal] 1. Verify products exist in App Store Connect');
  console.warn('[PaywallModal] 2. Check if signed in with Sandbox account');
  console.warn('[PaywallModal] 3. Verify Bundle ID matches product IDs');
  console.warn('[PaywallModal] 4. Ensure products are "Ready to Submit"');
  
  showToast(
    'Subscription products unavailable. Please ensure you are signed in with a Sandbox test account in Settings > App Store.',
    'error'
  );
} else {
  console.log('[PaywallModal] ✅ Products loaded successfully');
  console.log('[PaywallModal] 📦 Products:', products.map(p => ({
    id: p.productId,
    price: p.price,
    title: p.title,
  })));
}
```

---

## Testing Checklist

After applying fixes, test this flow:

### Prerequisites
- [ ] Both products created in App Store Connect
- [ ] Products are "Ready to Submit" status
- [ ] Paid Applications Agreement signed
- [ ] Banking/Tax info completed
- [ ] Fresh TestFlight build uploaded

### Testing Steps

#### 1. Clean Start
```bash
- [ ] Sign out from any sandbox account: Settings → App Store → Sandbox Account → Sign Out
- [ ] Delete Renvo TestFlight app
- [ ] Restart iPhone
- [ ] Reinstall TestFlight app
- [ ] Reinstall Renvo from TestFlight
```

#### 2. First Purchase Test
```bash
- [ ] Open Renvo from TestFlight
- [ ] Navigate to Paywall (try to add 6th subscription)
- [ ] Paywall should show:
  - "Upgrade to Premium" title ✅
  - Monthly: $4.99/month ✅
  - Yearly: $39.99/year ✅
  - Both buttons enabled ✅
```

#### 3. Tap "Choose Monthly"
```bash
Expected behavior:
- [ ] Apple dialog appears immediately
- [ ] Dialog shows "[Sandbox]" label at top
- [ ] Shows product: "The Renvo Premium Monthly"
- [ ] Shows price: $4.99
- [ ] Shows "For testing purposes only. You will not be charged"
- [ ] Prompts for Apple ID sign-in (if not signed in)
```

#### 4. Sign In with Sandbox Account
```bash
- [ ] Enter sandbox test account email
- [ ] Enter sandbox test account password
- [ ] Accept any prompts
- [ ] Purchase should complete
- [ ] App should show "Premium" status
- [ ] Should be able to add unlimited subscriptions
```

#### 5. Test Subscription Management
```bash
- [ ] Go to Settings/Profile screen
- [ ] Tap "Manage Subscription" or "Cancel Subscription"
- [ ] Should show alert with correct instructions:
  - TestFlight: Guide to Settings → App Store → Sandbox Account
  - Production: Link to App Store subscriptions
```

#### 6. Verify Subscription in Settings
```bash
- [ ] Open iPhone Settings
- [ ] Scroll down → App Store
- [ ] Scroll to bottom → SANDBOX ACCOUNT
- [ ] Tap sandbox account
- [ ] Tap "Manage"
- [ ] Should see "The Renvo Premium Monthly" subscription
- [ ] Should show status: "Active" with renewal date
```

#### 7. Test Cancel Flow
```bash
- [ ] In Settings → App Store → Sandbox Account → Manage
- [ ] Tap your Renvo subscription
- [ ] Tap "Cancel Subscription"
- [ ] Confirm cancellation
- [ ] App should detect cancellation via webhook (eventually)
```

---

## Common Issues & Solutions

### Issue: "Cannot Connect to iTunes Store"
**Cause:** Not signed in with sandbox account or network issue
**Fix:** 
1. Sign out from any existing sandbox account
2. Try purchase again and sign in when prompted
3. Check internet connection

### Issue: Products Show $0.00
**Cause:** Products not loaded from App Store Connect
**Fix:**
1. Check console logs for product fetch errors
2. Verify products exist in App Store Connect
3. Sign in with sandbox account
4. Restart app and try again

### Issue: "This Apple ID has not been set up for sandbox testing"
**Cause:** Using production Apple ID instead of sandbox account
**Fix:**
1. Settings → App Store → Sandbox Account → Sign Out
2. Try purchase again
3. Sign in with correct sandbox test account

### Issue: Subscription Doesn't Appear in App Store Settings
**Cause:** TestFlight subscriptions are sandbox - they don't appear in production App Store
**Fix:**
1. Go to Settings → App Store → Sandbox Account (NOT App Store subscriptions)
2. Tap sandbox account email
3. Tap "Manage"
4. Your test subscriptions will be there

### Issue: Webhook Doesn't Receive Updates
**Cause:** Webhook URL not configured or not working
**Fix:**
1. Verify webhook URL in App Store Connect
2. Check Supabase Edge Function logs
3. For testing: Manually refresh subscription status in app
4. Note: Local simulator webhooks won't work - use real device

---

## Implementation Plan

### Step 1: Apply Code Fixes
1. [ ] Create `utils/environment.ts` with TestFlight detection
2. [ ] Update `components/CancelSubscriptionModal.tsx` with environment-aware instructions
3. [ ] Add enhanced diagnostics to `components/PaywallModal.tsx`

### Step 2: Rebuild and Test
1. [ ] Build new TestFlight version
2. [ ] Upload to TestFlight
3. [ ] Wait for processing
4. [ ] Install on test device

### Step 3: Clean Test
1. [ ] Sign out from sandbox account
2. [ ] Delete old TestFlight build
3. [ ] Install new build
4. [ ] Test entire purchase flow

### Step 4: Verify Each Issue is Fixed
1. [ ] Issue 1: Can sign in with sandbox account during purchase ✅
2. [ ] Issue 2: Monthly purchase popup appears ✅
3. [ ] Issue 3: Cancel flow shows correct instructions ✅

---

## Quick Reference

### Sandbox Account Sign-Out
```
Settings → App Store → [Scroll down] → SANDBOX ACCOUNT → Sign Out
```

### Sandbox Subscription Management
```
Settings → App Store → SANDBOX ACCOUNT → [Tap email] → Manage
```

### Production Subscription Management (for later)
```
Settings → [Your Name] → Subscriptions
OR
App Store app → Account icon → Subscriptions
```

### App Store Connect
- Products: https://appstoreconnect.apple.com → My Apps → Renvo → Features → In-App Purchases
- Sandbox Testers: https://appstoreconnect.apple.com → Users and Access → Sandbox

---

## Support Commands

### Reset Everything
```bash
# On device:
1. Settings → App Store → Sandbox Account → Sign Out
2. Delete Renvo TestFlight app
3. Restart iPhone

# On computer:
npx expo start --clear
```

### Check Product IDs
```bash
# In your codebase:
cat config/appleIAP.ts | grep "productId:"
```

Expected output:
```
basic_monthly: 'com.ronnie39.renvo.premium.monthly.v1',
basic_yearly: 'com.ronnie39.renvo.premium.yearly.v1',
```

---

## Next Steps

1. **Immediate:** Apply the code fixes above
2. **Test:** Clean install and test purchase flow
3. **Verify:** Check all 3 issues are resolved
4. **Document:** Note any remaining issues for troubleshooting

If issues persist after these fixes, we'll need to:
- Check App Store Connect product configuration
- Verify Xcode bundle ID settings
- Test on different device
- Review Apple Developer account status

