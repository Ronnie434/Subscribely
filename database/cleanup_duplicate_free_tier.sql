-- ============================================================================
-- CLEANUP: Remove Duplicate Free Tier from subscription_tiers
-- ============================================================================
-- This script removes the duplicate 'free_tier' and ensures only 2 tiers exist:
-- 1. 'free' - Free tier with 5 subscription limit
-- 2. 'premium_tier' - Premium tier with unlimited subscriptions
-- ============================================================================

-- Step 1: Check current tiers (before cleanup)
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit,
  is_active
FROM public.subscription_tiers
ORDER BY display_order;

-- Step 2: Check if any user_subscriptions are using 'free_tier'
-- (We need to migrate these to 'free' before deleting)
SELECT 
  COUNT(*) as users_on_free_tier,
  'Checking if any users need migration' as note
FROM public.user_subscriptions
WHERE tier_id = 'free_tier';

-- Step 3: Migrate any users from 'free_tier' to 'free'
-- (Just in case anyone was assigned to the duplicate tier)
UPDATE public.user_subscriptions
SET tier_id = 'free'
WHERE tier_id = 'free_tier';

-- Step 4: Delete the duplicate 'free_tier'
DELETE FROM public.subscription_tiers
WHERE tier_id = 'free_tier';

-- Step 5: Verify only 2 tiers remain
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit,
  is_active,
  display_order
FROM public.subscription_tiers
ORDER BY display_order;

-- Step 6: Ensure correct tier configuration
-- Update 'free' tier to ensure it has correct values
UPDATE public.subscription_tiers
SET 
  name = 'Free',
  description = 'Basic subscription tracking',
  monthly_price = 0.00,
  annual_price = 0.00,
  subscription_limit = 5,
  display_order = 1,
  is_active = true,
  features = '["cloud_sync", "renewal_reminders", "basic_stats"]'::jsonb
WHERE tier_id = 'free';

-- Update 'premium_tier' to ensure it has correct values
UPDATE public.subscription_tiers
SET 
  name = 'Premium',
  description = 'Unlimited subscription tracking with advanced features',
  monthly_price = 4.99,
  annual_price = 39.99,
  subscription_limit = -1,  -- -1 means unlimited
  display_order = 2,
  is_active = true,
  features = '["cloud_sync", "renewal_reminders", "basic_stats", "advanced_analytics", "priority_support", "unlimited_subscriptions"]'::jsonb
WHERE tier_id = 'premium_tier';

-- Step 7: Final verification
DO $$
DECLARE
  tier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tier_count FROM public.subscription_tiers;
  
  IF tier_count = 2 THEN
    RAISE NOTICE '✅ SUCCESS: Exactly 2 tiers exist';
    RAISE NOTICE '';
    RAISE NOTICE 'Current tiers:';
    RAISE NOTICE '  1. free - Free tier (5 subscriptions)';
    RAISE NOTICE '  2. premium_tier - Premium tier (unlimited)';
  ELSE
    RAISE WARNING '⚠️ WARNING: Expected 2 tiers but found %', tier_count;
  END IF;
END $$;

-- Step 8: Show final state
SELECT 
  '✅ Cleanup Complete!' as status,
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit,
  display_order
FROM public.subscription_tiers
ORDER BY display_order;

