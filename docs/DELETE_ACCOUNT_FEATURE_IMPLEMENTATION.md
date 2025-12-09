# Delete Account Feature - Implementation & Deployment Guide

**Version:** 1.0.0  
**Date:** December 9, 2025  
**Feature Status:** ✅ Fully Implemented

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture Summary](#architecture-summary)
3. [Environment Setup](#environment-setup)
4. [Deployment Instructions](#deployment-instructions)
5. [Testing Guide](#testing-guide)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Future Enhancements](#future-enhancements)

---

## Feature Overview

### What This Feature Does

The Delete Account feature allows users to permanently remove their account and all associated data from the application. It implements a **soft delete with a 30-day grace period**, giving users time to recover their account if they change their mind.

### Why Soft Delete with Grace Period?

**Benefits:**

✅ **User Protection** - Prevents accidental permanent data loss  
✅ **Regulatory Compliance** - Meets GDPR/CCPA "right to be forgotten" requirements  
✅ **User Confidence** - Users feel safer knowing they can recover their account  
✅ **Business Intelligence** - Provides insights into account deletion patterns  
✅ **Premium Subscription Handling** - Automatically cancels active subscriptions  

**Key Features:**

- 🔒 **Secure soft delete** - Account marked for deletion, not immediately destroyed
- ⏰ **30-day grace period** - Users can recover their account by logging in
- 🗑️ **Automatic cleanup** - Scheduled job permanently deletes expired accounts
- 💳 **Subscription handling** - Cancels active premium subscriptions automatically
- 📊 **Audit logging** - Complete audit trail of deletion and recovery events
- 🔐 **Security first** - All operations require authentication

---

## Architecture Summary

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DELETE ACCOUNT FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User Action                  Backend                    Database
─────────────────────────────────────────────────────────────────

[Delete Button]
      │
      ├──> [DeleteAccountModal]
      │         │ (Requires "DELETE" confirmation)
      │         │
      │         ├──> mark-account-deleted Function
      │         │         │
      │         │         ├──> Sets deleted_at timestamp
      │         │         │         └──> profiles.deleted_at = NOW()
      │         │         │
      │         │         ├──> Creates audit log
      │         │         │         └──> account_deletion_logs (insert)
      │         │         │
      │         │         └──> Cancels premium subscription (if any)
      │         │                   └──> Calls cancel-subscription
      │         │
      │         └──> Signs out user
      │
      └──> Account marked for deletion
           (30-day grace period begins)


┌─────────────────────────────────────────────────────────────────┐
│                      RECOVERY FLOW                               │
└─────────────────────────────────────────────────────────────────┘

User Action                  Backend                    Database
─────────────────────────────────────────────────────────────────

[User Logs In]
      │
      ├──> AuthContext detects deleted_at
      │         │
      │         └──> Navigates to AccountRecoveryScreen
      │                   │ (Shows countdown timer)
      │                   │
      │                   ├──> [Recover Account Button]
      │                   │         │
      │                   │         ├──> recover-account Function
      │                   │         │         │
      │                   │         │         ├──> Validates grace period
      │                   │         │         │
      │                   │         │         ├──> Clears deleted_at
      │                   │         │         │         └──> profiles.deleted_at = NULL
      │                   │         │         │
      │                   │         │         └──> Logs recovery event
      │                   │         │                   └──> account_deletion_logs (insert)
      │                   │         │
      │                   │         └──> Returns to Home screen
      │                   │
      │                   └──> Account recovered
      │
      └──> All data restored


┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATIC CLEANUP FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Scheduled Job                Backend                    Database
─────────────────────────────────────────────────────────────────

[Supabase Cron]
(Daily at 2:00 AM UTC)
      │
      ├──> cleanup-deleted-accounts Function
      │         │
      │         ├──> Finds accounts with deleted_at > 30 days
      │         │         └──> WHERE deleted_at < NOW() - INTERVAL '30 days'
      │         │
      │         ├──> For each account:
      │         │         │
      │         │         ├──> Deletes subscriptions
      │         │         │         └──> DELETE FROM subscriptions
      │         │         │
      │         │         ├──> Updates audit log
      │         │         │         └──> permanently_deleted_at = NOW()
      │         │         │
      │         │         ├──> Deletes profile
      │         │         │         └──> DELETE FROM profiles
      │         │         │
      │         │         └──> Deletes auth user
      │         │                   └──> supabase.auth.admin.deleteUser()
      │         │
      │         └──> Returns summary report
      │
      └──> Expired accounts permanently deleted
```

### Component Overview

**Database Layer:**
- [`database/add_soft_delete_support.sql`](../database/add_soft_delete_support.sql) - Migration script
  - Adds `deleted_at` column to profiles table
  - Creates `account_deletion_logs` audit table
  - Updates RLS policies to exclude soft-deleted accounts
  - Creates performance indexes

**Backend Layer (Edge Functions):**
- [`supabase/functions/mark-account-deleted/index.ts`](../supabase/functions/mark-account-deleted/index.ts)
  - Marks account for deletion
  - Cancels active premium subscriptions
  - Creates audit log entry

- [`supabase/functions/recover-account/index.ts`](../supabase/functions/recover-account/index.ts)
  - Validates grace period
  - Restores account by clearing deleted_at
  - Logs recovery event

- [`supabase/functions/cleanup-deleted-accounts/index.ts`](../supabase/functions/cleanup-deleted-accounts/index.ts)
  - Scheduled job (runs daily)
  - Permanently deletes expired accounts
  - Batch processing with error handling

**Frontend Layer:**
- [`components/DeleteAccountModal.tsx`](../components/DeleteAccountModal.tsx) - Confirmation modal
- [`screens/AccountRecoveryScreen.tsx`](../screens/AccountRecoveryScreen.tsx) - Recovery interface
- [`contexts/AuthContext.tsx`](../contexts/AuthContext.tsx) - Deleted account detection
- [`navigation/AppNavigator.tsx`](../navigation/AppNavigator.tsx) - Recovery screen routing
- [`screens/SettingsScreen.tsx`](../screens/SettingsScreen.tsx) - Delete button integration

---

## Environment Setup

### Required Environment Variables

These environment variables must be configured in your Supabase project:

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `PROJECT_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SERVICE_ROLE_KEY` | Service role key for admin operations | Supabase Dashboard → Settings → API → service_role key (secret) |
| `CLEANUP_SECRET_KEY` | Optional secret key for cleanup job | Generate a secure random string (optional, falls back to SERVICE_ROLE_KEY) |

### Setting Up Environment Variables

#### For Edge Functions (Supabase):

1. **Navigate to Edge Functions Settings:**
   ```
   Supabase Dashboard → Edge Functions → Settings
   ```

2. **Add Environment Variables:**
   - These are automatically available: `PROJECT_URL`, `SERVICE_ROLE_KEY`
   - Optionally add `CLEANUP_SECRET_KEY` for extra security

#### For Local Development:

Create a `.env.local` file in your Supabase functions directory:

```bash
PROJECT_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your-service-role-key
CLEANUP_SECRET_KEY=your-cleanup-secret-key
```

⚠️ **Security Note:** Never commit the `.env.local` file to version control.

---

## Deployment Instructions

### Prerequisites

- ✅ Supabase project set up
- ✅ Supabase CLI installed ([Install Guide](https://supabase.com/docs/guides/cli))
- ✅ Logged in to Supabase CLI: `supabase login`
- ✅ Linked to your project: `supabase link --project-ref your-project-ref`

### Step 1: Deploy Database Migration

**⚠️ IMPORTANT:** This migration modifies the `profiles` table and creates a new `account_deletion_logs` table. Review the migration before running.

#### 1.1 Run the Migration

```bash
# Navigate to your project root
cd /path/to/smart-subscription-tracker

# Run the migration in Supabase SQL Editor
# Copy the contents of database/add_soft_delete_support.sql
# and paste into Supabase Dashboard → SQL Editor → New Query
```

**Or via Supabase CLI:**

```bash
supabase db push
```

#### 1.2 Verify Migration Success

Check the output for these confirmations:
```
✅ profiles.deleted_at column: EXISTS
✅ account_deletion_logs table: EXISTS
✅ Indexes created: 4 of 4
```

#### 1.3 Verify in Database

Run this query in SQL Editor to confirm:

```sql
-- Check deleted_at column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name = 'deleted_at';

-- Check audit table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'account_deletion_logs';
```

### Step 2: Deploy Edge Functions

Deploy all three Edge Functions to Supabase:

#### 2.1 Deploy mark-account-deleted Function

```bash
supabase functions deploy mark-account-deleted
```

**Expected Output:**
```
Deploying mark-account-deleted...
✓ Deployed function mark-account-deleted
```

#### 2.2 Deploy recover-account Function

```bash
supabase functions deploy recover-account
```

**Expected Output:**
```
Deploying recover-account...
✓ Deployed function recover-account
```

#### 2.3 Deploy cleanup-deleted-accounts Function

```bash
supabase functions deploy cleanup-deleted-accounts
```

**Expected Output:**
```
Deploying cleanup-deleted-accounts...
✓ Deployed function cleanup-deleted-accounts
```

#### 2.4 Verify Deployment

1. Navigate to: **Supabase Dashboard → Edge Functions**
2. Confirm all three functions are listed and have "Deployed" status
3. Click each function to view logs and ensure no deployment errors

### Step 3: Set Up Supabase Cron Job

The cleanup job needs to run automatically every day to permanently delete accounts past their grace period.

#### 3.1 Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### 3.2 Create Cron Job

```sql
-- Schedule cleanup job to run daily at 2:00 AM UTC
SELECT cron.schedule(
  'cleanup-deleted-accounts-daily',           -- Job name
  '0 2 * * *',                                 -- Cron schedule (2 AM UTC daily)
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

**⚠️ IMPORTANT:** Replace `your-project` with your actual Supabase project reference.

#### 3.3 Alternative: Use CLEANUP_SECRET_KEY

If you configured a `CLEANUP_SECRET_KEY`, use it instead:

```sql
SELECT cron.schedule(
  'cleanup-deleted-accounts-daily',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_CLEANUP_SECRET_KEY'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

#### 3.4 Verify Cron Job Setup

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Check job runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-deleted-accounts-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

#### 3.5 Cron Schedule Reference

Common schedules you might want to use:

| Schedule | Description | Cron Expression |
|----------|-------------|-----------------|
| Daily at 2 AM UTC | Default (recommended) | `0 2 * * *` |
| Daily at midnight UTC | Alternative | `0 0 * * *` |
| Every 12 hours | More frequent | `0 */12 * * *` |
| Weekly on Sunday at 3 AM | Less frequent | `0 3 * * 0` |

### Step 4: Verify Complete Deployment

Run these verification steps:

#### 4.1 Test Database Access

```sql
-- Check profiles table has deleted_at
SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL;

-- Check audit log table is accessible
SELECT COUNT(*) FROM account_deletion_logs;
```

#### 4.2 Test Edge Functions

```bash
# Test mark-account-deleted (requires valid JWT)
curl -X POST \
  https://your-project.supabase.co/functions/v1/mark-account-deleted \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Test cleanup with dry-run
curl -X POST \
  "https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts?dry_run=true" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

#### 4.3 Check Function Logs

1. Go to: **Supabase Dashboard → Edge Functions**
2. Click on each function
3. View "Logs" tab to ensure no errors

### Deployment Complete! ✅

Your Delete Account feature is now fully deployed and operational.

---

## Testing Guide

### Overview

This guide covers comprehensive testing scenarios for the Delete Account feature. Follow these steps to verify all functionality works correctly.

### Prerequisites for Testing

- ✅ Feature fully deployed (database + Edge Functions + cron job)
- ✅ Test user account created
- ✅ Access to Supabase Dashboard for monitoring
- ✅ Optional: Premium subscription test account

---

### Test Scenario 1: Account Deletion Flow

**Objective:** Verify user can successfully mark their account for deletion.

#### Steps:

1. **Log in to the app** with a test account
   - Email: `test-delete@example.com`
   - Password: Your test password

2. **Navigate to Settings screen**
   - Tap the "Settings" tab
   - Scroll to the "Support" section

3. **Initiate account deletion**
   - Tap "Delete Account" button
   - Verify `DeleteAccountModal` appears

4. **Review modal content**
   - ✅ Warning message displayed
   - ✅ List of what will be deleted shown
   - ✅ 30-day grace period information visible
   - ✅ Text input for "DELETE" confirmation present

5. **Confirm deletion**
   - Type "DELETE" in the input field (must be uppercase)
   - Verify "Delete My Account" button becomes enabled
   - Tap "Delete My Account"

6. **Verify success**
   - ✅ Success toast: "Account Deletion Scheduled"
   - ✅ Info toast: "You can recover your account within 30 days..."
   - ✅ User is signed out
   - ✅ Returns to login screen

#### Verify in Database:

```sql
-- Check the account is marked for deletion
SELECT id, email, deleted_at 
FROM profiles 
WHERE email = 'test-delete@example.com';

-- Should show deleted_at with current timestamp

-- Check audit log entry
SELECT user_id, deleted_at, reason, ip_address, created_at
FROM account_deletion_logs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;
```

#### Expected Results:

- ✅ `deleted_at` column has a timestamp
- ✅ Audit log entry created
- ✅ User signed out successfully
- ✅ If premium subscription existed, it should be cancelled

---

### Test Scenario 2: Account Recovery Flow

**Objective:** Verify user can recover their account within the 30-day grace period.

#### Steps:

1. **Log in with the deleted account**
   - Email: `test-delete@example.com`
   - Password: Your test password

2. **Verify recovery screen appears**
   - ✅ `AccountRecoveryScreen` is displayed automatically
   - ✅ Warning icon visible
   - ✅ Account email displayed
   - ✅ Countdown timer shows days and hours remaining
   - ✅ "What will be recovered" list shown

3. **Review countdown timer**
   - Should show: "30 days" and "X hours"
   - Timer updates every minute

4. **Recover the account**
   - Tap "Recover My Account" button
   - Wait for processing (loading spinner)

5. **Verify recovery success**
   - ✅ Success toast: "Account recovered successfully! Welcome back."
   - ✅ Navigates to Home screen
   - ✅ All subscription data visible
   - ✅ User settings intact

#### Verify in Database:

```sql
-- Check deleted_at is cleared
SELECT id, email, deleted_at 
FROM profiles 
WHERE email = 'test-delete@example.com';

-- Should show deleted_at = NULL

-- Check recovery log entry
SELECT user_id, deleted_at, reason, ip_address, created_at
FROM account_deletion_logs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Should show reason like "Account recovered on 2025-12-09..."
```

#### Expected Results:

- ✅ `deleted_at` is NULL (cleared)
- ✅ Recovery log entry created
- ✅ User can access all data
- ✅ Premium status preserved (if applicable)

---

### Test Scenario 3: Expired Grace Period

**Objective:** Verify recovery is blocked after 30-day grace period expires.

#### Steps:

**⚠️ Note:** This scenario requires manually setting `deleted_at` to simulate expiration.

1. **Create test account and mark for deletion**
   - Follow Test Scenario 1 steps

2. **Simulate expired grace period in database:**

```sql
-- Set deleted_at to 31 days ago
UPDATE profiles
SET deleted_at = NOW() - INTERVAL '31 days'
WHERE email = 'test-expired@example.com';
```

3. **Attempt to log in**
   - Email: `test-expired@example.com`
   - Password: Your test password

4. **Verify AccountRecoveryScreen appears**
   - ✅ Screen loads
   - ✅ Countdown shows "0 days 0 hours"

5. **Attempt recovery**
   - Tap "Recover My Account" button
   - Wait for response

6. **Verify error message**
   - ✅ Error toast: "Recovery period has expired..."
   - ✅ Alert dialog appears: "Recovery Period Expired"
   - ✅ User is signed out
   - ✅ Returns to login screen

#### Expected Results:

- ✅ Recovery blocked after grace period
- ✅ Clear error message displayed
- ✅ User cannot access account
- ✅ Account ready for cleanup job

---

### Test Scenario 4: Cleanup Job (Dry Run)

**Objective:** Test the automatic cleanup job without actually deleting data.

#### Steps:

1. **Prepare test account for cleanup**

```sql
-- Create/update account with expired deletion date
UPDATE profiles
SET deleted_at = NOW() - INTERVAL '31 days'
WHERE email = 'test-cleanup@example.com';
```

2. **Run cleanup job in dry-run mode:**

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts?dry_run=true" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

3. **Review response:**

```json
{
  "success": true,
  "message": "Dry run completed - no actual deletions performed",
  "summary": {
    "accountsFound": 1,
    "accountsDeleted": 1,
    "accountsFailed": 0,
    "errors": []
  }
}
```

4. **Verify in database (account should still exist):**

```sql
-- Account should still be present in dry-run mode
SELECT id, email, deleted_at 
FROM profiles 
WHERE email = 'test-cleanup@example.com';
```

#### Expected Results:

- ✅ Function returns success
- ✅ Reports accounts found
- ✅ No actual deletion occurred (dry-run)
- ✅ Account still exists in database

---

### Test Scenario 5: Cleanup Job (Real Execution)

**Objective:** Test actual permanent deletion of expired accounts.

#### ⚠️ **WARNING:** This test permanently deletes data. Use only test accounts.

#### Steps:

1. **Prepare test account for cleanup**

```sql
-- Set account to expired
UPDATE profiles
SET deleted_at = NOW() - INTERVAL '31 days'
WHERE email = 'test-permanent-delete@example.com';
```

2. **Run cleanup job (without dry_run):**

```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

3. **Review response:**

```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "summary": {
    "accountsFound": 1,
    "accountsDeleted": 1,
    "accountsFailed": 0,
    "errors": []
  }
}
```

4. **Verify permanent deletion:**

```sql
-- Account should be gone
SELECT COUNT(*) FROM profiles 
WHERE email = 'test-permanent-delete@example.com';
-- Should return 0

-- Check audit log was updated
SELECT user_id, permanently_deleted_at 
FROM account_deletion_logs
WHERE user_id = 'DELETED_USER_ID';
-- Should show permanently_deleted_at timestamp

-- Verify auth.users entry is gone
SELECT COUNT(*) FROM auth.users 
WHERE email = 'test-permanent-delete@example.com';
-- Should return 0
```

#### Expected Results:

- ✅ Profile deleted
- ✅ Auth user deleted
- ✅ Subscriptions deleted
- ✅ Audit log updated with `permanently_deleted_at`
- ✅ No errors in response

---

### Test Scenario 6: Premium Subscription Cancellation

**Objective:** Verify premium subscriptions are automatically cancelled on deletion.

#### Prerequisites:
- Test account with active premium subscription

#### Steps:

1. **Verify premium status before deletion:**

```sql
SELECT user_id, status, stripe_subscription_id, tier_id
FROM user_subscriptions
WHERE user_id = 'YOUR_TEST_USER_ID';
-- Should show status = 'active' or 'trialing'
```

2. **Delete account (follow Test Scenario 1)**

3. **Check function logs:**
   - Navigate to: Supabase Dashboard → Edge Functions → mark-account-deleted → Logs
   - Look for: "💳 Active subscription found: sub_xxx"
   - Look for: "✅ Subscription cancelled successfully"

4. **Verify subscription status:**

```sql
SELECT user_id, status, cancel_at_period_end
FROM user_subscriptions
WHERE user_id = 'YOUR_TEST_USER_ID';
-- Should show cancel_at_period_end = true or status = 'canceled'
```

#### Expected Results:

- ✅ Subscription cancellation attempted
- ✅ Logs show cancellation success
- ✅ Subscription marked for cancellation at period end
- ✅ No errors during deletion process

---

### Test Scenario 7: Edge Cases

#### 7.1 Multiple Rapid Deletions

**Test:** User clicks delete button multiple times rapidly.

**Expected:** Only one deletion request processed, others ignored or handle gracefully.

#### 7.2 Delete During Poor Network

**Test:** Delete account with poor/no network connection.

**Expected:** Clear error message, account not marked as deleted, user can retry.

#### 7.3 Login Immediately After Deletion

**Test:** User deletes account, then logs in within seconds.

**Expected:** `AccountRecoveryScreen` appears immediately, countdown shows ~30 days.

#### 7.4 Recovery During Network Failure

**Test:** Attempt recovery with poor network.

**Expected:** Clear error message, retry option, account remains recoverable.

#### 7.5 Cleanup Job with Many Accounts

**Test:** Simulate 100+ expired accounts.

**Expected:** All accounts processed in batch, summary reports correct counts, no timeouts.

---

### Monitoring & Verification

#### Check Edge Function Logs

```bash
# View recent logs for mark-account-deleted
supabase functions logs mark-account-deleted --tail

# View recent logs for recover-account
supabase functions logs recover-account --tail

# View recent logs for cleanup-deleted-accounts
supabase functions logs cleanup-deleted-accounts --tail
```

#### Check Cron Job Execution

```sql
-- View recent cron job runs
SELECT jobid, jobname, status, start_time, end_time
FROM cron.job_run_details
WHERE jobname = 'cleanup-deleted-accounts-daily'
ORDER BY start_time DESC
LIMIT 10;
```

#### Monitor Deletion Trends

```sql
-- Count accounts marked for deletion
SELECT COUNT(*) as pending_deletions
FROM profiles
WHERE deleted_at IS NOT NULL;

-- Count permanent deletions
SELECT COUNT(*) as permanent_deletions
FROM account_deletion_logs
WHERE permanently_deleted_at IS NOT NULL;

-- Accounts recovered
SELECT COUNT(*) as recoveries
FROM account_deletion_logs
WHERE reason LIKE '%Account recovered%';
```

---

## API Reference

### 1. mark-account-deleted

**Purpose:** Marks a user's account for deletion with a 30-day grace period.

**Endpoint:** `POST /functions/v1/mark-account-deleted`

**Authentication:** Required (Bearer token)

#### Request

**Headers:**
```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body (Optional):**
```json
{
  "reason": "Optional deletion reason"
}
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Account marked for deletion. You have 30 days to recover your account.",
  "deletedAt": "2025-12-09T22:00:00.000Z",
  "gracePeriodEnds": "2026-01-08T22:00:00.000Z"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Missing authorization header"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to mark account for deletion"
}
```

#### Side Effects

1. Sets `profiles.deleted_at` to current timestamp
2. Creates entry in `account_deletion_logs`
3. Cancels active premium subscription (if exists)
4. Logs IP address for audit trail

#### Example Usage

```typescript
const { data, error } = await supabase.functions.invoke(
  'mark-account-deleted',
  {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      reason: 'User requested deletion',
    },
  }
);
```

---

### 2. recover-account

**Purpose:** Restores a deleted account within the 30-day grace period.

**Endpoint:** `POST /functions/v1/recover-account`

**Authentication:** Required (Bearer token)

#### Request

**Headers:**
```http
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:** None required

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Your account has been successfully recovered.",
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "tier": "free",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-12-09T22:00:00.000Z"
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Error (400 Bad Request - Grace Period Expired):**
```json
{
  "error": "Recovery period has expired. Account will be permanently deleted."
}
```

**Error (404 Not Found):**
```json
{
  "error": "Account is not marked for deletion"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to recover account"
}
```

#### Side Effects

1. Sets `profiles.deleted_at` to NULL
2. Creates recovery entry in `account_deletion_logs`
3. Logs IP address for audit trail

#### Example Usage

```typescript
const { data, error } = await supabase.functions.invoke(
  'recover-account',
  {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  }
);

if (error) {
  if (error.message.includes('expired')) {
    // Handle expired grace period
    showExpiredDialog();
  }
} else {
  // Account recovered successfully
  navigateToHome();
}
```

---

### 3. cleanup-deleted-accounts

**Purpose:** Permanently deletes accounts that have exceeded the 30-day grace period. Runs as a scheduled job.

**Endpoint:** `POST /functions/v1/cleanup-deleted-accounts`

**Authentication:** Required (Service role key or cleanup secret)

#### Request

**Headers:**
```http
Authorization: Bearer SERVICE_ROLE_KEY
Content-Type: application/json
```

**Query Parameters:**
- `dry_run` (optional): Set to `true` to simulate without actual deletion

**Example:**
```
POST /functions/v1/cleanup-deleted-accounts?dry_run=true
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "summary": {
    "accountsFound": 5,
    "accountsDeleted": 5,
    "accountsFailed": 0,
    "errors": []
  }
}
```

**Success with Errors (200 OK):**
```json
{
  "success": true,
  "message": "Cleanup completed successfully",
  "summary": {
    "accountsFound": 5,
    "accountsDeleted": 4,
    "accountsFailed": 1,
    "errors": [
      {
        "userId": "failed-user-uuid",
        "error": "Failed to delete profile: permission denied"
      }
    ]
  }
}
```

**Dry Run Response (200 OK):**
```json
{
  "success": true,
  "message": "Dry run completed - no actual deletions performed",
  "summary": {
    "accountsFound": 3,
    "accountsDeleted": 3,
    "accountsFailed": 0,
    "errors": []
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Unauthorized: Invalid authorization token"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to query accounts for deletion"
}
```

#### Deletion Process

For each expired account, the function:

1. Deletes all subscriptions
2. Updates `account_deletion_logs.permanently_deleted_at`
3. Deletes profile record
4. Deletes auth.users record (cascades to other tables)

#### Example Usage

**Manual Execution (Testing):**
```bash
# Dry run to see what would be deleted
curl -X POST \
  "https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts?dry_run=true" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Real execution
curl -X POST \
  "https://your-project.supabase.co/functions/v1/cleanup-deleted-accounts" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Scheduled Execution (Cron):**
```sql
-- This runs automatically via pg_cron
-- See "Deployment Instructions" section for setup
```

---

## Troubleshooting

### Common Issues

#### Issue 1: "Missing authorization header" Error

**Symptoms:**
- API call to Edge Function fails immediately
- Error: "Missing authorization header"

**Cause:**
- Missing or malformed Authorization header

**Solution:**
```typescript
// ✅ Correct
const { data, error } = await supabase.functions.invoke('mark-account-deleted', {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});

// ❌ Wrong - missing Bearer prefix
Authorization: session.access_token

// ❌ Wrong - using API key instead of JWT
Authorization: `Bearer ${SUPABASE_ANON_KEY}`
```

---

#### Issue 2: Cleanup Job Not Running

**Symptoms:**
- Accounts past 30 days not being deleted
- No entries in `cron.job_run_details`

**Diagnosis:**

```sql
-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname = 'cleanup-deleted-accounts-daily';

-- Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**Solution:**

1. Verify pg_cron extension:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

2. Recreate cron job (see Deployment Instructions, Step 3.2)

3. Check Edge Function logs:
```bash
supabase functions logs cleanup-deleted-accounts --tail
```

---

#### Issue 3: "Recovery period has expired" But Grace Period Not Over

**Symptoms:**
- User tries to recover within 30 days
- Gets "expired" error message

**Cause:**
- Time zone mismatch or calculation error

**Diagnosis:**

```sql
-- Check deleted_at and calculate grace period end
SELECT 
  id,
  email,
  deleted_at,
  deleted_at + INTERVAL '30 days' as grace_period_ends,
  NOW() as current_time,
  (deleted_at + INTERVAL '30 days') > NOW() as still_recoverable
FROM profiles
WHERE email = 'affected-user@example.com';
```

**Solution:**

1. Verify system time is correct (UTC)
2. Check Edge Function logs for actual timestamps
3. If time zone issue, adjust server time settings

---

#### Issue 4: Premium Subscription Not Cancelled

**Symptoms:**
- Account deleted successfully
- Premium subscription still active
- Logs show no cancellation attempt

**Diagnosis:**

```sql
-- Check subscription status
SELECT 
  user_id,
  status,
  stripe_subscription_id,
  tier_id
FROM user_subscriptions
WHERE user_id = 'affected-user-id';
```

**Check Function Logs:**
```bash
supabase functions logs mark-account-deleted --tail
```

Look for:
- "💳 Active subscription found"
- "✅ Subscription cancelled successfully"
- Or error messages

**Common Causes:**

1. **No stripe_subscription_id:** Subscription created via Apple IAP (iOS) instead of Stripe
2. **cancel-subscription function error:** Check that function is deployed and working
3. **Network error:** Function couldn't reach cancel-subscription endpoint

**Solution:**

For Apple IAP subscriptions:
- These must be cancelled through Apple's system
- App Store → Subscriptions → Cancel

For Stripe issues:
1. Verify `cancel-subscription` function is deployed
2. Check Stripe dashboard for subscription status
3. Manually cancel via Stripe if needed

---

#### Issue 5: RLS Policy Blocking Deletion

**Symptoms:**
- Deletion fails with "permission denied"
- Edge Function returns 500 error

**Diagnosis:**

```sql
-- Check RLS policies on profiles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
```

**Solution:**

Ensure service role policy exists:
```sql
-- This should exist from migration
CREATE POLICY "Service role can manage profiles"
  ON public.profiles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

---

### Debugging Tips

#### Enable Detailed Logging

Add debug logging to Edge Functions (for development):

```typescript
// In mark-account-deleted/index.ts
if (Deno.env.get('DEBUG') === 'true') {
  console.log('[DEBUG] User:', user);
  console.log('[DEBUG] Profile update result:', profileUpdateError);
}
```

#### Monitor in Real-Time

```bash
# Watch all Edge Function logs
supabase functions logs --tail

# Watch specific function
supabase functions logs mark-account-deleted --tail

# Filter for errors
supabase functions logs | grep "ERROR"
```

#### Check Database Logs

```sql
-- Recent profile updates
SELECT id, email, deleted_at, updated_at
FROM profiles
WHERE deleted_at IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Recent deletion logs
SELECT user_id, deleted_at, reason, permanently_deleted_at, created_at
FROM account_deletion_logs
ORDER BY created_at DESC
LIMIT 20;
```

#### Test Edge Functions Directly

```bash
# Test with curl
curl -X POST \
  https://your-project.supabase.co/functions/v1/mark-account-deleted \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "test"}' \
  -v  # Verbose output
```

---

### Log Locations

**Edge Function Logs:**
- Supabase Dashboard → Edge Functions → [Function Name] → Logs tab
- Via CLI: `supabase functions logs [function-name]`

**Database Logs:**
- Supabase Dashboard → Database → Query Editor
- Run queries against `account_deletion_logs` table

**Cron Job Logs:**
```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'cleanup-deleted-accounts-daily'
ORDER BY start_time DESC;
```

**Frontend Logs:**
- React Native Debugger
- Expo Go console output
- Device logs (via `console.log`)

---

## Future Enhancements

### Potential Improvements

#### 1. Email Notifications

**Feature:** Send email notifications at key points in the deletion process.

**Implementation:**
- Send confirmation email when account is marked for deletion
- Send reminder emails at 7 days and 1 day before permanent deletion
- Send recovery confirmation email

**Complexity:** Medium  
**Priority:** High

**Example:**
```typescript
// In mark-account-deleted function
await sendEmail({
  to: user.email,
  subject: 'Account Deletion Scheduled',
  template: 'deletion-confirmation',
  data: {
    gracePeriodEnds: gracePeriodEndsISO,
    recoveryUrl: 'https://app.renvo.com/login',
  },
});
```

---

#### 2. Configurable Grace Period

**Feature:** Allow admins to configure grace period length (default: 30 days).

**Implementation:**
- Add `grace_period_days` to app settings table
- Update all grace period calculations to use this value
- Add admin UI for configuration

**Complexity:** Low  
**Priority:** Medium

**Example:**
```sql
-- Settings table
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO app_settings (key, value)
VALUES ('deletion_grace_period_days', '30');
```

---

#### 3. Data Export Before Deletion

**Feature:** Allow users to download all their data before deleting.

**Implementation:**
- Add "Export Data" button to DeleteAccountModal
- Generate ZIP file with subscriptions, billing history, settings
- Store temporarily with download link

**Complexity:** High  
**Priority:** Medium

**Related:** Supports GDPR compliance

---

#### 4. Partial Account Deletion

**Feature:** Allow users to delete specific data types without full deletion.

**Options:**
- Delete subscription history only
- Delete billing history only
- Keep account but remove personal data

**Complexity:** High  
**Priority:** Low

---

#### 5. Admin Dashboard for Deletions

**Feature:** Admin interface to view and manage account deletions.

**Features:**
- List of pending deletions
- Manual recovery option
- Deletion analytics
- Export deletion reports

**Complexity:** Medium  
**Priority:** Low

---

#### 6. Deletion Reason Analytics

**Feature:** Collect and analyze deletion reasons to improve retention.

**Implementation:**
- Add optional reason dropdown in DeleteAccountModal
- Store in `account_deletion_logs.reason`
- Create analytics dashboard

**Reasons:**
- "Too expensive"
- "Not using anymore"
- "Found alternative"
- "Privacy concerns"
- "Other"

**Complexity:** Low  
**Priority:** Medium

---

#### 7. Two-Factor Confirmation

**Feature:** Require 2FA or password re-entry before deletion.

**Implementation:**
- Add password confirmation field to DeleteAccountModal
- Verify password before calling mark-account-deleted
- Optional: SMS/email verification code

**Complexity:** Medium  
**Priority:** High (security improvement)

---

#### 8. Scheduled Deletion Date

**Feature:** Allow users to schedule deletion for a future date.

**Use Case:** User wants account deleted after subscription expires.

**Implementation:**
- Add "Schedule deletion for: [date picker]" option
- Store scheduled_deletion_date in profiles
- Cron job checks and processes scheduled deletions

**Complexity:** Medium  
**Priority:** Low

---

### Security Enhancements

#### 1. Rate Limiting

**Feature:** Prevent abuse by limiting deletion/recovery attempts.

**Implementation:**
- Add rate limiting to Edge Functions
- Track attempts by IP address
- Block after X failed attempts in Y minutes

**Complexity:** Medium  
**Priority:** High

---

#### 2. Audit Log Improvements

**Feature:** Enhanced audit logging with more details.

**Additions:**
- User agent string
- Device information
- Previous account state snapshot
- Subscription value at deletion time

**Complexity:** Low  
**Priority:** Medium

---

#### 3. Permanent Deletion Confirmation

**Feature:** Require admin approval for permanent deletions.

**Use Case:** Extra safety for high-value accounts.

**Implementation:**
- Flag accounts for admin review
- Admin dashboard for approval
- Only delete after approval

**Complexity:** High  
**Priority:** Low

---

### Performance Improvements

#### 1. Batch Processing Optimization

**Feature:** Optimize cleanup job for large-scale deletions.

**Improvements:**
- Process deletions in smaller batches
- Add progress tracking
- Implement retry logic for failures

**Complexity:** Medium  
**Priority:** Low (unless scaling issues occur)

---

#### 2. Async Deletion

**Feature:** Queue deletions for background processing.

**Benefits:**
- Faster response time for users
- Better error handling
- Retry failed deletions automatically

**Implementation:**
- Use message queue (e.g., pg_notify or external queue)
- Worker process handles deletions
- Update status in real-time

**Complexity:** High  
**Priority:** Low

---

## Additional Resources

### Related Documentation

- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)

### Support

For questions or issues:
- **Email:** support@therenvo.com
- **GitHub Issues:** [Create an issue](https://github.com/your-repo/issues)
- **Supabase Support:** [Supabase Help Center](https://supabase.com/support)

---

## Appendix

### Database Schema

#### profiles.deleted_at Column

```sql
ALTER TABLE public.profiles 
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS 
'Timestamp when user requested account deletion. NULL = active account. After 30 days, account is permanently deleted.';
```

#### account_deletion_logs Table

```sql
CREATE TABLE IF NOT EXISTS public.account_deletion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  ip_address TEXT,
  permanently_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Environment Variable Template

```bash
# Supabase Project Configuration
PROJECT_URL=https://your-project-ref.supabase.co
SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Optional: Dedicated cleanup secret (recommended for production)
CLEANUP_SECRET_KEY=your-secure-random-string

# Optional: Enable debug logging
DEBUG=true
```

---

**Document Version:** 1.0.0  
**Last Updated:** December 9, 2025  
**Maintained By:** Development Team