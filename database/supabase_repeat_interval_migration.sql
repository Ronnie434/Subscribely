-- ============================================================================
-- SUPABASE SQL CONSOLE: REPEAT INTERVAL MIGRATION
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor and run it.
-- This will add the repeat_interval column and migrate existing data.
-- ============================================================================

-- Step 1: Add new repeat_interval column
ALTER TABLE recurring_items 
ADD COLUMN IF NOT EXISTS repeat_interval VARCHAR(20) DEFAULT 'monthly';

-- Step 2: Add check constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'repeat_interval_check'
  ) THEN
    ALTER TABLE recurring_items
    ADD CONSTRAINT repeat_interval_check 
    CHECK (repeat_interval IN (
      'weekly', 'biweekly', 'semimonthly', 'monthly', 
      'bimonthly', 'quarterly', 'semiannually', 'yearly', 'never'
    ));
  END IF;
END $$;

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_recurring_items_repeat_interval
ON recurring_items(repeat_interval);

CREATE INDEX IF NOT EXISTS idx_recurring_items_user_interval
ON recurring_items(user_id, repeat_interval);

-- Step 4: Migrate existing data
UPDATE recurring_items
SET repeat_interval = CASE
  -- One-time charges -> 'never'
  WHEN charge_type = 'one_time' THEN 'never'
  -- Recurring yearly -> 'yearly'
  WHEN (charge_type = 'recurring' OR charge_type IS NULL) 
       AND billing_cycle = 'yearly' THEN 'yearly'
  -- Recurring monthly -> 'monthly' (default)
  ELSE 'monthly'
END
WHERE repeat_interval IS NULL OR repeat_interval = 'monthly';

-- Step 5: Add column comments
COMMENT ON COLUMN recurring_items.repeat_interval IS 
  'Repeat interval for recurring items. Replaces charge_type + billing_cycle. @since v3.0.0';

COMMENT ON COLUMN recurring_items.billing_cycle IS 
  'DEPRECATED: Use repeat_interval instead. Will be removed in v4.0.0';

COMMENT ON COLUMN recurring_items.charge_type IS 
  'DEPRECATED: Use repeat_interval instead. Will be removed in v4.0.0';

-- Step 6: Verify migration (check results in output)
SELECT 
  'Migration Summary' as status,
  COUNT(*) as total_items,
  SUM(CASE WHEN repeat_interval = 'never' THEN 1 ELSE 0 END) as one_time_items,
  SUM(CASE WHEN repeat_interval = 'monthly' THEN 1 ELSE 0 END) as monthly_items,
  SUM(CASE WHEN repeat_interval = 'yearly' THEN 1 ELSE 0 END) as yearly_items,
  SUM(CASE WHEN repeat_interval IS NULL THEN 1 ELSE 0 END) as errors
FROM recurring_items;

-- ============================================================================
-- MIGRATION COMPLETE!
-- Check the output above to verify:
-- - total_items: Total number of items in database
-- - one_time_items: Items with 'never' interval (was one-time)
-- - monthly_items: Items with 'monthly' interval
-- - yearly_items: Items with 'yearly' interval
-- - errors: Should be 0 (any NULL values)
-- ============================================================================