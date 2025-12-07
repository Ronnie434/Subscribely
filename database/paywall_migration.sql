-- ============================================================================
-- PAYWALL SYSTEM DATABASE MIGRATION
-- ============================================================================
-- Description: Complete database schema for subscription-based paywall system
-- Version: 1.0.0
-- Date: 2025-11-16
-- 
-- IMPORTANT: Run this script in Supabase SQL Editor
-- 
-- This migration includes:
-- - 6 core tables for subscription management
-- - Row Level Security (RLS) policies
-- - Database functions for business logic
-- - Triggers for automation
-- - Performance indexes
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: subscription_tiers
-- Purpose: Defines available subscription tiers (Free and Premium)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  tier_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  annual_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  subscription_limit INTEGER NOT NULL DEFAULT 5,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_prices CHECK (monthly_price >= 0 AND annual_price >= 0),
  CONSTRAINT valid_limit CHECK (subscription_limit = -1 OR subscription_limit > 0)
);

-- Add comments for documentation
COMMENT ON TABLE public.subscription_tiers IS 'Defines available subscription tiers and their features';
COMMENT ON COLUMN public.subscription_tiers.tier_id IS 'Unique tier identifier (e.g., free, premium)';
COMMENT ON COLUMN public.subscription_tiers.subscription_limit IS 'Maximum subscriptions allowed (-1 for unlimited)';
COMMENT ON COLUMN public.subscription_tiers.features IS 'JSON array of feature identifiers';
COMMENT ON COLUMN public.subscription_tiers.monthly_price IS 'Monthly subscription price in USD';
COMMENT ON COLUMN public.subscription_tiers.annual_price IS 'Annual subscription price in USD';

-- ----------------------------------------------------------------------------
-- Table: user_subscriptions
-- Purpose: Tracks each user's subscription status and Stripe integration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier_id TEXT REFERENCES public.subscription_tiers(tier_id) NOT NULL DEFAULT 'free',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual', 'none')) DEFAULT 'none',
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'paused')) DEFAULT 'active',
  
  -- Stripe integration fields
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Billing period tracking
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation tracking
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancel_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one subscription per user
  UNIQUE (user_id)
);

-- Add comments
COMMENT ON TABLE public.user_subscriptions IS 'Tracks user subscription tier and billing status';
COMMENT ON COLUMN public.user_subscriptions.status IS 'Current subscription status (synced with Stripe)';
COMMENT ON COLUMN public.user_subscriptions.cancel_at_period_end IS 'If true, subscription will cancel at end of billing period';
COMMENT ON COLUMN public.user_subscriptions.stripe_customer_id IS 'Stripe Customer ID for payment processing';
COMMENT ON COLUMN public.user_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID';

-- ----------------------------------------------------------------------------
-- Table: payment_transactions
-- Purpose: Records all payment transactions for audit and history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE CASCADE NOT NULL,
  
  -- Stripe references
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  
  -- Payment details
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')) NOT NULL,
  payment_method_type TEXT,
  
  -- Additional information
  description TEXT,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- Add comments
COMMENT ON TABLE public.payment_transactions IS 'Audit trail of all payment transactions';
COMMENT ON COLUMN public.payment_transactions.stripe_payment_intent_id IS 'Unique Stripe Payment Intent ID';
COMMENT ON COLUMN public.payment_transactions.metadata IS 'Additional Stripe metadata and context';
COMMENT ON COLUMN public.payment_transactions.amount IS 'Payment amount in the specified currency';

-- ----------------------------------------------------------------------------
-- Table: refund_requests
-- Purpose: Tracks refund requests and their processing status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  
  -- Refund details
  refund_amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  user_notes TEXT,
  
  -- Processing status
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'processed', 'failed')) DEFAULT 'pending',
  stripe_refund_id TEXT UNIQUE,
  admin_notes TEXT,
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_refund_amount CHECK (refund_amount > 0)
);

