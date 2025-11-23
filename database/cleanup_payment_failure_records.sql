-- Cleanup script for orphaned premium subscription records
-- These are records created during the vulnerability window where premium access
-- was granted before payment was confirmed, but payment ultimately failed

-- 1. First, let's identify the problematic records
SELECT 
  id,
  user_id,
  tier_id,
  status,
  stripe_subscription_id,
  created_at,
  updated_at,
  CASE 
    WHEN status IN ('payment_failed', 'grace_period', 'incomplete', 'canceled') AND tier_id = 'premium' 
    THEN 'NEEDS CLEANUP'
    ELSE 'OK'
  END as cleanup_status
FROM user_subscriptions
WHERE tier_id = 'premium' 
  AND status IN ('payment_failed', 'grace_period', 'incomplete', 'canceled')
ORDER BY created_at DESC;

-- 2. Get the free tier ID (we'll need this for downgrade)
SELECT tier_id, name FROM subscription_tiers WHERE tier_id = 'free';

-- 3. Downgrade orphaned premium records to free tier
-- These are records where payment failed but premium tier was granted
UPDATE user_subscriptions
SET 
  tier_id = 'free',
  updated_at = NOW()
WHERE tier_id = 'premium'
  AND status IN ('payment_failed', 'grace_period', 'incomplete', 'canceled')
RETURNING 
  id,
  user_id,
  tier_id,
  status,
  stripe_subscription_id;

-- 4. Optionally, completely remove incomplete records (if payment never succeeded)
-- Uncomment if you want to DELETE instead of downgrade
-- DELETE FROM user_subscriptions
-- WHERE tier_id = 'premium'
--   AND status = 'incomplete'
--   AND created_at < NOW() - INTERVAL '1 hour'
-- RETURNING id, user_id, status;

-- 5. Verify the cleanup
SELECT 
  tier_id,
  status,
  COUNT(*) as count
FROM user_subscriptions
GROUP BY tier_id, status
ORDER BY tier_id, status;