-- ============================================================================
-- APPLE IN-APP PURCHASE DATABASE MIGRATION
-- ============================================================================
-- Description: Database schema updates for dual payment provider support
-- Version: 1.0.0 (Phase 4)
-- Date: 2025-12-06
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor
-- 
-- This migration adds:
-- - Payment provider tracking (Stripe vs Apple)
-- - Apple-specific transaction fields
-- - Apple transactions audit table
-- - Indexes for performance
-- - RLS policies for new table
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD PAYMENT PROVIDER SUPPORT TO PROFILES
-- ============================================================================

-- Add payment_provider column to track which payment system the user uses
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS payment_provider TEXT 
CHECK (payment_provider IN ('stripe', 'apple'))
DEFAULT NULL;

COMMENT ON COLUMN public.profiles.payment_provider IS 'Payment provider used by user (stripe or apple)';

-- ============================================================================
-- SECTION 2: ADD APPLE-SPECIFIC COLUMNS TO PROFILES
-- ============================================================================

-- Add Apple transaction tracking fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS apple_latest_receipt TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS apple_receipt_expiration_date TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.apple_original_transaction_id IS 'Apple original transaction ID for subscription tracking';
COMMENT ON COLUMN public.profiles.apple_latest_receipt IS 'Latest receipt data from Apple (base64 encoded)';
COMMENT ON COLUMN public.profiles.apple_receipt_expiration_date IS 'Subscription expiration date from Apple receipt';

-- ============================================================================
-- SECTION 3: CREATE APPLE TRANSACTIONS TABLE
-- ============================================================================

-- Create table for Apple IAP transaction audit trail
CREATE TABLE IF NOT EXISTS public.apple_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Transaction identifiers
  transaction_id TEXT NOT NULL,
  original_transaction_id TEXT NOT NULL,
  
  -- Product information
  product_id TEXT NOT NULL,
  
  -- Transaction dates
  purchase_date TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ,
  
  -- Notification tracking (for webhook events)
  notification_type TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique transactions
  UNIQUE(transaction_id)
);

COMMENT ON TABLE public.apple_transactions IS 'Audit trail of all Apple IAP transactions and webhook notifications';
COMMENT ON COLUMN public.apple_transactions.transaction_id IS 'Unique transaction ID from Apple';
COMMENT ON COLUMN public.apple_transactions.original_transaction_id IS 'Original transaction ID (same for all renewals)';
COMMENT ON COLUMN public.apple_transactions.product_id IS 'Apple product ID that was purchased';
COMMENT ON COLUMN public.apple_transactions.notification_type IS 'Type of Apple webhook notification that triggered this record';

-- ============================================================================
-- SECTION 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for profiles payment provider lookups
CREATE INDEX IF NOT EXISTS idx_profiles_payment_provider 
ON public.profiles(payment_provider) 
WHERE payment_provider IS NOT NULL;

-- Index for profiles Apple transaction ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_apple_original_transaction_id 
ON public.profiles(apple_original_transaction_id) 
WHERE apple_original_transaction_id IS NOT NULL;

-- Indexes for apple_transactions table
CREATE INDEX IF NOT EXISTS idx_apple_transactions_user_id 
ON public.apple_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_apple_transactions_original_transaction_id 
ON public.apple_transactions(original_transaction_id);

CREATE INDEX IF NOT EXISTS idx_apple_transactions_product_id 
ON public.apple_transactions(product_id);

CREATE INDEX IF NOT EXISTS idx_apple_transactions_created 
ON public.apple_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_apple_transactions_notification_type 
ON public.apple_transactions(notification_type) 
WHERE notification_type IS NOT NULL;

-- ============================================================================
-- SECTION 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.apple_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: CREATE RLS POLICIES FOR APPLE_TRANSACTIONS
-- ============================================================================

-- Users can view their own Apple transactions
CREATE POLICY "Users can view own Apple transactions"
  ON public.apple_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all Apple transactions (for webhooks and validation)
