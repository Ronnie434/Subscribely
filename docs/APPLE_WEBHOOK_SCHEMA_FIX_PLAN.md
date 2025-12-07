# Apple Webhook Database Schema Fix Plan

## 🐛 Issue Identified

**Error Message:**
```
"Could not find the 'subscription_status' column of 'profiles' in the schema cache"
```

**Root Cause:**
The `apple-webhook` Edge Function is trying to update `subscription_tier` and `subscription_status` columns in the `profiles` table, but these columns don't exist there. Instead, subscription data is stored in the `user_subscriptions` table.

### Current Database Schema

#### `profiles` table (from `supabase_migration.sql`):
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### Additions from `apple_iap_migration.sql`:
```sql
ALTER TABLE public.profiles ADD COLUMN:
- payment_provider TEXT  ✅ EXISTS
- apple_original_transaction_id TEXT  ✅ EXISTS
- apple_latest_receipt TEXT  ✅ EXISTS
- apple_receipt_expiration_date TIMESTAMPTZ  ✅ EXISTS
```

#### `user_subscriptions` table (from `paywall_migration.sql`):
```sql
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tier_id TEXT REFERENCES subscription_tiers(tier_id),  ✅ Subscription tier HERE
  billing_cycle TEXT,
  status TEXT,  ✅ Subscription status HERE
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  -- ... more fields
);
```

### The Problem

**File: `supabase/functions/apple-webhook/index.ts`**

Lines 247-257 (and similar in other places):
```typescript
// ❌ WRONG: Trying to update columns that don't exist
const { error: updateError } = await supabase
  .from('profiles')
  .update({
    subscription_tier: tier,  // ❌ Column doesn't exist in profiles
    subscription_status: 'active',  // ❌ Column doesn't exist in profiles
    payment_provider: 'apple',  // ✅ This column exists
    apple_original_transaction_id: originalTransactionId,  // ✅ This exists
    apple_receipt_expiration_date: expiresDateStr,  // ✅ This exists
    updated_at: new Date().toISOString(),
  })
  .eq('id', userId);
```

---

## 🔧 Solution Options

### Option 1: Add Columns to `profiles` Table (Simple, but creates redundancy)

**Pros:**
- Quick fix
- Minimal code changes
- Keeps Apple IAP data separate from Stripe

**Cons:**
- Data redundancy (subscription info in 2 tables)
- Potential sync issues between tables
- Violates normalization principles

### Option 2: Update Webhook to Use `user_subscriptions` Table (Recommended)

**Pros:**
- Single source of truth for subscription status
- Works with existing paywall system
- Proper database normalization
- Future-proof

**Cons:**
- Requires more code changes in webhook
- Need to ensure `user_subscriptions` record exists

---

## ✅ Recommended Solution: Option 2

Update the webhook to use `user_subscriptions` table instead of `profiles`.

### Implementation Plan

#### Step 1: Create Database Migration
**File: `database/fix_apple_iap_profiles_schema.sql`**

```sql
-- ============================================================================
-- FIX: Apple IAP Webhook Schema Issue
-- ============================================================================
-- This migration ensures proper integration between Apple IAP and subscription system
-- ============================================================================

-- Option A: If you want to add columns to profiles (NOT RECOMMENDED)
-- Uncomment below if you prefer Option 1:

/*
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT REFERENCES subscription_tiers(tier_id),
ADD COLUMN IF NOT EXISTS subscription_status TEXT 
  CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'paused', 'expired'));

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier 
  ON public.profiles(subscription_tier);
  
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
  ON public.profiles(subscription_status);

COMMENT ON COLUMN public.profiles.subscription_tier IS 'Denormalized subscription tier for quick access';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Denormalized subscription status for quick access';
*/

-- Option B: Helper function to upsert user_subscriptions (RECOMMENDED)
-- This function ensures a user_subscriptions record exists before update

CREATE OR REPLACE FUNCTION public.ensure_user_subscription_exists(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Check if subscription exists
  SELECT id INTO v_subscription_id
  FROM public.user_subscriptions
  WHERE user_id = p_user_id;
  
  -- If not, create a free tier subscription
  IF v_subscription_id IS NULL THEN
    INSERT INTO public.user_subscriptions (
      user_id,
      tier_id,
      billing_cycle,
      status
    ) VALUES (
      p_user_id,
      'free',
      'none',
      'active'
    )
    RETURNING id INTO v_subscription_id;
  END IF;
  
  RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_subscription_exists IS 
  'Ensures a user_subscriptions record exists, creates one if missing';

-- Helper function to update Apple subscription in user_subscriptions table
CREATE OR REPLACE FUNCTION public.update_apple_iap_subscription(
  p_user_id UUID,
  p_tier_id TEXT,
  p_status TEXT,
  p_original_transaction_id TEXT,
  p_expiration_date TIMESTAMPTZ,
  p_product_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
  v_billing_cycle TEXT;
BEGIN
  -- Determine billing cycle from product ID
  IF p_product_id LIKE '%monthly%' THEN
    v_billing_cycle := 'monthly';
  ELSIF p_product_id LIKE '%yearly%' OR p_product_id LIKE '%annual%' THEN
    v_billing_cycle := 'annual';
  ELSE
    v_billing_cycle := 'monthly'; -- default fallback
  END IF;
  
  -- Ensure user_subscriptions record exists
  v_subscription_id := ensure_user_subscription_exists(p_user_id);
  
  -- Update user_subscriptions with Apple subscription details
  UPDATE public.user_subscriptions
  SET
    tier_id = p_tier_id,
    billing_cycle = v_billing_cycle,
    status = p_status,
    current_period_end = p_expiration_date,
    updated_at = NOW()
  WHERE id = v_subscription_id;
  
  -- Update profiles with Apple-specific tracking fields
  UPDATE public.profiles
  SET
    payment_provider = 'apple',
    apple_original_transaction_id = p_original_transaction_id,
    apple_receipt_expiration_date = p_expiration_date,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.update_apple_iap_subscription IS 
  'Updates user subscription status for Apple IAP purchases';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Apple IAP profile schema fix applied!';
  RAISE NOTICE 'Helper functions created: 2';
  RAISE NOTICE '  - ensure_user_subscription_exists()';
  RAISE NOTICE '  - update_apple_iap_subscription()';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Update apple-webhook Edge Function to use new helper functions';
END $$;
```

