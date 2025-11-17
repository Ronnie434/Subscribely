# Paywall System - Database Setup Instructions

## Overview

This guide provides step-by-step instructions for setting up the paywall system database in Supabase. Follow these instructions carefully to ensure a successful migration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Running the Migration](#running-the-migration)
4. [Verification Steps](#verification-steps)
5. [Testing RLS Policies](#testing-rls-policies)
6. [Rollback Instructions](#rollback-instructions)
7. [Troubleshooting](#troubleshooting)
8. [Post-Migration Tasks](#post-migration-tasks)

---

## Prerequisites

### Required Access
- ✅ Supabase project admin access
- ✅ Access to Supabase SQL Editor
- ✅ Database credentials (for CLI access, optional)

### Required Files
- ✅ [`paywall_migration.sql`](paywall_migration.sql) - Main migration script
- ✅ [`paywall_rollback.sql`](paywall_rollback.sql) - Rollback script (backup)
- ✅ [`paywall_test_data.sql`](paywall_test_data.sql) - Test data seeding (optional)

### Environment Preparation
- ✅ Backup your database before migration
- ✅ Choose low-traffic time for production deployment
- ✅ Notify team members about the migration
- ✅ Test migration in staging environment first

---

## Pre-Migration Checklist

### Step 1: Backup Your Database

**Via Supabase Dashboard:**
1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Backups**
3. Click **"Create Backup"**
4. Wait for backup to complete
5. Download backup for local storage

**Via CLI (Alternative):**
```bash
# Export database schema
supabase db dump -f backup_schema.sql

# Export database data
supabase db dump --data-only -f backup_data.sql
```

### Step 2: Verify Existing Users

Check how many existing users need migration:

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as total_users 
FROM auth.users;
```

**Note the count** - all these users will be automatically assigned a free tier subscription.

### Step 3: Check for Conflicts

Ensure no conflicting tables exist:

```sql
-- Check for existing paywall tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'subscription_tiers',
    'user_subscriptions', 
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events'
  );
```

**Expected Result:** No rows (empty result set)

If tables exist, you must either:
- Drop them manually (if safe to do so)
- Rename them before migration
- Use a different table naming scheme

---

## Running the Migration

### Option 1: Supabase Dashboard (Recommended)

#### Step 1: Open SQL Editor
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

#### Step 2: Execute Migration Script
1. Click **"New Query"**
2. Open [`paywall_migration.sql`](paywall_migration.sql) in a text editor
3. Copy the **entire contents** of the file
4. Paste into the SQL Editor
5. Click **"Run"** (or press `Cmd/Ctrl + Enter`)

#### Step 3: Monitor Execution
- Watch for success messages in the output panel
- Execution should take **10-30 seconds**
- Look for the final success message:
  ```
  NOTICE:  Paywall database migration completed successfully!
  NOTICE:  Tables created: 6
  NOTICE:  Indexes created: 20
  NOTICE:  Functions created: 6
  NOTICE:  Triggers created: 4
  ```

#### Step 4: Check for Errors
If you see any errors:
1. **DO NOT re-run** the script immediately
2. Read the error message carefully
3. See [Troubleshooting](#troubleshooting) section
4. Fix the issue before proceeding

### Option 2: Supabase CLI

If you prefer using the CLI:

```bash
# Ensure you're in the project directory
cd /path/to/smart-subscription-tracker

# Login to Supabase (if not already)
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push --db-url "your-database-url"

# Or execute the SQL file directly
psql "your-database-connection-string" -f database/paywall_migration.sql
```

---

## Verification Steps

After running the migration, verify everything was created successfully.

### Step 1: Verify Tables

Run this query to check all tables were created:

```sql
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN (
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events'
  )
ORDER BY table_name;
```

**Expected Result:** 6 rows showing all tables

| table_name | column_count |
|------------|--------------|
| payment_transactions | 13 |
| refund_requests | 13 |
| stripe_webhooks | 9 |
| subscription_tiers | 10 |
| usage_tracking_events | 5 |
| user_subscriptions | 16 |

### Step 2: Verify Subscription Tiers

Check that default tiers were created:

```sql
SELECT 
  tier_id,
  name,
  monthly_price,
  annual_price,
  subscription_limit,
  is_active
FROM public.subscription_tiers
ORDER BY display_order;
```

**Expected Result:** 2 rows

| tier_id | name | monthly_price | annual_price | subscription_limit | is_active |
|---------|------|---------------|--------------|-------------------|-----------|
| free | Free | 0.00 | 0.00 | 5 | true |
| premium | Premium | 4.99 | 39.00 | -1 | true |

### Step 3: Verify Indexes

```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events'
  )
ORDER BY tablename, indexname;
```

**Expected Result:** At least 20 indexes (plus primary key indexes)

### Step 4: Verify Functions

```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_subscription_limit',
    'can_user_add_subscription',
    'initialize_user_subscription',
    'process_stripe_webhook',
    'track_usage_event',
    'calculate_refund_eligibility',
    'downgrade_to_free',
    'update_updated_at_column'
  )
ORDER BY routine_name;
```

**Expected Result:** 8 functions

### Step 5: Verify RLS is Enabled

```sql
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events'
  );
```

**Expected Result:** All tables should have `rowsecurity = true`

### Step 6: Verify Existing Users Migrated

Check that existing users got free tier subscriptions:

```sql
SELECT 
  COUNT(*) as users_with_subscriptions
FROM public.user_subscriptions
WHERE tier_id = 'free';
```

**Expected Result:** Should match the number of users in `auth.users`

---

## Testing RLS Policies

It's critical to test Row Level Security policies to ensure users can only access their own data.

### Test Setup

First, get a test user ID:

```sql
-- Get a test user
SELECT id, email 
FROM auth.users 
LIMIT 1;
```

### Test 1: User Can View Own Subscription

```sql
-- Set the user context (replace with actual user ID)
SET request.jwt.claim.sub = 'USER_ID_HERE';

-- Try to view own subscription
SELECT * FROM public.user_subscriptions
WHERE user_id = 'USER_ID_HERE';
```

**Expected:** Returns the user's subscription

### Test 2: User Cannot View Other Subscriptions

```sql
-- Try to view all subscriptions (should be blocked)
SELECT * FROM public.user_subscriptions;
```

**Expected:** Only returns subscriptions belonging to the authenticated user

### Test 3: Anyone Can View Active Tiers

```sql
-- View subscription tiers (should work without authentication)
SELECT * FROM public.subscription_tiers
WHERE is_active = TRUE;
```

**Expected:** Returns both Free and Premium tiers

### Test 4: Service Role Can Access Everything

This test requires using the Supabase service role key (only do this in development):

```sql
-- Reset to service role context
RESET request.jwt.claim.sub;

-- View all subscriptions (as service role)
SELECT COUNT(*) FROM public.user_subscriptions;
```

**Expected:** Returns all subscriptions

---

## Rollback Instructions

If you need to rollback the migration due to issues:

### ⚠️ WARNING
**Rollback will permanently delete all paywall data including:**
- All user subscriptions
- Payment transaction history
- Webhook logs
- Usage analytics
- Refund requests

### Rollback Steps

1. **Backup Current State First**
   ```sql
   -- Export data before rollback
   COPY public.user_subscriptions TO '/tmp/user_subscriptions_backup.csv' CSV HEADER;
   COPY public.payment_transactions TO '/tmp/payment_transactions_backup.csv' CSV HEADER;
   ```

2. **Run Rollback Script**
   - Open [`paywall_rollback.sql`](paywall_rollback.sql)
   - Copy entire contents
   - Paste into Supabase SQL Editor
   - Click **"Run"**

3. **Verify Rollback**
   ```sql
   -- Verify tables are gone
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name LIKE '%subscription%';
   ```
   **Expected:** No rows (tables deleted)

4. **Document Rollback Reason**
   - Note why rollback was necessary
   - Fix issues before attempting migration again

---

## Troubleshooting

### Issue: "relation already exists"

**Problem:** Tables already exist in the database

**Solution:**
```sql
-- Check which tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions'
  );

-- Option 1: Drop conflicting tables (if safe)
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_tiers CASCADE;

-- Option 2: Rename existing tables
ALTER TABLE public.user_subscriptions 
  RENAME TO user_subscriptions_old;
```

### Issue: "permission denied"

**Problem:** Insufficient database permissions

**Solution:**
- Ensure you're using an admin account
- Check that you have `CREATE` privileges
- Try using the Supabase service role key (in development only)

### Issue: "foreign key constraint fails"

**Problem:** Referential integrity violation

**Solution:**
```sql
-- Check for orphaned records
SELECT us.id 
FROM public.user_subscriptions us
LEFT JOIN auth.users u ON us.user_id = u.id
WHERE u.id IS NULL;

-- Clean up orphaned records
DELETE FROM public.user_subscriptions
WHERE user_id NOT IN (SELECT id FROM auth.users);
```

### Issue: "function already exists"

**Problem:** Functions already defined

**Solution:**
```sql
-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_user_subscription_limit(UUID);
DROP FUNCTION IF EXISTS public.can_user_add_subscription(UUID);
-- ... repeat for all functions
```

### Issue: Slow migration execution

**Problem:** Migration taking longer than expected

**Possible Causes:**
- Large number of existing users (>10,000)
- Database under heavy load
- Network latency

**Solution:**
- Run during off-peak hours
- Split migration into smaller batches
- Increase statement timeout:
  ```sql
  SET statement_timeout = '10min';
  ```

### Issue: RLS policies not working

**Problem:** Users can see data they shouldn't

**Solution:**
1. Verify RLS is enabled:
   ```sql
   ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
   ```

2. Recreate policies:
   ```sql
   DROP POLICY IF EXISTS "Users can view own subscription" 
     ON public.user_subscriptions;
   
   CREATE POLICY "Users can view own subscription"
     ON public.user_subscriptions
     FOR SELECT
     USING (auth.uid() = user_id);
   ```

---

## Post-Migration Tasks

### 1. Initialize Existing Users

The migration automatically creates free tier subscriptions for all existing users. Verify this:

```sql
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT us.user_id) as users_with_subscriptions
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id;
```

Both counts should match. If not:

```sql
-- Manually initialize missing users
INSERT INTO public.user_subscriptions (user_id, tier_id, billing_cycle, status)
SELECT 
  u.id,
  'free',
  'none',
  'active'
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
WHERE us.user_id IS NULL;
```

### 2. Configure Environment Variables

Add these to your application's environment:

**For React Native App (`.env`):**
```bash
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**For Supabase Edge Functions:**
```bash
# Set via Supabase Dashboard → Settings → API → Secrets
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Set Up Monitoring

Create a dashboard to monitor:

```sql
-- Active subscriptions by tier
CREATE OR REPLACE VIEW public.subscription_metrics AS
SELECT 
  tier_id,
  COUNT(*) as active_subscriptions,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month
