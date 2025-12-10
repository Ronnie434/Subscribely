-- ============================================================================
-- CLEANUP ALL TEST DATA - START FRESH
-- ============================================================================
-- Description: Removes all subscription and payment data for fresh testing
-- WARNING: This will DELETE ALL user subscription data!
-- Only use in development/testing!
-- ============================================================================

-- STEP 1: Clear user subscriptions
DELETE FROM public.user_subscriptions;

-- STEP 2: Clear payment history
DELETE FROM public.payment_history;

-- STEP 3: Clear Apple transaction audit records (if exists)
DELETE FROM public.apple_transactions WHERE true;

-- STEP 4: Reset profiles to free tier
UPDATE public.profiles
SET 
  payment_provider = NULL,
  apple_original_transaction_id = NULL,
  updated_at = NOW();

-- STEP 5: Verify cleanup
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User subscriptions: %', (SELECT COUNT(*) FROM public.user_subscriptions);
  RAISE NOTICE 'Payment history: %', (SELECT COUNT(*) FROM public.payment_history);
  RAISE NOTICE 'Profiles with subscriptions: %', (SELECT COUNT(*) FROM public.profiles WHERE payment_provider IS NOT NULL);
  RAISE NOTICE '';
  RAISE NOTICE 'All users are now FREE tier';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: To fully test fresh purchases:';
  RAISE NOTICE '1. Clear iOS App Store Sandbox subscriptions:';
  RAISE NOTICE '   Settings > App Store > Sandbox Account > Manage > Clear Purchase History';
  RAISE NOTICE '2. Or sign out and sign in with a NEW sandbox test account';
  RAISE NOTICE '3. Restart the app';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;