-- ============================================================================
-- CRITICAL: DATABASE CLEANUP SCRIPT
-- ============================================================================
-- This script will DELETE ALL user data EXCEPT for one specified user
-- 
-- ⚠️  WARNING: THIS IS A DESTRUCTIVE OPERATION! ⚠️
-- 
-- BEFORE RUNNING:
-- 1. CREATE A COMPLETE DATABASE BACKUP
-- 2. VERIFY the email address is correct
-- 3. TEST in a development environment first
-- 4. Run the DRY RUN first to see what will be deleted
-- 
-- TO USE:
-- 1. Set the email address of the user to KEEP (see "Configuration" section)
-- 2. Run the script AS-IS to see a dry-run preview of what will be deleted
-- 3. Review the counts carefully
-- 4. To execute actual deletion:
--    a) Uncomment the BEGIN; line in the "Transaction Control" section
--    b) Uncomment all DELETE statements throughout the script
--    c) Uncomment the COMMIT; line at the end
-- 5. Re-run the modified script
-- 
-- TRANSACTION CONTROL:
-- This script now has PROPER transaction control. The BEGIN/COMMIT are outside
-- the main logic, so you can ROLLBACK if needed. Keep BEGIN/COMMIT commented
-- for dry-run mode (safe preview), uncomment them for actual execution.
-- 
-- ============================================================================

-- ============================================================================
-- TRANSACTION CONTROL: Uncomment BEGIN to enable transaction
-- ============================================================================
-- ⚠️  KEEP COMMENTED FOR DRY RUN (preview mode)
-- ⚠️  UNCOMMENT FOR ACTUAL DELETION

-- BEGIN;

-- ============================================================================
-- Configuration: Email of the user to KEEP
-- ============================================================================

-- Create temporary table to store script variables
CREATE TEMP TABLE IF NOT EXISTS _cleanup_vars (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Set the email to keep
INSERT INTO _cleanup_vars (key, value) 
VALUES ('keep_email', 'rox434@gmail.com')  -- ⚠️ MODIFY THIS IF NEEDED
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- STEP 1: Find and verify the user to keep
-- ============================================================================

RAISE INFO '';
RAISE INFO '============================================================================';
RAISE INFO 'DATABASE CLEANUP SCRIPT STARTED';
RAISE INFO '============================================================================';
RAISE INFO 'Timestamp: %', NOW();
RAISE INFO 'Email to KEEP: %', (SELECT value FROM _cleanup_vars WHERE key = 'keep_email');
RAISE INFO '';

RAISE INFO '--- STEP 1: Finding user to keep ---';

-- Find the user ID for the email to keep
INSERT INTO _cleanup_vars (key, value)
SELECT 'keep_user_id', id::text
FROM auth.users
WHERE email = (SELECT value FROM _cleanup_vars WHERE key = 'keep_email')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Verify user was found
DO $$
DECLARE
    v_user_id TEXT;
    v_email TEXT;
BEGIN
    SELECT value INTO v_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    SELECT value INTO v_email FROM _cleanup_vars WHERE key = 'keep_email';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'ERROR: User with email "%" not found! Aborting.', v_email;
    END IF;
END $$;

RAISE INFO 'Found user to KEEP:';
RAISE INFO '  Email: %', (SELECT value FROM _cleanup_vars WHERE key = 'keep_email');
RAISE INFO '  User ID: %', (SELECT value FROM _cleanup_vars WHERE key = 'keep_user_id');
RAISE INFO '';

-- ============================================================================
-- STEP 2: Count total users and users to delete
-- ============================================================================

RAISE INFO '--- STEP 2: Analyzing user counts ---';

-- Store counts
INSERT INTO _cleanup_vars (key, value)
SELECT 'total_users', COUNT(*)::text FROM auth.users
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO _cleanup_vars (key, value)
SELECT 'users_to_delete', (COUNT(*) - 1)::text 
FROM auth.users
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Total users in database: %', (SELECT value FROM _cleanup_vars WHERE key = 'total_users');
RAISE INFO 'Users to DELETE: %', (SELECT value FROM _cleanup_vars WHERE key = 'users_to_delete');
RAISE INFO 'Users to KEEP: 1 (% - %)', 
    (SELECT value FROM _cleanup_vars WHERE key = 'keep_email'),
    (SELECT value FROM _cleanup_vars WHERE key = 'keep_user_id');
RAISE INFO '';

-- Exit early if no users to delete
DO $$
DECLARE
    v_users_to_delete INT;
BEGIN
    SELECT value::int INTO v_users_to_delete FROM _cleanup_vars WHERE key = 'users_to_delete';
    
    IF v_users_to_delete = 0 THEN
        RAISE INFO '⚠️  No users to delete. Only the keeper user exists.';
        RAISE INFO 'Script completed without changes.';
        -- Note: Cannot RETURN from here, script will continue but show zero counts
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Count records to be deleted from each table
-- ============================================================================

RAISE INFO '--- STEP 3: Counting records to be deleted ---';
RAISE INFO '';

-- Level 4: refund_requests
INSERT INTO _cleanup_vars (key, value)
SELECT 'refund_requests_count', COUNT(*)::text
FROM refund_requests
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 4 - refund_requests: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'refund_requests_count');

