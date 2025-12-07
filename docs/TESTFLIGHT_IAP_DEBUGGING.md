# TestFlight IAP Debugging Guide

## Common Issues and Solutions

### Issue: "Not working at all" in TestFlight

When IAP doesn't work in TestFlight, it usually means one of these issues:

## 1. Products Not Loading (Most Common)

**Symptoms:**
- Modal opens but shows $0.00 or no products
- "Choose Monthly/Yearly" buttons are disabled or do nothing
- Products array is empty

**Root Causes & Fixes:**

### A. Products Not Created in App Store Connect
```
✅ Required: Products must exist in App Store Connect
```

**Check:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. My Apps → Your App → Features → In-App Purchases
3. Verify these products exist:
   - `com.ronnie39.renvo.premium.monthly.v1`
   - `com.ronnie39.renvo.premium.yearly.v1`

**Fix:** Create products following `docs/APPLE_IAP_SETUP_GUIDE.md`

### B. Products in Wrong Status
```
✅ Required: Products must be "Ready to Submit" or "Approved"
```

**Check:**
- Each product should NOT be in "Missing Metadata" status
- Must have pricing, localization, and all required fields

**Fix:**
1. Click on each product
2. Complete all required fields
3. Save
4. Status should change to "Ready to Submit"

### C. Sandbox Account Not Signed In
```
✅ Required: TestFlight uses Sandbox accounts, not your real Apple ID
```

**Check:**
- Settings → App Store → Sandbox Account
- Should show a test email (e.g., `test@example.com`)

**Fix:**
1. Create sandbox tester in App Store Connect:
   - Users and Access → Sandbox → Testers
   - Click `+` to add tester
2. On device:
   - Settings → App Store → Sign out (if signed in)
   - Settings → App Store → Sandbox Account → Sign in with test account

### D. Bundle ID Mismatch
```
✅ Required: Product IDs must start with your app's Bundle ID
```

**Check your Bundle ID:**
```bash
# In Xcode project
# or check ios/Renvo/Info.plist
```

**Current Config:**
- Bundle ID: `com.ronnie39.renvo`
- Products: `com.ronnie39.renvo.premium.monthly.v1`

**Fix:** Ensure products in App Store Connect start with exact Bundle ID

### E. Agreements Not Signed
```
✅ Required: Paid Applications Agreement must be signed
```

**Check:**
1. App Store Connect → Agreements, Tax, and Banking
2. Verify "Paid Applications" status is "Active"

**Fix:** Complete all required agreements and banking info

---

## 2. Purchase Dialog Not Appearing

**Symptoms:**
- Products load correctly
- Clicking "Choose Monthly/Yearly" does nothing
- No Apple purchase dialog

**Root Causes:**

### A. StoreKit Configuration File Active in TestFlight
```
⚠️ Local .storekit files can interfere with real TestFlight purchases
```

**Fix:**
1. Xcode → Product → Scheme → Edit Scheme
2. Run → Options tab
3. Set "StoreKit Configuration" to **None**
4. Rebuild and upload to TestFlight

### B. Missing In-App Purchase Capability
```
✅ Required: Entitlements must include IAP
```

**Check:** `ios/Renvo/Renvo.entitlements` should have:
```xml
<key>com.apple.developer.in-app-payments</key>
<array>
    <string>merchant.com.ronnie39.renvo</string>
</array>
```

**Fix:** Already configured in your project ✅

---

## 3. Purchase Starts But Fails

**Symptoms:**
- Apple dialog appears
- User completes purchase
- Error occurs during processing

**Root Causes:**

### A. Receipt Validation Failing
```
Edge Function: validate-apple-receipt
```

**Check Logs:**
```bash
# View Supabase edge function logs
supabase functions logs validate-apple-receipt --tail
```

**Common Issues:**
- Function not deployed
- Missing environment variables
- Network issues

**Fix:**
```bash
# Redeploy functions
supabase functions deploy validate-apple-receipt
supabase functions deploy apple-webhook
```

