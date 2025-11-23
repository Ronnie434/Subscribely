# Billing Cycle Switching Implementation

## Overview

This document explains how billing cycle switching (monthly ↔ yearly) is handled in the Smart Subscription Tracker app, including payment processing, proration, and database synchronization.

## The Problem (Before Fix)

Previously, the app only updated the local database when users switched billing cycles:
- ❌ Stripe subscription was never updated
- ❌ No payment was charged for the switch
- ❌ Database and Stripe were out of sync
- ❌ Next renewal would charge old price and revert billing cycle

## The Solution (Current Implementation)

The billing cycle switch now properly integrates with Stripe to:
- ✅ Update Stripe subscription immediately
- ✅ Calculate and charge proration automatically
- ✅ Sync changes back to database via webhooks
- ✅ Maintain data consistency

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Billing Cycle Switch Flow                     │
└─────────────────────────────────────────────────────────────────┘

User (Mobile App)
    │
    │ 1. Clicks "Switch to Yearly"
    ↓
PaymentService.switchBillingCycle('yearly')
    │
    │ 2. Calls Edge Function
    ↓
switch-billing-cycle Edge Function
    │
    │ 3. Updates Stripe subscription
    │    - Changes price to yearly plan
    │    - Sets proration_behavior: 'always_invoice'
    │    - Maintains billing cycle anchor
    ↓
Stripe API
    │
    │ 4. Calculates proration
    │    - Credits unused monthly time
    │    - Charges for yearly subscription
    │    - Creates immediate invoice
    ├─────────────────────────┬──────────────────────────┐
    ↓                         ↓                          ↓
Charges User          Fires Webhooks             Returns Response
    │                         │                          │
    │                    ┌────┴────┐                    │
    │                    ↓         ↓                    │
    │         subscription.updated  invoice.payment_succeeded
    │                    │         │                    │
    │                    ↓         ↓                    │
    │         stripe-webhook Edge Function             │
    │                    │                              │
    │         Updates Database:                        │
    │         - billing_cycle                          │
    │         - stripe_price_id                        │
    │         - Records payment transaction            │
    │                    │                              │
    │                    ↓                              ↓
    └─────────────> User Sees Success Message
                   with proration amount
```

## Components

### 1. Edge Function: `switch-billing-cycle`

**Location:** `supabase/functions/switch-billing-cycle/index.ts`

**Purpose:** Handles the Stripe subscription update with proration

**Key Features:**
- Authenticates user via JWT
- Validates billing cycle input
- Retrieves current subscription
- Updates Stripe subscription with new price
- Applies proration immediately (`proration_behavior: 'always_invoice'`)
- Returns proration details to user

**Request:**
```json
{
  "newBillingCycle": "yearly" | "monthly"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_xxx",
    "newBillingCycle": "yearly",
    "prorationAmount": 36.50,
    "nextBillingDate": "2024-02-01T00:00:00Z",
    "message": "Billing cycle switched to yearly. You'll be charged $36.50 for the prorated difference."
  }
}
```

### 2. Client Service: `paymentService.switchBillingCycle()`

**Location:** `services/paymentService.ts`

**Purpose:** Client-side method to initiate billing cycle switch

**Key Changes:**
- Now calls edge function instead of updating database directly
- Returns proration information to UI
- Tracks usage event for analytics

**Before:**
```typescript
// ❌ Only updated local database
await supabase
  .from('user_subscriptions')
  .update({ billing_cycle: newCycle })
```

**After:**
```typescript
// ✅ Calls edge function for proper Stripe integration
const result = await this.callEdgeFunction('switch-billing-cycle', {
  newBillingCycle: newCycle,
});
```

### 3. Webhook Handler: `subscription.updated`

**Location:** `supabase/functions/stripe-webhook/index.ts`

**Purpose:** Syncs Stripe subscription changes to database

**Enhanced to Handle:**
- Billing cycle changes from metadata
- Price ID updates
- Period date updates
- Status changes

**Key Logic:**
```typescript
// Extract billing cycle from Stripe metadata
const billingCycleFromMetadata = subscription.metadata?.billing_cycle;
const dbBillingCycle = billingCycleFromMetadata === 'yearly' ? 'annual' : 'monthly';