#### Step 2: Update Webhook Edge Function
**File: `supabase/functions/apple-webhook/index.ts`**

**Changes needed:**

1. **Replace direct profile updates** (lines 243-264):

```typescript
// ❌ OLD CODE:
case NotificationType.SUBSCRIBED:
case NotificationType.DID_RENEW:
  console.log('[apple-webhook] ✅ Activating/renewing subscription...');
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,  // ❌ Doesn't exist
      subscription_status: 'active',  // ❌ Doesn't exist
      payment_provider: 'apple',
      apple_original_transaction_id: originalTransactionId,
      apple_receipt_expiration_date: expiresDateStr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
```

```typescript
// ✅ NEW CODE:
case NotificationType.SUBSCRIBED:
case NotificationType.DID_RENEW:
  console.log('[apple-webhook] ✅ Activating/renewing subscription...');
  
  // Use helper function to update both tables properly
  const { data: updateResult, error: updateError } = await supabase.rpc(
    'update_apple_iap_subscription',
    {
      p_user_id: userId,
      p_tier_id: tier,
      p_status: 'active',
      p_original_transaction_id: originalTransactionId,
      p_expiration_date: expiresDateStr,
      p_product_id: productId,
    }
  );
```

2. **Update cancellation handler** (lines 284-305):

```typescript
// ❌ OLD CODE:
case NotificationType.DID_CHANGE_RENEWAL_STATUS:
  console.log('[apple-webhook] 🔄 Auto-renew status change for user:', userId);
  if (renewalInfo) {
    const willRenew = renewalInfo.autoRenewStatus === 1;
    console.log(`[apple-webhook] 📝 Auto-renew ${willRenew ? 'enabled' : 'disabled'} for user ${userId}`);
    
    if (!willRenew) {
      console.log('[apple-webhook] 🚫 User disabled auto-renew, marking as canceled...');
      const { error: cancelError } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'canceled',  // ❌ Column doesn't exist
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
```

```typescript
// ✅ NEW CODE:
case NotificationType.DID_CHANGE_RENEWAL_STATUS:
  console.log('[apple-webhook] 🔄 Auto-renew status change for user:', userId);
  if (renewalInfo) {
    const willRenew = renewalInfo.autoRenewStatus === 1;
    console.log(`[apple-webhook] 📝 Auto-renew ${willRenew ? 'enabled' : 'disabled'} for user ${userId}`);
    
    if (!willRenew) {
      console.log('[apple-webhook] 🚫 User disabled auto-renew, marking as canceled...');
      
      // Update user_subscriptions table instead
      const { error: cancelError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
```

3. **Update expiration handler** (lines 307-329):

```typescript
// ❌ OLD CODE:
case NotificationType.EXPIRED:
  console.log('[apple-webhook] ⏰ Subscription expired for user:', userId);
  const { error: expireError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'expired',  // ❌ Column doesn't exist
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
```

```typescript
// ✅ NEW CODE:
case NotificationType.EXPIRED:
  console.log('[apple-webhook] ⏰ Subscription expired for user:', userId);
  
  // Update user_subscriptions to free tier
  const { error: expireError } = await supabase
    .from('user_subscriptions')
    .update({
      tier_id: 'free',
      status: 'canceled',
      billing_cycle: 'none',
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
```

4. **Update payment failure handler** (lines 266-282):

```typescript
// ✅ NEW CODE:
case NotificationType.DID_FAIL_TO_RENEW:
  console.log('[apple-webhook] ⚠️ Payment failed for user:', userId);
  
  const { error: failError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
```

#### Step 3: Update Product Tier Mapping

In the webhook function, update the tier mapping:

