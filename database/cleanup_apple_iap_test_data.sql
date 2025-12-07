-- ============================================================================
-- CLEANUP APPLE IAP TEST DATA
-- ============================================================================
-- Description: Removes all Apple IAP subscription data to allow fresh testing
-- Version: 1.0.0
-- Date: 2025-12-07
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor
-- 
-- This script will:
-- 1. Delete all Apple transactions
-- 2. Reset user subscription status to free tier
-- 3. Clear Apple-specific fields from profiles
-- 4. Clear payment transactions related to Apple IAP
-- 
-- WARNING: This will delete all subscription data for ALL users
-- Use with caution in production!
-- ============================================================================

-- ============================================================================
-- SECTION 1: DELETE APPLE TRANSACTIONS
-- ============================================================================

DELETE FROM public.apple_transactions;

-- ============================================================================
-- SECTION 2: RESET USER SUBSCRIPTIONS TO FREE TIER
-- ============================================================================

-- Reset all subscriptions to free tier and clear Apple/Stripe data
UPDATE public.user_subscriptions
SET 
  tier_id = 'free',
  status = 'active',
  billing_cycle = 'none',
  stripe_customer_id = NULL,
  stripe_subscription_id = NULL,
  stripe_price_id = NULL,
  current_period_start = NULL,
  current_period_end = NULL,
  trial_end = NULL,
  canceled_at = NULL,
  cancel_at_period_end = FALSE,
  cancel_reason = NULL,
  updated_at = NOW()
WHERE tier_id != 'free';

-- Or delete all subscriptions (users will get free tier by default)
-- Uncomment the line below if you want to delete instead of reset:
-- DELETE FROM public.user_subscriptions;

-- ============================================================================
-- SECTION 3: CLEAR APPLE-SPECIFIC FIELDS FROM PROFILES
-- ============================================================================

-- Clear Apple IAP data from profiles
-- Note: subscription_tier and subscription_status are in user_subscriptions, not profiles
UPDATE public.profiles
SET 
  payment_provider = NULL,
  apple_original_transaction_id = NULL,
  apple_latest_receipt = NULL,
  apple_receipt_expiration_date = NULL,
  updated_at = NOW()
WHERE 
  payment_provider = 'apple' 
  OR apple_original_transaction_id IS NOT NULL;

-- ============================================================================
-- SECTION 4: DELETE PAYMENT TRANSACTIONS (OPTIONAL)
-- ============================================================================

-- Uncomment to delete all payment transactions:
-- DELETE FROM public.payment_transactions;

-- Or just delete Apple-related transactions (if you track payment_provider):
-- DELETE FROM public.payment_transactions
-- WHERE metadata->>'payment_provider' = 'apple';

-- ============================================================================
-- SECTION 5: VERIFY CLEANUP
-- ============================================================================

-- Check remaining Apple transactions
SELECT COUNT(*) as remaining_apple_transactions 
FROM public.apple_transactions;

-- Check users with Apple subscriptions
SELECT 
  p.id,
  p.email,
  p.payment_provider,
  p.apple_original_transaction_id,
  us.tier_id as subscription_tier
FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
WHERE 
  p.payment_provider = 'apple' 
  OR p.apple_original_transaction_id IS NOT NULL
  OR (us.tier_id IS NOT NULL AND us.tier_id != 'free');

-- Check user subscriptions
SELECT 
  us.user_id,
  us.tier_id,
  us.status,
  us.billing_cycle
FROM public.user_subscriptions us
WHERE us.tier_id != 'free';

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
-- After running this script:
-- 1. All users will have free tier
-- 2. All Apple transaction records are deleted
-- 3. All Apple-specific profile fields are cleared
-- 
-- Next steps:
-- 1. Clear Apple IAP purchases on your device (see instructions below)
-- 2. Test the full purchase flow again
-- ============================================================================

