# Integration Testing Guide - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Overview](#overview)
2. [Testing Environments](#testing-environments)
3. [End-to-End Testing Flows](#end-to-end-testing-flows)
4. [Testing Checklists](#testing-checklists)
5. [Database Verification](#database-verification)
6. [Stripe Dashboard Verification](#stripe-dashboard-verification)
7. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Overview

This guide provides comprehensive instructions for testing the complete paywall system integration. All tests should be performed in a staging environment before deploying to production.

### Prerequisites

Before testing, ensure:
- [ ] Database migrations are applied
- [ ] Edge Functions are deployed
- [ ] Stripe test mode is configured
- [ ] Environment variables are set
- [ ] Test user accounts are created

---

## Testing Environments

### Development Environment
```bash
# Environment variables
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase project: Development
# Stripe mode: Test
# Database: Development instance
```

### Staging Environment
```bash
# Environment variables
EXPO_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase project: Staging
# Stripe mode: Test
# Database: Staging instance (mirrors production schema)
```

### Production Environment
```bash
# Environment variables
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Supabase project: Production
# Stripe mode: Live
# Database: Production instance
```

---

## End-to-End Testing Flows

### Flow 1: Free User → Premium User (Complete Upgrade)

**Objective**: Test the complete upgrade flow from free to premium tier.

#### Step 1: Create Test User
```bash
# Create a new test user in your app
Email: test-upgrade-$(date +%s)@example.com
Password: TestPassword123!
```

**Expected Result**:
- User is created successfully
- Default free tier subscription is created in `user_subscriptions` table
- Tier is set to 'free'

**Database Verification**:
```sql
SELECT * FROM public.user_subscriptions 
WHERE user_id = 'USER_ID_HERE';

-- Expected:
-- tier_id: 'free'
-- status: 'active'
-- billing_cycle: 'none'
-- stripe_customer_id: NULL
```

#### Step 2: Add Subscriptions (Below Limit)
```
1. Navigate to Add Subscription screen
2. Add subscription 1: "Netflix - $15.99/month"
3. Add subscription 2: "Spotify - $9.99/month"
4. Add subscription 3: "Amazon Prime - $14.99/month"
5. Add subscription 4: "Apple Music - $10.99/month"
```

**Expected Result**:
- All 4 subscriptions added successfully
- No paywall shown
- Home screen shows 4 subscriptions
- Stats page reflects correct totals

**Database Verification**:
```sql
SELECT COUNT(*) FROM public.subscriptions 
WHERE user_id = 'USER_ID_HERE';

-- Expected: 4
```

#### Step 3: Reach Free Tier Limit
```
Add subscription 5: "Disney+ - $7.99/month"
```

**Expected Result**:
- Subscription added successfully
- Total count: 5 subscriptions
- No paywall yet (at limit, not over)

#### Step 4: Trigger Paywall
```
Attempt to add subscription 6: "Hulu - $6.99/month"
```

**Expected Result**:
- ✅ Paywall modal appears immediately
- ✅ Modal shows: "You've reached your limit"
- ✅ Shows current count: 5/5
- ✅ Displays upgrade options (Monthly/Annual)
- ✅ Cancel button available

**Analytics Verification**:
```sql
SELECT * FROM public.usage_tracking_events 
WHERE user_id = 'USER_ID_HERE' 
  AND event_type = 'limit_reached'
ORDER BY created_at DESC 
LIMIT 1;

-- Should show a limit_reached event
```

#### Step 5: Select Premium Plan
```
1. On paywall modal, tap "See Plans"
2. Select "Monthly - $4.99/month"
3. Tap "Continue"
```

**Expected Result**:
- Navigates to payment screen
- Shows selected plan details
- Shows price: $4.99/month
- Payment form loads

**Analytics Verification**:
```sql
SELECT * FROM public.usage_tracking_events 
WHERE user_id = 'USER_ID_HERE' 
  AND event_type = 'plan_selected'
  AND event_data->>'plan' = 'monthly'
ORDER BY created_at DESC 
LIMIT 1;
```

#### Step 6: Complete Payment
```
1. Enter Stripe test card: 4242 4242 4242 4242
2. Expiry: 12/34
3. CVC: 123
4. ZIP: 12345
5. Tap "Pay $4.99"
```

**Expected Result**:
- ✅ Payment processing indicator shown
- ✅ Payment succeeds
- ✅ Success message displayed
- ✅ Navigates back to home screen
- ✅ Tier badge shows "Premium"
- ✅ Can now add unlimited subscriptions

**Database Verification**:
```sql
-- Check user subscription
SELECT * FROM public.user_subscriptions 
WHERE user_id = 'USER_ID_HERE';

-- Expected:
-- tier_id: 'premium'
-- status: 'active'
-- billing_cycle: 'monthly'
-- stripe_customer_id: 'cus_...'
-- stripe_subscription_id: 'sub_...'
-- current_period_start: <timestamp>
-- current_period_end: <timestamp +1 month>

-- Check payment transaction
SELECT * FROM public.payment_transactions 
WHERE user_subscription_id = (
  SELECT id FROM public.user_subscriptions WHERE user_id = 'USER_ID_HERE'
)
ORDER BY created_at DESC 
LIMIT 1;

-- Expected:
-- amount: 4.99
-- currency: 'usd'
-- status: 'succeeded'
-- stripe_payment_intent_id: 'pi_...'
```

#### Step 7: Verify Webhook Processing
**Check Stripe Dashboard**:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find recent events
3. Verify these events were sent:
   - `customer.created`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`

**Database Verification**:
```sql
SELECT * FROM public.stripe_webhooks 
WHERE event_data->>'customer' LIKE '%cus_...%'
ORDER BY created_at DESC 
LIMIT 5;

-- All webhooks should have:
-- processing_status: 'processed'
-- error_message: NULL
-- processed_at: <timestamp>
```

#### Step 8: Add Unlimited Subscriptions
```
1. Add subscription 6: "Hulu - $6.99/month"
2. Add subscription 7: "YouTube Premium - $11.99/month"
3. Add subscription 8: "HBO Max - $14.99/month"
```

**Expected Result**:
- ✅ All subscriptions added without paywall
- ✅ Total count now 8 subscriptions
- ✅ No limit warnings

**Success Criteria**:
- [x] User upgraded from free to premium
- [x] Payment processed successfully
- [x] Database reflects premium status
- [x] Webhooks processed correctly
- [x] Unlimited subscriptions work
- [x] Analytics events tracked

---

### Flow 2: Subscription Limit Enforcement

**Objective**: Verify limit enforcement at exactly 5 subscriptions for free tier.

#### Test Case 2.1: At Limit (5/5)
```
Precondition: Free user with exactly 5 subscriptions
Action: Try to add 6th subscription
```

**Expected Result**:
- ✅ Paywall appears immediately
- ✅ Shows "5 of 5 subscriptions used"
- ✅ Add button blocked
- ✅ Upgrade prompt shown

#### Test Case 2.2: Premium User (Unlimited)
```
Precondition: Premium user with any number of subscriptions
Action: Add subscription
```

**Expected Result**:
- ✅ No paywall shown
- ✅ Subscription added successfully
- ✅ No limit indicators

#### Test Case 2.3: Downgrade with >5 Subscriptions
```
Precondition: Premium user with 8 subscriptions
Action: Cancel premium, wait for period end, downgrade to free
```

**Expected Result**:
- ✅ All 8 subscriptions remain visible
- ✅ Can view/edit/delete existing subscriptions
- ✅ Cannot add new subscriptions
- ✅ Paywall shows when attempting to add
- ✅ Must delete to 4 or fewer to add new

**Database Verification**:
```sql
-- After downgrade
SELECT tier_id, status FROM public.user_subscriptions 
WHERE user_id = 'USER_ID_HERE';
-- Expected: tier_id='free', status='active'

SELECT COUNT(*) FROM public.subscriptions 
WHERE user_id = 'USER_ID_HERE';
-- Expected: 8 (all subscriptions preserved)
```

---

### Flow 3: Payment Processing (Success and Failure)

#### Test Case 3.1: Successful Payment
```
Card: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
```

**Expected Result**:
- ✅ Payment succeeds
- ✅ User upgraded immediately
- ✅ Success message shown
- ✅ Transaction recorded

#### Test Case 3.2: Card Declined
```
Card: 4000 0000 0000 0002 (Stripe test card for decline)
Expiry: 12/34
CVC: 123
```

**Expected Result**:
- ✅ Payment fails
- ✅ Error message: "Your card was declined"
- ✅ User remains on free tier
- ✅ Can retry payment
- ✅ Transaction recorded as 'failed'

**Database Verification**:
```sql
SELECT status, failure_reason FROM public.payment_transactions 
WHERE stripe_payment_intent_id = 'pi_...'
AND status = 'failed';

-- Expected:
-- status: 'failed'
-- failure_reason: 'card_declined' or similar
```

#### Test Case 3.3: Insufficient Funds
```
Card: 4000 0000 0000 9995 (Stripe test card for insufficient funds)
```

**Expected Result**:
- ✅ Payment fails
- ✅ Error message: "Insufficient funds"
- ✅ User can try different payment method

#### Test Case 3.4: 3D Secure Authentication
```
Card: 4000 0027 6000 3184 (Stripe test card requiring 3DS)
```

**Expected Result**:
- ✅ 3D Secure modal appears
- ✅ User completes authentication
- ✅ Payment succeeds after auth
- ✅ User upgraded

---

### Flow 4: Cancellation and Refund

#### Test Case 4.1: Cancel Subscription (End of Period)
```
Precondition: Active premium monthly subscription
Action: 
1. Go to Subscription Management
2. Tap "Cancel Subscription"
3. Select "Cancel at end of period"
4. Confirm
```

**Expected Result**:
- ✅ Cancellation confirmed
- ✅ Subscription remains active until period end
- ✅ UI shows "Cancels on [date]"
- ✅ Access to premium features maintained

**Database Verification**:
```sql
SELECT 
  status, 
  cancel_at_period_end, 
  canceled_at, 
  current_period_end 
FROM public.user_subscriptions 
WHERE user_id = 'USER_ID_HERE';

-- Expected:
-- status: 'active'
-- cancel_at_period_end: true
-- canceled_at: <timestamp>
-- current_period_end: <future date>
```

#### Test Case 4.2: Request Refund (Within 7 Days)
```
Precondition: Payment made < 7 days ago
Action:
1. Go to Billing History
2. Select recent transaction
3. Tap "Request Refund"
4. Enter reason: "Changed my mind"
5. Submit
```

**Expected Result**:
- ✅ Refund request submitted
- ✅ Confirmation message shown
- ✅ Refund processed automatically (test mode)
- ✅ User downgraded to free tier

**Database Verification**:
```sql
-- Check refund request
SELECT * FROM public.refund_requests 
WHERE user_subscription_id = (
  SELECT id FROM public.user_subscriptions WHERE user_id = 'USER_ID_HERE'
)
ORDER BY requested_at DESC 
LIMIT 1;

-- Expected:
-- status: 'processed'
-- stripe_refund_id: 're_...'
-- refund_amount: 4.99 (or 39.00 for annual)

-- Check transaction updated
SELECT status FROM public.payment_transactions 
WHERE id = <transaction_id>;
-- Expected: status = 'refunded'
```

#### Test Case 4.3: Request Refund (After 7 Days)
```
Precondition: Payment made > 7 days ago
Action: Attempt to request refund
```

**Expected Result**:
- ✅ Refund button disabled or shows "Ineligible"
- ✅ Message: "Refunds are only available within 7 days"
- ✅ No refund request created

---

### Flow 5: Subscription Management

#### Test Case 5.1: View Billing History
```
Precondition: Premium user with multiple payments
Action: Navigate to Billing History
```

**Expected Result**:
- ✅ List of all transactions shown
- ✅ Each shows: date, amount, status
- ✅ Most recent first
- ✅ Can filter by status

#### Test Case 5.2: Update Payment Method
```
Precondition: Active premium subscription
Action:
1. Go to Subscription Management
2. Tap "Update Payment Method"
3. Enter new card: 5555 5555 5555 4444
4. Save
```

**Expected Result**:
- ✅ Payment method updated in Stripe
- ✅ Success message shown
- ✅ Next billing uses new card
- ✅ No interruption to service

#### Test Case 5.3: Access Billing Portal
```
Action:
1. Go to Subscription Management
2. Tap "Manage in Stripe"
```

**Expected Result**:
- ✅ Stripe Billing Portal opens
- ✅ Can view invoices
- ✅ Can update payment method
- ✅ Can view billing history

---

## Testing Checklists

### Pre-Test Setup Checklist

**Environment Setup**:
- [ ] Database migrations applied
- [ ] All tables exist
- [ ] RLS policies active
- [ ] Database functions created
- [ ] Triggers active

**Stripe Setup**:
- [ ] Test mode enabled
- [ ] Products created (Premium)
- [ ] Prices created (Monthly: $4.99, Annual: $39.00)
- [ ] Webhook endpoint configured
- [ ] Webhook secret set in Edge Function
- [ ] Test cards available

**Edge Functions**:
- [ ] All 5 functions deployed
- [ ] Environment secrets set
- [ ] Webhook endpoint accessible
- [ ] CORS configured

**App Configuration**:
- [ ] Stripe publishable key set
- [ ] Supabase URL/key set
- [ ] App builds successfully
- [ ] Can run on simulator/device

### Post-Test Verification Checklist

**Database**:
- [ ] No orphaned records
- [ ] All foreign keys valid
- [ ] Timestamps accurate
- [ ] No null required fields

**Analytics**:
- [ ] All events tracked
- [ ] Event data accurate
- [ ] No duplicate events
- [ ] Timestamps correct

**Stripe**:
- [ ] All webhooks processed
- [ ] No failed webhooks
- [ ] Customer created
- [ ] Subscription created
- [ ] Payments recorded

**User Experience**:
- [ ] No crashes
- [ ] No UI glitches
- [ ] Loading states shown
- [ ] Error messages clear
- [ ] Success messages shown

---

## Database Verification

### Quick Verification Queries

```sql
-- 1. Check tier configuration
SELECT * FROM public.subscription_tiers ORDER BY display_order;

-- 2. Check user subscription status
SELECT 
  u.email,
  us.tier_id,
  us.status,
  us.billing_cycle,
  us.current_period_end,
  us.cancel_at_period_end
FROM public.user_subscriptions us
JOIN auth.users u ON us.user_id = u.id
WHERE u.email = 'test@example.com';

-- 3. Check subscription count
SELECT 
  us.tier_id,
  COUNT(s.*) as subscription_count
FROM public.user_subscriptions us
LEFT JOIN public.subscriptions s ON s.user_id = us.user_id
WHERE us.user_id = 'USER_ID_HERE'
GROUP BY us.tier_id;

-- 4. Check recent payments
SELECT 
  pt.created_at,
  pt.amount,
  pt.status,
  pt.stripe_payment_intent_id
FROM public.payment_transactions pt
JOIN public.user_subscriptions us ON pt.user_subscription_id = us.id
WHERE us.user_id = 'USER_ID_HERE'
ORDER BY pt.created_at DESC
LIMIT 5;

-- 5. Check webhook processing
SELECT 
  event_type,
  processing_status,
  created_at,
  processed_at,
  error_message
FROM public.stripe_webhooks
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check analytics events
SELECT 
  event_type,
  event_context,
  event_data,
  created_at
FROM public.usage_tracking_events
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check refund requests
SELECT 
  rr.reason,
  rr.status,
  rr.refund_amount,
  rr.requested_at,
  rr.processed_at
FROM public.refund_requests rr
JOIN public.user_subscriptions us ON rr.user_subscription_id = us.id
WHERE us.user_id = 'USER_ID_HERE';
```

---

## Stripe Dashboard Verification

### What to Check in Stripe Dashboard

**1. Customers**:
- Navigate to: Customers
- Verify: New customer created with correct email
- Check: Metadata contains Supabase user ID
- Confirm: Default payment method set

**2. Subscriptions**:
- Navigate to: Subscriptions
- Verify: Active subscription listed
- Check: Correct price ($4.99 or $39.00)
- Confirm: Next billing date correct

**3. Payments**:
- Navigate to: Payments
- Verify: Payment succeeded
- Check: Amount matches plan
- Confirm: Receipt sent to customer

**4. Webhooks**:
- Navigate to: Developers → Webhooks
- Check: Endpoint responding (200 OK)
- Verify: Recent events processed
- Confirm: No failed webhook deliveries

**5. Events**:
- Navigate to: Developers → Events
- Search for customer ID
- Verify events in sequence:
  1. `customer.created`
  2. `customer.subscription.created`
  3. `invoice.payment_succeeded`
  4. `payment_intent.succeeded`

---

## Common Issues and Solutions

### Issue 1: Paywall Not Appearing

**Symptoms**:
- User can add >5 subscriptions on free tier
- No paywall modal shown

**Diagnosis**:
```sql
-- Check user tier
SELECT tier_id, status FROM public.user_subscriptions WHERE user_id = 'USER_ID';

-- Check subscription count
SELECT COUNT(*) FROM public.subscriptions WHERE user_id = 'USER_ID';

-- Test limit function
SELECT * FROM can_user_add_subscription('USER_ID');
```

**Solutions**:
1. Verify database function exists: `can_user_add_subscription`
2. Check RLS policies are enabled
3. Verify limit check is called before navigation
4. Check cache isn't serving stale data

### Issue 2: Payment Fails Silently

**Symptoms**:
- Payment processing never completes
- No error message shown
- User stuck on payment screen

**Diagnosis**:
- Check browser/app console for errors
- Verify Stripe publishable key is correct
- Check Edge Function logs

**Solutions**:
1. Ensure Stripe provider wraps app in `App.tsx`
2. Verify publishable key matches environment
3. Check network connectivity
4. Review Edge Function logs for errors

### Issue 3: Webhooks Not Processing

**Symptoms**:
- Payment succeeds in Stripe
- User subscription not updated in database
- Tier remains 'free' after payment

**Diagnosis**:
```sql
-- Check webhook logs
SELECT * FROM public.stripe_webhooks 
WHERE processing_status = 'failed' 
ORDER BY created_at DESC;
```

**Solutions**:
1. Verify webhook secret in Edge Function env
2. Check Edge Function is deployed
3. Verify webhook endpoint URL is correct
4. Test webhook signature verification
5. Review Edge Function logs

### Issue 4: User Stuck in Grace Period

**Symptoms**:
- Subscription shows 'past_due'
- User has Premium access but shouldn't

**Diagnosis**:
```sql
SELECT 
  status,
  current_period_end,
  tier_id
FROM public.user_subscriptions 
WHERE user_id = 'USER_ID';
```

**Solutions**:
1. Check Stripe subscription status
2. Manually trigger webhook event
3. Run reconciliation script
4. Update subscription status manually if needed

### Issue 5: Refund Not Processing

**Symptoms**:
- Refund request submitted
- Status stuck in 'pending'
- User not downgraded

**Diagnosis**:
```sql
SELECT * FROM public.refund_requests 
WHERE status = 'pending' 
AND requested_at < NOW() - INTERVAL '1 hour';
```

**Solutions**:
1. Check Edge Function logs for errors
2. Verify Stripe API keys have refund permissions
3. Check payment is eligible for refund
4. Manually process in Stripe Dashboard if needed

---

## Performance Benchmarks

### Target Performance

| Operation | Target | Acceptable | Poor |
|-----------|--------|------------|------|
| Limit Check | <200ms | <500ms | >500ms |
| Payment Init | <1s | <2s | >2s |
| Payment Complete | <3s | <5s | >5s |
| Webhook Process | <3s | <5s | >5s |
| Page Load | <1s | <2s | >2s |

### Performance Testing

```typescript
// Test limit check performance
const start = Date.now();
const result = await subscriptionLimitService.checkCanAddSubscription();
const duration = Date.now() - start;
console.log(`Limit check: ${duration}ms`);

// Should be < 200ms
```

---

## Test Data Cleanup

After testing, clean up test data:

```sql
-- WARNING: Only run in development/staging!

-- Delete test user subscriptions
DELETE FROM public.subscriptions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

-- Delete test transactions
DELETE FROM public.payment_transactions WHERE user_subscription_id IN (
  SELECT id FROM public.user_subscriptions WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
  )
);

-- Delete test user subscriptions
DELETE FROM public.user_subscriptions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'test-%@example.com'
);

-- Delete test users
DELETE FROM auth.users WHERE email LIKE 'test-%@example.com';
```

Or use the cleanup script:
```bash
npm run cleanup-test-data
```

---

**End of Integration Testing Guide**