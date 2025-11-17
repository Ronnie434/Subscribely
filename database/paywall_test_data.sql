-- ============================================================================
-- PAYWALL SYSTEM TEST DATA SEEDING SCRIPT
-- ============================================================================
-- Description: Seeds the database with test data for development and testing
-- Version: 1.0.0
-- Date: 2025-11-16
-- 
-- IMPORTANT: Only run this script in development/staging environments!
-- DO NOT run this in production!
-- 
-- This script creates:
-- - Test user subscriptions in various states
-- - Sample payment transactions
-- - Sample webhook events
-- - Sample usage tracking events
-- - Sample refund requests
-- ============================================================================

-- ============================================================================
-- PREREQUISITES CHECK
-- ============================================================================

DO $$
BEGIN
  -- Verify subscription tiers exist
  IF NOT EXISTS (SELECT 1 FROM public.subscription_tiers WHERE tier_id = 'free') THEN
    RAISE EXCEPTION 'Subscription tiers not found. Run paywall_migration.sql first!';
  END IF;
  
  RAISE NOTICE 'Prerequisites check passed. Proceeding with test data seeding...';
END $$;

-- ============================================================================
-- SECTION 1: TEST USER SUBSCRIPTIONS
-- ============================================================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_subscription_id UUID;
BEGIN
  RAISE NOTICE 'Creating test user subscriptions...';
  
  -- Note: In a real scenario, you would use actual user IDs from auth.users
  -- For testing, you can replace these UUIDs with real user IDs from your database
  
  -- Test User 1: Free tier user with 3 subscriptions
  -- (Replace with actual user_id from your auth.users table)
  -- Example: v_test_user_id := '00000000-0000-0000-0000-000000000001';
  
  RAISE NOTICE 'Note: To use this script, replace the placeholder UUIDs with actual user IDs from auth.users';
  RAISE NOTICE 'Example: SELECT id FROM auth.users LIMIT 5;';
  
END $$;

-- ============================================================================
-- EXAMPLE TEST DATA (Template)
-- ============================================================================
-- Uncomment and modify with real user IDs to seed test data

/*
-- Example 1: Free tier user (active)
INSERT INTO public.user_subscriptions (
  user_id,
  tier_id,
  billing_cycle,
  status,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_REAL_USER_ID_1'::UUID,
  'free',
  'none',
  'active',
  NOW() - INTERVAL '30 days',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  tier_id = EXCLUDED.tier_id,
  status = EXCLUDED.status;

-- Example 2: Premium tier user (monthly, active)
INSERT INTO public.user_subscriptions (
  user_id,
  tier_id,
  billing_cycle,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_REAL_USER_ID_2'::UUID,
  'premium',
  'monthly',
  'active',
  'cus_test_123456',
  'sub_test_123456',
  'price_test_monthly',
  NOW() - INTERVAL '15 days',
  NOW() + INTERVAL '15 days',
  NOW() - INTERVAL '60 days',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  tier_id = EXCLUDED.tier_id,
  status = EXCLUDED.status,
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id;

-- Example 3: Premium tier user (annual, active)
INSERT INTO public.user_subscriptions (
  user_id,
  tier_id,
  billing_cycle,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_REAL_USER_ID_3'::UUID,
  'premium',
  'annual',
  'active',
  'cus_test_789012',
  'sub_test_789012',
  'price_test_annual',
  NOW() - INTERVAL '90 days',
  NOW() + INTERVAL '275 days',
  NOW() - INTERVAL '90 days',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  tier_id = EXCLUDED.tier_id,
  billing_cycle = EXCLUDED.billing_cycle,
  status = EXCLUDED.status;

-- Example 4: Canceled subscription (retains premium until period end)
INSERT INTO public.user_subscriptions (
  user_id,
  tier_id,
  billing_cycle,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  canceled_at,
  cancel_at_period_end,
  cancel_reason,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_REAL_USER_ID_4'::UUID,
  'premium',
  'monthly',
  'active',
  'cus_test_345678',
  'sub_test_345678',
  NOW() - INTERVAL '20 days',
  NOW() + INTERVAL '10 days',
  NOW() - INTERVAL '5 days',
  TRUE,
  'Too expensive',
  NOW() - INTERVAL '120 days',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  canceled_at = EXCLUDED.canceled_at,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end;

-- Example 5: Past due subscription (payment failed)
INSERT INTO public.user_subscriptions (
  user_id,
  tier_id,
  billing_cycle,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
) VALUES (
  'REPLACE_WITH_REAL_USER_ID_5'::UUID,
  'premium',
  'monthly',
  'past_due',
  'cus_test_901234',
  'sub_test_901234',
  NOW() - INTERVAL '35 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '180 days',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  status = EXCLUDED.status;
*/

