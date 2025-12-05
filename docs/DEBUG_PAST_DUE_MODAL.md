# Debug: Past Due Modal Not Showing

## Step-by-Step Debugging

Run these SQL queries in Supabase SQL Editor to diagnose the issue:

### Step 1: Verify Migration Success

```sql
-- Check if payment_history table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'payment_history'
) AS table_exists;
```
**Expected:** `true`

```sql
-- Check if function exists
SELECT EXISTS (
  SELECT FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name = 'get_past_due_items'
) AS function_exists;
```
**Expected:** `true`

### Step 2: Find Your User ID

```sql
-- Get your user ID
SELECT id, email 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```
Copy your `id` from the results.

### Step 3: Check for Past Due Items (Manual Query)

```sql
-- Replace <YOUR_USER_ID> with the ID from Step 2
SELECT 
  id,
  name,
  cost,
  renewal_date,
  repeat_interval,
  status,
  CURRENT_DATE AS today,
  renewal_date < CURRENT_DATE AS is_past_due,
  CURRENT_DATE - renewal_date AS days_past_due
FROM recurring_items
WHERE user_id = '<YOUR_USER_ID>'
ORDER BY renewal_date DESC;
```

**Look for:**
- `is_past_due` = `true`
- `status` = `active`
- `repeat_interval` != `never`

### Step 4: Test the Function Directly

```sql
-- Replace <YOUR_USER_ID>
SELECT * FROM get_past_due_items('<YOUR_USER_ID>');
```

**If this returns rows:** Function works! Issue is in the app.
**If this returns no rows:** Check Step 3 results.

### Step 5: Check Item Status

```sql
-- Replace <YOUR_USER_ID>
SELECT 
  id,
  name,
  renewal_date,
  status,
  repeat_interval,
  CASE 
    WHEN status = 'active' THEN '✅ Active'
    WHEN status = 'paused' THEN '❌ Paused (won''t show)'
    WHEN status = 'cancelled' THEN '❌ Cancelled (won''t show)'
    ELSE '❓ Unknown'
  END AS status_check,
  CASE
    WHEN repeat_interval = 'never' THEN '❌ One-time (won''t show)'
    ELSE '✅ Recurring'
  END AS interval_check,
  CASE
    WHEN renewal_date < CURRENT_DATE THEN '✅ Past due'
    ELSE '❌ Not past due yet'
  END AS date_check
FROM recurring_items
WHERE user_id = '<YOUR_USER_ID>'
  AND name LIKE '%Dec%'  -- Adjust to match your item name
ORDER BY renewal_date DESC;
```

### Step 6: Check Console Logs

Open your app with React Native Debugger or Expo Dev Tools:

**Look for these logs:**
```
✅ Good: "HomeScreen focused - force refreshing from Supabase..."
✅ Good: "Found X past due items"
❌ Bad: "Error fetching past due items"
❌ Bad: Any RPC function errors
```

## Common Issues & Fixes

### Issue A: Dec 4, 2025 is in the FUTURE
**Problem:** Today is Dec 5, 2024, but your item is Dec 4, **2025**
**Fix:** Update the renewal date to 2024:
```sql
UPDATE recurring_items
SET renewal_date = '2024-12-04'
WHERE id = '<YOUR_ITEM_ID>';
```

### Issue B: Item Status Not Active
**Problem:** Item is paused or cancelled
**Fix:**
```sql
UPDATE recurring_items
SET status = 'active'
WHERE id = '<YOUR_ITEM_ID>';
```

### Issue C: Item is One-Time (never)
**Problem:** repeat_interval = 'never'
**Fix:**
```sql
UPDATE recurring_items
SET repeat_interval = 'monthly'
WHERE id = '<YOUR_ITEM_ID>';
```

### Issue D: App Not Refreshed
**Problem:** App still has old code cached
**Fix:** 
- Close app completely
- Clear cache if using Expo
- Restart app

## Quick Fix: Create Test Item

If still not working, create a guaranteed past due item:

```sql
-- Replace <YOUR_USER_ID>
INSERT INTO recurring_items (
  user_id,
  name,
  cost,
  repeat_interval,
  renewal_date,
  category,
  status
) VALUES (
  '<YOUR_USER_ID>',
  '🧪 TEST Past Due Item',
  9.99,
  'monthly',
  CURRENT_DATE - INTERVAL '2 days',  -- 2 days ago
  'Test',
  'active'
);
```

Now restart the app - you SHOULD see the modal!

## Still Not Working?

Share these results:
1. Output from Step 3 (manual query)
2. Output from Step 4 (function test)
3. Console logs from app
4. Screenshot of your item in Supabase dashboard