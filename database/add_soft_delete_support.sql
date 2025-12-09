-- ============================================================================
-- SOFT DELETE SUPPORT FOR DELETE ACCOUNT FEATURE (PHASE 1)
-- ============================================================================
-- Description: Implements 30-day grace period for account deletion
-- Version: 1.0.0
-- Date: 2025-12-09
-- 
-- This migration includes:
-- - deleted_at column on profiles table for soft delete tracking
-- - account_deletion_logs table for audit trail
-- - Updated RLS policies to exclude soft-deleted accounts
-- - Performance indexes for deletion queries
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD SOFT DELETE COLUMN TO PROFILES
-- ============================================================================

-- Add deleted_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'profiles' 
      AND column_name = 'deleted_at'
  ) THEN
    -- Add the deleted_at column
    ALTER TABLE public.profiles 
    ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
    
    -- Add comment explaining the column
    COMMENT ON COLUMN public.profiles.deleted_at IS 'Timestamp when user requested account deletion. NULL = active account. After 30 days, account is permanently deleted.';
    
    RAISE NOTICE 'Added deleted_at column to profiles table';
  ELSE
    RAISE NOTICE 'deleted_at column already exists on profiles - skipping';
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: CREATE ACCOUNT DELETION AUDIT LOG TABLE
-- ============================================================================

-- Create account_deletion_logs table for tracking deletion requests and recovery
CREATE TABLE IF NOT EXISTS public.account_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  ip_address TEXT,
  permanently_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add table and column comments
COMMENT ON TABLE public.account_deletion_logs IS 'Audit trail of account deletion requests and permanent deletions';
COMMENT ON COLUMN public.account_deletion_logs.user_id IS 'User who requested account deletion';
COMMENT ON COLUMN public.account_deletion_logs.deleted_at IS 'Timestamp when deletion was requested';
COMMENT ON COLUMN public.account_deletion_logs.reason IS 'Optional reason for deletion (for future use)';
COMMENT ON COLUMN public.account_deletion_logs.ip_address IS 'IP address of deletion request (for security audit)';
COMMENT ON COLUMN public.account_deletion_logs.permanently_deleted_at IS 'Timestamp when account was permanently deleted (set by cleanup job)';
COMMENT ON COLUMN public.account_deletion_logs.created_at IS 'Record creation timestamp';

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY ON AUDIT LOG
-- ============================================================================

ALTER TABLE public.account_deletion_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: CREATE RLS POLICIES FOR AUDIT LOG
-- ============================================================================

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can view own deletion logs" ON public.account_deletion_logs;

-- Users can only view their own deletion logs
CREATE POLICY "Users can view own deletion logs"
  ON public.account_deletion_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all deletion logs (for cleanup job and admin access)
DROP POLICY IF EXISTS "Service role can manage deletion logs" ON public.account_deletion_logs;

CREATE POLICY "Service role can manage deletion logs"
  ON public.account_deletion_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SECTION 5: UPDATE RLS POLICIES FOR PROFILES TABLE
-- ============================================================================

-- Update SELECT policy to exclude soft-deleted accounts
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    AND deleted_at IS NULL  -- Exclude soft-deleted accounts
  );

-- Update INSERT policy (soft-deleted accounts should not be created)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND deleted_at IS NULL  -- Prevent inserting soft-deleted accounts
  );

-- Update UPDATE policy to prevent updates to deleted accounts
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND deleted_at IS NULL  -- Prevent updates to soft-deleted accounts
  )
  WITH CHECK (
    auth.uid() = id
  );

-- Service role can manage all profiles (for recovery and cleanup operations)
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

CREATE POLICY "Service role can manage profiles"
  ON public.profiles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SECTION 6: CREATE PERFORMANCE INDEXES
-- ============================================================================

-- Index on profiles.deleted_at for finding deleted accounts
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at 
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Index on account_deletion_logs.user_id for lookups
CREATE INDEX IF NOT EXISTS idx_deletion_logs_user_id 
  ON public.account_deletion_logs(user_id);

-- Index on account_deletion_logs.deleted_at for finding accounts to permanently delete
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at 
  ON public.account_deletion_logs(deleted_at);

-- Index on account_deletion_logs.permanently_deleted_at for filtering processed deletions
CREATE INDEX IF NOT EXISTS idx_deletion_logs_permanently_deleted 
  ON public.account_deletion_logs(permanently_deleted_at)
  WHERE permanently_deleted_at IS NULL;

-- ============================================================================
-- SECTION 7: VERIFICATION
-- ============================================================================

-- Verify the migration completed successfully
DO $$
DECLARE
  v_has_deleted_at BOOLEAN;
  v_has_audit_table BOOLEAN;
  v_index_count INTEGER;
BEGIN
  -- Check deleted_at column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'profiles' 
      AND column_name = 'deleted_at'
  ) INTO v_has_deleted_at;
  
  -- Check audit table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'account_deletion_logs'
  ) INTO v_has_audit_table;
  
  -- Count indexes created
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (indexname LIKE 'idx_profiles_deleted_at%' 
         OR indexname LIKE 'idx_deletion_logs%');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SOFT DELETE MIGRATION VERIFICATION';
  RAISE NOTICE '========================================';
  
  IF v_has_deleted_at THEN
    RAISE NOTICE 'profiles.deleted_at column: ✅ EXISTS';
  ELSE
    RAISE NOTICE 'profiles.deleted_at column: ❌ MISSING';
  END IF;
  
  IF v_has_audit_table THEN
    RAISE NOTICE 'account_deletion_logs table: ✅ EXISTS';
  ELSE
    RAISE NOTICE 'account_deletion_logs table: ❌ MISSING';
  END IF;
  
  RAISE NOTICE 'Indexes created: % of 4', v_index_count;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Phase 1 Implementation Summary:
-- ✅ Added deleted_at column to profiles table
-- ✅ Created account_deletion_logs audit table
-- ✅ Updated RLS policies to exclude soft-deleted accounts
-- ✅ Created performance indexes
-- ✅ Enabled Row Level Security on audit table
--
-- Next Steps (Phase 2):
-- - Implement mark-account-deleted Edge Function
-- - Implement recover-account Edge Function
-- - Implement cleanup-deleted-accounts Edge Function
-- - Setup scheduled cleanup job
-- ============================================================================