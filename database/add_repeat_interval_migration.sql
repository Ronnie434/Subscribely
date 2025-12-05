-- ============================================================================
-- REPEAT INTERVAL MIGRATION
-- ============================================================================
-- This migration adds the new repeat_interval column and migrates data from
-- the legacy charge_type and billing_cycle columns.
--
-- Version: 3.0.0
-- Date: 2024-12-05
-- Author: Smart Subscription Tracker Team
--
-- IMPORTANT: This migration is non-destructive and maintains backward
-- compatibility. Old columns are kept for rollback safety.
-- ============================================================================

-- Step 1: Add new repeat_interval column with default value
-- ============================================================================
ALTER TABLE recurring_items 
ADD COLUMN IF NOT EXISTS repeat_interval VARCHAR(20) DEFAULT 'monthly';

-- Add comment to document the column
COMMENT ON COLUMN recurring_items.repeat_interval IS 
  'Repeat interval for recurring items. Replaces charge_type + billing_cycle. @since v3.0.0';

-- Step 2: Add check constraint to ensure valid values
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'repeat_interval_check'
  ) THEN
    ALTER TABLE recurring_items
    ADD CONSTRAINT repeat_interval_check 
    CHECK (repeat_interval IN (
      'weekly', 
      'biweekly', 
      'semimonthly', 
      'monthly', 
      'bimonthly', 
      'quarterly', 
      'semiannually', 
      'yearly', 
      'never'
    ));
  END IF;
END $$;

-- Step 3: Add index for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_recurring_items_repeat_interval 
ON recurring_items(repeat_interval);

-- Add compound index for common queries
CREATE INDEX IF NOT EXISTS idx_recurring_items_user_interval 
ON recurring_items(user_id, repeat_interval) 
WHERE status = 'active';

