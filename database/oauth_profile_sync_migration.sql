-- OAuth Profile Sync Migration
-- Purpose: Add UPDATE trigger to sync OAuth metadata (avatar_url, full_name) to profiles table
-- 
-- This migration adds:
-- 1. Function: handle_auth_user_update() - Syncs OAuth metadata when auth.users is updated
-- 2. Trigger: on_auth_user_updated - Fires after UPDATE on auth.users
--
-- Design: OAUTH_PROFILE_SYNC_DESIGN.md
-- 
-- When to use:
-- - Run this migration once in Supabase SQL Editor
-- - This enables automatic syncing of OAuth profile data when users sign in with OAuth providers
--
-- Rollback:
-- DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_auth_user_update();

-- Function to sync OAuth metadata on auth.users UPDATE
CREATE OR REPLACE FUNCTION public.handle_auth_user_update()
RETURNS TRIGGER AS $$
DECLARE
  new_avatar_url TEXT;
  new_full_name TEXT;
  profile_exists BOOLEAN;
BEGIN
  -- Extract OAuth metadata from updated user
  new_avatar_url := NEW.raw_user_meta_data->>'avatar_url';
  new_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  );

  -- Check if this is an OAuth update with metadata
  IF new_avatar_url IS NULL AND new_full_name IS NULL THEN
    -- No OAuth metadata to sync
    RETURN NEW;
  END IF;

  -- Check if profile exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  ) INTO profile_exists;

  IF NOT profile_exists THEN
    -- Profile doesn't exist, skip (should not happen, but defensive)
    RETURN NEW;
  END IF;

  -- Update profile with OAuth metadata
  UPDATE public.profiles
  SET
    -- Always update avatar_url if present (latest OAuth wins)
    avatar_url = CASE
      WHEN new_avatar_url IS NOT NULL THEN new_avatar_url
      ELSE avatar_url
    END,
    -- Only update full_name if currently NULL (preserve manual edits)
    full_name = CASE
      WHEN new_full_name IS NOT NULL AND full_name IS NULL THEN new_full_name
      ELSE full_name
    END,
    updated_at = NOW()
  WHERE id = NEW.id
    -- Only update if something actually changed
    AND (
      (new_avatar_url IS NOT NULL AND (avatar_url IS NULL OR avatar_url != new_avatar_url))
      OR (new_full_name IS NOT NULL AND full_name IS NULL)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users UPDATE events
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_update();