-- Add comments
COMMENT ON TABLE public.refund_requests IS 'Tracks user refund requests and processing status';
COMMENT ON COLUMN public.refund_requests.status IS 'Current status of refund request';
COMMENT ON COLUMN public.refund_requests.stripe_refund_id IS 'Stripe Refund ID after processing';
COMMENT ON COLUMN public.refund_requests.requested_at IS 'When the refund was requested by user';

-- ----------------------------------------------------------------------------
-- Table: stripe_webhooks
-- Purpose: Logs all Stripe webhook events for debugging and idempotency
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Event details
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  
  -- Processing status
  processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'ignored')) DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_retry_count CHECK (retry_count >= 0)
);

-- Add comments
COMMENT ON TABLE public.stripe_webhooks IS 'Audit log of all Stripe webhook events for idempotency and debugging';
COMMENT ON COLUMN public.stripe_webhooks.event_id IS 'Unique Stripe event ID (ensures idempotency)';
COMMENT ON COLUMN public.stripe_webhooks.event_data IS 'Complete webhook event payload from Stripe';
COMMENT ON COLUMN public.stripe_webhooks.processing_status IS 'Current processing status of the webhook';

-- ----------------------------------------------------------------------------
-- Table: usage_tracking_events
-- Purpose: Tracks user interactions with paywall for analytics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_tracking_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  event_context TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.usage_tracking_events IS 'Tracks paywall interaction events for conversion analytics';
COMMENT ON COLUMN public.usage_tracking_events.event_type IS 'Type of event (e.g., paywall_viewed, plan_selected, payment_completed)';
COMMENT ON COLUMN public.usage_tracking_events.event_context IS 'Context where event occurred (e.g., add_subscription_limit)';
COMMENT ON COLUMN public.usage_tracking_events.event_data IS 'Additional event metadata in JSON format';

-- ============================================================================
-- SECTION 2: INSERT DEFAULT DATA
-- ============================================================================

-- Insert subscription tier definitions
INSERT INTO public.subscription_tiers (
  tier_id, 
  name, 
  description, 
  monthly_price, 
  annual_price, 
  subscription_limit, 
  features, 
  display_order
) VALUES
  (
    'free',
    'Free',
    'Basic subscription tracking',
    0.00,
    0.00,
    5,
    '["cloud_sync", "renewal_reminders", "basic_stats"]'::jsonb,
    1
  ),
  (
    'premium_tier',
    'Premium',
    'Unlimited subscription tracking with advanced features',
    4.99,
    39.99,
    -1,
    '["cloud_sync", "renewal_reminders", "basic_stats", "advanced_analytics", "priority_support", "unlimited_subscriptions"]'::jsonb,
    2
  )
ON CONFLICT (tier_id) DO NOTHING;

-- ============================================================================
-- SECTION 3: CREATE INDEXES
-- ============================================================================

