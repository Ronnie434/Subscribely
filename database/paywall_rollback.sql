-- ============================================================================
-- PAYWALL SYSTEM ROLLBACK MIGRATION
-- ============================================================================
-- Description: Safely removes all paywall-related database objects
-- Version: 1.0.0
-- Date: 2025-11-16
-- 
-- WARNING: This script will permanently delete all paywall data!
-- 
-- IMPORTANT: 
-- - Backup your data before running this script
-- - This action is IRREVERSIBLE
-- - Run this script in Supabase SQL Editor only if you need to rollback
-- 
-- This rollback script removes (in reverse order):
-- - Triggers
-- - RLS Policies
-- - Functions
-- - Indexes
-- - Tables
-- ============================================================================

-- ============================================================================
-- SECTION 1: DROP TRIGGERS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping triggers...';
END $$;

-- Drop user subscription initialization trigger
DROP TRIGGER IF EXISTS on_user_created_subscription ON auth.users;

-- Drop updated_at triggers
DROP TRIGGER IF EXISTS update_refund_requests_updated_at ON public.refund_requests;
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON public.user_subscriptions;
DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON public.subscription_tiers;

-- ============================================================================
-- SECTION 2: DROP RLS POLICIES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping Row Level Security policies...';
END $$;

-- Drop usage_tracking_events policies
DROP POLICY IF EXISTS "Service role can access all usage events" ON public.usage_tracking_events;
DROP POLICY IF EXISTS "Users can track own usage events" ON public.usage_tracking_events;
DROP POLICY IF EXISTS "Users can view own usage events" ON public.usage_tracking_events;

-- Drop stripe_webhooks policies
DROP POLICY IF EXISTS "Service role can manage webhooks" ON public.stripe_webhooks;

-- Drop refund_requests policies
DROP POLICY IF EXISTS "Service role can manage all refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can create own refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;

-- Drop payment_transactions policies
DROP POLICY IF EXISTS "Service role can manage all transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;

-- Drop user_subscriptions policies
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can create own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;

-- Drop subscription_tiers policies
DROP POLICY IF EXISTS "Service role can manage subscription tiers" ON public.subscription_tiers;
DROP POLICY IF EXISTS "Anyone can view active subscription tiers" ON public.subscription_tiers;

-- ============================================================================
-- SECTION 3: DISABLE ROW LEVEL SECURITY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Disabling Row Level Security...';
END $$;

ALTER TABLE IF EXISTS public.usage_tracking_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stripe_webhooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refund_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscription_tiers DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: DROP FUNCTIONS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping database functions...';
END $$;

-- Drop business logic functions
DROP FUNCTION IF EXISTS public.downgrade_to_free(UUID);
DROP FUNCTION IF EXISTS public.calculate_refund_eligibility(UUID);
DROP FUNCTION IF EXISTS public.track_usage_event(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.process_stripe_webhook(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.initialize_user_subscription();
DROP FUNCTION IF EXISTS public.can_user_add_subscription(UUID);
DROP FUNCTION IF EXISTS public.get_user_subscription_limit(UUID);

-- Drop helper functions
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- ============================================================================
-- SECTION 5: DROP INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping indexes...';
END $$;

-- Drop usage_tracking_events indexes
DROP INDEX IF EXISTS public.idx_usage_events_created;
DROP INDEX IF EXISTS public.idx_usage_events_type;
DROP INDEX IF EXISTS public.idx_usage_events_user_id;

-- Drop stripe_webhooks indexes
DROP INDEX IF EXISTS public.idx_stripe_webhooks_created;
DROP INDEX IF EXISTS public.idx_stripe_webhooks_status;
DROP INDEX IF EXISTS public.idx_stripe_webhooks_event_type;
DROP INDEX IF EXISTS public.idx_stripe_webhooks_event_id;

-- Drop refund_requests indexes
DROP INDEX IF EXISTS public.idx_refund_requests_requested;
DROP INDEX IF EXISTS public.idx_refund_requests_status;
DROP INDEX IF EXISTS public.idx_refund_requests_transaction;
DROP INDEX IF EXISTS public.idx_refund_requests_user_sub;

-- Drop payment_transactions indexes
DROP INDEX IF EXISTS public.idx_payment_transactions_created;
DROP INDEX IF EXISTS public.idx_payment_transactions_status;
DROP INDEX IF EXISTS public.idx_payment_transactions_stripe_intent;
DROP INDEX IF EXISTS public.idx_payment_transactions_user_sub;

-- Drop user_subscriptions indexes
DROP INDEX IF EXISTS public.idx_user_subscriptions_tier;
DROP INDEX IF EXISTS public.idx_user_subscriptions_status;
DROP INDEX IF EXISTS public.idx_user_subscriptions_stripe_subscription;
DROP INDEX IF EXISTS public.idx_user_subscriptions_stripe_customer;
DROP INDEX IF EXISTS public.idx_user_subscriptions_user_id;

-- ============================================================================
-- SECTION 6: DROP TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Dropping tables...';
  RAISE NOTICE 'WARNING: All paywall data will be permanently deleted!';
END $$;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.usage_tracking_events CASCADE;
DROP TABLE IF EXISTS public.stripe_webhooks CASCADE;
DROP TABLE IF EXISTS public.refund_requests CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_tiers CASCADE;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Paywall system rollback completed successfully!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'All paywall database objects have been removed:';
  RAISE NOTICE '- 6 tables dropped';
  RAISE NOTICE '- 20 indexes dropped';
  RAISE NOTICE '- 8 functions dropped';
  RAISE NOTICE '- 4 triggers dropped';
  RAISE NOTICE '- 16 RLS policies dropped';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'WARNING: All paywall data has been permanently deleted!';
  RAISE NOTICE '============================================================';
END $$;