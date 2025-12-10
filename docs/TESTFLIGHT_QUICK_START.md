# TestFlight Sandbox Testing - Quick Start Guide

## 🚀 TL;DR - Start Here

You had 3 issues. Here's what was fixed and what you need to do:

### Issue 1: ✅ FIXED - Sandbox Account Instructions
**Before:** App redirected to production App Store (subscriptions not found)
**After:** App now detects TestFlight and shows correct instructions

### Issue 2: 🔍 NEEDS TESTING - Missing Purchase Popup for $4.99
**What we did:** Added extensive logging to diagnose the issue
**What you need to do:** Follow the testing steps below to identify root cause

### Issue 3: ✅ FIXED - Cancel Subscription Flow
**Before:** Opened production App Store (test subscription not there)
**After:** Shows TestFlight-specific instructions to manage sandbox subscriptions

---

## 📋 Immediate Action Required

### Step 1: Clean Slate (5 minutes)

On your iPhone:

```
1. Settings → App Store → SANDBOX ACCOUNT
   - If you see a sandbox account, tap it and "Sign Out"
   
2. Delete the Renvo TestFlight app from your device
   
3. Restart your iPhone (hold power button, slide to power off)

4. Reinstall:
   - Open TestFlight app
   - Find Renvo
   - Tap "Install"
```

### Step 2: Create Fresh Sandbox Account (2 minutes)

On your computer:

```
1. Go to https://appstoreconnect.apple.com
2. Sign in with your Apple Developer account
3. Click "Users and Access" → "Sandbox" tab
4. Click the "+" button
5. Fill in:
   - First Name: Test
   - Last Name: Renvo
   - Email: testrenvo2025@gmail.com (or any unique email)
   - Password: Create a strong password (WRITE IT DOWN!)
   - Country: United States
6. Click "Invite"
```

**Pro Tip:** Use a Gmail alias from your existing email:
- `youremail+renvotest@gmail.com`
- `youremail+test123@gmail.com`

### Step 3: Test Purchase Flow (3 minutes)

On your iPhone with fresh TestFlight install:

```
1. Open Renvo from TestFlight
2. Try to add a 6th subscription (to trigger paywall)
3. Paywall should appear
4. Look at the prices - are they showing?
   - Monthly: $4.99/month ✅
   - Yearly: $39.99/year ✅
   
5. Tap "Choose Monthly"
6. What happens? (See outcomes below)
```

**Expected Outcomes:**

**✅ GOOD - Apple dialog appears:**
- Shows "[Sandbox]" label at top
- Shows "The Renvo Premium Monthly - $4.99"
- Shows "For testing purposes only. You will not be charged"
- Prompts you to sign in with Apple ID
- Enter your sandbox test account credentials
- Purchase completes
- App shows "Premium" status

**❌ BAD - No dialog appears:**
- Check the Xcode console or logs
- Look for lines starting with `[PaywallModal]`
- Screenshot the logs and share them with me
- We'll diagnose from there

**❌ BAD - Products show $0.00:**
- Products not loading from App Store Connect
- Check console logs for errors
- Go to Step 4 below

---

## 🔍 Diagnosing Issue #2 (Missing Purchase Popup)

### Enhanced Logging

The code now includes extensive logging. When you tap "Choose Monthly", you'll see:

```
[PaywallModal] 🎯 handleUpgrade called with plan: monthly
[PaywallModal] 📱 iOS detected, using Apple IAP
[PaywallModal] ✅ IAP already initialized
[PaywallModal] 📦 Checking products availability... (2 products loaded)
[PaywallModal] 🔍 Mapped plan "monthly" to product ID: com.ronnie39.renvo.premium.monthly.v1
[PaywallModal] 🔍 Product exists in fetched list: true
[PaywallModal] 🛒 Starting purchase for: com.ronnie39.renvo.premium.monthly.v1
[AppleIAP] 🛒 Initiating purchase: com.ronnie39.renvo.premium.monthly.v1
[AppleIAP] ✅ IAP initialized, product verified, requesting purchase...
[AppleIAP] ✅ Purchase request sent, waiting for listener...
```

**If you see different logs, that tells us where the problem is.**

### Common Causes

**Cause A: Products Not in App Store Connect**
Check: https://appstoreconnect.apple.com → My Apps → Renvo → Features → In-App Purchases

Required products:
- `com.ronnie39.renvo.premium.monthly.v1` - $4.99/month - Status: "Ready to Submit"
- `com.ronnie39.renvo.premium.yearly.v1` - $39.99/year - Status: "Ready to Submit"

**Cause B: Bundle ID Mismatch**
Check: In Xcode, verify Bundle Identifier matches: `com.ronnie39.renvo`

**Cause C: Not Signed into Sandbox**
The app will prompt you during purchase - this is normal!

**Cause D: Agreements Not Signed**
Check: App Store Connect → Agreements, Tax, and Banking
Ensure "Paid Applications" agreement is signed and active.

---

## 📱 Managing TestFlight Subscriptions

### Where to Find Sandbox Subscriptions

**For TestFlight/Development builds:**

```
iPhone Settings
  → App Store (scroll down)
    → SANDBOX ACCOUNT (scroll to bottom)
      → [Tap your sandbox email]
        → Manage
          → Select "The Renvo Premium Monthly"
            → Cancel Subscription
```

**NOT HERE (for TestFlight):**
- ❌ Settings → [Your Name] → Subscriptions ← Production subscriptions only
- ❌ App Store app → Account → Subscriptions ← Production subscriptions only

**Why?** TestFlight uses Apple's sandbox environment. Sandbox subscriptions and production subscriptions are completely separate.

### Cancel Subscription (Now Fixed!)

The app now shows environment-appropriate instructions:

**In TestFlight:**
- Tap "Cancel Subscription" in app
- App shows: "You're using a TestFlight build..."
- Button: "Open Settings"
- Tap it → Takes you to Settings app
- Navigate to: App Store → Sandbox Account → Manage

**In Production (future):**
- Tap "Cancel Subscription" in app
- Opens: App Store → Subscriptions directly
- Select your Renvo subscription
- Tap "Cancel Subscription"

---

## 🐛 Troubleshooting

### "Cannot Connect to iTunes Store"

**Cause:** Not signed in with sandbox account
**Fix:** 
1. Try making a purchase
2. When prompted, sign in with your sandbox test account
3. Purchase should proceed

### Products Show $0.00

**Cause:** Products not loaded from App Store Connect
**Fix:**
1. Check App Store Connect (see Cause A above)
2. Ensure products are "Ready to Submit"
3. Sign in with sandbox account
4. Check console logs for errors

### "This Apple ID has not been set up for sandbox testing"

**Cause:** Using production Apple ID instead of sandbox account
**Fix:**
1. Settings → App Store → Sandbox Account → Sign Out
2. Try purchase again
3. Sign in with correct sandbox test account (the one you created in App Store Connect)

### Purchase Completes But App Doesn't Show Premium

**Cause:** Subscription status not syncing
**Fix:**
1. Kill and restart the app
2. Pull to refresh on Home screen
3. Check Settings screen for subscription status
4. Check Supabase logs for webhook errors

### Sandbox Subscription Keeps Asking for Password

**Cause:** Normal Apple behavior for security
**Fix:** This is expected - enter your sandbox account password each time

---

## 📊 What Was Changed

### New Files Created

1. **`utils/environment.ts`**
   - Detects TestFlight vs Production environment
   - Provides environment-aware subscription management URLs
   - Returns user-friendly instructions for each environment

2. **`docs/TESTFLIGHT_SANDBOX_ISSUES_FIX.md`**
   - Comprehensive guide for all 3 issues
   - Detailed testing steps
   - Troubleshooting section

### Files Modified

1. **`components/CancelSubscriptionModal.tsx`**
   - Now detects TestFlight environment
   - Shows sandbox-specific instructions
   - Prevents redirect to production App Store for test subscriptions

2. **`components/PaywallModal.tsx`**
   - Added extensive diagnostic logging
   - Better product availability checks
   - Detailed error messages
   - Logs every step of purchase flow

---

## ✅ Testing Checklist

Use this to verify everything works:

### Prerequisites
- [ ] Products created in App Store Connect
- [ ] Products are "Ready to Submit" status
- [ ] Paid Applications Agreement signed
- [ ] Sandbox test account created
- [ ] Fresh TestFlight build installed

### Test: Monthly Subscription Purchase
- [ ] Open Renvo from TestFlight
- [ ] Navigate to Paywall
- [ ] Tap "Choose Monthly"
- [ ] Apple dialog appears ✅
- [ ] Shows "[Sandbox]" label ✅
- [ ] Shows correct product and price ✅
- [ ] Sign in with sandbox account
- [ ] Purchase completes
- [ ] App shows "Premium" status

### Test: Yearly Subscription Purchase
- [ ] Same as above, but tap "Choose Yearly"
- [ ] Dialog appears and purchase completes

### Test: Cancel Subscription
- [ ] Open Settings/Profile in app
- [ ] Tap "Manage Subscription" or "Cancel Subscription"
- [ ] App shows TestFlight-specific instructions ✅
- [ ] Tap "Open Settings"
- [ ] Navigate to App Store → Sandbox Account
- [ ] See your Renvo subscription
- [ ] Cancel it successfully

### Test: Restore Purchases
- [ ] Sign out and back in
- [ ] Should restore premium status automatically
- [ ] OR tap "Restore Purchases" in settings

---

## 🆘 If Something Still Doesn't Work

### Collect This Information:

1. **Console Logs**
   - Open Xcode
   - Window → Devices and Simulators
   - Select your device
   - Open Console
   - Filter for "PaywallModal" or "AppleIAP"
   - Copy all logs when you attempt purchase

2. **App Store Connect Status**
   - Screenshot of your In-App Purchases list
   - Show product IDs and their status

3. **Device Settings**
   - Settings → App Store → Sandbox Account
   - Is a sandbox account signed in? Which email?

4. **What Happens**
   - Which button you tapped (Monthly or Yearly)
   - What you see (or don't see)
   - Any error messages

### Share with Me:
- Console logs
- Screenshots
- Description of what you're seeing

I'll help diagnose further!

---

## 📞 Quick Reference

### Sandbox Account Sign-Out
```
Settings → App Store → SANDBOX ACCOUNT → Sign Out
```

### Sandbox Subscription Management
```
Settings → App Store → SANDBOX ACCOUNT → [Email] → Manage
```

### App Store Connect
- **Products:** https://appstoreconnect.apple.com → My Apps → Renvo → In-App Purchases
- **Sandbox Testers:** https://appstoreconnect.apple.com → Users and Access → Sandbox

### Expected Product IDs
```
com.ronnie39.renvo.premium.monthly.v1 ($4.99/month)
com.ronnie39.renvo.premium.yearly.v1 ($39.99/year)
```

### Bundle Identifier
```
com.ronnie39.renvo
```

---

## 🎯 Next Steps

1. ✅ Follow "Step 1: Clean Slate" above
2. ✅ Follow "Step 2: Create Fresh Sandbox Account"
3. ✅ Follow "Step 3: Test Purchase Flow"
4. 📸 Take screenshots of what happens
5. 📋 Share console logs if there are issues
6. 🔧 We'll diagnose together if needed

Good luck! The fixes are in place, now we need to test them in your environment to confirm everything works.