-- user_subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
  ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer 
  ON public.user_subscriptions(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription 
  ON public.user_subscriptions(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status 
  ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier 
  ON public.user_subscriptions(tier_id);

-- payment_transactions indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_sub 
  ON public.payment_transactions(user_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_intent 
  ON public.payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status 
  ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created 
  ON public.payment_transactions(created_at DESC);

-- refund_requests indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_sub 
  ON public.refund_requests(user_subscription_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_transaction 
  ON public.refund_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status 
  ON public.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested 
  ON public.refund_requests(requested_at DESC);

-- stripe_webhooks indexes
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_id 
  ON public.stripe_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_type 
  ON public.stripe_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_status 
  ON public.stripe_webhooks(processing_status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_created 
  ON public.stripe_webhooks(created_at DESC);

-- usage_tracking_events indexes
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id 
  ON public.usage_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type 
  ON public.usage_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created 
  ON public.usage_tracking_events(created_at DESC);

-- ============================================================================
-- SECTION 4: CREATE HELPER FUNCTION FOR TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column IS 'Automatically updates the updated_at timestamp';

-- ============================================================================
-- SECTION 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: CREATE RLS POLICIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Subscription Tiers Policies
-- ----------------------------------------------------------------------------

-- Anyone can view active subscription tiers
CREATE POLICY "Anyone can view active subscription tiers"
  ON public.subscription_tiers
  FOR SELECT
  USING (is_active = TRUE);

-- Service role can manage subscription tiers
CREATE POLICY "Service role can manage subscription tiers"
  ON public.subscription_tiers
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- User Subscriptions Policies
-- ----------------------------------------------------------------------------

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own subscription (for initial setup)
CREATE POLICY "Users can create own subscription"
  ON public.user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role can manage all subscriptions"
  ON public.user_subscriptions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Payment Transactions Policies
-- ----------------------------------------------------------------------------

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_subscriptions 
      WHERE user_subscriptions.id = payment_transactions.user_subscription_id 
        AND user_subscriptions.user_id = auth.uid()
    )
  );

-- Service role can manage all transactions (for webhooks)
CREATE POLICY "Service role can manage all transactions"
  ON public.payment_transactions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Refund Requests Policies
-- ----------------------------------------------------------------------------

-- Users can view their own refund requests
CREATE POLICY "Users can view own refund requests"
  ON public.refund_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.user_subscriptions 
      WHERE user_subscriptions.id = refund_requests.user_subscription_id 
        AND user_subscriptions.user_id = auth.uid()
    )
  );

-- Users can create their own refund requests
CREATE POLICY "Users can create own refund requests"
  ON public.refund_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.user_subscriptions 
      WHERE user_subscriptions.id = refund_requests.user_subscription_id 
        AND user_subscriptions.user_id = auth.uid()
    )
  );

-- Service role can manage all refund requests
CREATE POLICY "Service role can manage all refund requests"
  ON public.refund_requests
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Stripe Webhooks Policies
-- ----------------------------------------------------------------------------

-- Only service role can access webhooks
CREATE POLICY "Service role can manage webhooks"
  ON public.stripe_webhooks
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ----------------------------------------------------------------------------
-- Usage Tracking Policies
-- ----------------------------------------------------------------------------

-- Users can view their own usage events
CREATE POLICY "Users can view own usage events"
  ON public.usage_tracking_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage events
CREATE POLICY "Users can track own usage events"
  ON public.usage_tracking_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can access all usage events
CREATE POLICY "Service role can access all usage events"
  ON public.usage_tracking_events
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SECTION 7: CREATE DATABASE FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_user_subscription_limit
-- Purpose: Returns the subscription limit for a user based on their tier
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_subscription_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  -- Get the subscription limit for the user's current tier
  SELECT st.subscription_limit INTO v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON us.tier_id = st.tier_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active';
  
  -- If no active subscription found, return free tier limit
  IF v_limit IS NULL THEN
    SELECT subscription_limit INTO v_limit
    FROM public.subscription_tiers
    WHERE tier_id = 'free';
  END IF;
  
  RETURN COALESCE(v_limit, 5);
END;
$$;

COMMENT ON FUNCTION public.get_user_subscription_limit IS 'Returns subscription limit for a user based on their tier';

