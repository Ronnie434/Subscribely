-- ============================================================================
-- Fix Re-subscription Issue
-- ============================================================================
-- Description: Allows users to cancel and re-subscribe without errors
-- Issue: UNIQUE constraint on stripe_customer_id prevents re-subscription
-- Solution: Use UPSERT logic instead of INSERT for subscription creation
-- Date: 2025-11-22
-- 
-- IMPORTANT: This is a schema understanding file. The actual fix is in the
-- create-subscription Edge Function code, not in SQL.
-- ============================================================================

-- Current Schema Issue:
-- The user_subscriptions table has TWO unique constraints:
-- 1. UNIQUE (user_id) - One subscription per user
-- 2. UNIQUE (stripe_customer_id) - One record per Stripe customer

-- This creates a problem when:
-- 1. User subscribes (creates record with customer_id)
-- 2. User cancels (record remains with status='canceled')
-- 3. User re-subscribes (tries to INSERT new record with same customer_id)
-- 4. ERROR: duplicate key violates unique constraint

-- ============================================================================
-- SOLUTION: The Edge Function Should Use UPSERT
-- ============================================================================

-- Instead of INSERT:
-- INSERT INTO user_subscriptions (user_id, stripe_customer_id, ...)
-- VALUES (...);

-- Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE):
-- INSERT INTO user_subscriptions (
--   user_id, 
--   stripe_customer_id, 
--   stripe_subscription_id,
--   tier_id,
--   status,
--   billing_cycle,
--   current_period_start,
--   current_period_end
-- ) VALUES (
--   'user-id',
--   'cus_xxx',
--   'sub_xxx',
--   'premium',
--   'trialing',
--   'monthly',
--   '2025-11-22',
--   '2025-12-22'
-- )
-- ON CONFLICT (user_id) 
-- DO UPDATE SET
--   stripe_customer_id = EXCLUDED.stripe_customer_id,
--   stripe_subscription_id = EXCLUDED.stripe_subscription_id,
--   tier_id = EXCLUDED.tier_id,
--   status = EXCLUDED.status,
--   billing_cycle = EXCLUDED.billing_cycle,
--   current_period_start = EXCLUDED.current_period_start,
--   current_period_end = EXCLUDED.current_period_end,
--   canceled_at = NULL,  -- Clear cancellation timestamp
--   cancel_at = NULL,    -- Clear scheduled cancellation
--   updated_at = NOW();

-- This way:
-- - First subscription: Creates new record
-- - Re-subscription: Updates existing record with new Stripe subscription
-- - No duplicate key errors
-- - Historical data preserved (created_at remains)
-- - Clean upgrade/downgrade path

-- ============================================================================
-- Temporary Data Cleanup (Run Once)
-- ============================================================================

-- For your current stuck situation, run this first:
UPDATE user_subscriptions
SET 
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL
WHERE status = 'canceled'
  AND stripe_subscription_id IS NOT NULL;

-- This cleans up old canceled subscriptions so they don't block new ones.
-- After the Edge Function is fixed with UPSERT, this won't be needed anymore.

-- ============================================================================
-- NEXT STEP: Update supabase/functions/create-subscription/index.ts
-- ============================================================================
-- Change line 390 from INSERT to UPSERT logic
-- See the code changes being applied...