-- ============================================================================
-- SECTION 2: SAMPLE PAYMENT TRANSACTIONS
-- ============================================================================

/*
-- Get subscription ID for payment transaction examples
DO $$
DECLARE
  v_premium_sub_id UUID;
BEGIN
  -- Get a premium subscription ID
  SELECT id INTO v_premium_sub_id
  FROM public.user_subscriptions
  WHERE tier_id = 'premium'
  LIMIT 1;
  
  IF v_premium_sub_id IS NOT NULL THEN
    -- Successful payment transaction
    INSERT INTO public.payment_transactions (
      user_subscription_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      stripe_invoice_id,
      amount,
      currency,
      status,
      payment_method_type,
      description,
      created_at
    ) VALUES (
      v_premium_sub_id,
      'pi_test_success_001',
      'ch_test_success_001',
      'in_test_001',
      4.99,
      'usd',
      'succeeded',
      'card',
      'Monthly Premium Subscription',
      NOW() - INTERVAL '15 days'
    ) ON CONFLICT (stripe_payment_intent_id) DO NOTHING;
    
    -- Another successful payment (previous month)
    INSERT INTO public.payment_transactions (
      user_subscription_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      stripe_invoice_id,
      amount,
      currency,
      status,
      payment_method_type,
      description,
      created_at
    ) VALUES (
      v_premium_sub_id,
      'pi_test_success_002',
      'ch_test_success_002',
      'in_test_002',
      4.99,
      'usd',
      'succeeded',
      'card',
      'Monthly Premium Subscription',
      NOW() - INTERVAL '45 days'
    ) ON CONFLICT (stripe_payment_intent_id) DO NOTHING;
    
    -- Failed payment transaction
    INSERT INTO public.payment_transactions (
      user_subscription_id,
      stripe_payment_intent_id,
      amount,
      currency,
      status,
      payment_method_type,
      failure_reason,
      created_at
    ) VALUES (
      v_premium_sub_id,
      'pi_test_failed_001',
      4.99,
      'usd',
      'failed',
      'card',
      'Card was declined due to insufficient funds',
      NOW() - INTERVAL '2 days'
    ) ON CONFLICT (stripe_payment_intent_id) DO NOTHING;
    
    RAISE NOTICE 'Sample payment transactions created';
  END IF;
END $$;

-- Sample annual payment
DO $$
DECLARE
  v_annual_sub_id UUID;
BEGIN
  SELECT id INTO v_annual_sub_id
  FROM public.user_subscriptions
  WHERE tier_id = 'premium' AND billing_cycle = 'annual'
  LIMIT 1;
  
  IF v_annual_sub_id IS NOT NULL THEN
    INSERT INTO public.payment_transactions (
      user_subscription_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      stripe_invoice_id,
      amount,
      currency,
      status,
      payment_method_type,
      description,
      created_at
    ) VALUES (
      v_annual_sub_id,
      'pi_test_annual_001',
      'ch_test_annual_001',
      'in_test_annual_001',
      39.00,
      'usd',
      'succeeded',
      'card',
      'Annual Premium Subscription',
      NOW() - INTERVAL '90 days'
    ) ON CONFLICT (stripe_payment_intent_id) DO NOTHING;
    
    RAISE NOTICE 'Sample annual payment created';
  END IF;
END $$;
*/

-- ============================================================================
-- SECTION 3: SAMPLE STRIPE WEBHOOK EVENTS
-- ============================================================================

