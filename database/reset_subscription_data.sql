-- ============================================================================
-- RESET SUBSCRIPTION DATA SCRIPT
-- ============================================================================
-- Usage: Run this in Supabase SQL Editor to reset subscription data for testing.
-- WARNING: The first section deletes ALL data. Use the "Specific User" section for safety.

-- ============================================================================
-- OPTION 1: RESET EVERYTHING (ALL USERS)
-- ============================================================================

-- 1. Reset user subscriptions (Delete premium status)
DELETE FROM public.user_subscriptions;

-- 2. Reset user profiles (Clear IAP fields only)
-- Note: subscription_tier/status are in user_subscriptions, not profiles
UPDATE public.profiles
SET 
  payment_provider = NULL,
  apple_original_transaction_id = NULL,
  apple_receipt_expiration_date = NULL,
  updated_at = NOW();

-- 3. Clear transaction history
DELETE FROM public.apple_transactions;
DELETE FROM public.payment_transactions;

-- 4. Clear webhook logs
DELETE FROM public.stripe_webhooks;


-- ============================================================================
-- OPTION 2: RESET SPECIFIC USER (SAFER)
-- ============================================================================
/*
-- Replace 'YOUR_USER_ID_HERE' with the UUID from auth.users

-- 1. Delete subscription
DELETE FROM public.user_subscriptions 
WHERE user_id = 'YOUR_USER_ID_HERE';

-- 2. Reset profile (Clear IAP fields only)
UPDATE public.profiles
SET 
  payment_provider = NULL,
  apple_original_transaction_id = NULL,
  apple_receipt_expiration_date = NULL,
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID_HERE';

-- 3. Clear transactions for this user
DELETE FROM public.apple_transactions 
WHERE user_id = 'YOUR_USER_ID_HERE';
*/
