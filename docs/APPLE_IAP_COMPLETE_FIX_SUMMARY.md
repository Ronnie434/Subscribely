# Complete Apple IAP Schema Fix Summary

## ✅ All Issues Fixed

### Issue 1: Apple Webhook Schema Error ✅ FIXED
**File:** `supabase/functions/apple-webhook/index.ts`
**Error:** `"Could not find 'subscription_status' column of 'profiles' in the schema cache"`
**Fix:** Updated to use `user_subscriptions` table and `update_apple_iap_subscription()` helper function

### Issue 2: Validate Receipt Schema Error ✅ FIXED  
**File:** `supabase/functions/validate-apple-receipt/index.ts`
**Error:** `'column "subscription_tier" of relation "profiles" does not exist'`
**Fix:** Updated to use `update_apple_iap_subscription()` helper function

### Issue 3: Duplicate Free Tier ✅ READY TO FIX
**File:** `database/cleanup_duplicate_free_tier.sql`
**Issue:** 3 tiers in database but only need 2
**Status:** SQL script ready to run

---

## 📋 What Was Done

### 1. Database Migration ✅ (You ran this)
**File:** `database/fix_apple_iap_webhook_schema.sql`

Created helper functions:
- `ensure_user_subscription_exists()` - Creates user_subscriptions record if missing
- `update_apple_iap_subscription()` - Updates both user_subscriptions and profiles properly

### 2. Apple Webhook Function ✅ (Just updated)
**File:** `supabase/functions/apple-webhook/index.ts`

**Changes:**
- Line 53-60: Tier mapping (kept `'premium_tier'` - correct!)
- Line 247-257: SUBSCRIBED/DID_RENEW → Use `update_apple_iap_subscription()`
- Line 269-275: DID_FAIL_TO_RENEW → Update `user_subscriptions` table
- Line 294-300: DID_CHANGE_RENEWAL_STATUS → Update `user_subscriptions` table
- Line 317-327: EXPIRED → Update `user_subscriptions` table, revert to free
- Line 344-363: REFUND/REVOKED → Update `user_subscriptions` table, clear Apple fields

### 3. Validate Receipt Function ✅ (Just updated)
**File:** `supabase/functions/validate-apple-receipt/index.ts`

**Changes:**
- Line 380-391: Changed from `update_user_apple_subscription()` to `update_apple_iap_subscription()`
- Now uses same helper function as webhook for consistency

---

## 🚀 Next Steps

### Step 1: Clean Up Duplicate Tier (Optional but Recommended)

Run in Supabase SQL Editor:
```sql
-- Quick cleanup: Remove duplicate 'free_tier'
UPDATE public.user_subscriptions
SET tier_id = 'free'
WHERE tier_id = 'free_tier';

DELETE FROM public.subscription_tiers
WHERE tier_id = 'free_tier';

-- Verify only 2 tiers remain
SELECT tier_id, name FROM public.subscription_tiers ORDER BY display_order;
```

Expected result:
- `free` (5 subscriptions)
- `premium_tier` (unlimited)

### Step 2: Deploy Both Edge Functions

```bash
# Deploy webhook function
supabase functions deploy apple-webhook

# Deploy validate-receipt function  
supabase functions deploy validate-apple-receipt
```

### Step 3: Test Everything

#### Test 1: New Purchase
1. Make a purchase in TestFlight
2. Check Supabase logs for `validate-apple-receipt`
3. **Expected:** No `column "subscription_tier"` errors ✅
4. **Expected:** User gets premium status ✅

#### Test 2: Webhook Events
1. Cancel subscription via native screen
2. Check Supabase logs for `apple-webhook`
3. **Expected:** No `subscription_status` errors ✅
4. **Expected:** Subscription marked as canceled ✅

#### Test 3: App Status
1. Open app after purchase
2. Check Settings/Profile
3. **Expected:** Shows "Premium" status ✅
4. **Expected:** Can add unlimited subscriptions ✅

---

## 🔍 Verification Queries

After deploying, run these in Supabase SQL Editor:

