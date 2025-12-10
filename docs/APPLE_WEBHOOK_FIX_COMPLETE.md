# Apple Webhook Fix - Implementation Complete ✅

## What Was Done

### ✅ Step 1: Database Migration (Completed by you)
You ran `fix_apple_iap_webhook_schema.sql` which created:
- ✅ `ensure_user_subscription_exists()` function
- ✅ `update_apple_iap_subscription()` function

### ✅ Step 2: Webhook Code Updates (Just completed)

Updated `supabase/functions/apple-webhook/index.ts` with the following changes:

#### Change 1: Fixed Tier Mapping (Line 53-60)
```typescript
// ❌ BEFORE:
'com.ronnie39.renvo.premium.monthly.v1': 'premium_tier',
'com.ronnie39.renvo.premium.yearly.v1': 'premium_tier',

// ✅ AFTER:
'com.ronnie39.renvo.premium.monthly.v1': 'premium',
'com.ronnie39.renvo.premium.yearly.v1': 'premium',
```
**Why:** Must match `tier_id` in `subscription_tiers` table (which is 'premium', not 'premium_tier')

#### Change 2: Subscription Activation (Lines 243-264)
```typescript
// ❌ BEFORE: Tried to update non-existent columns in profiles
await supabase.from('profiles').update({
  subscription_tier: tier,  // ❌ Column doesn't exist
  subscription_status: 'active',  // ❌ Column doesn't exist
  ...
})

// ✅ AFTER: Uses helper function to update both tables properly
await supabase.rpc('update_apple_iap_subscription', {
  p_user_id: userId,
  p_tier_id: tier,
  p_status: 'active',
  ...
})
```

#### Change 3: Payment Failure (Lines 266-282)
```typescript
// ❌ BEFORE: profiles table
await supabase.from('profiles').update({
  subscription_status: 'past_due',  // ❌ Column doesn't exist
})

// ✅ AFTER: user_subscriptions table
await supabase.from('user_subscriptions').update({
  status: 'past_due',  // ✅ Correct column
})
```

#### Change 4: Cancellation (Lines 284-310)
```typescript
// ❌ BEFORE: profiles table
await supabase.from('profiles').update({
  subscription_status: 'canceled',  // ❌ Column doesn't exist
})

// ✅ AFTER: user_subscriptions table
await supabase.from('user_subscriptions').update({
  status: 'canceled',
  cancel_at_period_end: true,
  canceled_at: new Date().toISOString(),
})
```

#### Change 5: Expiration (Lines 313-334)
```typescript
// ❌ BEFORE: profiles table with non-existent columns
await supabase.from('profiles').update({
  subscription_tier: 'free',  // ❌ Column doesn't exist
  subscription_status: 'expired',  // ❌ Column doesn't exist
})

// ✅ AFTER: user_subscriptions table
await supabase.from('user_subscriptions').update({
  tier_id: 'free',  // ✅ Correct column
  status: 'canceled',  // ✅ Correct column
  billing_cycle: 'none',
  current_period_end: null,
})
```

#### Change 6: Refund/Revocation (Lines 337-367)
```typescript
// ❌ BEFORE: profiles table with non-existent columns
await supabase.from('profiles').update({
  subscription_tier: 'free',  // ❌ Column doesn't exist
  subscription_status: status,  // ❌ Column doesn't exist
})

// ✅ AFTER: user_subscriptions table + profiles cleanup
await supabase.from('user_subscriptions').update({
  tier_id: 'free',
  status: 'canceled',
  billing_cycle: 'none',
  current_period_end: null,
  canceled_at: new Date().toISOString(),
})

// Also clear Apple tracking fields in profiles
await supabase.from('profiles').update({
  apple_receipt_expiration_date: null,
  apple_original_transaction_id: null,
})
```

---

## ✅ Next Steps

### Step 3: Redeploy Webhook Function

Run this command to deploy the updated webhook:

```bash
supabase functions deploy apple-webhook
```

### Step 4: Test the Fix