-- Level 3: payment_transactions
INSERT INTO _cleanup_vars (key, value)
SELECT 'payment_transactions_count', COUNT(*)::text
FROM payment_transactions
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 3 - payment_transactions: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'payment_transactions_count');

-- Level 2: user_subscriptions
INSERT INTO _cleanup_vars (key, value)
SELECT 'user_subscriptions_count', COUNT(*)::text
FROM user_subscriptions
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 2 - user_subscriptions: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'user_subscriptions_count');

-- Level 2: payment_history
INSERT INTO _cleanup_vars (key, value)
SELECT 'payment_history_count', COUNT(*)::text
FROM payment_history
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 2 - payment_history: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'payment_history_count');

-- Level 1: recurring_items
INSERT INTO _cleanup_vars (key, value)
SELECT 'recurring_items_count', COUNT(*)::text
FROM recurring_items
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 1 - recurring_items: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'recurring_items_count');

-- Level 1: apple_transactions
INSERT INTO _cleanup_vars (key, value)
SELECT 'apple_transactions_count', COUNT(*)::text
FROM apple_transactions
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 1 - apple_transactions: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'apple_transactions_count');

-- Level 1: usage_tracking_events
INSERT INTO _cleanup_vars (key, value)
SELECT 'usage_tracking_count', COUNT(*)::text
FROM usage_tracking_events
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 1 - usage_tracking_events: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'usage_tracking_count');

-- Level 1: account_deletion_logs
INSERT INTO _cleanup_vars (key, value)
SELECT 'deletion_logs_count', COUNT(*)::text
FROM account_deletion_logs
WHERE user_id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 1 - account_deletion_logs: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'deletion_logs_count');

-- Level 1: profiles
INSERT INTO _cleanup_vars (key, value)
SELECT 'profiles_count', COUNT(*)::text
FROM profiles
WHERE id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 1 - profiles: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'profiles_count');

-- Level 0: stripe_webhooks (special handling - JSONB check)
-- NOTE: This uses JSONB filtering on event_data->>'user_id'
-- Only deletes webhooks that have a user_id in their event_data
-- Webhooks without user_id or with the keeper's user_id are preserved
INSERT INTO _cleanup_vars (key, value)
SELECT 'stripe_webhooks_count', COUNT(*)::text
FROM stripe_webhooks
WHERE event_data->>'user_id' IS NOT NULL
  AND event_data->>'user_id' != (SELECT value FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Level 0 - stripe_webhooks (with user_id in event_data): % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'stripe_webhooks_count');

-- auth.users
INSERT INTO _cleanup_vars (key, value)
SELECT 'auth_users_count', COUNT(*)::text
FROM auth.users
WHERE id != (SELECT value::uuid FROM _cleanup_vars WHERE key = 'keep_user_id')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO 'Final  - auth.users: % records', 
    (SELECT value FROM _cleanup_vars WHERE key = 'auth_users_count');