-- ----------------------------------------------------------------------------
-- Function: can_user_add_subscription
-- Purpose: Checks if user can add a new subscription based on their tier limit
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_add_subscription(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
BEGIN
  -- Get current subscription count (assumes subscriptions table exists)
  SELECT COUNT(*) INTO v_count
  FROM public.subscriptions
  WHERE user_id = p_user_id;
  
  -- Get user's tier and limit
  SELECT us.tier_id, st.subscription_limit
  INTO v_tier, v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON us.tier_id = st.tier_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing', 'incomplete', 'past_due', 'paused');
  
  -- Default to free tier if no subscription found
  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_limit := 5;
  END IF;
  
  -- -1 means unlimited
  IF v_limit = -1 THEN
    RETURN QUERY SELECT TRUE, v_count, v_limit, v_tier;
  ELSE
    RETURN QUERY SELECT (v_count < v_limit), v_count, v_limit, v_tier;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.can_user_add_subscription IS 'Checks if user can add a new subscription based on their tier limit';

-- ----------------------------------------------------------------------------
-- Function: initialize_user_subscription
-- Purpose: Automatically creates free tier subscription for new users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initialize_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create free tier subscription for new user
  INSERT INTO public.user_subscriptions (
    user_id, 
    tier_id, 
    billing_cycle, 
    status
  )
  VALUES (
    NEW.id, 
    'free', 
    'none', 
    'active'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.initialize_user_subscription IS 'Automatically creates free tier subscription for new users';

-- ----------------------------------------------------------------------------
-- Function: process_stripe_webhook
-- Purpose: Idempotent function to log and process Stripe webhook events
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_stripe_webhook(
  p_event_id TEXT,
  p_event_type TEXT,
  p_event_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_webhook_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check if event already processed (idempotency)
  SELECT id INTO v_existing_id
  FROM public.stripe_webhooks
  WHERE event_id = p_event_id;
  
  IF v_existing_id IS NOT NULL THEN
    -- Event already processed, return existing ID
    RETURN v_existing_id;
  END IF;
  
  -- Insert new webhook event
  INSERT INTO public.stripe_webhooks (
    event_id, 
    event_type, 
    event_data, 
    processing_status
  )
  VALUES (
    p_event_id, 
    p_event_type, 
    p_event_data, 
    'pending'
  )
  RETURNING id INTO v_webhook_id;
  
  RETURN v_webhook_id;
END;
$$;

COMMENT ON FUNCTION public.process_stripe_webhook IS 'Idempotent function to log and process Stripe webhook events';

-- ----------------------------------------------------------------------------
-- Function: track_usage_event
-- Purpose: Tracks user interaction events with the paywall system
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_usage_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_context TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.usage_tracking_events (
    user_id, 
    event_type, 
    event_context, 
    event_data
  )
  VALUES (
    p_user_id, 
    p_event_type, 
    p_event_context, 
    p_event_data
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.track_usage_event IS 'Tracks user interaction events with the paywall system';

-- ----------------------------------------------------------------------------
-- Function: calculate_refund_eligibility
-- Purpose: Checks if a subscription qualifies for refund (7-day window)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_refund_eligibility(
  p_subscription_id UUID
)
RETURNS TABLE(
  eligible BOOLEAN,
  days_since_payment INTEGER,
  refund_window_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_date TIMESTAMPTZ;
  v_days_since INTEGER;
  v_window_days INTEGER := 7;
BEGIN
  -- Get the most recent successful payment for this subscription
  SELECT pt.created_at INTO v_payment_date
  FROM public.payment_transactions pt
  WHERE pt.user_subscription_id = p_subscription_id
    AND pt.status = 'succeeded'
  ORDER BY pt.created_at DESC
  LIMIT 1;
  
  IF v_payment_date IS NULL THEN
    -- No payment found
    RETURN QUERY SELECT FALSE, 0, v_window_days;
  ELSE
    -- Calculate days since payment
    v_days_since := EXTRACT(DAY FROM (NOW() - v_payment_date))::INTEGER;
    
    RETURN QUERY SELECT 
      (v_days_since <= v_window_days), 
      v_days_since, 
      v_window_days;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_refund_eligibility IS 'Checks if subscription qualifies for refund (7-day window)';

-- ----------------------------------------------------------------------------
-- Function: downgrade_to_free
-- Purpose: Safely downgrades a user to free tier
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.downgrade_to_free(
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update user subscription to free tier
  UPDATE public.user_subscriptions
  SET 
    tier_id = 'free',
    billing_cycle = 'none',
    status = 'active',
    stripe_subscription_id = NULL,
    current_period_start = NULL,
    current_period_end = NULL,
    canceled_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.downgrade_to_free IS 'Safely downgrades a user to free tier';

-- ============================================================================
-- SECTION 8: CREATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on subscription_tiers
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on refund_requests
CREATE TRIGGER update_refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create free subscription for new users
CREATE TRIGGER on_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_subscription();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Paywall database migration completed successfully!';
  RAISE NOTICE 'Tables created: 6';
  RAISE NOTICE 'Indexes created: 20';
  RAISE NOTICE 'Functions created: 6';
  RAISE NOTICE 'Triggers created: 4';
  RAISE NOTICE 'RLS policies enabled on all tables';
END $$;