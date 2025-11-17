# Edge Cases Documentation - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Overview](#overview)
2. [Subscription Management Edge Cases](#subscription-management-edge-cases)
3. [Payment Processing Edge Cases](#payment-processing-edge-cases)
4. [Tier Management Edge Cases](#tier-management-edge-cases)
5. [Webhook Processing Edge Cases](#webhook-processing-edge-cases)
6. [Race Condition Scenarios](#race-condition-scenarios)
7. [Data Consistency Edge Cases](#data-consistency-edge-cases)
8. [User Behavior Edge Cases](#user-behavior-edge-cases)

---

## Overview

This document catalogs edge cases in the paywall system and how they are handled. Each edge case includes:
- **Scenario**: What triggers the edge case
- **Expected Behavior**: How the system should respond
- **Implementation**: How it's handled in code
- **Testing**: How to reproduce and test

---

## Subscription Management Edge Cases

### EC-SM-001: User Has >5 Subscriptions When Downgrading

**Scenario**: Premium user with 8 subscriptions cancels and downgrades to free tier.

**Expected Behavior**:
- All 8 subscriptions remain visible
- User can view, edit, and delete existing subscriptions
- User cannot add new subscriptions until count ≤ 4
- Paywall appears when attempting to add new subscription
- Clear message: "Delete some subscriptions to add more"

**Implementation**:
```typescript
// services/subscriptionLimitService.ts
async checkCanAddSubscription(): Promise<{canAdd: boolean}> {
  const { currentCount, limit, tier } = await this.getStatus();
  
  // Premium users can always add
  if (tier === 'premium') {
    return { canAdd: true };
  }
  
  // Free users: check limit
  // Allow if count < limit (not <=, must have room)
  return { 
    canAdd: currentCount < limit,
    reason: currentCount >= limit 
      ? `You have ${currentCount} subscriptions. Delete some to add more.`
      : undefined
  };
}
```

**Testing**:
```typescript
// Test scenario
test('user with >5 subs after downgrade cannot add', async () => {
  // Setup: User with 8 subscriptions, downgraded to free
  await createUserWithSubscriptions(8);
  await downgradeTo

Free();
  
  // Attempt to add
  const result = await subscriptionLimitService.checkCanAddSubscription();
  
  expect(result.canAdd).toBe(false);
  expect(result.currentCount).toBe(8);
  expect(result.limit).toBe(5);
});
```

**Database State**:
```sql
-- User has more subscriptions than free tier allows
SELECT 
  tier_id,
  COUNT(s.id) as subscription_count
FROM user_subscriptions us
LEFT JOIN subscriptions s ON s.user_id = us.user_id
WHERE us.user_id = 'USER_ID'
GROUP BY tier_id;

-- Expected result: tier_id='free', subscription_count=8
```

---

### EC-SM-002: User Cancels and Immediately Re-subscribes

**Scenario**: User cancels premium subscription, then immediately upgrades again.

**Expected Behavior**:
- Cancel the previous subscription in Stripe
- Create new subscription
- No gap in premium access
- Old subscription marked as canceled
- New subscription becomes active

**Implementation**:
```typescript
// services/paymentService.ts
async upgradeToPremi um(plan: 'monthly' | 'annual') {
  const currentSub = await this.getCurrentSubscription();
  
  if (currentSub?.stripe_subscription_id) {
    // Cancel existing Stripe subscription
    await stripe.subscriptions.cancel(currentSub.stripe_subscription_id);
  }
  
  // Create new subscription
  const newSubscription = await this.createSubscription(plan);
  
  // Update database atomically
  await supabase.rpc('replace_subscription', {
    user_id: userId,
    old_subscription_id: currentSub?.id,
    new_subscription_id: newSubscription.id
  });
}
```

**Testing**:
```sql
-- Should have only one active premium subscription
SELECT COUNT(*) FROM user_subscriptions 
WHERE user_id = 'USER_ID' 
  AND status = 'active' 
  AND tier_id = 'premium';
-- Expected: 1
```

---

### EC-SM-003: Multiple Active Subscriptions in Stripe

**Scenario**: User somehow has multiple active subscriptions in Stripe (data inconsistency).

**Expected Behavior**:
- Use the most recent subscription
- Cancel older subscriptions
- Log warning for investigation
- Update database to match Stripe

**Implementation**:
```typescript
// supabase/functions/stripe-webhook/index.ts
async function reconcileMultipleSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active'
  });
  
  if (subscriptions.data.length > 1) {
    console.warn(`Multiple active subscriptions for customer ${customerId}`);
    
    // Sort by created date, keep newest
    const sorted = subscriptions.data.sort((a, b) => b.created - a.created);
    const [keep, ...cancel] = sorted;
    
    // Cancel older subscriptions
    for (const sub of cancel) {
      await stripe.subscriptions.cancel(sub.id);
      console.log(`Canceled duplicate subscription: ${sub.id}`);
    }
    
    // Update database to use newest
    await supabase
      .from('user_subscriptions')
      .update({ stripe_subscription_id: keep.id })
      .eq('stripe_customer_id', customerId);
  }
}
```

---

### EC-SM-004: User at 5/5 During Grace Period

**Scenario**: Free user at 5/5 limit attempts to add during payment grace period.

**Expected Behavior**:
- User is still blocked from adding
- Payment hasn't completed yet, so still on free tier
- Must complete payment to unlock unlimited
- Paywall shows "Complete your payment to add more"

**Implementation**:
```typescript
// Check actual tier status, not payment status
async checkCanAddSubscription() {
  const { data } = await supabase
    .from('user_subscriptions')
    .select('tier_id, status')
    .eq('user_id', userId)
    .single();
  
  // Only 'premium' tier with 'active' status gets unlimited
  if (data.tier_id === 'premium' && data.status === 'active') {
    return { canAdd: true };
  }
  
  // All other states check limit
  return this.checkLimit();
}
```

---

## Payment Processing Edge Cases

### EC-PP-001: Webhook Arrives Before Payment Confirmation

**Scenario**: Stripe webhook for `invoice.payment_succeeded` arrives before mobile app receives payment confirmation.

**Expected Behavior**:
- Webhook updates database first
- App receives success response
- App refreshes subscription status
- User sees upgrade immediately
- No race condition

**Implementation**:
```typescript
// Webhook handler (runs first)
async function handlePaymentSucceeded(event) {
  await supabase
    .from('user_subscriptions')
    .update({
      tier_id: 'premium',
      status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', event.data.object.subscription);
}

// App payment confirmation (runs second)
async function confirmPayment(paymentIntentId) {
  const { error } = await stripe.confirmPayment(clientSecret);
  
  if (!error) {
    // Refresh subscription from database
    // This will get the webhook-updated data
    await subscriptionTierService.refreshUserSubscription();
  }
}
```

---

### EC-PP-002: Payment Succeeds But Webhook Fails

**Scenario**: Payment is successful in Stripe, but webhook delivery fails.

**Expected Behavior**:
- Stripe retries webhook automatically (up to 3 days)
- Database eventually gets updated via retry
- If all retries fail, manual reconciliation detects issue
- User gets access once webhook succeeds

**Implementation**:
```typescript
// Webhook idempotency ensures safe retries
async function processWebhook(event) {
  // Check if already processed
  const { data: existing } = await supabase
    .from('stripe_webhooks')
    .select('id')
    .eq('event_id', event.id)
    .single();
  
  if (existing) {
    console.log('Event already processed:', event.id);
    return { status: 'already_processed' };
  }
  
  // Process and mark as processed
  await processEvent(event);
  
  await supabase
    .from('stripe_webhooks')
    .insert({
      event_id: event.id,
      event_type: event.type,
      processing_status: 'processed'
    });
}
```

**Manual Reconciliation**:
```typescript
// Run daily to catch missed webhooks
async function reconcileSubscriptions() {
  const { data: users } = await supabase
    .from('user_subscriptions')
    .select('*')
    .not('stripe_subscription_id', 'is', null);
  
  for (const user of users) {
    const stripeSub = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id
    );
    
    // Check if database status matches Stripe
    if (stripeSub.status !== user.status) {
      console.warn('Status mismatch:', user.user_id);
      
      // Update to match Stripe (source of truth)
      await supabase
        .from('user_subscriptions')
        .update({ status: stripeSub.status })
        .eq('id', user.id);
    }
  }
}
```

---

### EC-PP-003: User Closes App During Payment

**Scenario**: User initiates payment, then closes app before completion.

**Expected Behavior**:
- Payment continues processing in Stripe
- Webhook updates database when payment completes
- When user reopens app, they see upgraded status
- No lost payment

**Implementation**:
```typescript
// Payment is processed server-side
// App closure doesn't affect it

// On app relaunch
useEffect(() => {
  async function checkPendingPayment() {
    const lastPaymentIntent = await storage.get('pending_payment_intent');
    
    if (lastPaymentIntent) {
      // Check payment status
      const status = await paymentService.checkPaymentStatus(lastPaymentIntent);
      
      if (status === 'succeeded') {
        // Payment completed while app was closed
        await subscriptionTierService.refreshUserSubscription();
        await storage.remove('pending_payment_intent');
        
        // Show success message
        Alert.alert('Payment Successful', 'You now have Premium access!');
      }
    }
  }
  
  checkPendingPayment();
}, []);
```

---

### EC-PP-004: Multiple Payments in Quick Succession

**Scenario**: User rapidly taps "Pay" button multiple times.

**Expected Behavior**:
- Only one payment is processed
- Subsequent attempts are ignored
- Idempotency key prevents duplicates
- User is not charged multiple times

**Implementation**:
```typescript
// Disable button during processing
const [isProcessing, setIsProcessing] = useState(false);

async function handlePayment() {
  if (isProcessing) return; // Prevent double-tap
  
  setIsProcessing(true);
  
  try {
    // Use idempotency key
    const idempotencyKey = `payment_${userId}_${Date.now()}`;
    
    await stripe.confirmPayment(clientSecret, {
      idempotency_key: idempotencyKey
    });
  } finally {
    setIsProcessing(false);
  }
}

// Button disabled during processing
<Button 
  onPress={handlePayment} 
  disabled={isProcessing}
  title={isProcessing ? 'Processing...' : 'Pay $4.99'}
/>
```

---

## Tier Management Edge Cases

### EC-TM-001: Grace Period Ends While User is Offline

**Scenario**: User's payment fails, grace period expires while device is offline.

**Expected Behavior**:
- Server-side job downgrades user to free tier
- When user comes online, app syncs new tier status
- User sees downgrade message
- Existing subscriptions preserved (if >5)

**Implementation**:
```sql
-- Database trigger to auto-downgrade after grace period
CREATE OR REPLACE FUNCTION auto_downgrade_expired_grace_period()
RETURNS void AS $$
BEGIN
  UPDATE user_subscriptions
  SET 
    tier_id = 'free',
    status = 'active',
    billing_cycle = 'none',
    stripe_subscription_id = NULL
  WHERE 
    status = 'past_due'
    AND current_period_end < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql;

-- Scheduled job (run hourly)
SELECT cron.schedule(
  'downgrade-expired-grace-periods',
  '0 * * * *', -- Every hour
  $$SELECT auto_downgrade_expired_grace_period()$$
);
```

---

### EC-TM-002: User Switches Between Monthly and Annual

**Scenario**: User on monthly plan wants to switch to annual.

**Expected Behavior**:
- Cancel monthly subscription
- Create annual subscription
- Prorate unused time from monthly
- Seamless transition, no service interruption

**Implementation**:
```typescript
async function switchPlan(newPlan: 'monthly' | 'annual') {
  const currentSub = await getCurrentSubscription();
  
  // Update existing subscription in Stripe
  const updated = await stripe.subscriptions.update(
    currentSub.stripe_subscription_id,
    {
      items: [{
        id: currentSub.items.data[0].id,
        price: STRIPE_PRICES[newPlan]
      }],
      proration_behavior: 'create_prorations' // Prorate the difference
    }
  );
  
  // Database updated via webhook
}
```

---

### EC-TM-003: Premium Subscription Expires Exactly at Midnight

**Scenario**: Subscription period ends at 2025-12-01 00:00:00 UTC.

**Expected Behavior**:
- User retains access until exact expiration time
- Automatic downgrade happens server-side
- No manual intervention needed
- Graceful transition

**Implementation**:
```sql
-- Check if user has active premium at current moment
CREATE OR REPLACE FUNCTION is_premium_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = p_user_id
      AND tier_id = 'premium'
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql;
```

---

## Webhook Processing Edge Cases

### EC-WH-001: Webhook Arrives Out of Order

**Scenario**: `subscription.updated` webhook arrives before `subscription.created`.

**Expected Behavior**:
- System handles out-of-order events gracefully
- Uses event timestamps to determine sequence
- Applies most recent state
- Doesn't corrupt data

**Implementation**:
```typescript
async function processWebhook(event) {
  // Check if a newer event was already processed
  const { data: laterEvents } = await supabase
    .from('stripe_webhooks')
    .select('created_at')
    .eq('event_data->>object->>id', event.data.object.id)
    .gt('created_at', new Date(event.created * 1000).toISOString())
    .eq('processing_status', 'processed');
  
  if (laterEvents && laterEvents.length > 0) {
    console.log('Skipping out-of-order event:', event.id);
    return { status: 'ignored_outdated' };
  }
  
  // Process event normally
  await handleEvent(event);
}
```

---

### EC-WH-002: Duplicate Webhook Delivery

**Scenario**: Stripe sends same webhook event multiple times.

**Expected Behavior**:
- First occurrence is processed
- Subsequent occurrences are ignored
- No duplicate database updates
- Idempotent processing

**Implementation**:
```typescript
// Already implemented in processWebhook function
const { data: existing } = await supabase
  .from('stripe_webhooks')
  .select('id')
  .eq('event_id', event.id)
  .single();

if (existing) {
  // Already processed, return success
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

---

### EC-WH-003: Webhook for Deleted User

**Scenario**: Webhook arrives for a user who has deleted their account.

**Expected Behavior**:
- Log the event
- Don't fail the webhook
- Don't try to update non-existent user
- Return 200 OK to Stripe

**Implementation**:
```typescript
async function handleSubscriptionUpdate(event) {
  const subscription = event.data.object;
  
  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single();
  
  if (!user) {
    console.log('Webhook for non-existent user, likely deleted');
    
    // Log it but don't fail
    await supabase.from('stripe_webhooks').insert({
      event_id: event.id,
      event_type: event.type,
      processing_status: 'ignored',
      error_message: 'User not found, likely deleted'
    });
    
    return { status: 'user_not_found' };
  }
  
  // Process normally
  await updateSubscription(user.user_id, subscription);
}
```

---

## Race Condition Scenarios

### EC-RC-001: Simultaneous Subscription Additions

**Scenario**: User has 4 subscriptions, opens app on two devices, tries to add on both.

**Expected Behavior**:
- First addition succeeds (5/5)
- Second addition is blocked (already at limit)
- Database transaction ensures consistency
- No corruption

**Implementation**:
```sql
-- Use database transaction with row locking
BEGIN;

-- Lock the user's subscription row
SELECT * FROM user_subscriptions 
WHERE user_id = 'USER_ID' 
FOR UPDATE;

-- Check current count within transaction
SELECT COUNT(*) FROM subscriptions WHERE user_id = 'USER_ID';

-- Add only if under limit
INSERT INTO subscriptions (...) 
  SELECT ... 
  WHERE (SELECT COUNT(*) FROM subscriptions WHERE user_id = 'USER_ID') < 5;

COMMIT;
```

---

### EC-RC-002: Payment and Cancellation Simultaneously

**Scenario**: User initiates payment on device A, cancels subscription on device B at same moment.

**Expected Behavior**:
- One operation wins based on Stripe's state
- Webhook reconciles final state
- No mixed state
- User is charged or not charged consistently

**Implementation**:
```typescript
// Both operations go through Stripe (single source of truth)
// Stripe handles the race condition internally
// Our webhook handler applies final state

async function handleWebhook(event) {
  // Always trust Stripe's state
  const latestState = event.data.object;
  
  await supabase
    .from('user_subscriptions')
    .update({
      status: latestState.status,
      tier_id: latestState.status === 'active' ? 'premium' : 'free'
    })
    .eq('stripe_subscription_id', latestState.id);
}
```

---

## Data Consistency Edge Cases

### EC-DC-001: Database Out of Sync with Stripe

**Scenario**: Database shows user as free, Stripe shows active premium subscription.

**Expected Behavior**:
- Reconciliation job detects mismatch
- Stripe is source of truth
- Database updated to match Stripe
- User gets correct access

**Implementation**:
```typescript
// Daily reconciliation job
async function reconcileAllSubscriptions() {
  const { data: users } = await supabase
    .from('user_subscriptions')
    .select('*')
    .not('stripe_subscription_id', 'is', null);
  
  for (const user of users) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(
        user.stripe_subscription_id
      );
      
      // Compare states
      const needsUpdate = 
        stripeSub.status !== user.status ||
        stripeSub.current_period_end !== user.current_period_end;
      
      if (needsUpdate) {
        console.warn('Reconciling user:', user.user_id);
        
        await supabase
          .from('user_subscriptions')
          .update({
            status: stripeSub.status,
            tier_id: stripeSub.status === 'active' ? 'premium' : 'free',
            current_period_end: new Date(stripeSub.current_period_end * 1000)
          })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Reconciliation failed for:', user.user_id, error);
    }
  }
}
```

---

## User Behavior Edge Cases

### EC-UB-001: User Requests Refund on Day 7

**Scenario**: User requests refund exactly 7 days (168 hours) after payment.

**Expected Behavior**:
- If within 7 * 24 hours, refund approved
- If even 1 minute over, refund denied
- Clear communication to user
- Exact time calculation

**Implementation**:
```typescript
async function checkRefundEligibility(transactionId: string) {
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('created_at, amount')
    .eq('id', transactionId)
    .single();
  
  const hoursSincePayment = 
    (Date.now() - new Date(transaction.created_at).getTime()) / (1000 * 60 * 60);
  
  const REFUND_WINDOW_HOURS = 7 * 24; // Exactly 7 days
  
  return {
    eligible: hoursSincePayment <= REFUND_WINDOW_HOURS,
    hoursRemaining: Math.max(0, REFUND_WINDOW_HOURS - hoursSincePayment),
    amount: transaction.amount
  };
}
```

---

### EC-UB-002: User Deletes Account with Active Subscription

**Scenario**: Premium user requests account deletion.

**Expected Behavior**:
- Warn user they have active subscription
- Offer to cancel subscription first
- If they proceed, cancel Stripe subscription
- Delete all user data
- Refund not automatic (unless within 7 days)

**Implementation**:
```typescript
async function deleteAccount(userId: string) {
  // Check for active subscription
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (subscription?.stripe_subscription_id) {
    // Cancel in Stripe
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
  }
  
  // Delete user data (cascades to all tables)
  await supabase.auth.admin.deleteUser(userId);
}
```

---

### EC-UB-003: User Tries to "Game" Free Trial

**Scenario**: User creates multiple accounts to get multiple free tiers.

**Expected Behavior**:
- Each account independent (allowed)
- No automatic fraud detection (not implemented)
- Rate limiting on account creation prevents abuse
- Future: Could track by device/payment method

**Implementation**:
```typescript
// Rate limiting on signup (optional)
const signupLimiter = new RateLimiter({
  max: 3, // 3 signups
  window: 24 * 60 * 60 * 1000 // per 24 hours
});

async function signup(email: string, ip: string) {
  const limited = await signupLimiter.check(ip);
  
  if (limited) {
    throw new Error('Too many signups from this IP. Please try again later.');
  }
  
  // Proceed with signup
}
```

---

## Testing Edge Cases

### Test Checklist

Each edge case should have:
- [ ] Unit test
- [ ] Integration test
- [ ] Manual test procedure
- [ ] Expected behavior documented
- [ ] Logging for detection

### Example Test

```typescript
describe('Edge Case: User >5 subs after downgrade', () => {
  it('prevents adding new subscription', async () => {
    // Setup
    const user = await createTestUser();
    await createSubscriptions(user.id, 8);
    await upgradeToPremium(user.id);
    await downgradeToFree(user.id);
    
    // Test
    const canAdd = await subscriptionLimitService.checkCanAddSubscription();
    
    // Assert
    expect(canAdd.allowed).toBe(false);
    expect(canAdd.currentCount).toBe(8);
    expect(canAdd.limit).toBe(5);
  });
  
  it('allows adding after deleting to <5', async () => {
    // Setup (from previous test state)
    await deleteSubscriptions(user.id, 4); // Delete 4, leaving 4
    
    // Test
    const canAdd = await subscriptionLimitService.checkCanAddSubscription();
    
    // Assert
    expect(canAdd.allowed).toBe(true);
    expect(canAdd.currentCount).toBe(4);
  });
});
```

---

**End of Edge Cases Documentation**