# Apple IAP Testing Execution Guide

Day-by-day schedule for comprehensive Apple In-App Purchase testing.

## Document Information
- **Version**: 1.0.0
- **Created**: 2025-12-06
- **Phase**: Phase 6 - Testing & Validation
- **Total Duration**: 5-6 days + App Store Connect setup

---

## Table of Contents

1. [Overview](#overview)
2. [Day 0: Pre-Testing Setup](#day-0-pre-testing-setup)
3. [Day 1: Basic Purchase Testing](#day-1-basic-purchase-testing)
4. [Day 2: Restoration & Edge Cases](#day-2-restoration--edge-cases)
5. [Day 3: Webhook Testing](#day-3-webhook-testing)
6. [Day 4: Cross-Device & Integration](#day-4-cross-device--integration)
7. [Day 5: App Store Review Prep](#day-5-app-store-review-prep)
8. [Testing Progress Tracker](#testing-progress-tracker)

---

## Overview

### Testing Timeline

```
Day 0 (Setup)  →  Day 1-2 (Core)  →  Day 3 (Webhooks)  →  Day 4 (Integration)  →  Day 5 (Prep)
  2-3 hours        8-12 hours           3-4 hours            2-3 hours             2-3 hours
```

**Total Estimated Time**: 17-25 hours over 6 days

### Prerequisites Before Starting

- ✅ Code implementation complete (Phases 2-5)
- ✅ [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md) reviewed
- ✅ [`APP_STORE_REVIEW_CHECKLIST.md`](APP_STORE_REVIEW_CHECKLIST.md) reviewed
- ✅ Apple Developer Account active
- ✅ Test devices/simulators available

### Testing Team Roles

**Recommended Team**:
- **Lead Tester**: Coordinates testing, tracks progress (1 person)
- **iOS Testers**: Execute test scenarios (1-2 people)
- **Backend Tester**: Monitor logs, verify database (1 person)

**Solo Developer**: Can complete all testing alone, will take longer.

---

## Day 0: Pre-Testing Setup

**Duration**: 2-3 hours  
**Objective**: Configure App Store Connect and prepare testing environment

### Morning Session (9:00 AM - 11:00 AM)

#### Task 0.1: App Store Connect Configuration (90 minutes)

**Follow**: [`SANDBOX_TESTING_GUIDE.md#app-store-connect-configuration`](SANDBOX_TESTING_GUIDE.md#app-store-connect-configuration)

**Steps**:
1. **Create Subscription Group** (15 min)
   - [ ] Navigate to App Store Connect → Subscriptions
   - [ ] Create "Premium Subscriptions" group
   - [ ] Configure group settings

2. **Create Monthly Product** (30 min)
   - [ ] Product ID: `com.renvo.basic.monthly`
   - [ ] Price: $4.99 USD (Tier 5)
   - [ ] Duration: 1 month
   - [ ] Add localizations
   - [ ] Submit for review (approval not needed for sandbox)

3. **Create Yearly Product** (30 min)
   - [ ] Product ID: `com.renvo.basic.yearly`
   - [ ] Price: $39.99 USD (Tier 40)
   - [ ] Duration: 1 year
   - [ ] Add localizations
   - [ ] Submit for review

4. **Configure Webhook URL** (15 min)
   - [ ] Go to App Information → Server Notifications
   - [ ] Enter: `https://[project].supabase.co/functions/v1/apple-webhook`
   - [ ] Test connection
   - [ ] Save

**Completion Criteria**:
- ✅ Both products show in App Store Connect
- ✅ Webhook URL configured and tested
- ✅ Products ready for sandbox testing

---

#### Task 0.2: Sandbox Accounts Setup (30 minutes)

**Steps**:
1. **Create Test Accounts** (20 min)
   - [ ] Account 1 (US): `test.monthly.user@example.com`
   - [ ] Account 2 (US): `test.yearly.user@example.com`
   - [ ] Account 3 (UK): `test.international@example.com`
   - [ ] Document passwords securely

2. **Prepare Test Devices** (10 min)
   - [ ] Sign out of production Apple ID on all test devices
   - [ ] Verify device/simulator iOS version (15+)
   - [ ] Install Xcode and connect devices

**Completion Criteria**:
- ✅ 3+ sandbox accounts created
- ✅ Test devices prepared
- ✅ Not signed into production Apple ID

---

### Afternoon Session (1:00 PM - 3:00 PM)

#### Task 0.3: Environment Configuration (60 minutes)

**Steps**:
1. **Verify Supabase Setup** (30 min)
   ```bash
   # Check environment variables
   supabase secrets list
   
   # Expected variables:
   # - APPLE_APP_BUNDLE_ID
   # - APPLE_SHARED_SECRET
   # - SUPABASE_URL
   # - SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Deploy Edge Functions** (20 min)
   ```bash
   # Deploy receipt validation
   supabase functions deploy validate-apple-receipt
   
   # Deploy webhook handler
   supabase functions deploy apple-webhook
   
   # Verify deployments
   supabase functions list
   ```

3. **Run Database Migration** (10 min)
   ```bash
   # Execute Apple IAP migration
   psql -h [db-host] -U postgres -d postgres -f database/apple_iap_migration.sql
   ```

**Completion Criteria**:
- ✅ All environment variables set
- ✅ Edge functions deployed
- ✅ Database migration executed
- ✅ Tables created (`apple_transactions`, updated `profiles`)

---

#### Task 0.4: Build and Install App (30 minutes)

**Steps**:
1. **Build App** (15 min)
   ```bash
   # For iOS Simulator
   npm run ios
   
   # Or for physical device
   npx expo run:ios --device
   ```

2. **Verify Build** (10 min)
   - [ ] App launches successfully
   - [ ] No critical errors in console
   - [ ] Can navigate to paywall

3. **Monitor Logs** (5 min)
   ```bash
   # Terminal 1: Xcode console
   # Window → Devices and Simulators → Console
   
   # Terminal 2: Supabase functions
   supabase functions logs validate-apple-receipt --tail
   
   # Terminal 3: Webhook logs
   supabase functions logs apple-webhook --tail
   ```

**Completion Criteria**:
- ✅ App installed and running
- ✅ Logs monitoring active
- ✅ Ready for testing

---

### End of Day 0 Checklist

- [ ] App Store Connect products configured
- [ ] Sandbox accounts created (3+)
- [ ] Environment variables set
- [ ] Edge functions deployed
- [ ] Database migration executed
- [ ] App built and installed
- [ ] Log monitoring set up
- [ ] Testing documentation ready

**If all checked**: ✅ **Proceed to Day 1**

---

## Day 1: Basic Purchase Testing

**Duration**: 4-6 hours  
**Objective**: Validate core purchase flows for monthly and yearly subscriptions

### Morning Session (9:00 AM - 12:00 PM)

#### Task 1.1: Monthly Subscription Purchase (60 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-11-first-time-monthly-purchase`](SANDBOX_TESTING_GUIDE.md#test-11-first-time-monthly-purchase)

**Test Steps**:
1. **Launch App** (5 min)
   - [ ] Fresh install or clear app data
   - [ ] Sign up with new user account
   - [ ] Verify free tier (3 items max)

2. **Navigate to Paywall** (5 min)
   - [ ] Add 3 subscriptions to hit limit
   - [ ] Trigger paywall modal
   - [ ] Verify monthly price shows $4.99

3. **Execute Purchase** (15 min)
   - [ ] Tap "Choose Monthly"
   - [ ] Sign in with sandbox account #1
   - [ ] Authenticate with Face ID/password
   - [ ] Wait for confirmation

4. **Verify Success** (35 min)
   - [ ] Success message displayed
   - [ ] Premium features unlocked
   - [ ] Can add more than 3 items
   - [ ] Check Xcode console for logs
   - [ ] Monitor Supabase validation logs
   - [ ] Query database:
   ```sql
   SELECT subscription_tier, subscription_status, payment_provider,
          apple_original_transaction_id, apple_receipt_expiration_date
   FROM profiles WHERE id = '[user_id]';
   
   SELECT transaction_id, product_id, purchase_date, expiration_date
   FROM apple_transactions WHERE user_id = '[user_id]'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Pass/Fail Criteria**:
- ✅ **PASS**: Purchase completes, premium unlocked, database updated
- ❌ **FAIL**: Any step fails, document issue in [Testing Log](#testing-progress-tracker)

**Time Tracking**: Expected 60 min | Actual: _____ min

---

#### Task 1.2: Yearly Subscription Purchase (60 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-12-first-time-yearly-purchase`](SANDBOX_TESTING_GUIDE.md#test-12-first-time-yearly-purchase)

**Test Steps**:
1. **New User Setup** (10 min)
   - [ ] Delete app completely
   - [ ] Reinstall app
   - [ ] Sign up with different user account

2. **Execute Yearly Purchase** (15 min)
   - [ ] Navigate to paywall
   - [ ] Verify yearly shows $39.99
   - [ ] Verify "Save 17%" badge
   - [ ] Tap "Choose Yearly"
   - [ ] Sign in with sandbox account #2
   - [ ] Complete purchase

3. **Verify Success** (35 min)
   - [ ] Confirmation received
   - [ ] Premium unlocked
   - [ ] Database shows yearly subscription
   - [ ] Expiration date ~1 year in future
   - [ ] Verify in database

**Pass/Fail Criteria**:
- ✅ **PASS**: Yearly purchase successful
- ❌ **FAIL**: Document issues

**Time Tracking**: Expected 60 min | Actual: _____ min

---

### Afternoon Session (1:00 PM - 3:00 PM)

#### Task 1.3: Purchase Variations (120 minutes)

**Multiple Tests**:

**Test 1.3a: Different Sandbox Account** (30 min)
- [ ] Use sandbox account #3 (international)
- [ ] Verify regional pricing works
- [ ] Complete purchase

**Test 1.3b: Purchase Interruption** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-14-purchase-interruption-handling`](SANDBOX_TESTING_GUIDE.md#test-14-purchase-interruption-handling)
- [ ] Initiate purchase
- [ ] Kill app mid-purchase
- [ ] Relaunch, verify no corruption
- [ ] Retry purchase successfully

**Test 1.3c: Network Failure** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-15-network-failure-during-purchase`](SANDBOX_TESTING_GUIDE.md#test-15-network-failure-during-purchase)
- [ ] Initiate purchase
- [ ] Enable airplane mode after auth
- [ ] Observe error handling
- [ ] Re-enable network, retry

**Test 1.3d: User Cancellation** (30 min)
- [ ] Start purchase
- [ ] Cancel at Apple payment sheet
- [ ] Verify graceful failure
- [ ] User remains in free tier

**Pass/Fail Criteria**:
- ✅ **PASS**: All variations handled gracefully
- ❌ **FAIL**: Document specific failures

---

### End of Day 1 Summary

**Tests Completed**: ____/4  
**Tests Passed**: ____/4  
**Tests Failed**: ____/4

**Critical Issues Found**:
- [ ] None (proceed to Day 2)
- [ ] Minor issues (document, proceed)
- [ ] Critical issues (fix before Day 2)

**Notes**:
```
[Add any observations, issues, or concerns]
```

---

## Day 2: Restoration & Edge Cases

**Duration**: 4-6 hours  
**Objective**: Test purchase restoration and edge case scenarios

### Morning Session (9:00 AM - 12:00 PM)

#### Task 2.1: Purchase Restoration (90 minutes)

**Test 2.1a: Delete and Reinstall** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-21-delete-and-reinstall-restore-purchases`](SANDBOX_TESTING_GUIDE.md#test-21-delete-and-reinstall-restore-purchases)

**Steps**:
1. **Note Current State** (5 min)
   - [ ] Document active subscription details
   - [ ] Note transaction ID

2. **Delete and Reinstall** (10 min)
   - [ ] Completely delete app
   - [ ] Reinstall from Xcode/EAS
   - [ ] Sign in with same user account

3. **Restore Purchases** (15 min)
   - [ ] Navigate to Settings
   - [ ] Tap "Restore Purchases"
   - [ ] Sign in with same sandbox account
   - [ ] Wait for restoration

4. **Verify Restoration** (10 min)
   - [ ] Success message shown
   - [ ] Premium tier restored
   - [ ] Original transaction ID matches
   - [ ] Database updated correctly

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.1b: Cross-Device Restoration** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-22-restore-on-different-device`](SANDBOX_TESTING_GUIDE.md#test-22-restore-on-different-device)

**Steps**:
1. **Device A**: Complete purchase (if not done)
2. **Device B**: Install app
3. **Device B**: Sign in with same user
4. **Device B**: Tap "Restore Purchases"
5. **Device B**: Sign in with same sandbox account
6. **Verify**: Subscription syncs to Device B

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.1c: No Previous Purchases** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-23-restore-with-no-previous-purchases`](SANDBOX_TESTING_GUIDE.md#test-23-restore-with-no-previous-purchases)

**Steps**:
1. **New User**: Create fresh account
2. **Attempt Restore**: Tap "Restore Purchases"
3. **Verify**: "No purchases found" message
4. **Verify**: User remains in free tier
5. **Verify**: No errors or crashes

**Pass/Fail**: _____ | Time: _____ min

---

### Afternoon Session (1:00 PM - 3:30 PM)

#### Task 2.2: Edge Cases Testing (150 minutes)

**Test 2.2a: Multiple Rapid Purchases** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-51-multiple-rapid-purchase-attempts`](SANDBOX_TESTING_GUIDE.md#test-51-multiple-rapid-purchase-attempts)

**Steps**:
- [ ] Tap purchase button rapidly 5 times
- [ ] Complete authentication
- [ ] Verify only 1 purchase processed
- [ ] Check database for duplicates

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.2b: App Killed During Purchase** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-52-app-killed-during-purchase`](SANDBOX_TESTING_GUIDE.md#test-52-app-killed-during-purchase)

**Steps**:
- [ ] Initiate purchase
- [ ] After auth, force quit app immediately
- [ ] Wait 30 seconds
- [ ] Relaunch app
- [ ] Verify purchase completed in background

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.2c: Expired Subscription Re-activation** (30 min)
**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-53-expired-subscription-re-activation`](SANDBOX_TESTING_GUIDE.md#test-53-expired-subscription-re-activation)

**Steps**:
- [ ] Let sandbox subscription expire (or simulate)
- [ ] Verify user downgraded to free tier
- [ ] Attempt new purchase
- [ ] Verify new subscription created
- [ ] Check for new transaction ID

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.2d: Receipt Validation Failure** (30 min)
**Steps**:
- [ ] Temporarily break receipt validation (test only)
- [ ] Attempt purchase
- [ ] Verify error handling
- [ ] Restore validation
- [ ] Retry purchase successfully

**Pass/Fail**: _____ | Time: _____ min

---

**Test 2.2e: Performance Testing** (30 min)
**Steps**:
- [ ] Measure purchase flow time (should be <10 sec)
- [ ] Test with poor network (slow 3G simulation)
- [ ] Monitor memory usage during purchase
- [ ] Check for memory leaks

**Pass/Fail**: _____ | Time: _____ min

---

### End of Day 2 Summary

**Tests Completed**: ____/8  
**Tests Passed**: ____/8  
**Tests Failed**: ____/8

**Restoration Working**: [ ] Yes [ ] No  
**Edge Cases Handled**: [ ] Yes [ ] No

**Critical Issues**:
```
[Document any critical issues found]
```

---

## Day 3: Webhook Testing

**Duration**: 3-4 hours  
**Objective**: Test App Store Server Notifications webhook handling

### Morning Session (9:00 AM - 12:00 PM)

#### Task 3.1: Renewal Testing (60 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-41-subscription-renewal-event`](SANDBOX_TESTING_GUIDE.md#test-41-subscription-renewal-event)

**Sandbox Renewal Timing**:
- Monthly: Renews every **5 minutes**
- Yearly: Renews every **1 hour**

**Steps**:
1. **Setup Monitoring** (10 min)
   ```bash
   # Watch webhook logs
   supabase functions logs apple-webhook --tail
   ```

2. **Wait for Renewal** (30 min)
   - [ ] Have active monthly subscription
   - [ ] Wait 5-6 minutes for first renewal
   - [ ] Monitor webhook logs

3. **Verify Renewal** (20 min)
   - [ ] Webhook received with `DID_RENEW`
   - [ ] Database updated with new expiration
   - [ ] Transaction recorded
   - [ ] User maintains premium access

**Webhook Payload Example**:
```json
{
  "notificationType": "DID_RENEW",
  "data": {
    "environment": "Sandbox",
    "signedTransactionInfo": "[jwt]"
  }
}
```

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 3.2: Cancellation Testing (45 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-42-subscription-cancellation-event`](SANDBOX_TESTING_GUIDE.md#test-42-subscription-cancellation-event)

**Steps**:
1. **Disable Auto-Renewal** (10 min)
   - [ ] In App Store Connect Sandbox controls
   - [ ] Disable auto-renewal for test subscription

2. **Monitor Webhook** (20 min)
   - [ ] Webhook received: `DID_CHANGE_RENEWAL_STATUS`
   - [ ] Database shows `subscription_status = 'canceled'`

3. **Verify Grace Period** (15 min)
   - [ ] User still has access until expiration
   - [ ] No renewal after expiration

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 3.3: Payment Failure Testing (45 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-43-payment-failure-event`](SANDBOX_TESTING_GUIDE.md#test-43-payment-failure-event)

**Steps**:
1. **Simulate Failure** (10 min)
   - [ ] Use App Store Connect sandbox controls
   - [ ] Simulate payment failure

2. **Monitor Webhook** (20 min)
   - [ ] Webhook: `DID_FAIL_TO_RENEW`
   - [ ] Status: `past_due`

3. **Verify Handling** (15 min)
   - [ ] User notified
   - [ ] Grace period handling (if configured)

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 3.4: Refund Testing (30 minutes)

**Reference**: [`SANDBOX_TESTING_GUIDE.md#test-44-refund-processing`](SANDBOX_TESTING_GUIDE.md#test-44-refund-processing)

**Steps**:
1. **Process Refund** (10 min)
   - [ ] Use App Store Connect
   - [ ] Refund active subscription

2. **Verify Webhook** (10 min)
   - [ ] Webhook: `REFUND`
   - [ ] Immediate access revocation

3. **Verify Database** (10 min)
   - [ ] User downgraded to free
   - [ ] Transaction marked as refunded

**Pass/Fail**: _____ | Time: _____ min

---

### End of Day 3 Summary

**Webhook Tests Completed**: ____/4  
**Webhook Tests Passed**: ____/4

**Webhook URL Working**: [ ] Yes [ ] No  
**Database Updates Correct**: [ ] Yes [ ] No

**Issues**:
```
[Document webhook-related issues]
```

---

## Day 4: Cross-Device & Integration

**Duration**: 2-3 hours  
**Objective**: Verify cross-device sync and integration with existing features

### Morning Session (9:00 AM - 11:00 AM)

#### Task 4.1: Multi-Device Testing (60 minutes)

**Devices to Test**:
- [ ] iPhone (physical)
- [ ] iPad (if supported)
- [ ] iOS Simulator

**Test Steps**:
1. **Purchase on Device A** (15 min)
   - [ ] Complete purchase on iPhone
   - [ ] Verify premium features work

2. **Sync to Device B** (20 min)
   - [ ] Install app on iPad/Simulator
   - [ ] Sign in with same account
   - [ ] Tap "Restore Purchases"
   - [ ] Verify subscription syncs

3. **Verify Cross-Device State** (25 min)
   - [ ] Both devices show premium tier
   - [ ] Features work on both devices
   - [ ] Database shows single subscription

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 4.2: iOS Version Compatibility (30 minutes)

**Test on Multiple iOS Versions**:
- [ ] iOS 17 (latest)
- [ ] iOS 16
- [ ] iOS 15 (minimum for StoreKit 2)

**Verify**:
- [ ] Purchase flow works on all versions
- [ ] StoreKit 2/1 fallback functional
- [ ] UI renders correctly

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 4.3: Feature Integration Testing (30 minutes)

**Test Premium Features**:
1. **Unlimited Items** (10 min)
   - [ ] Free tier: Limited to 3 items
   - [ ] Premium: Can add unlimited items
   - [ ] Downgrade: Limit enforced again

2. **Export Functionality** (10 min)
   - [ ] Export available for premium users
   - [ ] Export blocked for free users

3. **Advanced Analytics** (10 min)
   - [ ] Premium features visible
   - [ ] Free users see upgrade prompts

**Pass/Fail**: _____ | Time: _____ min

---

### End of Day 4 Summary

**Integration Tests**: ____/3 passed  
**Multi-Device Sync**: [ ] Working [ ] Issues  
**iOS Compatibility**: [ ] All versions work [ ] Issues

---

## Day 5: App Store Review Prep

**Duration**: 2-3 hours  
**Objective**: Prepare all materials for App Store submission

### Morning Session (9:00 AM - 12:00 PM)

#### Task 5.1: Screenshot Preparation (60 minutes)

**Reference**: [`APP_STORE_REVIEW_CHECKLIST.md#app-metadata-requirements`](APP_STORE_REVIEW_CHECKLIST.md#app-metadata-requirements)

**Screenshots Needed**:
1. **Home Screen** (10 min)
   - [ ] Capture on iPhone 15 Pro Max (1290 x 2796)
   - [ ] Show subscriptions dashboard

2. **Paywall Screen** (15 min) - **CRITICAL**
   - [ ] Show monthly and yearly options
   - [ ] Display pricing clearly
   - [ ] Show subscription terms
   - [ ] Show "Restore Purchases" button

3. **Subscription Details** (10 min)
   - [ ] Individual subscription view
   - [ ] Feature showcase

4. **Settings Screen** (10 min)
   - [ ] Show "Restore Purchases" button
   - [ ] Subscription management link

5. **Statistics** (15 min)
   - [ ] Analytics/insights view
   - [ ] Premium features visible

**Tools**:
```bash
# Using simulator
CMD + S to save screenshot

# Or use Fastlane Snapshot
fastlane snapshot
```

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 5.2: Review Notes Preparation (30 minutes)

**Create Demo Account**:
```
Email: reviewer@renvo-test.com
Password: [secure password]

Sandbox Account for IAP:
Apple ID: [sandbox email]
Password: [sandbox password]

Instructions:
1. Launch app and sign in with demo account
2. Tap "Upgrade to Premium" to see paywall
3. Choose subscription (Monthly or Yearly)
4. Sign in with sandbox Apple ID when prompted
5. Complete purchase
6. Premium features will unlock immediately
```

**Pass/Fail**: _____ | Time: _____ min

---

#### Task 5.3: Final Checklist Verification (60 minutes)

**Reference**: [`APP_STORE_REVIEW_CHECKLIST.md#pre-submission-checklist`](APP_STORE_REVIEW_CHECKLIST.md#pre-submission-checklist)

**Critical Items**:
- [ ] IAP products approved in App Store Connect
- [ ] "Restore Purchases" button visible (REQUIRED)
- [ ] Subscription terms clearly stated (REQUIRED)
- [ ] Auto-renewal disclosure present (REQUIRED)
- [ ] Privacy policy accessible (REQUIRED)
- [ ] No external payment links on iOS (REQUIRED)
- [ ] Webhook URL configured
- [ ] Database migration executed
- [ ] Edge functions deployed
- [ ] Screenshots prepared (6+ images)
- [ ] App icon ready (1024x1024)
- [ ] Demo account created
- [ ] Review notes written

**Pass/Fail**: _____ | Time: _____ min

---

### End of Day 5 Summary

**App Store Ready**: [ ] Yes [ ] No  
**Screenshots Complete**: [ ] Yes [ ] No  
**Review Notes Ready**: [ ] Yes [ ] No

**Final Blockers**:
```
[List any remaining issues before submission]
```

---

## Testing Progress Tracker

### Overall Progress

| Phase | Status | Tests Passed | Tests Failed | Notes |
|-------|--------|--------------|--------------|-------|
| Day 0: Setup | ⬜ | N/A | N/A | |
| Day 1: Purchases | ⬜ | __/4 | __/4 | |
| Day 2: Restoration | ⬜ | __/8 | __/8 | |
| Day 3: Webhooks | ⬜ | __/4 | __/4 | |
| Day 4: Integration | ⬜ | __/3 | __/3 | |
| Day 5: Review Prep | ⬜ | __/3 | __/3 | |

**Total Tests**: __/22 passed

---

### Issues Log

| # | Date | Test | Issue | Severity | Status | Resolution |
|---|------|------|-------|----------|--------|------------|
| 1 | | | | Critical/High/Medium/Low | Open/Fixed | |
| 2 | | | | | | |
| 3 | | | | | | |

---

### Time Tracking

| Day | Estimated | Actual | Variance | Notes |
|-----|-----------|--------|----------|-------|
| Day 0 | 2-3 hours | ____ | ____ | |
| Day 1 | 4-6 hours | ____ | ____ | |
| Day 2 | 4-6 hours | ____ | ____ | |
| Day 3 | 3-4 hours | ____ | ____ | |
| Day 4 | 2-3 hours | ____ | ____ | |
| Day 5 | 2-3 hours | ____ | ____ | |
| **Total** | **17-25 hours** | ____ | ____ | |

---

## Post-Testing Actions

### When All Tests Pass

1. **Update Documentation** (30 min)
   - [ ] Add testing results to this document
   - [ ] Update any changed procedures
   - [ ] Document workarounds

2. **Create Test Report** (30 min)
   ```markdown
   # Apple IAP Testing Report
   
   **Date**: [Date]
   **Tester**: [Name]
   **Duration**: [X] hours
   
   ## Summary
   - Tests Passed: X/22
   - Tests Failed: X/22
   - Critical Issues: X
   
   ## Key Findings
   [List important discoveries]
   
   ## Recommendations
   [Suggestions for improvement]
   
   ## Ready for Submission
   [Yes/No with justification]
   ```

3. **Submit to App Store** (follow [`APP_STORE_REVIEW_CHECKLIST.md`](APP_STORE_REVIEW_CHECKLIST.md))

### If Critical Issues Found

1. **Document Issues**
   - Create GitHub issues
   - Prioritize by severity
   - Assign to developers

2. **Fix Critical Issues**
   - Address blocking issues
   - Retest affected scenarios

3. **Repeat Affected Tests**
   - Only retest impacted areas
   - Verify fixes work

---

## Tips for Efficient Testing

### Do's ✅

- **Document Everything**: Take notes as you test
- **Screenshot Failures**: Capture errors immediately
- **Take Breaks**: Testing is mentally demanding
- **Ask Questions**: Consult docs when unsure
- **Test Systematically**: Follow order, don't skip

### Don'ts ❌

- **Don't Rush**: Thoroughness over speed
- **Don't Skip Steps**: Each step has purpose
- **Don't Test Alone**: Have backup reviewer
- **Don't Ignore Small Issues**: Small bugs become big problems
- **Don't Forget to Log**: Track everything

---

## Resources

### Documentation
- [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md) - Detailed test procedures
- [`AUTOMATED_TESTING_PLAN.md`](AUTOMATED_TESTING_PLAN.md) - Unit/integration tests
- [`APP_STORE_REVIEW_CHECKLIST.md`](APP_STORE_REVIEW_CHECKLIST.md) - Submission prep
- [`APPLE_IAP_IMPLEMENTATION_PLAN.md`](APPLE_IAP_IMPLEMENTATION_PLAN.md) - Full implementation plan

### Tools
- Xcode Console - Log monitoring
- Supabase Dashboard - Function logs
- App Store Connect - Sandbox controls
- Database Client - Query verification

### Support
- Apple Developer Forums
- Supabase Support
- Team Slack/Discord (if applicable)

---

## Conclusion

After completing this 5-6 day testing schedule:

✅ **You will have**:
- Thoroughly tested all IAP functionality
- Verified sandbox operation
- Confirmed webhook handling
- Prepared App Store submission materials
- Documented all issues and resolutions

✅ **You will be ready to**:
- Submit app for App Store review
- Respond to reviewer feedback
- Launch with confidence

**Good luck with testing!** 🚀

---

**Version History**:
- v1.0.0 (2025-12-06): Initial testing execution guide