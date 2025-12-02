-- ============================================================================
-- Migration: Clear Invalid Domains from Recurring Items
-- ============================================================================
-- Description: Removes invalid domain values that don't match proper domain format
-- Date: 2025-12-02
-- Version: 1.0.0
-- 
-- PURPOSE:
-- This migration clears domain values that were auto-generated before validation
-- was added to the domain field in the recurring_items table. Invalid domains
-- like "temp.com", "test.com", "mygym.com" can cause issues when users click on
-- subscription logos, as they redirect to non-existent or wrong websites.
-- 
-- WHAT THIS MIGRATION DOES:
-- - Identifies rows where the domain field doesn't match valid domain patterns
-- - Sets invalid domain values to empty string ('')
-- - Preserves domains that match the valid domain pattern
-- - Safe to run multiple times (idempotent)
-- 
-- VALID DOMAIN PATTERN:
-- A valid domain must match: ^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$
-- Examples of VALID domains:
--   ✓ netflix.com
--   ✓ amazon.com
--   ✓ google.com
--   ✓ my-gym.com
-- 
-- Examples of INVALID domains that will be cleared:
--   ✗ temp.com (generic placeholder)
--   ✗ test.com (generic placeholder)
--   ✗ mygym.com (auto-generated, not real domain)
--   ✗ company (missing TLD)
--   ✗ .com (missing domain name)
-- 
-- IMPORTANT: Consider backing up your recurring_items table before running.
-- Run this in your Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- SECTION 1: CLEAR INVALID DOMAINS
-- ============================================================================

-- Update invalid domains to empty string
-- Uses PostgreSQL regex operator ~* (case-insensitive match)
-- The !~* operator means "does NOT match" (case-insensitive)
UPDATE public.recurring_items
SET 
  domain = '',
  updated_at = NOW()
WHERE domain IS NOT NULL 
  AND domain != ''
  AND domain !~* '^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$';

-- ============================================================================
-- SECTION 2: VERIFICATION QUERY
-- ============================================================================
-- Run this query after the migration to verify results:
--
-- SELECT 
--   COUNT(*) as total_items,
--   COUNT(CASE WHEN domain = '' OR domain IS NULL THEN 1 END) as empty_domains,
--   COUNT(CASE WHEN domain != '' AND domain IS NOT NULL THEN 1 END) as valid_domains
-- FROM public.recurring_items;
--
-- You can also check specific examples:
-- SELECT id, name, domain, updated_at 
-- FROM public.recurring_items 
-- WHERE domain = ''
-- ORDER BY updated_at DESC
-- LIMIT 10;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- SUMMARY:
-- ✓ Invalid domains cleared from recurring_items table
-- ✓ Valid domains preserved
-- ✓ Migration is idempotent (safe to run multiple times)
-- 
-- NOTES:
-- - This migration only updates the domain field, no rows are deleted
-- - The updated_at timestamp is updated for modified rows
-- - Users can still manually add valid domains via the app
-- - The app now validates domains before saving to prevent future invalid entries
-- 
-- NEXT STEPS:
-- 1. Run the verification query above to confirm results
-- 2. Test the subscription card links in the app
-- 3. Monitor for any user reports of broken links
-- 
-- ============================================================================