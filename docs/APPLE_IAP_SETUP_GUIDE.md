# Apple In-App Purchase Setup Guide - Quick Start

## Overview

This guide will walk you through setting up Apple IAP for Renvo from scratch. The error you're seeing (`Fetched 0 products`) means the products need to be created in App Store Connect.

---

## Prerequisites

- ✅ Active Apple Developer Account ($99/year)
- ✅ Xcode installed
- ✅ App created in App Store Connect
- ✅ Bundle ID: `com.renvo` (or your actual bundle ID)

---

## Step 1: App Store Connect - Create Products

### 1.1 Access In-App Purchases

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Sign in with your Apple Developer account
3. Click on **My Apps**
4. Select your app (Renvo)
5. In the left sidebar, click **Features** → **In-App Purchases**

### 1.2 Create Subscription Group

Before creating products, you need a subscription group:

1. Click **Manage** (under Subscription Groups section)
2. Click the **+** button to create a new group
3. Fill in:
   - **Reference Name**: `Premium Subscriptions`
   - **App Name**: (will auto-populate)
4. Click **Create**

### 1.3 Create Monthly Subscription Product

1. Inside the `Premium Subscriptions` group, click **Create Subscription**
2. Fill in the product information:

```
Product Information:
├── Reference Name: Premium Monthly
├── Product ID: com.renvo.premium.monthly.v1
└── Description: Monthly premium subscription
```

3. **Subscription Duration**: Select `1 month`

4. **Subscription Prices**:
   - Click **Add Pricing**
   - Select **Price**: $4.99 USD (or search for tier)
   - Add prices for all regions you want to support
   - Click **Next**

5. **Localization** (Required):
   - Language: English (US)
   - Display Name: `Monthly Premium`
   - Description: `Unlimited recurring item tracking, billed monthly. Cancel anytime.`
   - Click **Create**

6. **App Store Localization** (Required):
   - Under "Subscription" section, add:
   - Name: `Monthly Premium`
   - Description: `Track unlimited subscriptions and recurring items. Billed monthly.`

7. Click **Save** in the top right

### 1.4 Create Yearly Subscription Product

Repeat the same process for yearly:

1. In the same subscription group, click **Create Subscription**
2. Fill in:

```
Product Information:
├── Reference Name: Premium Yearly
├── Product ID: com.renvo.premium.yearly.v1
└── Description: Yearly premium subscription
```

3. **Subscription Duration**: Select `1 year`

4. **Subscription Prices**:
   - Price: $39.99 USD
   - Add all regions

5. **Localization**:
   - Display Name: `Yearly Premium`
   - Description: `Unlimited recurring item tracking, billed annually. Save 17%!`

6. **App Store Localization**:
   - Name: `Yearly Premium`
   - Description: `Track unlimited subscriptions. Best value - save 17% vs monthly!`

7. Click **Save**

### 1.5 Set Product Status

For EACH product (Monthly and Yearly):

1. Open the product
2. Scroll down to **App Store Information**
3. Fill in ALL required fields:
   - Add at least one localization
   - Add a review note (optional but recommended)
4. Make sure status shows **"Ready to Submit"** or **"Approved"**

⚠️ **CRITICAL**: Products MUST show "Ready to Submit" status to appear in sandbox testing!

---

## Step 2: Configure Xcode Project

### 2.1 Add In-App Purchase Capability

1. Open your project in Xcode:
   ```bash
   cd ios
   open Renvo.xcworkspace
   ```

2. Select your project in the left sidebar
3. Select the **Renvo** target
4. Click the **Signing & Capabilities** tab
5. Click **+ Capability**
6. Search for and add **"In-App Purchase"**

### 2.2 Verify Bundle ID

1. In the same **Signing & Capabilities** tab
2. Verify **Bundle Identifier** matches: `com.renvo` (or your actual bundle ID)
3. This MUST match what's in App Store Connect

### 2.3 Create StoreKit Configuration File (For Local Testing)

This allows testing without connecting to App Store servers:

1. In Xcode: **File → New → File**
2. Search for **"StoreKit Configuration File"**
3. Name it: `Renvo.storekit`
4. Location: `ios/` folder
5. Click **Create**

6. In the StoreKit file, add your products:
   - Click **+** at the bottom
   - Select **Add Auto-Renewable Subscription**
   - Fill in:
     - **Product ID**: `com.renvo.premium.monthly.v1`
     - **Reference Name**: Premium Monthly
     - **Price**: $4.99
     - **Subscription Duration**: 1 Month
   - Repeat for yearly product

7. **Enable StoreKit Testing**:
   - **Product → Scheme → Edit Scheme**
   - Select **Run** on the left
   - Click **Options** tab
   - Under **StoreKit Configuration**, select `Renvo.storekit`

---

## Step 3: Create Sandbox Test Accounts

### 3.1 Create Test Accounts in App Store Connect