#### Test 1: Purchase Flow
1. Make a purchase in TestFlight
2. Check Supabase logs
3. **Expected:** No more `PGRST204` errors
4. **Expected:** User gets premium status

#### Test 2: Cancellation Flow
1. Cancel subscription via native screen
2. Check Supabase logs for `DID_CHANGE_RENEWAL_STATUS` event
3. **Expected:** No errors
4. **Expected:** `user_subscriptions.status` = 'canceled'
5. **Expected:** `user_subscriptions.cancel_at_period_end` = true

#### Test 3: Subscription Status in App
1. Open app after cancellation
2. Check Settings/Profile screen
3. **Expected:** Shows "Canceled" status but still premium until expiration

---

## 🔍 Verification Queries

After deploying, run these in Supabase SQL Editor to verify:

```sql
-- 1. Check if user has subscription record
SELECT 
  us.user_id,
  us.tier_id,
  us.status,
  us.billing_cycle,
  us.cancel_at_period_end,
  us.current_period_end,
  p.payment_provider,
  p.apple_original_transaction_id
FROM user_subscriptions us
JOIN profiles p ON p.id = us.user_id
WHERE p.payment_provider = 'apple'
ORDER BY us.updated_at DESC
LIMIT 5;

-- 2. Check Apple transactions
SELECT 
  user_id,
  product_id,
  notification_type,
  expiration_date,
  created_at
FROM apple_transactions
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verify helper functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('ensure_user_subscription_exists', 'update_apple_iap_subscription');
```

---

## 📊 Expected Results

### Before Fix:
```
❌ [apple-webhook] Failed to update profile (canceled): {
  "code": "PGRST204",
  "message": "Could not find the 'subscription_status' column of 'profiles' in the schema cache"
}
```

### After Fix:
```
✅ [apple-webhook] 🔄 Auto-renew status change for user: xxx
✅ [apple-webhook] 📝 Auto-renew disabled for user xxx
✅ [apple-webhook] 🚫 User disabled auto-renew, marking as canceled...
✅ [apple-webhook] ✅ Subscription canceled for user xxx
✅ [apple-webhook] ✅ Subscription event processed
✅ [apple-webhook] ✅ Webhook processed successfully
```

---

## 🎯 Summary of Changes

| File | Changes Made | Purpose |
|------|-------------|---------|
| `database/fix_apple_iap_webhook_schema.sql` | ✅ Ran (Step 1) | Created helper functions |
| `supabase/functions/apple-webhook/index.ts` | ✅ Updated (Step 2) | Fixed all table references |
| Deployment | ⏳ Pending (Step 3) | Deploy updated webhook |

---

## 🚀 Deployment Command

```bash
# Deploy the updated webhook function
supabase functions deploy apple-webhook

# Expected output:
# Deploying Function...
# Function deployed: apple-webhook
# URL: https://[your-project].supabase.co/functions/v1/apple-webhook
```

---

## ✅ Success Criteria

After deployment, you should see:
- ✅ No more `PGRST204` errors in Supabase logs
- ✅ Purchase flow works (status updates in user_subscriptions)
- ✅ Cancellation flow works (status = 'canceled', cancel_at_period_end = true)
- ✅ App correctly shows subscription status
- ✅ Webhook logs show "✅ Webhook processed successfully"

---

## 🔄 If You Need to Rollback

```bash
# Revert webhook changes
git checkout HEAD~1 supabase/functions/apple-webhook/index.ts

# Redeploy old version
supabase functions deploy apple-webhook

# Drop helper functions
# Run in Supabase SQL Editor:
DROP FUNCTION IF EXISTS public.ensure_user_subscription_exists(UUID);
DROP FUNCTION IF EXISTS public.update_apple_iap_subscription(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT);
```

---

## 📝 Notes

1. **Database migration is idempotent** - Safe to run multiple times
2. **Helper functions handle missing records** - Creates user_subscriptions if doesn't exist
3. **Single source of truth** - All subscription data in user_subscriptions table
4. **Aligned with existing system** - Works with Stripe subscriptions too

The fix is complete! Just deploy and test. 🎉


