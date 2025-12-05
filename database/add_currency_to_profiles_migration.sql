-- Migration: Add currency column to profiles table
-- Description: Stores user's preferred currency for cross-device sync
-- Date: 2025-12-05

-- Add currency column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Add comment
COMMENT ON COLUMN profiles.currency IS 'User preferred currency (ISO 4217 code)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_currency ON profiles(currency);

-- Rollback (uncomment to rollback):
-- DROP INDEX IF EXISTS idx_profiles_currency;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS currency;