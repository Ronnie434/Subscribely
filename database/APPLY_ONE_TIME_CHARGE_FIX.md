# How to Apply the One-Time Charge Fix

## Problem
When you mark a one-time charge as "paid" or "I didn't pay", the modal keeps reappearing after refreshing the home screen.

## Root Cause
The [`record_payment_and_update_renewal`](fix_one_time_charge_paid_status.sql:22) function was:
- ✅ Recording the payment in payment_history
- ✅ Skipping renewal_date updates for one-time charges (correct)
- ❌ NOT changing the item's status from 'active'

Since [`get_past_due_items`](update_get_past_due_items_for_one_time_charges.sql:10) filters for `status='active'` AND `renewal_date < CURRENT_DATE`, the one-time charge kept appearing as past due.

## Solution
Update the database function to mark one-time charges as `'cancelled'` when paid or skipped. This prevents them from reappearing in the past due list.

## How to Apply

### Option 1: Using Supabase Dashboard (Recommended)

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of [`fix_one_time_charge_paid_status.sql`](fix_one_time_charge_paid_status.sql)
5. Paste into the SQL Editor
6. Click **Run** to execute the migration
7. You should see a success message

### Option 2: Using Supabase CLI

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run the migration
supabase db execute -f database/fix_one_time_charge_paid_status.sql
```

## Verification

After applying the migration:

1. **Clear any existing one-time charges stuck in past due:**
   ```sql
   -- Run this in Supabase SQL Editor to clean up existing stuck items
   UPDATE public.recurring_items
   SET status = 'cancelled'
   WHERE repeat_interval = 'never'
     AND renewal_date < CURRENT_DATE
     AND status = 'active'
     AND id IN (
       SELECT recurring_item_id 
       FROM public.payment_history 
       WHERE status IN ('paid', 'skipped')
     );
   ```

2. **Test the flow:**
   - Add a new one-time charge with a past due date
   - Navigate to Home screen
   - The past due modal should appear
   - Click "I Paid"
   - Refresh the home screen
   - The modal should NOT reappear ✅

## What Changed

### Before:
```sql
-- One-time charges stayed as 'active' even after payment
IF v_repeat_interval != 'never' THEN
  UPDATE public.recurring_items
  SET renewal_date = v_new_renewal_date, ...
  WHERE id = p_recurring_item_id;
END IF;
-- (No update for one-time charges)
```

### After:
```sql
IF v_repeat_interval != 'never' THEN
  -- Recurring: Update renewal date
  UPDATE public.recurring_items
  SET renewal_date = v_new_renewal_date, ...
ELSE
  -- One-time: Mark as cancelled to prevent reappearance
  UPDATE public.recurring_items
  SET status = 'cancelled', ...
END IF;
```

## Rollback (if needed)

If you need to rollback this change:

```sql
-- Restore the previous version from one_time_charge_support.sql
-- (This will revert to the buggy behavior)
```

## Related Files
- [`fix_one_time_charge_paid_status.sql`](fix_one_time_charge_paid_status.sql) - The migration file
- [`one_time_charge_support.sql`](one_time_charge_support.sql) - Original implementation
- [`record_payment_and_update_renewal`](one_time_charge_support.sql:22) - The function being fixed