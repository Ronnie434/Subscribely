-- OAuth Profile Backfill Migration
-- Purpose: One-time backfill to sync OAuth metadata for existing users
--
-- This migration updates profiles for users who:
-- - Have OAuth data in auth.users.raw_user_meta_data
-- - Are missing avatar_url or full_name in profiles table
-- - Signed up before the oauth_profile_sync_migration.sql was deployed
--
-- Design: OAUTH_PROFILE_SYNC_DESIGN.md
--
-- When to use:
-- - Run this ONCE after deploying oauth_profile_sync_migration.sql
-- - Safe to run multiple times (idempotent)
-- - Will report number of profiles updated
--
-- Expected output:
-- - NOTICE: "Backfilled OAuth data for N profile(s)"
-- - N = number of users who had missing OAuth data that was synced

DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Update profiles with OAuth data from auth.users
  WITH oauth_users AS (
    SELECT
      id,
      raw_user_meta_data->>'avatar_url' as oauth_avatar_url,
      COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name'
      ) as oauth_full_name
    FROM auth.users
    WHERE raw_user_meta_data IS NOT NULL
      AND (
        raw_user_meta_data->>'avatar_url' IS NOT NULL
        OR raw_user_meta_data->>'full_name' IS NOT NULL
        OR raw_user_meta_data->>'name' IS NOT NULL
      )
  )
  UPDATE public.profiles p
  SET
    avatar_url = CASE
      WHEN o.oauth_avatar_url IS NOT NULL THEN o.oauth_avatar_url
      ELSE p.avatar_url
    END,
    full_name = CASE
      WHEN o.oauth_full_name IS NOT NULL AND p.full_name IS NULL THEN o.oauth_full_name
      ELSE p.full_name
    END,
    updated_at = NOW()
  FROM oauth_users o
  WHERE p.id = o.id
    AND (
      (o.oauth_avatar_url IS NOT NULL AND (p.avatar_url IS NULL OR p.avatar_url != o.oauth_avatar_url))
      OR (o.oauth_full_name IS NOT NULL AND p.full_name IS NULL)
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled OAuth data for % profile(s)', updated_count;
END $$;