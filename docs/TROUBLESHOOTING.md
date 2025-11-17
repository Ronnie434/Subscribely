# Troubleshooting Guide - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Quick Diagnostics](#quick-diagnostics)
2. [Development Issues](#development-issues)
3. [Payment Issues](#payment-issues)
4. [Database Issues](#database-issues)
5. [Webhook Issues](#webhook-issues)
6. [Performance Issues](#performance-issues)
7. [User Experience Issues](#user-experience-issues)

---

## Quick Diagnostics

### Diagnostic Script

Run this quick diagnostic to identify common issues:

```bash
# Run verification script
npm run verify-setup

# Or manually:
npx ts-node scripts/verify-paywall-setup.ts
```

### Quick Checks

```bash
# 1. Check environment variables
echo $EXPO_PUBLIC_SUPABASE_URL
echo $EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

# 2. Check Supabase connection
curl -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/"

# 3. Check Edge Functions
curl "$EXPO_PUBLIC_SUPABASE_URL/functions/v1/stripe-webhook"

# 4. Check database tables
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

---

## Development Issues

### Issue: "Stripe provider not initialized"

**Symptoms**:
- Error when trying to use Stripe
- `useStripe()` returns undefined
- Payment sheet won't open

**Diagnosis**:
```typescript
// Check if StripeProvider is wrapping app
// In App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

console.log('Stripe Key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

**Solutions**:

1. **Verify StripeProvider in App.tsx**:
   ```typescript
   export default function App() {
     return (
       <StripeProvider 
         publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
       >
         {/* Your app content */}
       </StripeProvider>
     );
   }
   ```

2. **Check environment variable**:
   ```bash
   # Verify .env file exists
   cat .env | grep STRIPE_PUBLISHABLE_KEY
   
   # Restart development server
   npm start -- --reset-cache
   ```

3. **Verify package installation**:
   ```bash
   npm install @stripe/stripe-react-native
   
   # iOS
   cd ios && pod install && cd ..
   ```

---

### Issue: "Supabase client not initialized"

**Symptoms**:
- Cannot query database
- Authentication fails
- RLS errors

**Diagnosis**:
```typescript
// config/supabase.ts
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('Has Anon Key:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

import { supabase } from './config/supabase';
console.log('Supabase client:', supabase);
```

**Solutions**:

1. **Check environment variables**:
   ```bash
   # .env file
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Verify client creation**:
   ```typescript
   // config/supabase.ts
   import { createClient } from '@supabase/supabase-js';
   
   const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
   
   if (!supabaseUrl || !supabaseAnonKey) {
     throw new Error('Missing Supabase environment variables');
   }
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

---

### Issue: "Database function not found"

**Symptoms**:
- Error: `function public.can_user_add_subscription does not exist`
- Limit check fails

**Diagnosis**:
```sql
-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'can_user_add_subscription';
```

**Solutions**:

1. **Run database migration**:
   ```bash
   # In Supabase SQL Editor
   # Copy and run: database/paywall_migration.sql
   ```

2. **Verify function creation**:
   ```sql
   -- Test the function
   SELECT * FROM can_user_add_subscription(auth.uid());
   ```

3. **Check function permissions**:
   ```sql
   -- Grant execute permission
   GRANT EXECUTE ON FUNCTION can_user_add_subscription TO authenticated;
   ```

---

## Payment Issues

### Issue: Payment processing fails silently

**Symptoms**:
- Payment sheet appears but nothing happens
- No error message shown
- Loading state never ends

**Diagnosis**:
```typescript
// Add detailed logging
try {
  console.log('Creating payment intent...');
  const intent = await paymentService.createPaymentIntent();
  console.log('Payment intent created:', intent);
  
  console.log('Initializing payment sheet...');
  const { error } = await initPaymentSheet(intent.clientSecret);
  console.log('Payment sheet result:', { error });
} catch (error) {
  console.error('Payment error:', error);
}
```

**Solutions**:

1. **Check Stripe publishable key**:
   ```typescript
   // Verify correct key format
   const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
   console.log('Key starts with pk_:', key?.startsWith('pk_'));
   console.log('Is test key:', key?.includes('test'));
   ```

2. **Verify Edge Function response**:
   ```bash
   # Test create-subscription endpoint
   curl -X POST \
     https://your-project.supabase.co/functions/v1/create-subscription \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"priceId": "price_test123"}'
   ```

3. **Check network connectivity**:
   ```typescript
   import NetInfo from '@react-native-community/netinfo';
   
   const state = await NetInfo.fetch();
   console.log('Is connected:', state.isConnected);
   ```

---

### Issue: "Card declined" for test cards

**Symptoms**:
- Test card 4242 4242 4242 4242 is declined
- Payment fails in test mode

**Diagnosis**:
```typescript
// Check which Stripe mode you're using
console.log('Publishable key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY);
// Should start with pk_test_ for test mode
```

**Solutions**:

1. **Verify using test mode**:
   - Publishable key should start with `pk_test_`
   - Secret key should start with `sk_test_`

2. **Use correct test card**:
   ```
   Success: 4242 4242 4242 4242
   Decline: 4000 0000 0000 0002
   Insufficient funds: 4000 0000 0000 9995
   3D Secure: 4000 0027 6000 3184
   ```

3. **Check Stripe Dashboard**:
   - Verify you're in Test Mode (toggle in top-right)
   - Check Payments → Logs for error details

---

### Issue: Payment succeeds but user not upgraded

**Symptoms**:
- Payment shows as succeeded in Stripe
- User still on free tier
- Database not updated

**Diagnosis**:
```sql
-- Check if webhook was received
SELECT * FROM stripe_webhooks 
WHERE event_type = 'invoice.payment_succeeded'
ORDER BY created_at DESC 
LIMIT 5;

-- Check user subscription status
SELECT * FROM user_subscriptions 
WHERE user_id = 'USER_ID';

-- Check payment transactions
SELECT * FROM payment_transactions 
WHERE stripe_payment_intent_id = 'pi_...';
```

**Solutions**:

1. **Check webhook delivery**:
   ```
   Stripe Dashboard → Developers → Webhooks → [Your Endpoint]
   - Check recent events
   - Look for failed deliveries
   - Check response codes
   ```

2. **Manually trigger webhook**:
   ```
   In Stripe Dashboard:
   1. Find the payment event
   2. Click "Resend webhook"
   3. Select your endpoint
   4. Send
   ```

3. **Verify webhook secret**:
   ```bash
   # Check Edge Function has correct secret
   supabase secrets list
   
   # Should show STRIPE_WEBHOOK_SECRET
   ```

4. **Check Edge Function logs**:
   ```bash
   supabase functions logs stripe-webhook --tail
   ```

---

## Database Issues

### Issue: RLS policy violation

**Symptoms**:
- Error: `new row violates row-level security policy`
- Cannot insert/update records
- 403 Forbidden errors

**Diagnosis**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'user_subscriptions';

-- Check policies
SELECT * FROM pg_policies 
WHERE tablename = 'user_subscriptions';

-- Test as user
SET request.jwt.claims.sub = 'USER_ID';
INSERT INTO user_subscriptions (user_id, tier_id) 
VALUES ('USER_ID', 'free');
```

**Solutions**:

1. **Verify user is authenticated**:
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('Current user:', user?.id);
   ```

2. **Check RLS policies exist**:
   ```sql
   -- Re-run RLS policy creation from migration script
   -- See database/paywall_migration.sql
   ```

3. **Temporarily disable RLS for testing**:
   ```sql
   -- ONLY IN DEVELOPMENT!
   ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;
   
   -- Re-enable after testing
   ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
   ```

---

### Issue: Slow database queries

**Symptoms**:
- App feels sluggish
- Long loading times
- Timeouts

**Diagnosis**:
```sql
-- Find slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- > 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename IN ('user_subscriptions', 'subscriptions');
```

**Solutions**:

1. **Add indexes**:
   ```sql
   -- Common indexes from migration
   CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
     ON user_subscriptions(user_id);
   
   CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id 
     ON subscriptions(user_id);
   ```

2. **Optimize query**:
   ```sql
   -- Bad: Full table scan
   SELECT * FROM subscriptions WHERE user_id = 'xxx';
   
   -- Good: Use index and select only needed columns
   SELECT id, name, amount 
   FROM subscriptions 
   WHERE user_id = 'xxx';
   ```

3. **Use caching**:
   ```typescript
   // Cache frequent queries
   import { subscriptionCache } from '../utils/subscriptionCache';
   
   const cached = subscriptionCache.get(cacheKey);
   if (cached) return cached;
   
   const data = await fetchFromDatabase();
   subscriptionCache.set(cacheKey, data, TTL);
   ```

---

## Webhook Issues

### Issue: Webhooks not being received

**Symptoms**:
- No entries in `stripe_webhooks` table
- Payment succeeds but database not updated
- Stripe Dashboard shows webhook failures

**Diagnosis**:
```bash
# Check webhook endpoint is accessible
curl https://your-project.supabase.co/functions/v1/stripe-webhook

# Check Stripe Dashboard
# Developers → Webhooks → [Endpoint] → Recent deliveries
```

**Solutions**:

1. **Verify endpoint URL**:
   ```
   Correct: https://your-project.supabase.co/functions/v1/stripe-webhook
   Wrong: http://... (must be https)
   Wrong: .../stripe_webhook (underscore instead of dash)
   ```

2. **Check Edge Function is deployed**:
   ```bash
   supabase functions list
   
   # Should show stripe-webhook
   ```

3. **Test webhook locally**:
   ```bash
   # Use Stripe CLI
   stripe listen --forward-to \
     https://your-project.supabase.co/functions/v1/stripe-webhook
   
   # Trigger test event
   stripe trigger payment_intent.succeeded
   ```

---

### Issue: Webhook signature verification fails

**Symptoms**:
- Error: `Webhook signature verification failed`
- Webhooks logged as failed
- Status code 400

**Diagnosis**:
```bash
# Check Edge Function logs
supabase functions logs stripe-webhook | grep "signature"
```

**Solutions**:

1. **Verify webhook secret is set**:
   ```bash
   supabase secrets list
   
   # Should show STRIPE_WEBHOOK_SECRET
   ```

2. **Update webhook secret**:
   ```bash
   # Get from Stripe Dashboard → Webhooks → [Endpoint] → Signing secret
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Redeploy Edge Function**:
   ```bash
   supabase functions deploy stripe-webhook
   ```

---

## Performance Issues

### Issue: App feels slow/laggy

**Diagnosis**:
```typescript
// Measure performance
const start = Date.now();
await someOperation();
console.log('Operation took:', Date.now() - start, 'ms');

// Check render count
useEffect(() => {
  console.log('Component rendered');
});
```

**Solutions**:

1. **Optimize database queries**:
   - Use indexes
   - Select only needed columns
   - Limit results

2. **Implement caching**:
   ```typescript
   const { data, isLoading } = useQuery(
     ['subscriptions', userId],
     fetchSubscriptions,
     { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
   );
   ```

3. **Use pagination**:
   ```typescript
   const { data } = await supabase
     .from('subscriptions')
     .select('*')
     .range(0, 9) // First 10 items
     .order('created_at', { ascending: false });
   ```

4. **Add loading states**:
   ```typescript
   if (isLoading) return <SkeletonLoader />;
   if (error) return <ErrorState />;
   return <DataView data={data} />;
   ```

---

## User Experience Issues

### Issue: Paywall not appearing

**Symptoms**:
- User can add >5 subscriptions
- Free tier limit not enforced
- No upgrade prompt

**Diagnosis**:
```typescript
// Check limit service
const result = await subscriptionLimitService.checkCanAddSubscription();
console.log('Can add:', result);

// Check user tier
const { data } = await supabase
  .from('user_subscriptions')
  .select('tier_id, status')
  .eq('user_id', userId)
  .single();
console.log('User tier:', data);
```

**Solutions**:

1. **Verify limit check is called**:
   ```typescript
   // Before navigation to Add Subscription
   const canAdd = await subscriptionLimitService.checkCanAddSubscription();
   
   if (!canAdd.canAdd) {
     navigation.navigate('Paywall', {
       currentCount: canAdd.currentCount,
       limit: canAdd.limit
     });
     return;
   }
   
   navigation.navigate('AddSubscription');
   ```

2. **Check database function**:
   ```sql
   -- Test manually
   SELECT * FROM can_user_add_subscription('USER_ID');
   ```

3. **Clear cache**:
   ```typescript
   await subscriptionLimitService.refreshLimitStatus();
   ```

---

### Issue: User stuck in loading state

**Symptoms**:
- Spinner never stops
- Screen frozen
- No error message

**Diagnosis**:
```typescript
// Add timeout to operations
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 10000)
);

try {
  await Promise.race([operation(), timeoutPromise]);
} catch (error) {
  console.error('Operation failed or timed out:', error);
}
```

**Solutions**:

1. **Add timeout handling**:
   ```typescript
   const [isLoading, setIsLoading] = useState(true);
   
   useEffect(() => {
     const timeout = setTimeout(() => {
       if (isLoading) {
         setIsLoading(false);
         Alert.alert('Error', 'Request timed out. Please try again.');
       }
     }, 10000);
     
     return () => clearTimeout(timeout);
   }, [isLoading]);
   ```

2. **Implement error boundaries**:
   ```typescript
   <ErrorBoundary fallback={<ErrorScreen />}>
     <YourComponent />
   </ErrorBoundary>
   ```

3. **Add retry mechanism**:
   ```typescript
   async function withRetry(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * (i + 1)));
       }
     }
   }
   ```

---

## Getting Additional Help

### Log Collection

When reporting issues, collect these logs:

```bash
# Edge Function logs
supabase functions logs stripe-webhook --since 1h > webhook_logs.txt

# Database logs
supabase db logs --level error > db_logs.txt

# App logs
# From React Native Debugger or Expo Dev Tools
```

### Issue Reporting Template

```markdown
## Issue Description
[Brief description of the problem]

## Environment
- OS: [iOS/Android/Both]
- App Version: [1.0.0]
- Supabase Project: [dev/staging/prod]
- Stripe Mode: [test/live]

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Logs
[Paste relevant logs]

## Screenshots
[If applicable]
```

### Contact Support

- **Supabase Support**: https://supabase.com/support
- **Stripe Support**: https://support.stripe.com
- **Community Discord**: [Your Discord link]
- **GitHub Issues**: [Your GitHub repo]

---

**End of Troubleshooting Guide**