-- Calculate total
INSERT INTO _cleanup_vars (key, value)
SELECT 'total_records', (
    (SELECT value::int FROM _cleanup_vars WHERE key = 'refund_requests_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'payment_transactions_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'user_subscriptions_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'payment_history_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'recurring_items_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'apple_transactions_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'usage_tracking_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'deletion_logs_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'profiles_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'stripe_webhooks_count') +
    (SELECT value::int FROM _cleanup_vars WHERE key = 'auth_users_count')
)::text
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

RAISE INFO '';
RAISE INFO '--- TOTAL RECORDS TO DELETE: % ---',
    (SELECT value FROM _cleanup_vars WHERE key = 'total_records');
RAISE INFO '';

-- ============================================================================
-- STEP 4: DELETE DATA
-- ============================================================================

RAISE INFO '============================================================================';
RAISE INFO 'STARTING DELETION PROCESS';
RAISE INFO '============================================================================';
RAISE INFO '';
RAISE INFO '⚠️  To actually perform deletions, uncomment the transaction BEGIN';
RAISE INFO '⚠️  at the top of this script and COMMIT at the end.';
RAISE INFO '';

-- Level 4: Delete refund_requests
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'refund_requests_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from refund_requests (Level 4) ---';
        -- DELETE FROM refund_requests WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 3: Delete payment_transactions
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'payment_transactions_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from payment_transactions (Level 3) ---';
        -- DELETE FROM payment_transactions WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 2: Delete user_subscriptions
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'user_subscriptions_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from user_subscriptions (Level 2) ---';
        -- DELETE FROM user_subscriptions WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 2: Delete payment_history
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'payment_history_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from payment_history (Level 2) ---';
        -- DELETE FROM payment_history WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 1: Delete recurring_items
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'recurring_items_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from recurring_items (Level 1) ---';
        -- DELETE FROM recurring_items WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 1: Delete apple_transactions
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'apple_transactions_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from apple_transactions (Level 1) ---';
        -- DELETE FROM apple_transactions WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 1: Delete usage_tracking_events
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'usage_tracking_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from usage_tracking_events (Level 1) ---';
        -- DELETE FROM usage_tracking_events WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 1: Delete account_deletion_logs
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'deletion_logs_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from account_deletion_logs (Level 1) ---';
        -- DELETE FROM account_deletion_logs WHERE user_id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 1: Delete profiles
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'profiles_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from profiles (Level 1) ---';
        -- DELETE FROM profiles WHERE id != v_keep_user_id;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Level 0: Delete stripe_webhooks (special JSONB handling)
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'stripe_webhooks_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from stripe_webhooks (Level 0) ---';
        -- DELETE FROM stripe_webhooks
        -- WHERE event_data->>'user_id' IS NOT NULL
        --   AND event_data->>'user_id' != v_keep_user_id::text;
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- Final: Delete from auth.users (CASCADE will handle any remaining linked records)
DO $$
DECLARE
    v_count INT;
    v_keep_user_id UUID;
BEGIN
    SELECT value::int INTO v_count FROM _cleanup_vars WHERE key = 'auth_users_count';
    SELECT value::uuid INTO v_keep_user_id FROM _cleanup_vars WHERE key = 'keep_user_id';
    
    IF v_count > 0 THEN
        RAISE INFO '--- Deleting from auth.users (FINAL - will cascade) ---';
        -- DELETE FROM auth.users WHERE id != v_keep_user_id;
        -- RAISE INFO 'CASCADE will automatically clean up any remaining linked records';
        RAISE INFO '⚠️  SKIPPED (uncomment DELETE statement to execute)';
    END IF;
END $$;

-- ============================================================================
-- DELETION SUMMARY
-- ============================================================================

RAISE INFO '';
RAISE INFO '============================================================================';
RAISE INFO 'DELETION SUMMARY (DRY RUN)';
RAISE INFO '============================================================================';
RAISE INFO 'This was a DRY RUN - no actual deletions performed.';
RAISE INFO '';
RAISE INFO 'To execute actual deletions:';
RAISE INFO '1. Uncomment the BEGIN; line in the "Transaction Control" section';
RAISE INFO '2. Uncomment all DELETE statements throughout the script';
RAISE INFO '3. Uncomment the COMMIT; line at the end';
RAISE INFO '4. Re-run this script';
RAISE INFO '';
RAISE INFO 'Records that WOULD be deleted:';
RAISE INFO '  refund_requests: %', (SELECT value FROM _cleanup_vars WHERE key = 'refund_requests_count');
RAISE INFO '  payment_transactions: %', (SELECT value FROM _cleanup_vars WHERE key = 'payment_transactions_count');
RAISE INFO '  user_subscriptions: %', (SELECT value FROM _cleanup_vars WHERE key = 'user_subscriptions_count');
RAISE INFO '  payment_history: %', (SELECT value FROM _cleanup_vars WHERE key = 'payment_history_count');
RAISE INFO '  recurring_items: %', (SELECT value FROM _cleanup_vars WHERE key = 'recurring_items_count');
RAISE INFO '  apple_transactions: %', (SELECT value FROM _cleanup_vars WHERE key = 'apple_transactions_count');
RAISE INFO '  usage_tracking_events: %', (SELECT value FROM _cleanup_vars WHERE key = 'usage_tracking_count');
RAISE INFO '  account_deletion_logs: %', (SELECT value FROM _cleanup_vars WHERE key = 'deletion_logs_count');
RAISE INFO '  profiles: %', (SELECT value FROM _cleanup_vars WHERE key = 'profiles_count');
RAISE INFO '  stripe_webhooks: %', (SELECT value FROM _cleanup_vars WHERE key = 'stripe_webhooks_count');
RAISE INFO '  auth.users: %', (SELECT value FROM _cleanup_vars WHERE key = 'auth_users_count');
RAISE INFO '';
RAISE INFO 'TOTAL: % records', (SELECT value FROM _cleanup_vars WHERE key = 'total_records');
RAISE INFO '';
RAISE INFO 'User to KEEP: % (%)', 
    (SELECT value FROM _cleanup_vars WHERE key = 'keep_email'),
    (SELECT value FROM _cleanup_vars WHERE key = 'keep_user_id');
RAISE INFO '============================================================================';

-- Clean up temporary table
DROP TABLE IF EXISTS _cleanup_vars;

-- ============================================================================
-- TRANSACTION CONTROL: Uncomment COMMIT to apply changes
-- ============================================================================
-- ⚠️  KEEP COMMENTED FOR DRY RUN (preview mode)
-- ⚠️  UNCOMMENT FOR ACTUAL DELETION

-- COMMIT;

-- To rollback instead of commit, uncomment this:
-- ROLLBACK;

RAISE INFO '';
RAISE INFO 'Script completed at: %', NOW();

-- ============================================================================
-- INSTRUCTIONS FOR ACTUAL EXECUTION:
-- ============================================================================
-- 
-- TRANSACTION CONTROL NOW WORKS PROPERLY!
-- ========================================
-- 
-- The BEGIN/COMMIT are now outside the main logic, so you have full
-- transaction control. You can ROLLBACK if something goes wrong.
-- 
-- TO PERFORM ACTUAL DELETION:
-- 
-- 1. First run the script AS-IS (dry run) and verify the counts
-- 
-- 2. Then uncomment these items:
--    a) BEGIN; line in the "Transaction Control" section at the top
--    b) All DELETE statements (remove the -- comment markers)
--    c) COMMIT; line in the "Transaction Control" section at the bottom
-- 
-- 3. Run the modified script
-- 
-- TO ROLLBACK IF SOMETHING GOES WRONG:
--    - Replace COMMIT; with ROLLBACK; at the end
--    - Or run ROLLBACK; manually if still in the transaction
--    - This is why having a backup is CRITICAL
-- 
-- NOTE ON STRIPE_WEBHOOKS:
--    The stripe_webhooks deletion uses JSONB filtering on event_data->>'user_id'
--    Only webhooks that contain a user_id field in their event_data JSON will
--    be considered for deletion. Webhooks without user_id or with the keeper's
--    user_id are automatically preserved.
-- 
-- ============================================================================