```sql
-- 1. Check user subscriptions are working
SELECT 
  us.user_id,
  us.tier_id,
  us.status,
  us.billing_cycle,
  us.current_period_end,
  p.payment_provider,
  p.apple_original_transaction_id
FROM user_subscriptions us
JOIN profiles p ON p.id = us.user_id
WHERE p.payment_provider = 'apple'
ORDER BY us.updated_at DESC
LIMIT 5;

-- 2. Check Apple transactions are recorded
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
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('ensure_user_subscription_exists', 'update_apple_iap_subscription');

-- 4. Check tier configuration
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit
FROM subscription_tiers
ORDER BY display_order;
```

---

## 📊 Expected Results

### Before Fix:
```
❌ [validate-apple-receipt] Failed to update profile: {
  "code": "42703",
  "message": "column \"subscription_tier\" of relation \"profiles\" does not exist"
}

❌ [apple-webhook] Failed to update profile (canceled): {
  "code": "PGRST204",
  "message": "Could not find the 'subscription_status' column"
}
```

### After Fix:
```
✅ [validate-apple-receipt] Transaction recorded
✅ [validate-apple-receipt] User subscription updated
✅ [validate-apple-receipt] Validation successful

✅ [apple-webhook] Subscription canceled for user: xxx
✅ [apple-webhook] Subscription event processed
✅ [apple-webhook] Webhook processed successfully
```

---

## 🎯 Summary of All Changes

| Component | Status | Action Required |
|-----------|--------|----------------|
| Database helper functions | ✅ Complete | Already ran |
| `apple-webhook/index.ts` | ✅ Complete | Deploy function |
| `validate-apple-receipt/index.ts` | ✅ Complete | Deploy function |
| Duplicate tier cleanup | ⏳ Pending | Run SQL (optional) |

---

## 🔧 Deployment Commands

```bash
# 1. Deploy webhook (handles cancellations, renewals, etc)
supabase functions deploy apple-webhook

# 2. Deploy validation (handles initial purchase validation)
supabase functions deploy validate-apple-receipt

# 3. Test in TestFlight
# - Make a purchase
# - Cancel subscription
# - Check Supabase logs for both functions
```

---

## ✅ Success Criteria

After deployment, you should see:

- ✅ No more `column "subscription_tier"` errors in validate-receipt logs
- ✅ No more `subscription_status` column errors in webhook logs
- ✅ Purchase flow works (user gets premium status)
- ✅ Cancellation flow works (status updated correctly)
- ✅ Webhook events process successfully
- ✅ App shows correct subscription status

---

## 🔄 Rollback (If Needed)

```bash
# Revert both functions
git checkout HEAD~1 supabase/functions/apple-webhook/index.ts
git checkout HEAD~1 supabase/functions/validate-apple-receipt/index.ts

# Redeploy old versions
supabase functions deploy apple-webhook
supabase functions deploy validate-apple-receipt
```

---

## 📝 Technical Details

### What Changed

**Old (Incorrect):**
- Functions tried to update `profiles.subscription_tier` and `profiles.subscription_status`
- These columns don't exist in profiles table
- Caused PGRST204 and 42703 errors

**New (Correct):**
- Functions use `update_apple_iap_subscription()` helper
- Updates `user_subscriptions.tier_id` and `user_subscriptions.status`
- Also updates `profiles.payment_provider` and Apple tracking fields
- Single source of truth for subscription data

### Why This is Better

1. **Proper database normalization** - Subscription data in one table
2. **Consistency with Stripe** - Both payment providers use same structure
3. **Atomic updates** - Helper function updates both tables in single transaction
4. **Error handling** - Automatically creates user_subscriptions record if missing
5. **Future-proof** - Easy to add new subscription tiers or features

---

## 🎉 You're Almost Done!

Just need to:
1. ✅ Run tier cleanup SQL (optional - 30 seconds)
2. ✅ Deploy both functions (2 minutes)
3. ✅ Test in TestFlight (5 minutes)

Then all schema errors will be gone! 🚀


