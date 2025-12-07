# Apple IAP Sandbox Testing Guide

Complete guide for testing Apple In-App Purchase implementation in sandbox environment.

## Document Information
- **Version**: 1.0.0
- **Created**: 2025-12-06
- **Phase**: Phase 6 - Testing & Validation
- **Prerequisites**: Phase 1-5 completed (code implementation ready)

---

## Table of Contents

1. [Prerequisites Checklist](#prerequisites-checklist)
2. [App Store Connect Configuration](#app-store-connect-configuration)
3. [Sandbox Account Setup](#sandbox-account-setup)
4. [Testing Environment Configuration](#testing-environment-configuration)
5. [Test Scenarios](#test-scenarios)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## Prerequisites Checklist

Before starting sandbox testing, ensure the following are completed:

### Code Implementation
- [ ] [`services/appleIAPService.ts`](../services/appleIAPService.ts) implemented
- [ ] [`config/appleIAP.ts`](../config/appleIAP.ts) configured with product IDs
- [ ] [`components/PaywallModal.tsx`](../components/PaywallModal.tsx) updated for iOS
- [ ] [`supabase/functions/validate-apple-receipt/`](../supabase/functions/validate-apple-receipt/index.ts) deployed
- [ ] [`supabase/functions/apple-webhook/`](../supabase/functions/apple-webhook/index.ts) deployed
- [ ] [`database/apple_iap_migration.sql`](../database/apple_iap_migration.sql) executed

### Supabase Configuration
- [ ] Database migration completed
- [ ] Edge functions deployed to Supabase
- [ ] Environment variables configured:
  - `APPLE_APP_BUNDLE_ID`
  - `APPLE_SHARED_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Apple Developer Account
- [ ] Active Apple Developer Program membership ($99/year)
- [ ] Xcode installed (latest version)
- [ ] iOS device or simulator available
- [ ] Apple ID for testing

### Documentation
- [ ] [`docs/APPLE_IAP_IMPLEMENTATION_PLAN.md`](APPLE_IAP_IMPLEMENTATION_PLAN.md) reviewed
- [ ] Product IDs documented
- [ ] Webhook URL noted

---

## App Store Connect Configuration

### Step 1: Access App Store Connect

1. Navigate to [App Store Connect](https://appstoreconnect.apple.com/)
2. Sign in with your Apple Developer account
3. Select your app (Renvo) or create new app if needed

### Step 2: Create Subscription Group

1. Navigate to **Features** → **Subscriptions**
2. Click **Create Subscription Group**
3. Configure:
   - **Reference Name**: `Premium Subscriptions`
   - **Group ID**: Will be auto-generated
   - **Review Information**: Add appropriate details

### Step 3: Create Subscription Products

#### Monthly Subscription

1. Click **Create Subscription** in your subscription group
2. Configure product:

```
Product Information:
├── Reference Name: Basic Monthly Premium
├── Product ID: com.renvo.basic.monthly
└── Review Information: Premium subscription billed monthly

Subscription Duration:
└── Duration: 1 month

Subscription Prices:
├── Price: $4.99 USD (Tier 5)
└── Add prices for all territories
```

3. **Localizations**: Add for all supported languages
4. **Subscription Information**:
   - Display Name: "Monthly Premium"
   - Description: "Unlimited recurring item tracking, billed monthly"

#### Yearly Subscription

1. Click **Create Subscription** in the same group
2. Configure product:

```
Product Information:
├── Reference Name: Basic Yearly Premium
├── Product ID: com.renvo.basic.yearly
└── Review Information: Premium subscription billed annually

Subscription Duration:
└── Duration: 1 year

Subscription Prices:
├── Price: $39.99 USD (Tier 40)
└── Add prices for all territories
```

3. **Localizations**: Add for all supported languages
4. **Subscription Information**:
   - Display Name: "Yearly Premium"
   - Description: "Unlimited recurring item tracking, billed annually. Best value!"

### Step 4: Configure Subscription Group Settings

1. Select subscription group
2. Configure upgrade/downgrade paths:
   - Monthly → Yearly: Upgrade (immediate billing)
   - Yearly → Monthly: Downgrade (at period end)

### Step 5: Submit Products for Review

1. Complete all required fields
2. Add screenshots showing subscription UI
3. Submit for Apple review
4. Wait for approval (usually 24-48 hours)

**Note**: Products must be approved before production use, but sandbox testing can begin immediately.

### Step 6: Configure Webhook URL

1. Go to **App Information** → **App Store Server Notifications**
2. Enter webhook URL:
   ```
   https://[your-project].supabase.co/functions/v1/apple-webhook
   ```
3. Test webhook connection
4. Save configuration

---

## Sandbox Account Setup

### Creating Sandbox Test Accounts

Apple sandbox accounts are special test accounts for IAP testing.

#### Step 1: Access Sandbox Testers

1. In App Store Connect, go to **Users and Access**
2. Click **Sandbox** → **Testers**
3. Click **+** to add new tester

#### Step 2: Create Test Accounts

Create at least **3 test accounts** for different scenarios:

**Account 1: New User**
```
Email: test.new.user@example.com (use + addressing)
Password: TestPass123!
Country: United States
```

**Account 2: Existing Subscriber**
```
Email: test.subscriber@example.com
Password: TestPass123!
Country: United States
```

**Account 3: International User**
```
Email: test.international@example.com
Password: TestPass123!
Country: United Kingdom (or other country)
```

**Best Practices**:
- Use email addresses you control (use Gmail + addressing: yourname+test1@gmail.com)
- Use strong passwords (required by Apple)
- Create accounts in different countries to test regional pricing
- Document credentials securely

#### Step 3: Sign Out of Production Apple ID

**Critical**: Must sign out of production Apple ID before testing.

**On iOS Device/Simulator**:
1. Open **Settings**
2. Tap your name at the top
3. Scroll down and tap **Sign Out**
4. Confirm sign out

**Note**: Do NOT sign in with sandbox account in Settings. Sign in only when prompted during purchase.

### Sandbox Account Management

**Account Limits**:
- Maximum 100 sandbox testers per team
- Accounts can be deleted and recreated
- No limit on number of test purchases

**Account States**:
- **Active**: Available for testing
- **Pending**: Recently created (wait 24 hours)
- **Disabled**: Manually disabled by admin

---

## Testing Environment Configuration

### iOS Simulator Setup

#### Advantages
- ✅ Fast iteration
- ✅ Easy debugging
- ✅ No device needed
- ✅ StoreKit Configuration file support

#### Limitations
- ❌ Cannot test Face ID/Touch ID authentication
- ❌ May have different behavior than physical device
- ❌ Some edge cases not reproducible

#### Setup Steps

1. **Open Xcode**:
   ```bash
   open ios/Renvo.xcworkspace
   ```

2. **Select Simulator**:
   - Choose iPhone 15 Pro Max (or latest)
   - iOS 17.0+ for best StoreKit 2 support

3. **Create StoreKit Configuration File** (Optional for local testing):
   - File → New → File → StoreKit Configuration File
   - Name: `Renvo.storekit`
   - Add products matching App Store Connect

4. **Enable StoreKit Testing**:
   - Product → Scheme → Edit Scheme
   - Run → Options → StoreKit Configuration
   - Select your `.storekit` file

### Physical Device Setup

#### Advantages
- ✅ Real-world testing
- ✅ Biometric authentication testing
- ✅ Accurate performance metrics
- ✅ Network condition testing

#### Requirements
- iOS 15+ device (for StoreKit 2)
- Signed out of production Apple ID
- Development provisioning profile
- Xcode access

#### Setup Steps

1. **Connect Device**:
   - Connect via USB or wireless
   - Trust computer if prompted

2. **Configure Signing**:
   - Open Xcode project
   - Select target → Signing & Capabilities
   - Enable "Automatically manage signing"
   - Select your team

3. **Install App**:
   ```bash
   npx expo run:ios --device
   ```

4. **Sign Out of Apple ID**:
   - Settings → [Your Name] → Sign Out
   - Do NOT sign in with sandbox account in Settings

### Environment Variable Verification

Verify all environment variables are set in Supabase:

```bash
# Check Supabase environment variables
supabase secrets list

# Required variables:
# - APPLE_APP_BUNDLE_ID
# - APPLE_SHARED_SECRET
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
```

### Network Monitoring Setup

**Xcode Console Monitoring**:
1. Window → Devices and Simulators
2. Select your device/simulator
3. Open Console
4. Filter: "AppleIAP" or "IAP"

**Supabase Function Logs**:
```bash
# Watch function logs in real-time
supabase functions logs validate-apple-receipt --tail
supabase functions logs apple-webhook --tail
```

---

## Test Scenarios

### Purchase Flow Testing

#### Test 1.1: First-Time Monthly Purchase

**Objective**: Verify new user can purchase monthly subscription

**Prerequisites**:
- [ ] Signed out of production Apple ID
- [ ] App installed and launched
- [ ] Free tier active

**Steps**:
1. Navigate to subscription paywall
2. Tap "Choose Monthly" ($4.99/month)
3. When prompted, sign in with sandbox account #1
4. Complete purchase with Face ID/Touch ID/password
5. Wait for confirmation

**Expected Results**:
- ✅ Apple payment sheet appears
- ✅ Price shown correctly ($4.99)
- ✅ Authentication succeeds
- ✅ Success message displayed
- ✅ User upgraded to premium tier
- ✅ Database updated with transaction
- ✅ [`apple_transactions`](../database/apple_iap_migration.sql) table has new entry
- ✅ User [`profiles`](../database/apple_iap_migration.sql) table shows `subscription_tier: 'premium'`

**Verification**:
```sql
-- Check user profile
SELECT 
  subscription_tier,
  subscription_status,
  payment_provider,
  apple_original_transaction_id,
  apple_receipt_expiration_date
FROM profiles
WHERE id = '[user_id]';

-- Check transaction record
SELECT 
  transaction_id,
  product_id,
  purchase_date,
  expiration_date
FROM apple_transactions
WHERE user_id = '[user_id]'
ORDER BY created_at DESC
LIMIT 1;
```

**Pass Criteria**: ✅ All expected results confirmed

---

#### Test 1.2: First-Time Yearly Purchase

**Objective**: Verify new user can purchase yearly subscription

**Prerequisites**:
- [ ] Signed out of production Apple ID
- [ ] App installed with clean state
- [ ] Different sandbox account than Test 1.1

**Steps**:
1. Navigate to subscription paywall
2. Tap "Choose Yearly" ($39.99/year)
3. Sign in with sandbox account #2
4. Complete purchase
5. Verify confirmation

**Expected Results**:
- ✅ Payment sheet shows $39.99
- ✅ "Save 17%" badge visible
- ✅ Purchase completes successfully
- ✅ Premium features unlocked
- ✅ Database shows yearly subscription

**Pass Criteria**: ✅ All expected results confirmed

---

#### Test 1.3: Purchase with Different Sandbox Account

**Objective**: Verify multiple test accounts work independently

**Prerequisites**:
- [ ] Previous tests completed
- [ ] New sandbox account #3 created

**Steps**:
1. Completely delete app
2. Reinstall app
3. Sign up with new account
4. Attempt purchase with sandbox account #3

**Expected Results**:
- ✅ Purchase flow works with new sandbox account
- ✅ No cross-contamination with previous test accounts

**Pass Criteria**: ✅ Independent purchase successful

---

#### Test 1.4: Purchase Interruption Handling

**Objective**: Verify app handles interrupted purchases gracefully

**Prerequisites**:
- [ ] Sandbox account ready
- [ ] App in free tier

**Steps**:
1. Initiate monthly purchase
2. When payment sheet appears, **DO NOT complete** purchase
3. Press Home button or kill app
4. Relaunch app
5. Check subscription status

**Expected Results**:
- ✅ App doesn't crash
- ✅ User remains in free tier
- ✅ No pending transactions
- ✅ Can retry purchase

**Pass Criteria**: ✅ App handles gracefully, no data corruption

---

#### Test 1.5: Network Failure During Purchase

**Objective**: Verify purchase flow handles network issues

**Prerequisites**:
- [ ] Physical device (easier to toggle network)
- [ ] Sandbox account ready

**Steps**:
1. Initiate purchase
2. After authentication, quickly:
   - Enable Airplane Mode, OR
   - Disconnect WiFi
3. Observe behavior
4. Re-enable network
5. Check subscription status

**Expected Results**:
- ✅ Error message displayed
- ✅ User prompted to retry
- ✅ Transaction not duplicated when network restored
- ✅ Receipt validation handles retry

**Pass Criteria**: ✅ Graceful error handling, no duplicate charges

---

### Restoration Testing

#### Test 2.1: Delete and Reinstall - Restore Purchases

**Objective**: Verify purchases can be restored after app reinstall

**Prerequisites**:
- [ ] Completed Test 1.1 or 1.2 (have active purchase)
- [ ] Same device, same sandbox account

**Steps**:
1. Note current subscription details
2. Delete app completely
3. Reinstall app
4. Sign in with same user account (not sandbox account yet)
5. Navigate to Settings → Subscription
6. Tap "Restore Purchases"
7. Sign in with same sandbox account when prompted

**Expected Results**:
- ✅ "Restore Purchases" button visible
- ✅ Restoration prompt appears
- ✅ User signs in with sandbox account
- ✅ Success message: "Purchases restored"
- ✅ Premium tier re-activated
- ✅ Database updated with restored subscription
- ✅ [`apple_original_transaction_id`](../database/apple_iap_migration.sql) matches previous

**Verification**:
```sql
-- Verify original transaction ID maintained
SELECT 
  apple_original_transaction_id,
  subscription_status,
  apple_receipt_expiration_date
FROM profiles
WHERE id = '[user_id]';
```

**Pass Criteria**: ✅ Subscription fully restored

---

#### Test 2.2: Restore on Different Device

**Objective**: Verify cross-device subscription sync

**Prerequisites**:
- [ ] Active subscription on Device A
- [ ] Device B available (or simulator)
- [ ] Same sandbox Apple ID

**Steps**:
1. Install app on Device B
2. Sign in with same user account
3. Tap "Restore Purchases"
4. Sign in with same sandbox Apple ID
5. Verify subscription status

**Expected Results**:
- ✅ Subscription syncs to Device B
- ✅ Premium features available on Device B
- ✅ Database shows same `original_transaction_id`

**Pass Criteria**: ✅ Cross-device sync successful

---

#### Test 2.3: Restore with No Previous Purchases

**Objective**: Verify restore handles no-purchase scenario gracefully

**Prerequisites**:
- [ ] New sandbox account never used for purchase
- [ ] Fresh app install

**Steps**:
1. Launch app with new account
2. Tap "Restore Purchases"
3. Sign in with sandbox account (no purchases)

**Expected Results**:
- ✅ Message: "No previous purchases found"
- ✅ User remains in free tier
- ✅ No error/crash
- ✅ Can still make new purchase

**Pass Criteria**: ✅ Graceful "no purchases" handling

---

### Receipt Validation Testing

#### Test 3.1: Successful Receipt Validation

**Objective**: Verify server-side receipt validation works

**Prerequisites**:
- [ ] Supabase function deployed
- [ ] Environment variables set
- [ ] Active purchase

**Steps**:
1. Make purchase
2. Monitor Supabase function logs:
   ```bash
   supabase functions logs validate-apple-receipt --tail
   ```
3. Check for validation success

**Expected Results**:
- ✅ Function receives receipt data
- ✅ Apple API called successfully
- ✅ Receipt validated
- ✅ Database updated
- ✅ Log shows "Receipt validated successfully"

**Log Output Example**:
```
Validating receipt with Apple Production API...
✅ Receipt validated successfully
User subscription updated: user_id=[uuid]
```

**Pass Criteria**: ✅ Validation completes without errors

---

#### Test 3.2: Invalid Receipt Handling

**Objective**: Verify system rejects invalid receipts

**Prerequisites**:
- [ ] Access to Supabase function
- [ ] Can modify receipt data for testing

**Steps**:
1. Attempt to send malformed receipt to validation endpoint
2. Monitor response and logs

**Expected Results**:
- ✅ Validation fails appropriately
- ✅ Error logged
- ✅ Database not updated with invalid data
- ✅ User notified of issue

**Pass Criteria**: ✅ Invalid receipts rejected safely

---

#### Test 3.3: Database Update After Validation

**Objective**: Verify database correctly updated after validation

**Prerequisites**:
- [ ] Completed successful purchase
- [ ] Database access

**Steps**:
1. Complete purchase
2. Wait for validation
3. Query database tables

**Expected Results**:
- ✅ [`profiles`](../database/apple_iap_migration.sql) table updated:
  ```sql
  subscription_tier = 'premium'
  subscription_status = 'active'
  payment_provider = 'apple'
  apple_original_transaction_id = '[transaction_id]'
  apple_receipt_expiration_date = [future_date]
  ```
- ✅ [`apple_transactions`](../database/apple_iap_migration.sql) table has entry:
  ```sql
  transaction_id = '[unique_id]'
  product_id = 'com.renvo.basic.monthly' OR 'com.renvo.basic.yearly'
  purchase_date = [timestamp]
  expiration_date = [future_timestamp]
  ```

**Pass Criteria**: ✅ All database fields correctly populated

---

### Webhook Testing

Apple sends webhooks for subscription events. Test these scenarios using App Store Connect sandbox controls.

#### Test 4.1: Subscription Renewal Event

**Objective**: Verify DID_RENEW webhook updates subscription

**Prerequisites**:
- [ ] Active sandbox subscription
- [ ] Webhook URL configured in App Store Connect
- [ ] Access to Supabase logs

**Steps**:
1. Wait for sandbox renewal (sandbox accelerates time):
   - Monthly: Renews every 5 minutes
   - Yearly: Renews every 1 hour
2. Monitor webhook logs:
   ```bash
   supabase functions logs apple-webhook --tail
   ```
3. Check database after renewal

**Expected Results**:
- ✅ Webhook received with `notificationType: 'DID_RENEW'`
- ✅ Database updated with new expiration date
- ✅ Transaction recorded in `apple_transactions`
- ✅ User maintains premium access

**Webhook Payload Example**:
```json
{
  "notificationType": "DID_RENEW",
  "data": {
    "bundleId": "com.renvo",
    "environment": "Sandbox",
    "signedTransactionInfo": "[jwt_token]"
  }
}
```

**Pass Criteria**: ✅ Renewal processed automatically

---

#### Test 4.2: Subscription Cancellation Event

**Objective**: Verify DID_CHANGE_RENEWAL_STATUS webhook

**Prerequisites**:
- [ ] Active sandbox subscription
- [ ] Access to App Store Connect

**Steps**:
1. In App Store Connect Sandbox, disable auto-renewal
2. Monitor webhook
3. Check database status

**Expected Results**:
- ✅ Webhook received with `notificationType: 'DID_CHANGE_RENEWAL_STATUS'`
- ✅ Database shows `subscription_status = 'canceled'`
- ✅ User maintains access until expiration
- ✅ No renewal after expiration date

**Pass Criteria**: ✅ Cancellation processed, access maintained until period end

---

#### Test 4.3: Payment Failure Event

**Objective**: Verify DID_FAIL_TO_RENEW webhook

**Prerequisites**:
- [ ] Sandbox subscription near renewal
- [ ] Can simulate payment failure in sandbox

**Steps**:
1. Simulate payment failure in App Store Connect sandbox
2. Monitor webhook
3. Check user status

**Expected Results**:
- ✅ Webhook received with `notificationType: 'DID_FAIL_TO_RENEW'`
- ✅ Database shows `subscription_status = 'past_due'`
- ✅ User notified of payment issue
- ✅ Grace period handling (if configured)

**Pass Criteria**: ✅ Payment failure handled gracefully

---

#### Test 4.4: Refund Processing

**Objective**: Verify REFUND webhook revokes access

**Prerequisites**:
- [ ] Active subscription
- [ ] Can process refund in sandbox

**Steps**:
1. Process refund through App Store Connect
2. Monitor webhook
3. Verify access revoked

**Expected Results**:
- ✅ Webhook received with `notificationType: 'REFUND'`
- ✅ Database updated to free tier
- ✅ Premium features immediately disabled
- ✅ Transaction marked as refunded

**Pass Criteria**: ✅ Access revoked immediately after refund

---

### Edge Cases Testing

#### Test 5.1: Multiple Rapid Purchase Attempts

**Objective**: Verify system handles duplicate purchase attempts

**Prerequisites**:
- [ ] Sandbox account ready
- [ ] Good network connection

**Steps**:
1. Tap purchase button
2. While first purchase processing, tap again rapidly 3-5 times
3. Complete first purchase authentication
4. Observe behavior

**Expected Results**:
- ✅ Only one purchase processed
- ✅ No duplicate charges
- ✅ Subsequent taps ignored or queued properly
- ✅ Database has single transaction

**Pass Criteria**: ✅ No duplicate purchases

---

#### Test 5.2: App Killed During Purchase

**Objective**: Verify purchase recovers after app force-quit

**Prerequisites**:
- [ ] Physical device preferred
- [ ] Sandbox account ready

**Steps**:
1. Initiate purchase
2. After authentication, immediately:
   - Force quit app (swipe up in app switcher)
3. Wait 30 seconds
4. Relaunch app
5. Check subscription status

**Expected Results**:
- ✅ Purchase completes in background
- ✅ On relaunch, subscription active
- ✅ Receipt validation completed
- ✅ Premium features unlocked

**Pass Criteria**: ✅ Purchase resilient to app termination

---

#### Test 5.3: Expired Subscription Re-activation

**Objective**: Verify expired users can re-subscribe

**Prerequisites**:
- [ ] Previously active subscription now expired
- [ ] Sandbox account with expired subscription

**Steps**:
1. Let subscription expire (or manually expire in sandbox)
2. Verify user downgraded to free tier
3. Attempt new purchase
4. Complete purchase
5. Verify re-activation

**Expected Results**:
- ✅ User downgraded to free after expiration
- ✅ Can initiate new purchase
- ✅ New subscription created successfully
- ✅ New `original_transaction_id` generated

**Pass Criteria**: ✅ Re-subscription works seamlessly

---

#### Test 5.4: Cross-Platform Account (If Applicable)

**Objective**: Verify iOS subscription syncs to web (if web version exists)

**Prerequisites**:
- [ ] Web version of app exists
- [ ] Same user account on both platforms

**Steps**:
1. Purchase subscription on iOS
2. Log into web version
3. Check subscription status

**Expected Results**:
- ✅ Subscription visible on web
- ✅ Premium features available on web
- ✅ Database shows same subscription across platforms

**Pass Criteria**: ✅ Cross-platform sync successful

---

## Troubleshooting Guide

### Common Sandbox Issues

#### Issue 1: "Cannot Connect to iTunes Store"

**Symptoms**:
- Error when attempting purchase
- "Cannot connect to iTunes Store" message

**Possible Causes**:
1. Not signed out of production Apple ID
2. Network connectivity issues
3. Sandbox account not activated (24-hour wait)
4. Region mismatch

**Solutions**:
1. ✅ **Sign out of production Apple ID**:
   - Settings → [Your Name] → Sign Out
   - Restart device
2. ✅ **Check network connection**:
   - Ensure WiFi/cellular enabled
   - Try different network
3. ✅ **Wait 24 hours** after creating sandbox account
4. ✅ **Verify region settings**:
   - Device region matches sandbox account
   - App Store account region correct

---

#### Issue 2: Receipt Validation Failures

**Symptoms**:
- Purchase completes but premium not unlocked
- Error in Supabase logs: "Receipt validation failed"

**Possible Causes**:
1. Incorrect `APPLE_SHARED_SECRET`
2. Wrong environment (production vs sandbox)
3. Bundle ID mismatch
4. Network issues between Supabase and Apple

**Solutions**:
1. ✅ **Verify environment variables**:
   ```bash
   supabase secrets list
   # Check APPLE_SHARED_SECRET is correct
   ```
2. ✅ **Check validation logic**:
   - [`validate-apple-receipt/index.ts`](../supabase/functions/validate-apple-receipt/index.ts)
   - Ensure trying sandbox URL if production fails
3. ✅ **Verify bundle ID**:
   - `APPLE_APP_BUNDLE_ID` matches app
4. ✅ **Check logs for specific error**:
   ```bash
   supabase functions logs validate-apple-receipt
   ```

---

#### Issue 3: Webhook Not Receiving Notifications

**Symptoms**:
- Renewals not processing
- No webhook logs in Supabase
- Subscription status not updating

**Possible Causes**:
1. Webhook URL not configured in App Store Connect
2. Webhook URL incorrect
3. Supabase function not deployed
4. Function authentication issues

**Solutions**:
1. ✅ **Verify webhook URL in App Store Connect**:
   - App Information → App Store Server Notifications
   - URL format: `https://[project].supabase.co/functions/v1/apple-webhook`
2. ✅ **Test webhook manually**:
   ```bash
   curl -X POST https://[project].supabase.co/functions/v1/apple-webhook \
     -H "Content-Type: application/json" \
     -d '{"signedPayload":"test"}'
   ```
3. ✅ **Redeploy function**:
   ```bash
   supabase functions deploy apple-webhook
   ```
4. ✅ **Check function logs**:
   ```bash
   supabase functions logs apple-webhook --tail
   ```

---

#### Issue 4: Transaction Stuck in Pending State

**Symptoms**:
- Purchase initiated but never completes
- App shows "Processing..." indefinitely
- No success or error message

**Possible Causes**:
1. Listener not properly set up
2. Network interruption during purchase
3. Receipt validation hanging
4. Database deadlock

**Solutions**:
1. ✅ **Restart app and attempt restoration**:
   - Force quit app
   - Relaunch
   - Tap "Restore Purchases"
2. ✅ **Check listener setup** in [`appleIAPService.ts`](../services/appleIAPService.ts):
   ```typescript
   // Ensure listeners are properly configured
   setupPurchaseListeners()
   ```
3. ✅ **Manually finish transaction** (developer console):
   ```typescript
   // In React Native debugger
   await finishTransaction({ purchase, isConsumable: false });
   ```
4. ✅ **Check database for locks**:
   ```sql
   SELECT * FROM pg_locks WHERE granted = false;
   ```

---

#### Issue 5: "Sandbox Account Already Used"

**Symptoms**:
- Error: "This Apple ID has not yet been used in the iTunes Store"
- Cannot complete purchase

**Possible Causes**:
1. Sandbox account needs first-time setup
2. Account region not configured

**Solutions**:
1. ✅ **Complete first-time setup**:
   - Agree to terms and conditions when prompted
   - Verify account details
   - Try purchase again
2. ✅ **Create new sandbox account** if issue persists

---

### Performance Issues

#### Issue 6: Slow Purchase Flow

**Symptoms**:
- Purchase takes >10 seconds
- App feels unresponsive

**Solutions**:
1. ✅ **Profile network requests**:
   - Use Xcode Network Profiler
   - Check for slow Apple API calls
2. ✅ **Optimize receipt validation**:
   - Ensure Supabase function is fast
   - Add timeout handling
3. ✅ **Add loading indicators**:
   - Update UI to show progress
   - Prevent user confusion

---

### Database Issues

#### Issue 7: Subscription Status Not Updating

**Symptoms**:
- Purchase successful but user still in free tier
- Database not reflecting purchase

**Solutions**:
1. ✅ **Check database functions**:
   ```sql
   -- Verify functions exist
   SELECT proname FROM pg_proc WHERE proname LIKE '%apple%';
   
   -- Expected functions:
   -- - record_apple_transaction
   -- - update_user_apple_subscription
   ```
2. ✅ **Manually update for testing** (if needed):
   ```sql
   UPDATE profiles
   SET 
     subscription_tier = 'premium',
     subscription_status = 'active',
     payment_provider = 'apple'
   WHERE id = '[user_id]';
   ```
3. ✅ **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'apple_transactions';
   ```

---

## Testing Completion Checklist

Once all tests are complete, verify:

### Purchase Flows
- [ ] Monthly subscription purchase works
- [ ] Yearly subscription purchase works
- [ ] Purchase with multiple sandbox accounts
- [ ] Purchase interruption handled gracefully
- [ ] Network failure during purchase handled

### Restoration
- [ ] Restore after app reinstall
- [ ] Restore on different device
- [ ] Restore with no purchases (graceful failure)

### Receipt Validation
- [ ] Successful validation updates database
- [ ] Invalid receipts rejected
- [ ] Database correctly populated after validation

### Webhooks
- [ ] DID_RENEW event processes correctly
- [ ] DID_CHANGE_RENEWAL_STATUS handles cancellation
- [ ] DID_FAIL_TO_RENEW marks as past_due
- [ ] REFUND revokes access immediately

### Edge Cases
- [ ] No duplicate purchases
- [ ] Purchase survives app termination
- [ ] Expired subscription can re-subscribe

### Database
- [ ] All transactions recorded in `apple_transactions`
- [ ] User profiles updated correctly
- [ ] No duplicate transaction IDs

### Logs & Monitoring
- [ ] Supabase function logs accessible
- [ ] Xcode console shows IAP logs
- [ ] No critical errors in logs

---

## Next Steps

After completing sandbox testing:

1. ✅ Document any issues found and resolutions
2. ✅ Update test cases based on findings
3. ✅ Proceed to [Automated Testing](AUTOMATED_TESTING_PLAN.md)
4. ✅ Prepare for [App Store Review](APP_STORE_REVIEW_CHECKLIST.md)
5. ✅ Follow [Testing Execution Guide](TESTING_EXECUTION_GUIDE.md) timeline

---

## Resources

- [Apple Sandbox Testing Guide](https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases_with_sandbox)
- [StoreKit Testing in Xcode](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode)
- [App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

**Version History**:
- v1.0.0 (2025-12-06): Initial sandbox testing guide