// Update database if billing cycle changed
if (billingCycleFromMetadata && subRecord.billing_cycle !== dbBillingCycle) {
  updateData.billing_cycle = dbBillingCycle;
  updateData.stripe_price_id = priceId;
}
```

## Payment Flow Example

### Scenario: User switches from Monthly ($4.99) to Yearly ($39.00) on Day 15

**Step 1: User Initiates Switch**
```typescript
await paymentService.switchBillingCycle('yearly');
```

**Step 2: Edge Function Updates Stripe**
```typescript
// Stripe calculates proration
const updatedSubscription = await stripe.subscriptions.update(
  subscriptionId,
  {
    items: [{ id: itemId, price: yearlyPriceId }],
    proration_behavior: 'always_invoice',
    billing_cycle_anchor: 'unchanged',
  }
);
```

**Step 3: Stripe Charges User**
- Unused monthly time: 15 days × ($4.99 / 30 days) = $2.50 credit
- Yearly cost: $39.00
- **Immediate charge: $39.00 - $2.50 = $36.50**

**Step 4: Webhooks Fire**
- `customer.subscription.updated` → Updates billing cycle in database
- `invoice.payment_succeeded` → Records payment transaction

**Step 5: User Sees Confirmation**
```
✅ Billing cycle switched to yearly
You'll be charged $36.50 for the prorated difference.
Next billing date: Feb 1, 2024
```

## Proration Behavior

### How Stripe Calculates Proration

**Formula:**
```
Proration = (New Plan Cost) - (Unused Time Credit from Old Plan)
```

**Monthly to Yearly (Most Common):**
```
Days Remaining = (Period End - Now) days
Unused Credit = (Monthly Price / 30) × Days Remaining
Total Charge = Yearly Price - Unused Credit
```

**Yearly to Monthly (Rare):**
```
Days Remaining = (Period End - Now) days
Unused Credit = (Yearly Price / 365) × Days Remaining
Total Charge = Monthly Price - Unused Credit
```
*(Typically results in a credit for future billing)*

### Proration Behavior Options

The edge function uses `proration_behavior: 'always_invoice'`:

| Option | Behavior | When to Use |
|--------|----------|-------------|
| `always_invoice` | ✅ Creates immediate invoice | Billing cycle switches (recommended) |
| `create_prorations` | Creates prorations, bills at period end | Plan upgrades within same cycle |
| `none` | No proration, charges full amount | Free trials, promotions |

## Database Schema

### Updated Fields in `user_subscriptions`

```sql
-- Fields automatically synced by webhook
billing_cycle VARCHAR(10) -- 'monthly' or 'annual'
stripe_price_id TEXT      -- Updated to new price
current_period_end TIMESTAMP -- May change if anchor changes
updated_at TIMESTAMP      -- Tracks last sync
```

### Payment Transaction Record

```sql
-- Created by invoice.payment_succeeded webhook
INSERT INTO payment_transactions (
  user_subscription_id,
  stripe_payment_intent_id,
  stripe_invoice_id,
  amount,              -- Prorated amount charged
  currency,
  status,              -- 'succeeded'
  payment_method_type, -- 'card'
  metadata             -- Includes billing_reason: 'subscription_update'
)
```

## Error Handling

### Edge Function Errors

| Error | HTTP Code | Reason |
|-------|-----------|--------|
| Missing authorization | 401 | User not authenticated |
| Invalid billing cycle | 400 | Must be 'monthly' or 'yearly' |
| No active subscription | 404 | User doesn't have a subscription |
| Already on cycle | 400 | User already on requested cycle |
| Stripe card error | 402 | Payment failed (insufficient funds, etc.) |
| Invalid request | 400 | Stripe API validation error |

### Client-Side Handling

```typescript
try {
  const result = await paymentService.switchBillingCycle('yearly');
  
  showSuccess(result.message);
  showProrationInfo(result.prorationAmount);
  
} catch (error) {
  if (error.message.includes('payment failed')) {
    showPaymentError();
  } else if (error.message.includes('Already on')) {
    showAlreadyOnCycleError();
  } else {
    showGenericError();
  }
}
```

## Testing Checklist

### Unit Tests
- [ ] Edge function validates input
- [ ] Client service calls edge function
- [ ] Webhook handler updates billing cycle
- [ ] Webhook handler updates price ID

### Integration Tests
- [ ] Monthly → Yearly switch charges correct amount
- [ ] Yearly → Monthly switch applies credit
- [ ] Database syncs correctly after switch
- [ ] Payment transaction is recorded
- [ ] User can see updated billing cycle immediately

### Edge Cases
- [ ] User on last day of billing period
- [ ] User with failed payment method
- [ ] User switching multiple times rapidly
- [ ] Webhook arrives before edge function returns
- [ ] Network failure during switch

## Deployment

### Prerequisites

1. **Edge Functions Deployed:**
   ```bash
   supabase functions deploy switch-billing-cycle
   supabase functions deploy stripe-webhook
   ```

2. **Environment Variables Set:**
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   PROJECT_URL=https://xxx.supabase.co
   SERVICE_ROLE_KEY=xxx
   ```

