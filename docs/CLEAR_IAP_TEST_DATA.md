# Clearing IAP Test Data for Fresh Testing

This guide explains how to reset both Supabase database and Apple IAP purchases to test the full purchase flow from scratch.

## Part 1: Clear Supabase Data

### Option A: Using SQL Script (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Run the cleanup script:

```sql
-- Copy and paste the contents of database/cleanup_apple_iap_test_data.sql
```

Or run it directly:

```bash
# If you have Supabase CLI configured
supabase db execute --file database/cleanup_apple_iap_test_data.sql
```

### Option B: Manual Cleanup via Supabase Dashboard

1. **Delete Apple Transactions:**
   - Go to Table Editor → `apple_transactions`
   - Select all rows → Delete

2. **Reset User Subscriptions:**
   - Go to Table Editor → `user_subscriptions`
   - For each row, update:
     - `tier_id` → `'free'`
     - `status` → `'active'`
     - `billing_cycle` → `'none'`
     - Clear all Stripe/Apple fields

3. **Reset Profiles:**
   - Go to Table Editor → `profiles`
   - For each user, update:
     - `subscription_tier` → `'free'`
     - `subscription_status` → `'active'`
     - `payment_provider` → `NULL`
     - Clear all Apple fields (`apple_original_transaction_id`, etc.)

## Part 2: Clear Apple IAP Purchases

### For iOS Simulator

1. **Reset Simulator:**
   ```bash
   # Reset the simulator completely
   xcrun simctl erase all
   ```

2. **Or reset specific simulator:**
   ```bash
   # List simulators
   xcrun simctl list devices
   
   # Erase specific device (replace DEVICE_ID)
   xcrun simctl erase <DEVICE_ID>
   ```

### For Real iOS Device (Sandbox Testing)

1. **Sign Out of Sandbox Account:**
   - Settings → App Store → Sandbox Account
   - Sign Out

2. **Clear App Data:**
   - Delete and reinstall the app
   - Or: Settings → General → iPhone Storage → [Your App] → Offload App → Reinstall

3. **Reset StoreKit Testing (if using StoreKit Configuration):**
   - In Xcode: Product → Scheme → Edit Scheme
   - Run → Options → StoreKit Configuration
   - Select your `.storekit` file
   - Or: Delete and recreate the StoreKit configuration file

### For StoreKit Testing (Xcode)

1. **Clear StoreKit Transactions:**
   - In Xcode, while app is running:
   - Debug → StoreKit → Manage Transactions
   - Delete all transactions

2. **Or reset StoreKit file:**
   - Open `ios/Renvo.storekit` in Xcode
   - Delete all subscription entries
   - Save and rebuild

### Alternative: Use Different Sandbox Account

1. Create a new sandbox tester account in App Store Connect
2. Sign in with the new account when prompted during purchase
3. This allows testing without clearing existing purchases

## Part 3: Verify Cleanup

### Check Supabase

Run this query in Supabase SQL Editor:

```sql
-- Check Apple transactions
SELECT COUNT(*) FROM public.apple_transactions;
-- Should return 0

-- Check user subscriptions
SELECT user_id, tier_id, status 
FROM public.user_subscriptions 
WHERE tier_id != 'free';
-- Should return no rows

-- Check profiles
SELECT id, subscription_tier, payment_provider, apple_original_transaction_id
FROM public.profiles
WHERE subscription_tier != 'free' OR payment_provider = 'apple';
-- Should return no rows
```

### Check iOS Device

1. Open your app
2. Check subscription status - should show free tier
3. Try to purchase - should prompt for sandbox account sign-in

## Part 4: Test Full Flow

After cleanup:

1. **Open the app** - should show free tier limits
2. **Trigger paywall** - by hitting subscription limit
3. **Select plan** - monthly or yearly
4. **Complete purchase** - sign in with sandbox account
5. **Verify subscription** - check that premium features unlock
6. **Check Supabase** - verify data was created correctly

## Troubleshooting

### Still seeing old subscription?

1. **Clear app cache:**
   - Delete and reinstall app
   - Or: Clear app data in Settings

2. **Check Supabase cache:**
   - The app caches subscription status
   - Force close and reopen the app
   - Or: Wait a few minutes for cache to expire

3. **Verify database:**
   - Run the verification queries above
   - Make sure all Apple data is cleared

### Purchase still says "already owned"?

1. **Sign out of sandbox account** completely
2. **Delete app** and reinstall
3. **Use a different sandbox account** for testing

### Receipt validation failing?

This is normal in sandbox testing. The webhook will handle validation. The purchase flow should still complete successfully.

## Quick Reset Command

For development, you can create a quick reset script:

```bash
#!/bin/bash
# reset-iap-test.sh

echo "Resetting IAP test data..."

# Run SQL cleanup
supabase db execute --file database/cleanup_apple_iap_test_data.sql

# Reset iOS simulator (if using)
xcrun simctl erase all

echo "✅ Reset complete! Reinstall app and test again."
```

Save as `scripts/reset-iap-test.sh` and run:
```bash
chmod +x scripts/reset-iap-test.sh
./scripts/reset-iap-test.sh
```