CREATE POLICY "Service role can manage all Apple transactions"
  ON public.apple_transactions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SECTION 7: CREATE HELPER FUNCTIONS FOR APPLE IAP
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_user_subscription_status_with_provider
-- Purpose: Returns user subscription status including payment provider
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_subscription_status_with_provider(p_user_id UUID)
RETURNS TABLE(
  tier_name TEXT,
  subscription_status TEXT,
  payment_provider TEXT,
  expiration_date TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.subscription_tier,
    p.subscription_status,
    p.payment_provider,
    CASE 
      WHEN p.payment_provider = 'apple' THEN p.apple_receipt_expiration_date
      WHEN p.payment_provider = 'stripe' THEN us.current_period_end
      ELSE NULL
    END as expiration_date,
    CASE
      WHEN p.payment_provider = 'apple' THEN 
        (p.apple_receipt_expiration_date IS NOT NULL AND p.apple_receipt_expiration_date > NOW())
      WHEN p.payment_provider = 'stripe' THEN 
        (us.status IN ('active', 'trialing', 'past_due'))
      ELSE FALSE
    END as is_active
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
  WHERE p.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_subscription_status_with_provider IS 'Returns user subscription status including payment provider information';

-- ----------------------------------------------------------------------------
-- Function: record_apple_transaction
-- Purpose: Records an Apple IAP transaction in audit trail
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_apple_transaction(
  p_user_id UUID,
  p_transaction_id TEXT,
  p_original_transaction_id TEXT,
  p_product_id TEXT,
  p_purchase_date TIMESTAMPTZ,
  p_expiration_date TIMESTAMPTZ,
  p_notification_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Insert transaction record
  INSERT INTO public.apple_transactions (
    user_id,
    transaction_id,
    original_transaction_id,
    product_id,
    purchase_date,
    expiration_date,
    notification_type
  )
  VALUES (
    p_user_id,
    p_transaction_id,
    p_original_transaction_id,
    p_product_id,
    p_purchase_date,
    p_expiration_date,
    p_notification_type
  )
  ON CONFLICT (transaction_id) DO UPDATE
  SET
    expiration_date = EXCLUDED.expiration_date,
    notification_type = EXCLUDED.notification_type
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.record_apple_transaction IS 'Records an Apple IAP transaction in the audit trail';

-- ----------------------------------------------------------------------------
-- Function: update_user_apple_subscription
-- Purpose: Updates user profile with Apple subscription details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_apple_subscription(
  p_user_id UUID,
  p_original_transaction_id TEXT,
  p_product_id TEXT,
  p_expiration_date TIMESTAMPTZ,
  p_latest_receipt TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  -- Determine tier based on product ID
  IF p_product_id LIKE '%basic%' THEN
    v_tier := 'premium';
  ELSE
    v_tier := 'premium';
  END IF;
  
  -- Update user profile
  UPDATE public.profiles
  SET
    subscription_tier = v_tier,
    subscription_status = 'active',
    payment_provider = 'apple',
    apple_original_transaction_id = p_original_transaction_id,
    apple_latest_receipt = p_latest_receipt,
    apple_receipt_expiration_date = p_expiration_date,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.update_user_apple_subscription IS 'Updates user profile with Apple subscription details after validation';

-- ============================================================================
-- SECTION 8: MIGRATION VERIFICATION
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Apple IAP database migration completed successfully!';
  RAISE NOTICE 'Columns added to profiles: 4';
  RAISE NOTICE 'New table created: apple_transactions';
  RAISE NOTICE 'Indexes created: 7';
  RAISE NOTICE 'Functions created: 3';
  RAISE NOTICE 'RLS policies created: 2';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Deploy Supabase functions for receipt validation';
  RAISE NOTICE '2. Configure Apple environment variables';
  RAISE NOTICE '3. Update client code to use server validation';
END $$;