/*
-- Sample webhook: subscription created
INSERT INTO public.stripe_webhooks (
  event_id,
  event_type,
  event_data,
  processing_status,
  processed_at,
  created_at
) VALUES (
  'evt_test_subscription_created_001',
  'customer.subscription.created',
  '{"id": "sub_test_123456", "object": "subscription", "status": "active"}'::jsonb,
  'processed',
  NOW() - INTERVAL '60 days',
  NOW() - INTERVAL '60 days'
) ON CONFLICT (event_id) DO NOTHING;

-- Sample webhook: payment succeeded
INSERT INTO public.stripe_webhooks (
  event_id,
  event_type,
  event_data,
  processing_status,
  processed_at,
  created_at
) VALUES (
  'evt_test_payment_succeeded_001',
  'invoice.payment_succeeded',
  '{"id": "in_test_001", "amount_paid": 499, "status": "paid"}'::jsonb,
  'processed',
  NOW() - INTERVAL '15 days',
  NOW() - INTERVAL '15 days'
) ON CONFLICT (event_id) DO NOTHING;

-- Sample webhook: payment failed
INSERT INTO public.stripe_webhooks (
  event_id,
  event_type,
  event_data,
  processing_status,
  retry_count,
  created_at
) VALUES (
  'evt_test_payment_failed_001',
  'invoice.payment_failed',
  '{"id": "in_test_003", "amount_due": 499, "status": "open"}'::jsonb,
  'processed',
  1,
  NOW() - INTERVAL '2 days'
) ON CONFLICT (event_id) DO NOTHING;

-- Sample webhook: subscription canceled
INSERT INTO public.stripe_webhooks (
  event_id,
  event_type,
  event_data,
  processing_status,
  processed_at,
  created_at
) VALUES (
  'evt_test_subscription_deleted_001',
  'customer.subscription.deleted',
  '{"id": "sub_test_345678", "status": "canceled", "cancel_at_period_end": true}'::jsonb,
  'processed',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
) ON CONFLICT (event_id) DO NOTHING;

RAISE NOTICE 'Sample webhook events created';
*/

-- ============================================================================
-- SECTION 4: SAMPLE USAGE TRACKING EVENTS
-- ============================================================================

/*
-- Paywall viewed events
DO $$
DECLARE
  v_test_user_id UUID;
BEGIN
  -- Replace with actual user ID
  v_test_user_id := 'REPLACE_WITH_REAL_USER_ID_1'::UUID;
  
  -- User hit subscription limit
  INSERT INTO public.usage_tracking_events (
    user_id,
    event_type,
    event_context,
    event_data,
    created_at
  ) VALUES (
    v_test_user_id,
    'limit_reached',
    'add_subscription_attempt',
    '{"current_count": 5, "limit": 5, "tier": "free"}'::jsonb,
    NOW() - INTERVAL '3 days'
  );
  
  -- Paywall displayed
  INSERT INTO public.usage_tracking_events (
    user_id,
    event_type,
    event_context,
    event_data,
    created_at
  ) VALUES (
    v_test_user_id,
    'paywall_viewed',
    'subscription_limit',
    '{"trigger": "add_subscription", "subscriptions_count": 5}'::jsonb,
    NOW() - INTERVAL '3 days'
  );
  
  -- Plan selected
  INSERT INTO public.usage_tracking_events (
    user_id,
    event_type,
    event_context,
    event_data,
    created_at
  ) VALUES (
    v_test_user_id,
    'plan_selected',
    'upgrade_screen',
    '{"plan": "monthly", "price": 4.99}'::jsonb,
    NOW() - INTERVAL '3 days'
  );
  
  -- Payment initiated
  INSERT INTO public.usage_tracking_events (
    user_id,
    event_type,
    event_context,
    event_data,
    created_at
  ) VALUES (
    v_test_user_id,
    'payment_initiated',
    'stripe_payment_sheet',
    '{"plan": "monthly", "amount": 4.99}'::jsonb,
    NOW() - INTERVAL '3 days'
  );
  
  RAISE NOTICE 'Sample usage tracking events created';
END $$;
*/

-- ============================================================================
-- SECTION 5: SAMPLE REFUND REQUESTS
-- ============================================================================

