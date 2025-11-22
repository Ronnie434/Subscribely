-- ============================================================================
-- Add Missing cancel_at Column Migration
-- ============================================================================
-- Description: Adds the missing cancel_at column to user_subscriptions table
-- Issue: Cancel subscription feature fails because cancel_at column doesn't exist
-- Date: 2025-11-22
-- 
-- IMPORTANT: Run this script in your Supabase SQL Editor
-- ============================================================================

-- Add the missing cancel_at column
-- This column tracks the scheduled cancellation date (when subscription will cancel)
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;

-- Add index for efficient queries on scheduled cancellations
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_cancel_at 
  ON public.user_subscriptions(cancel_at) 
  WHERE cancel_at IS NOT NULL;

-- Add helpful comment explaining the column's purpose
COMMENT ON COLUMN public.user_subscriptions.cancel_at IS 
  'Scheduled date when subscription will be canceled. Set when user requests cancellation - immediate cancellation uses current timestamp, cancel-at-period-end uses period_end timestamp.';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this after the migration to verify the column was created successfully:

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_subscriptions' 
--   AND column_name = 'cancel_at';

-- Expected result:
-- column_name | data_type                   | is_nullable
-- cancel_at   | timestamp with time zone    | YES

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Test the cancel subscription feature
-- 2. Test the request refund feature  
-- 3. Monitor Edge Function logs for any errors
-- ============================================================================