-- Step 4: Create migration function to convert existing data
-- ============================================================================
CREATE OR REPLACE FUNCTION migrate_to_repeat_interval()
RETURNS TABLE(
  migrated_count INTEGER,
  one_time_count INTEGER,
  monthly_count INTEGER,
  yearly_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_one_time INTEGER := 0;
  v_monthly INTEGER := 0;
  v_yearly INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Migrate data based on charge_type and billing_cycle
  UPDATE recurring_items
  SET repeat_interval = CASE
    -- One-time charges -> 'never'
    WHEN charge_type = 'one_time' THEN 'never'
    
    -- Recurring yearly -> 'yearly'
    WHEN (charge_type = 'recurring' OR charge_type IS NULL) 
         AND billing_cycle = 'yearly' THEN 'yearly'
    
    -- Recurring monthly -> 'monthly'
    WHEN (charge_type = 'recurring' OR charge_type IS NULL) 
         AND billing_cycle = 'monthly' THEN 'monthly'
    
    -- Fallback: default to monthly
    ELSE 'monthly'
  END
  WHERE repeat_interval IS NULL 
     OR repeat_interval = 'monthly'; -- Re-run for safety
  
  -- Get counts for reporting
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  SELECT COUNT(*) INTO v_one_time 
  FROM recurring_items 
  WHERE repeat_interval = 'never';
  
  SELECT COUNT(*) INTO v_monthly 
  FROM recurring_items 
  WHERE repeat_interval = 'monthly';
  
  SELECT COUNT(*) INTO v_yearly 
  FROM recurring_items 
  WHERE repeat_interval = 'yearly';
  
  -- Check for any records that might have issues
  SELECT COUNT(*) INTO v_errors
  FROM recurring_items
  WHERE repeat_interval IS NULL;
  
  -- Return results
  RETURN QUERY SELECT v_migrated, v_one_time, v_monthly, v_yearly, v_errors;
  
  -- Log the migration
  RAISE NOTICE 'Migration completed: % total, % one-time, % monthly, % yearly, % errors',
    v_migrated, v_one_time, v_monthly, v_yearly, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Execute the migration
-- ============================================================================
DO $$
DECLARE
  migration_result RECORD;
BEGIN
  -- Run the migration
  SELECT * INTO migration_result FROM migrate_to_repeat_interval();
  
  -- Log results
  RAISE NOTICE '================================================';
  RAISE NOTICE 'REPEAT INTERVAL MIGRATION COMPLETE';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Total migrated: %', migration_result.migrated_count;
  RAISE NOTICE 'One-time items: %', migration_result.one_time_count;
  RAISE NOTICE 'Monthly items: %', migration_result.monthly_count;
  RAISE NOTICE 'Yearly items: %', migration_result.yearly_count;
  RAISE NOTICE 'Errors: %', migration_result.error_count;
  RAISE NOTICE '================================================';
  
  -- Warn if there were errors
  IF migration_result.error_count > 0 THEN
    RAISE WARNING 'Migration completed with % errors. Check data integrity!', 
      migration_result.error_count;
  END IF;
END $$;

-- Step 6: Add deprecation comments to old columns
-- ============================================================================
COMMENT ON COLUMN recurring_items.billing_cycle IS 
  'DEPRECATED: Use repeat_interval instead. Will be removed in v4.0.0. @deprecated v3.0.0';

COMMENT ON COLUMN recurring_items.charge_type IS 
  'DEPRECATED: Use repeat_interval instead. Will be removed in v4.0.0. @deprecated v3.0.0';

-- Step 7: Create helper view for backward compatibility (optional)
-- ============================================================================
CREATE OR REPLACE VIEW recurring_items_with_legacy AS
SELECT 
  ri.*,
  -- Provide legacy fields for backward compatibility
  CASE 
    WHEN ri.repeat_interval = 'never' THEN 'one_time'
    ELSE 'recurring'
  END AS legacy_charge_type,
  CASE 
    WHEN ri.repeat_interval = 'yearly' THEN 'yearly'
    ELSE 'monthly'
  END AS legacy_billing_cycle
FROM recurring_items ri;

COMMENT ON VIEW recurring_items_with_legacy IS 
  'Backward compatibility view that provides legacy charge_type and billing_cycle columns based on repeat_interval. @since v3.0.0';

-- Step 8: Create validation function
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_repeat_interval_migration()
RETURNS TABLE(
  status TEXT,
  total_items INTEGER,
  items_with_repeat_interval INTEGER,
  items_without_repeat_interval INTEGER,
  mismatches INTEGER
) AS $$
DECLARE
  v_total INTEGER;
  v_with_interval INTEGER;
  v_without_interval INTEGER;
  v_mismatches INTEGER;
BEGIN
  -- Count total items
  SELECT COUNT(*) INTO v_total FROM recurring_items;
  
  -- Count items with repeat_interval
  SELECT COUNT(*) INTO v_with_interval 
  FROM recurring_items 
  WHERE repeat_interval IS NOT NULL;
  
  -- Count items without repeat_interval
  SELECT COUNT(*) INTO v_without_interval 
  FROM recurring_items 
  WHERE repeat_interval IS NULL;
  
  -- Check for logical mismatches
  SELECT COUNT(*) INTO v_mismatches
  FROM recurring_items
  WHERE (
    -- One-time should be 'never'
    (charge_type = 'one_time' AND repeat_interval != 'never')
    OR
    -- Recurring yearly should be 'yearly'
    (charge_type = 'recurring' AND billing_cycle = 'yearly' AND repeat_interval != 'yearly')
    OR
    -- Recurring monthly should be 'monthly'
    (charge_type = 'recurring' AND billing_cycle = 'monthly' AND repeat_interval != 'monthly')
  );
  
  -- Determine status
  DECLARE
    v_status TEXT;
  BEGIN
    IF v_without_interval = 0 AND v_mismatches = 0 THEN
      v_status := 'SUCCESS';
    ELSIF v_mismatches > 0 THEN
      v_status := 'WARNING - MISMATCHES DETECTED';
    ELSE
      v_status := 'WARNING - INCOMPLETE';
    END IF;
    
    RETURN QUERY SELECT v_status, v_total, v_with_interval, v_without_interval, v_mismatches;
  END;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Run validation
-- ============================================================================
DO $$
DECLARE
  validation_result RECORD;
BEGIN
  SELECT * INTO validation_result FROM validate_repeat_interval_migration();
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'MIGRATION VALIDATION';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Status: %', validation_result.status;
  RAISE NOTICE 'Total items: %', validation_result.total_items;
  RAISE NOTICE 'Items with repeat_interval: %', validation_result.items_with_repeat_interval;
  RAISE NOTICE 'Items without repeat_interval: %', validation_result.items_without_repeat_interval;
  RAISE NOTICE 'Mismatches: %', validation_result.mismatches;
  RAISE NOTICE '================================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If you need to rollback this migration, run:
--
-- -- Remove the repeat_interval column
-- ALTER TABLE recurring_items DROP COLUMN IF EXISTS repeat_interval;
--
-- -- Drop the indexes
-- DROP INDEX IF EXISTS idx_recurring_items_repeat_interval;
-- DROP INDEX IF EXISTS idx_recurring_items_user_interval;
--
-- -- Drop the view
-- DROP VIEW IF EXISTS recurring_items_with_legacy;
--
-- -- Drop the functions
-- DROP FUNCTION IF EXISTS migrate_to_repeat_interval();
-- DROP FUNCTION IF EXISTS validate_repeat_interval_migration();
-- ============================================================================