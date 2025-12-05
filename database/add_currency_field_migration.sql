-- ============================================================================
-- CURRENCY FIELD MIGRATION
-- ============================================================================
-- Description: Add currency field to recurring_items table for multi-currency support
-- Version: 1.0.0
-- Date: 2024-12-05
--
-- PURPOSE:
-- This migration adds a currency field to the recurring_items table to support
-- tracking items in different currencies. Each item will store its currency code.
--
-- CHANGES:
-- 1. Add currency column to recurring_items table
-- 2. Set default currency based on locale (USD as fallback)
-- 3. Create index on currency column for filtering
--
-- ROLLBACK:
-- To rollback: ALTER TABLE recurring_items DROP COLUMN IF EXISTS currency;
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD CURRENCY COLUMN
-- ============================================================================

-- Add currency column with default value
ALTER TABLE public.recurring_items
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- Add comment to document the field
COMMENT ON COLUMN public.recurring_items.currency IS 'ISO 4217 currency code (e.g., USD, EUR, GBP)';

-- ============================================================================
-- SECTION 2: CREATE INDEX FOR PERFORMANCE
-- ============================================================================

-- Create index on currency column for filtering by currency
CREATE INDEX IF NOT EXISTS recurring_items_currency_idx 
  ON public.recurring_items(currency);

-- ============================================================================
-- SECTION 3: VALIDATE EXISTING DATA
-- ============================================================================

-- Update any existing records to ensure they have a currency
UPDATE public.recurring_items
SET currency = 'USD'
WHERE currency IS NULL OR currency = '';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CURRENCY FIELD MIGRATION COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CHANGES APPLIED:';
  RAISE NOTICE '  ✅ Added currency column to recurring_items';
  RAISE NOTICE '  ✅ Set default currency to USD';
  RAISE NOTICE '  ✅ Created index on currency column';
  RAISE NOTICE '  ✅ Updated existing records';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Update application code to use currency field';
  RAISE NOTICE '  2. Add currency selector in Settings';
  RAISE NOTICE '  3. Update display components to show correct symbols';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;