FROM public.user_subscriptions
WHERE status = 'active'
GROUP BY tier_id;

-- Recent payment activity
CREATE OR REPLACE VIEW public.payment_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  status,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM public.payment_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY date DESC;
```

### 4. Test Critical Functions

```sql
-- Test subscription limit check
SELECT * FROM public.can_user_add_subscription(
  (SELECT id FROM auth.users LIMIT 1)
);

-- Test usage event tracking
SELECT public.track_usage_event(
  (SELECT id FROM auth.users LIMIT 1),
  'test_event',
  'testing',
  '{"test": true}'::jsonb
);
```

### 5. Document for Team

Share with your team:
- Migration completion date
- Number of users migrated
- Any issues encountered
- Next steps for Phase 2 (Stripe integration)

---

## Next Steps

After successful database migration:

1. **Phase 2:** Set up Stripe integration (see [`docs/PAYWALL_IMPLEMENTATION_ROADMAP.md`](../docs/PAYWALL_IMPLEMENTATION_ROADMAP.md))
2. **Phase 3:** Implement subscription limit enforcement in the app
3. **Phase 4:** Build payment flow UI
4. **Phase 5:** Implement webhook handlers
5. **Phase 6:** Add refund flow and analytics

---

## Support and Resources

### Documentation References
- [Paywall Technical Specification](../docs/PAYWALL_TECHNICAL_SPEC.md)
- [Database Schema Documentation](../docs/PAYWALL_DATABASE_SCHEMA.md)
- [Implementation Roadmap](../docs/PAYWALL_IMPLEMENTATION_ROADMAP.md)

### External Resources
- [Supabase SQL Editor Documentation](https://supabase.com/docs/guides/database/sql-editor)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Stripe API Documentation](https://stripe.com/docs/api)

### Getting Help

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Supabase logs in Dashboard → Database → Logs
3. Search [Supabase Discord](https://discord.supabase.com)
4. Contact your database administrator

---

## Migration Checklist

Use this checklist to track your progress:

- [ ] Backed up database
- [ ] Reviewed existing users count
- [ ] Checked for table conflicts
- [ ] Ran migration script
- [ ] Verified all 6 tables created
- [ ] Verified 2 subscription tiers inserted
- [ ] Verified 20+ indexes created
- [ ] Verified 8 functions created
- [ ] Verified 4 triggers created
- [ ] Verified RLS enabled on all tables
- [ ] Tested RLS policies
- [ ] Verified existing users migrated
- [ ] Set up environment variables
- [ ] Created monitoring views
- [ ] Tested critical functions
- [ ] Documented completion for team

---

**Migration Complete! ✅**

You're now ready to proceed with Phase 2 of the paywall implementation.