/*
DO $$
DECLARE
  v_subscription_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get a premium subscription
  SELECT id INTO v_subscription_id
  FROM public.user_subscriptions
  WHERE tier_id = 'premium'
  LIMIT 1;
  
  -- Get a recent successful transaction
  SELECT id INTO v_transaction_id
  FROM public.payment_transactions
  WHERE status = 'succeeded'
    AND created_at > NOW() - INTERVAL '7 days'
  LIMIT 1;
  
  IF v_subscription_id IS NOT NULL AND v_transaction_id IS NOT NULL THEN
    -- Refund request within 7-day window (eligible)
    INSERT INTO public.refund_requests (
      user_subscription_id,
      transaction_id,
      refund_amount,
      reason,
      user_notes,
      status,
      requested_at,
      created_at
    ) VALUES (
      v_subscription_id,
      v_transaction_id,
      4.99,
      'Not satisfied with service',
      'I expected more features for the price',
      'pending',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days'
    );
    
    RAISE NOTICE 'Sample refund request created';
  END IF;
END $$;

-- Processed refund example
DO $$
DECLARE
  v_subscription_id UUID;
  v_transaction_id UUID;
BEGIN
  SELECT us.id, pt.id INTO v_subscription_id, v_transaction_id
  FROM public.user_subscriptions us
  JOIN public.payment_transactions pt ON pt.user_subscription_id = us.id
  WHERE us.tier_id = 'premium'
    AND pt.status = 'succeeded'
    AND pt.created_at < NOW() - INTERVAL '30 days'
  LIMIT 1;
  
  IF v_subscription_id IS NOT NULL AND v_transaction_id IS NOT NULL THEN
    INSERT INTO public.refund_requests (
      user_subscription_id,
      transaction_id,
      refund_amount,
      reason,
      user_notes,
      status,
      stripe_refund_id,
      requested_at,
      processed_at,
      created_at,
      updated_at
    ) VALUES (
      v_subscription_id,
      v_transaction_id,
      4.99,
      'Duplicate charge',
      NULL,
      'processed',
      're_test_processed_001',
      NOW() - INTERVAL '25 days',
      NOW() - INTERVAL '24 days',
      NOW() - INTERVAL '25 days',
      NOW() - INTERVAL '24 days'
    );
    
    RAISE NOTICE 'Sample processed refund created';
  END IF;
END $$;
*/

-- ============================================================================
-- SECTION 6: VERIFICATION QUERIES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'TEST DATA SEEDING INSTRUCTIONS';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. First, get actual user IDs from your database:';
  RAISE NOTICE '   SELECT id, email FROM auth.users LIMIT 5;';
  RAISE NOTICE '';
  RAISE NOTICE '2. Replace REPLACE_WITH_REAL_USER_ID_X with actual UUIDs';
  RAISE NOTICE '   in the commented sections above';
  RAISE NOTICE '';
  RAISE NOTICE '3. Uncomment the relevant sections to seed test data';
  RAISE NOTICE '';
  RAISE NOTICE '4. Run verification queries below to check seeded data';
  RAISE NOTICE '============================================================';
END $$;

-- Verification queries (uncomment to run after seeding)

/*
-- Verify subscription tiers
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit,
  is_active
FROM public.subscription_tiers
ORDER BY display_order;

-- Verify user subscriptions
SELECT 
  us.user_id,
  us.tier_id,
  us.billing_cycle,
  us.status,
  us.stripe_customer_id,
  us.created_at
FROM public.user_subscriptions us
ORDER BY us.created_at DESC;

-- Verify payment transactions
SELECT 
  pt.stripe_payment_intent_id,
  pt.amount,
  pt.currency,
  pt.status,
  pt.created_at
FROM public.payment_transactions pt
ORDER BY pt.created_at DESC;

-- Verify webhook events
SELECT 
  sw.event_id,
  sw.event_type,
  sw.processing_status,
  sw.created_at
FROM public.stripe_webhooks sw
ORDER BY sw.created_at DESC;

-- Verify usage tracking events
SELECT 
  ute.user_id,
  ute.event_type,
  ute.event_context,
  ute.created_at
FROM public.usage_tracking_events ute
ORDER BY ute.created_at DESC;

-- Verify refund requests
SELECT 
  rr.refund_amount,
  rr.reason,
  rr.status,
  rr.requested_at,
  rr.processed_at
FROM public.refund_requests rr
ORDER BY rr.requested_at DESC;
*/

-- ============================================================================
-- SEEDING COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Test data seeding script ready!';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: Uncomment and modify sections with real user IDs';
  RAISE NOTICE 'before running this script.';
  RAISE NOTICE '';
  RAISE NOTICE 'DO NOT run this in production!';
  RAISE NOTICE '============================================================';
END $$;