3. **Stripe Webhook Configured:**
   - Add endpoint: `https://xxx.supabase.co/functions/v1/stripe-webhook`
   - Subscribe to events:
     - `customer.subscription.updated`
     - `invoice.payment_succeeded`

4. **Price IDs Updated:**
   - Update `PRICE_IDS` in `switch-billing-cycle/index.ts`
   - Update `SUBSCRIPTION_PLANS` in `config/stripe.ts`

### Rollback Plan

If issues arise:

1. **Disable Edge Function:**
   ```bash
   # Comment out the function call in paymentService.ts
   // const result = await this.callEdgeFunction('switch-billing-cycle', ...);
   ```

2. **Revert to Read-Only Mode:**
   ```typescript
   // Show message to users
   throw new Error('Billing cycle switching is temporarily unavailable');
   ```

3. **Manual Stripe Updates:**
   - Users can switch via Stripe Customer Portal
   - Use `get-billing-portal` edge function

## Monitoring

### Key Metrics

1. **Success Rate:**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE processing_status = 'processed') as successful,
     COUNT(*) FILTER (WHERE processing_status = 'failed') as failed
   FROM stripe_webhooks
   WHERE event_type = 'customer.subscription.updated'
   AND created_at > NOW() - INTERVAL '7 days';
   ```

2. **Proration Amounts:**
   ```sql
   SELECT 
     AVG(amount) as avg_proration,
     MIN(amount) as min_proration,
     MAX(amount) as max_proration
   FROM payment_transactions
   WHERE metadata->>'billing_reason' = 'subscription_update'
   AND created_at > NOW() - INTERVAL '30 days';
   ```

3. **Billing Cycle Distribution:**
   ```sql
   SELECT 
     billing_cycle,
     COUNT(*) as count,
     ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
   FROM user_subscriptions
   WHERE status = 'active'
   GROUP BY billing_cycle;
   ```

## FAQs

**Q: What happens if the webhook fails?**
A: Stripe retries webhooks automatically. The idempotency check prevents duplicate processing.

**Q: Can users switch back immediately?**
A: Yes, but they'll be charged/credited again. Consider adding a cooldown period.

**Q: What if the user's card declines?**
A: The switch fails, user stays on current plan. Show error message with payment update link.

**Q: How do we test proration locally?**
A: Use Stripe test mode with test cards. Stripe CLI can simulate webhook events.

**Q: Does billing anchor change?**
A: No, we use `billing_cycle_anchor: 'unchanged'` to maintain the same renewal date.

## Support

For issues or questions:
1. Check Stripe Dashboard → Events for webhook delivery
2. Check Supabase Logs → Edge Functions for function errors
3. Check database `stripe_webhooks` table for processing status
4. Review `payment_transactions` for payment records

## References

- [Stripe Subscription API](https://stripe.com/docs/api/subscriptions/update)
- [Stripe Proration](https://stripe.com/docs/billing/subscriptions/prorations)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)