```typescript
// Line 212 - Update tier mapping
const PRODUCT_TIER_MAP: Record<string, string> = {
  'com.ronnie39.renvo.premium.monthly.v1': 'premium_tier',  // ❌ Should be 'premium'
  'com.ronnie39.renvo.premium.yearly.v1': 'premium_tier',   // ❌ Should be 'premium'
};

// ✅ CORRECT:
const PRODUCT_TIER_MAP: Record<string, string> = {
  'com.ronnie39.renvo.premium.monthly.v1': 'premium',  // Matches tier_id in subscription_tiers
  'com.ronnie39.renvo.premium.yearly.v1': 'premium',
};
```

---

## 📋 Implementation Checklist

### Phase 1: Database Updates

- [ ] **Step 1**: Run `fix_apple_iap_profiles_schema.sql` in Supabase SQL Editor
  - Creates `ensure_user_subscription_exists()` function
  - Creates `update_apple_iap_subscription()` function
  - Verifies successful execution

- [ ] **Step 2**: Verify functions exist
  ```sql
  -- Run in Supabase SQL Editor:
  SELECT routine_name, routine_type 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name LIKE '%apple%';
  ```

### Phase 2: Update Webhook Code

- [ ] **Step 3**: Update `supabase/functions/apple-webhook/index.ts`
  - Replace `PRODUCT_TIER_MAP` values
  - Update `SUBSCRIBED` and `DID_RENEW` case
  - Update `DID_CHANGE_RENEWAL_STATUS` case
  - Update `EXPIRED` case
  - Update `DID_FAIL_TO_RENEW` case

- [ ] **Step 4**: Redeploy webhook function
  ```bash
  supabase functions deploy apple-webhook
  ```

### Phase 3: Testing

- [ ] **Step 5**: Test purchase flow in TestFlight
  - Make new purchase
  - Check webhook logs (no errors about missing columns)
  - Verify `user_subscriptions` table updated
  - Verify `profiles.payment_provider` = 'apple'

- [ ] **Step 6**: Test cancellation flow
  - Cancel subscription via native screen
  - Check webhook processes `DID_CHANGE_RENEWAL_STATUS`
  - Verify `user_subscriptions.status` = 'canceled'
  - Verify `user_subscriptions.cancel_at_period_end` = true

- [ ] **Step 7**: Test expiration
  - Wait for sandbox subscription to expire (5-10 minutes)
  - Check webhook processes `EXPIRED` event
  - Verify user reverted to free tier

### Phase 4: Monitoring

- [ ] **Step 8**: Monitor Supabase logs for 24 hours
  - No `PGRST204` errors
  - All webhook events process successfully
  - Subscription status reflects correctly in app

---

## 🔍 Verification Queries

After implementing, run these queries to verify:

```sql
-- 1. Check if helper functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('ensure_user_subscription_exists', 'update_apple_iap_subscription');

-- 2. Check user subscription data after purchase
SELECT 
  us.user_id,
  us.tier_id,
  us.status,
  us.billing_cycle,
  p.payment_provider,
  p.apple_original_transaction_id
FROM user_subscriptions us
JOIN profiles p ON p.id = us.user_id
WHERE p.payment_provider = 'apple';

-- 3. Check Apple transactions audit trail
SELECT 
  at.user_id,
  at.product_id,
  at.notification_type,
  at.expiration_date,
  at.created_at
FROM apple_transactions at
ORDER BY at.created_at DESC
LIMIT 10;
```

---

## 🎯 Expected Results

### Before Fix:
```
❌ [apple-webhook] Failed to update profile (canceled): {
  code: "PGRST204",
  message: "Could not find the 'subscription_status' column of 'profiles'"
}
```

### After Fix:
```
✅ [apple-webhook] Subscription canceled for user: xxx
✅ [apple-webhook] User subscription updated successfully
✅ [apple-webhook] Webhook processed successfully
```

---

## 🚨 Rollback Plan

If issues occur after deployment:

```sql
-- Rollback: Drop new functions
DROP FUNCTION IF EXISTS public.ensure_user_subscription_exists(UUID);
DROP FUNCTION IF EXISTS public.update_apple_iap_subscription(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT);

-- Revert webhook code using git
git checkout HEAD~1 supabase/functions/apple-webhook/index.ts
supabase functions deploy apple-webhook
```

---

## 📚 Additional Notes

1. **Why not just add columns to profiles?**
   - Would create data redundancy
   - Existing paywall system uses `user_subscriptions`
   - Would need to keep both tables in sync
   - Violates database normalization

2. **What about existing Stripe users?**
   - They already use `user_subscriptions` table
   - This fix aligns Apple IAP with existing architecture
   - No changes needed for Stripe flow

3. **Migration safety:**
   - Helper functions use `IF NOT EXISTS` logic
   - Safe to run multiple times
   - No data loss risk

4. **Future considerations:**
   - Consider removing `subscription_tier` and `subscription_status` references from other Apple IAP functions if they exist
   - Update documentation to reflect correct table usage

---

## ✅ Summary

**Problem:** Webhook tries to update non-existent columns in `profiles` table

**Solution:** Update webhook to use `user_subscriptions` table (single source of truth)

**Impact:** Fixes schema errors, aligns Apple IAP with existing subscription system

**Risk:** Low - uses helper functions with error handling

**Timeline:** 30-60 minutes for full implementation and testing