### B. Database Schema Issues

**Check:**
Run these migrations:
```bash
# In Supabase SQL Editor, run:
# database/apple_iap_migration.sql
```

---

## Debugging Steps for TestFlight

### Step 1: Enable Debug Logging

On your TestFlight device, you won't see console logs by default. Add remote logging:

**Option A: Use React Native Debugger**
1. Install React Native Debugger
2. Connect device
3. Enable Remote JS Debugging

**Option B: Add Toast Messages (Quick Debug)**
In `services/appleIAPService.ts`, temporarily add toasts:

```typescript
// In getProducts()
const products = await fetchProducts(...);
Alert.alert('Debug', `Fetched ${products.length} products`);
```

### Step 2: Verify Products Load

**Expected behavior:**
- Modal opens
- Shows "$4.99/month" and "$39.99/year"
- Buttons are enabled

**If products don't load:**
1. Check App Store Connect (products exist?)
2. Check Bundle ID match
3. Check Sandbox account signed in

### Step 3: Test Purchase Flow

**Expected behavior:**
1. Click "Choose Monthly"
2. Apple purchase dialog appears
3. Shows correct price
4. Complete purchase with Sandbox account
5. Success message appears
6. UI updates to show Premium

**If dialog doesn't appear:**
- StoreKit Configuration might be active (set to None)
- Products not in correct status

### Step 4: Verify Subscription Status

After purchase:
```typescript
// Should see in logs:
[AppleIAP] ✅ Purchase completed
[AppleIAP] ✅ Subscription status updated
```

---

## Quick Checklist

Before testing in TestFlight, verify:

- [ ] Products created in App Store Connect
- [ ] Products have "Ready to Submit" status
- [ ] Bundle ID matches in all places
- [ ] Sandbox tester account created
- [ ] Signed in with Sandbox account on device
- [ ] Signed out of production Apple ID
- [ ] Paid Applications Agreement signed
- [ ] Banking info completed
- [ ] StoreKit Configuration set to "None" in scheme
- [ ] Edge functions deployed to Supabase
- [ ] Database migrations run

---

## App Store Connect Product Setup (Quick Reference)

Your current configuration requires these exact products:

### Product 1: Monthly
```
Product ID: com.ronnie39.renvo.premium.monthly.v1
Duration: 1 Month
Price: $4.99 USD
Display Name: The Renvo Premium Monthly
```

### Product 2: Yearly
```
Product ID: com.ronnie39.renvo.premium.yearly.v1
Duration: 1 Year
Price: $39.99 USD
Display Name: The Renvo Premium Yearly
```

---

## Still Not Working?

### Get Detailed Logs

Add this to `services/appleIAPService.ts` temporarily:

```typescript
async getProducts(): Promise<AppleIAPProduct[]> {
  try {
    console.log('[DEBUG] Fetching products for:', APPLE_IAP_CONFIG.productIds);
    console.log('[DEBUG] Platform:', Platform.OS);
    console.log('[DEBUG] Environment:', IAP_ENVIRONMENT);
    
    const products = await fetchProducts({ 
      skus: APPLE_IAP_CONFIG.productIds as string[],
      type: 'subs'
    });
    
    console.log('[DEBUG] Raw products received:', JSON.stringify(products, null, 2));
    
    // ... rest of code
  }
}
```

Then test in TestFlight with a connected debugger to see logs.

---

## Contact Apple Support

If all else fails:
1. Apple Developer Support: developer.apple.com/contact
2. Provide:
   - App Bundle ID
   - Product IDs
   - Screenshots of App Store Connect setup
   - Error messages from console

---

## Next Steps After Successful Test

1. Test both Monthly and Yearly purchases
2. Test subscription restoration (reinstall app)
3. Test subscription cancellation
4. Monitor Supabase edge function logs
5. Verify webhook receives events from Apple
6. Test subscription renewal (wait 24 hours in sandbox)


