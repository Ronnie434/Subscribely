# Payment Transactions Fix - Testing Guide

## ✅ Fix Applied

**Problem:** `payment_transactions` table was empty because `invoice.payment_intent` was NULL in webhook events, violating the NOT NULL constraint.

**Solution:** Modified [`supabase/functions/stripe-webhook/index.ts`](supabase/functions/stripe-webhook/index.ts:383-387) to use `invoice.id` as fallback when `payment_intent` is NULL.

**Deployed:** ✅ Webhook function successfully deployed

---

## 🧪 Testing Options

### Option 1: Replay Existing Webhook Event (FASTEST)

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Find one of these recent events in the logs:
   - `evt_1SUfGi2MEnHaTsaArQreNSAf`
   - `evt_1SUf8F2MEnHaTsaAzMI23qrV`
   - `evt_1SUd3d2MEnHaTsaA1H4A12rD`
4. Click the **"..."** menu → **"Resend event"**
5. This will trigger the webhook with the same data

### Option 2: Trigger New Payment (REAL TEST)

Make a new test payment through your app or Stripe test mode.

---

## 📊 Verification Steps

### 1. Check Webhook Logs
```bash
supabase functions logs stripe-webhook --limit 20
```

**Look for:**
- ✅ `⚠️ payment_intent is NULL - using invoice.id as fallback: invoice_in_...`
- ✅ `✅ Payment transaction recorded: invoice_in_...`

### 2. Check Database

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if payment_transactions are now being inserted
SELECT 
  id,
  stripe_payment_intent_id,
  stripe_invoice_id,
  amount,
  status,
  metadata->>'used_fallback_id' as used_fallback,
  created_at
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- You should see records with `stripe_payment_intent_id` like `invoice_in_XXX`
- `used_fallback` should be `true` for records where payment_intent was NULL

### 3. Verify Against Existing Events

Run this to see which events should have created transactions:

```sql
SELECT 
  event_id,
  event_type,
  event_data->'data'->'object'->>'id' as invoice_id,
  CASE 
    WHEN event_data->'data'->'object'->>'payment_intent' IS NULL 
    THEN 'invoice_' || (event_data->'data'->'object'->>'id')
    ELSE event_data->'data'->'object'->>'payment_intent'
  END as expected_payment_intent_id,
  created_at
FROM stripe_webhooks
WHERE event_type = 'invoice.payment_succeeded'
ORDER BY created_at DESC
LIMIT 5;
```

Cross-reference these with the `payment_transactions` table.

---

## 🎯 Success Criteria

✅ **Fix is working if:**
1. New `invoice.payment_succeeded` webhooks create records in `payment_transactions`
2. Records have `stripe_payment_intent_id` = `invoice_in_XXX` (when payment_intent was NULL)
3. No errors in webhook logs about "Failed to insert payment transaction"
4. `user_subscriptions` and `usage_tracking_events` continue to work (they already did)

---

## 🔄 What Changed

**File:** [`supabase/functions/stripe-webhook/index.ts`](supabase/functions/stripe-webhook/index.ts:383-407)

**Before:**
```typescript
stripe_payment_intent_id: invoice.payment_intent as string,  // ❌ Fails when NULL
```

**After:**
```typescript
const paymentIntentId = (invoice.payment_intent as string) || `invoice_${invoice.id}`;

if (!invoice.payment_intent) {
  console.log('⚠️ payment_intent is NULL - using invoice.id as fallback:', paymentIntentId);
}

// ... insert with:
stripe_payment_intent_id: paymentIntentId,  // ✅ Never NULL
metadata: {
  billing_reason: invoice.billing_reason,
  subscription_id: invoice.subscription,
  used_fallback_id: !invoice.payment_intent,  // ✅ Track fallback usage
}
```

---

## 📝 Notes

- The fix is backward compatible - it doesn't break existing functionality
- When `payment_intent` exists, it uses it (normal case)
- When `payment_intent` is NULL, it creates a unique ID using `invoice.id`
- The `metadata.used_fallback_id` field tracks which records used the fallback
- This is a common pattern for handling Stripe's subscription renewal webhooks