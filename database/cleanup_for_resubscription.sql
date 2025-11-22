-- ============================================================================
-- One-Time Data Cleanup for Re-subscription Fix
-- ============================================================================
-- Description: Clean up canceled subscriptions to allow re-subscription
-- Run this ONCE in your Supabase SQL Editor
-- After this, users can cancel and re-subscribe freely
-- Date: 2025-11-22
-- ============================================================================

-- Clean up ALL canceled subscriptions to remove blocking Stripe IDs
UPDATE user_subscriptions
SET 
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  updated_at = NOW()
WHERE status = 'canceled'
  AND (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL);

-- Verify the cleanup
SELECT 
  id,
  user_id,
  tier_id,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  billing_cycle,
  canceled_at
FROM user_subscriptions
WHERE status = 'canceled'
ORDER BY canceled_at DESC;

-- Expected result: All canceled subscriptions should have:
-- - stripe_customer_id = NULL
-- - stripe_subscription_id = NULL
-- - status = 'canceled'
-- - tier_id = 'free'

-- ============================================================================
-- DONE! After running this, users can re-subscribe without errors
-- ============================================================================