-- ============================================================================
-- DIAGNOSTIC QUERIES FOR payment_transactions DEBUG
-- ============================================================================
-- Run these queries in Supabase SQL Editor to diagnose the issue

-- 1. Check recent webhook events for invoice.payment_succeeded
-- This shows if webhooks are being received and what data they contain
SELECT 
  event_id,
  event_type,
  processing_status,
  error_message,
  event_data->'data'->'object'->>'id' as invoice_id,
  event_data->'data'->'object'->>'payment_intent' as payment_intent,
  event_data->'data'->'object'->>'amount_paid' as amount_paid,
  created_at
FROM stripe_webhooks
WHERE event_type = 'invoice.payment_succeeded'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if payment_intent is NULL in webhook data
-- This is the MOST LIKELY issue
SELECT 
  event_id,
  event_type,
  processing_status,
  CASE 
    WHEN event_data->'data'->'object'->>'payment_intent' IS NULL 
    THEN '❌ NULL (THIS IS THE PROBLEM!)'
    ELSE '✅ Has value: ' || (event_data->'data'->'object'->>'payment_intent')
  END as payment_intent_status,
  event_data->'data'->'object'->>'subscription' as subscription_id,
  created_at
FROM stripe_webhooks
WHERE event_type = 'invoice.payment_succeeded'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check RLS policies on payment_transactions table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'payment_transactions';

-- 4. Check table constraints
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'payment_transactions'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 5. Check if any payment_transactions exist at all
SELECT COUNT(*) as transaction_count FROM payment_transactions;

-- 6. Check user_subscriptions that should have transactions
SELECT 
  us.id,
  us.user_id,
  us.stripe_subscription_id,
  us.status,
  us.tier_id,
  COUNT(pt.id) as transaction_count
FROM user_subscriptions us
LEFT JOIN payment_transactions pt ON pt.user_subscription_id = us.id
WHERE us.stripe_subscription_id IS NOT NULL
GROUP BY us.id, us.user_id, us.stripe_subscription_id, us.status, us.tier_id
ORDER BY us.created_at DESC;

-- 7. Test manual insert with service role (will fail if RLS is the issue)
-- Run this as a test - it should succeed if RLS is configured correctly
-- Comment out if you don't want to test
/*
INSERT INTO payment_transactions (
  user_subscription_id,
  stripe_payment_intent_id,
  amount,
  status
) 
SELECT 
  id,
  'test_pi_' || gen_random_uuid()::text,
  9.99,
  'succeeded'
FROM user_subscriptions
WHERE stripe_subscription_id IS NOT NULL
LIMIT 1;
*/

-- 8. Check for duplicate payment_intent attempts
SELECT 
  event_data->'data'->'object'->>'payment_intent' as payment_intent,
  COUNT(*) as attempt_count,
  array_agg(event_id) as event_ids,
  array_agg(processing_status) as statuses
FROM stripe_webhooks
WHERE event_type = 'invoice.payment_succeeded'
  AND event_data->'data'->'object'->>'payment_intent' IS NOT NULL
GROUP BY event_data->'data'->'object'->>'payment_intent'
HAVING COUNT(*) > 1;