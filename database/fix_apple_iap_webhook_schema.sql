-- ============================================================================
-- FIX: Apple IAP Webhook Schema Issue
-- ============================================================================
-- Description: Fixes webhook errors by using user_subscriptions table
-- Version: 1.0.0
-- Date: 2025-12-07
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor
-- 
-- This migration adds:
-- - Helper function to ensure user_subscriptions record exists
-- - Helper function to update Apple IAP subscriptions properly
-- - Proper integration between profiles and user_subscriptions tables
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTION - ENSURE SUBSCRIPTION EXISTS
-- ============================================================================

-- Function to ensure a user has a user_subscriptions record
-- Creates a free tier subscription if one doesn't exist
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
    
    RAISE NOTICE 'Created user_subscriptions record for user: %', p_user_id;
  END IF;
  
  RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_subscription_exists IS 
  'Ensures a user_subscriptions record exists for the user, creates one if missing';

-- ============================================================================
-- SECTION 2: HELPER FUNCTION - UPDATE APPLE IAP SUBSCRIPTION
-- ============================================================================

-- Function to update user subscription status for Apple IAP purchases
-- Updates both user_subscriptions and profiles tables atomically
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
  'Updates user subscription status for Apple IAP purchases in both user_subscriptions and profiles tables';

-- ============================================================================
-- SECTION 3: VERIFICATION
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Apple IAP Webhook Schema Fix Applied!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✅ ensure_user_subscription_exists()';
  RAISE NOTICE '  ✅ update_apple_iap_subscription()';
  RAISE NOTICE '';
  RAISE NOTICE 'What this fixes:';
  RAISE NOTICE '  - Eliminates PGRST204 errors about missing columns';
  RAISE NOTICE '  - Uses user_subscriptions table (single source of truth)';
  RAISE NOTICE '  - Properly integrates Apple IAP with paywall system';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Update apple-webhook Edge Function code';
  RAISE NOTICE '  2. Redeploy webhook function';
  RAISE NOTICE '  3. Test purchase and cancellation flows';
  RAISE NOTICE '';
  RAISE NOTICE 'See: docs/APPLE_WEBHOOK_SCHEMA_FIX_PLAN.md';
  RAISE NOTICE '============================================';
END $$;