1. Go to **App Store Connect**
2. Click **Users and Access** (top right)
3. Click **Sandbox** tab → **Testers**
4. Click **+** to add a new tester
5. Fill in:
   ```
   First Name: Test
   Last Name: User
   Email: test.user+renvo1@gmail.com (use your email with +)
   Password: TestPass123!
   Confirm Password: TestPass123!
   Country: United States
   ```
6. Click **Invite**

Create at least 2 test accounts for different scenarios.

### 3.2 Sign Out of Production Apple ID (CRITICAL!)

**On your iOS device or simulator:**

1. Open **Settings**
2. Tap your name at the top
3. Scroll down and tap **Sign Out**
4. Confirm sign out

⚠️ **DO NOT** sign in with the sandbox account in Settings! Only sign in when prompted during purchase.

---

## Step 4: Test in Sandbox

### 4.1 Build and Run App

```bash
cd /Users/ronakpatel/Documents/Personal_Projects/smart-subscription-tracker
npx expo run:ios
```

### 4.2 Test Purchase Flow

1. In the app, navigate to the paywall
2. Tap "Choose Monthly" or "Choose Yearly"
3. **When prompted**, sign in with your SANDBOX test account
   - Email: `test.user+renvo1@gmail.com`
   - Password: `TestPass123!`
4. Confirm the purchase with Face ID/Touch ID/Password
5. Watch the console logs

### 4.3 Expected Console Output

If working correctly, you should see:
```
LOG  [AppleIAP] Fetching products: ["com.renvo.premium.monthly.v1", "com.renvo.premium.yearly.v1"]
LOG  [AppleIAP] ✅ Fetched 2 products  <-- Should be 2, not 0!
```

---

## Step 5: Troubleshooting

### Issue: "Fetched 0 products"

This is your current issue. Causes:

1. **Products not created in App Store Connect**
   - ✅ Solution: Complete Step 1 above

2. **Products not in "Ready to Submit" status**
   - ✅ Solution: Go to each product, fill in ALL required fields

3. **Bundle ID mismatch**
   - Check Xcode bundle ID matches App Store Connect
   - Must be EXACT match: `com.renvo`

4. **Wrong product IDs in code**
   - Verify in [`config/appleIAP.ts`](../config/appleIAP.ts):
   ```typescript
   basic_monthly: 'com.renvo.premium.monthly.v1',
   basic_yearly: 'com.renvo.premium.yearly.v1',
   ```
   - Must match EXACTLY what's in App Store Connect

5. **Still signed into production Apple ID**
   - Sign out from Settings
   - Restart device
   - Try again

### Issue: "Cannot Connect to iTunes Store"

- Sign out of production Apple ID
- Ensure device has internet connection
- Try different network (WiFi vs cellular)
- Wait 24 hours if sandbox account just created

### Issue: "Missing purchase request configuration"

This error appears when:
- Products aren't loaded (0 products fetched)
- Fix by resolving "Fetched 0 products" issue first

---

## Step 6: Verify Setup is Complete

Run through this checklist:

**App Store Connect:**
- [ ] Subscription group created: "Premium Subscriptions"
- [ ] Monthly product created: `com.renvo.premium.monthly.v1`
- [ ] Yearly product created: `com.renvo.premium.yearly.v1`
- [ ] Both products show "Ready to Submit" status
- [ ] Localizations added for both products
- [ ] Prices set for all regions

**Xcode:**
- [ ] In-App Purchase capability added
- [ ] Bundle ID matches App Store Connect
- [ ] StoreKit configuration file created (optional)
- [ ] StoreKit testing enabled (optional)

**Testing:**
- [ ] Sandbox test account created
- [ ] Signed out of production Apple ID
- [ ] App builds and runs
- [ ] Console shows "Fetched 2 products"

---

## Quick Test Command

After completing all steps above, test with:

```bash
# Clean build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..

# Run app
npx expo run:ios --device  # or without --device for simulator
```

Watch console for:
```
✅ [AppleIAP] Fetched 2 products
```

---

## Common Mistakes to Avoid

1. ❌ **Not signing out of production Apple ID**
   - You MUST sign out before testing

2. ❌ **Products not in "Ready to Submit" status**
   - Fill in ALL required fields in App Store Connect

3. ❌ **Bundle ID mismatch**
   - Must match EXACTLY between Xcode and App Store Connect

4. ❌ **Wrong product IDs**
   - Copy-paste product IDs carefully
   - No typos allowed!

5. ❌ **Signing in with sandbox account in Settings**
   - NEVER sign into Settings with sandbox account
   - Only sign in when prompted during purchase

---

## Next Steps After Setup

Once you see "Fetched 2 products" successfully:

1. Test monthly purchase
2. Test yearly purchase  
3. Test restore purchases
4. Review [`docs/SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md) for comprehensive testing

---

## Need More Help?

- Review: [`docs/APPLE_IAP_IMPLEMENTATION_PLAN.md`](APPLE_IAP_IMPLEMENTATION_PLAN.md)
- Testing: [`docs/SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md)
- Apple Docs: [In-App Purchase](https://developer.apple.com/in-app-purchase/)

---

**Created**: 2025-12-06
**Status**: Setup Guide for IAP Configuration