-- ============================================================================
-- VERIFY PAST DUE SYSTEM AND TEST
-- ============================================================================
-- This script checks if everything is set up correctly and tests the system

-- Step 1: Check if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'payment_history'
  ) THEN
    RAISE NOTICE '✅ payment_history table EXISTS';
  ELSE
    RAISE NOTICE '❌ payment_history table MISSING - run payment_history_migration.sql';
  END IF;
END $$;

-- Step 2: Check if functions exist
DO $$
DECLARE
  v_get_past_due BOOLEAN;
  v_record_payment BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.routines
    WHERE routine_name = 'get_past_due_items'
  ) INTO v_get_past_due;
  
  SELECT EXISTS (
    SELECT FROM information_schema.routines
    WHERE routine_name = 'record_payment_and_update_renewal'
  ) INTO v_record_payment;
  
  IF v_get_past_due THEN
    RAISE NOTICE '✅ get_past_due_items function EXISTS';
  ELSE
    RAISE NOTICE '❌ get_past_due_items function MISSING';
  END IF;
  
  IF v_record_payment THEN
    RAISE NOTICE '✅ record_payment_and_update_renewal function EXISTS';
  ELSE
    RAISE NOTICE '❌ record_payment_and_update_renewal function MISSING';
  END IF;
END $$;

-- Step 3: Check required columns on recurring_items
DO $$
DECLARE
  v_has_status BOOLEAN;
  v_has_repeat_interval BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'recurring_items' AND column_name = 'status'
  ) INTO v_has_status;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'recurring_items' AND column_name = 'repeat_interval'
  ) INTO v_has_repeat_interval;
  
  IF v_has_status THEN
    RAISE NOTICE '✅ recurring_items.status column EXISTS';
  ELSE
    RAISE NOTICE '❌ recurring_items.status column MISSING - run add_status_column_migration.sql';
  END IF;
  
  IF v_has_repeat_interval THEN
    RAISE NOTICE '✅ recurring_items.repeat_interval column EXISTS';
  ELSE
    RAISE NOTICE '⚠️  recurring_items.repeat_interval column MISSING - using billing_cycle';
  END IF;
END $$;

-- Step 4: Test the function (replace <YOUR_USER_ID> with your actual user ID)
-- Get your user ID first:
SELECT 
  'Your User ID:' as info,
  id as user_id, 
  email 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;

-- TO TEST: Replace <YOUR_USER_ID> below with the ID from above query result
-- Then uncomment and run:

/*
SELECT 
  'Testing get_past_due_items function:' as test,
  * 
FROM get_past_due_items('<YOUR_USER_ID>');
*/

-- Step 5: Check your specific item (replace <YOUR_USER_ID>)
/*
SELECT 
  'Your item details:' as info,
  name,
  renewal_date,
  COALESCE(status, 'MISSING_COLUMN') as status,
  repeat_interval,
  CURRENT_DATE as today,
  renewal_date < CURRENT_DATE as is_past_due
FROM recurring_items
WHERE user_id = '<YOUR_USER_ID>'
  AND renewal_date = '2025-12-04';
*/

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Check the messages above for any ❌ items';
  RAISE NOTICE '2. If status column is missing, run add_status_column_migration.sql';
  RAISE NOTICE '3. Uncomment the test queries above and replace <YOUR_USER_ID>';
  RAISE NOTICE '4. Run again to test the function';
  RAISE NOTICE '========================================';
END $$;