-- ============================================================================
-- Update Annual Price to Match Apple IAP Pricing
-- ============================================================================
-- Description: Update premium tier annual price from $39.00 to $39.99
-- Date: 2025-12-06
-- Reason: Match Apple IAP yearly subscription price
-- ============================================================================

-- Update the premium tier annual price
UPDATE public.subscription_tiers
SET 
  annual_price = 39.99,
  updated_at = NOW()
WHERE tier_id = 'premium_tier';

-- Verify the update
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  updated_at
FROM public.subscription_tiers
WHERE tier_id = 'premium_tier';

-- Expected result:
-- tier_id      | name    | monthly_price | annual_price | updated_at
-- -------------+---------+---------------+--------------+-------------------------
-- premium_tier | Premium | 4.99          | 39.99        | [current timestamp]