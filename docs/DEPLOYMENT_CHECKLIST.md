# Deployment Checklist - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Pre-Deployment Preparation](#pre-deployment-preparation)
2. [Database Deployment](#database-deployment)
3. [Stripe Configuration](#stripe-configuration)
4. [Edge Functions Deployment](#edge-functions-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Rollback Plan](#rollback-plan)

---

## Pre-Deployment Preparation

### Environment Verification

- [ ] All development testing completed
- [ ] Integration tests passing
- [ ] Edge cases tested and documented
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Code review approved
- [ ] Documentation updated

### Backup Current State

- [ ] **Database Backup**
  ```bash
  # Backup production database
  supabase db dump --db-url "postgresql://..." > backup_$(date +%Y%m%d).sql
  ```

- [ ] **Configuration Backup**
  - Export current environment variables
  - Save Stripe webhook configuration
  - Document current prices and products

- [ ] **Code Backup**
  ```bash
  # Tag current production version
  git tag -a v1.0.0-pre-deployment -m "Pre-deployment backup"
  git push origin v1.0.0-pre-deployment
  ```

### Team Communication

- [ ] Notify team of deployment window
- [ ] Schedule deployment during low-traffic period
- [ ] Ensure on-call engineer is available
- [ ] Prepare rollback team if needed

---

## Database Deployment

### Staging Environment

- [ ] **Run Migrations in Staging**
  ```bash
  # Connect to staging
  supabase link --project-ref staging-project-ref
  
  # Run migrations
  psql -h staging-db.supabase.co -U postgres < database/paywall_migration.sql
  ```

- [ ] **Verify Tables Created**
  ```sql
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
  
  -- Should return 6 rows
  ```

- [ ] **Verify Functions Exist**
  ```sql
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
    AND routine_type = 'FUNCTION'
    AND routine_name IN (
      'get_user_subscription_limit',
      'can_user_add_subscription',
      'initialize_user_subscription',
      'process_stripe_webhook',
      'track_usage_event',
      'calculate_refund_eligibility'
    );
  
  -- Should return 6 rows
  ```

- [ ] **Test RLS Policies**
  ```sql
  -- Test as authenticated user
  SET request.jwt.claims.sub = 'test-user-id';
  SELECT * FROM user_subscriptions WHERE user_id = 'test-user-id';
  
  -- Should succeed
  
  -- Test accessing other user's data
  SELECT * FROM user_subscriptions WHERE user_id = 'other-user-id';
  
  -- Should return 0 rows (blocked by RLS)
  ```

- [ ] **Verify Triggers Active**
  ```sql
  SELECT trigger_name, event_manipulation, event_object_table 
  FROM information_schema.triggers 
  WHERE trigger_schema = 'public';
  ```

- [ ] **Test in Staging**
  - Create test user
  - Upgrade to premium
  - Process test payment
  - Verify webhook processing
  - Test cancellation flow

### Production Environment

- [ ] **Create Database Backup**
  ```bash
  # Full backup before changes
  supabase db dump --db-url "$PROD_DB_URL" > prod_backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Run Migration Script**
  ```bash
  # Connect to production
  supabase link --project-ref prod-project-ref
  
  # Run migration
  psql -h prod-db.supabase.co -U postgres < database/paywall_migration.sql
  ```

- [ ] **Verify Migration Success**
  ```sql
  -- Check all tables exist
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name LIKE '%subscription%' 
    OR table_name LIKE '%payment%'
    OR table_name LIKE '%refund%'
    OR table_name LIKE '%webhook%';
  
  -- Should return 6
  ```

- [ ] **Insert Default Tier Data**
  ```sql
  -- Verify tiers exist
  SELECT tier_id, name, monthly_price, annual_price 
  FROM subscription_tiers;
  
  -- Expected:
  -- free | Free | 0.00 | 0.00
  -- premium | Premium | 4.99 | 39.00
  ```

- [ ] **Migrate Existing Users**
  ```sql
  -- Ensure all existing users have a subscription record
  INSERT INTO user_subscriptions (user_id, tier_id, status)
  SELECT 
    id,
    'free',
    'active'
  FROM auth.users
  WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
  ON CONFLICT (user_id) DO NOTHING;
  ```

---

## Stripe Configuration

### Switch to Live Mode

- [ ] **Enable Live Mode**
  - Toggle from Test Mode to Live Mode in Stripe Dashboard
  - Verify live mode is active (stripe.com/test/dashboard will redirect)

### Create Products (Live Mode)

- [ ] **Create Premium Product**
  ```
  Navigate to: Products → Add Product
  
  Name: Premium Subscription
  Description: Unlimited subscription tracking with advanced features
  ```

- [ ] **Create Monthly Price**
  ```
  Price: $4.99
  Billing Period: Monthly
  Currency: USD
  ```
  
  - [ ] Copy Price ID: `price_...` 
  - [ ] Save to production environment variables

- [ ] **Create Annual Price**
  ```
  Price: $39.00
  Billing Period: Yearly
  Currency: USD
  ```
  
  - [ ] Copy Price ID: `price_...`
  - [ ] Save to production environment variables

### Configure Webhooks (Live Mode)

- [ ] **Create Webhook Endpoint**
  ```
  Navigate to: Developers → Webhooks → Add endpoint
  
  Endpoint URL: https://your-prod-project.supabase.co/functions/v1/stripe-webhook
  
  Events to send:
  ✓ customer.created
  ✓ customer.updated
  ✓ customer.subscription.created
  ✓ customer.subscription.updated
  ✓ customer.subscription.deleted
  ✓ invoice.payment_succeeded
  ✓ invoice.payment_failed
  ✓ charge.refunded
  ```

- [ ] **Copy Webhook Secret**
  - Copy signing secret (starts with `whsec_`)
  - Save to Edge Function secrets

### Configure Billing Portal

- [ ] **Enable Customer Portal**
  ```
  Navigate to: Settings → Billing → Customer Portal
  
  Enable portal
  
  Configure:
  ✓ Allow customers to update payment methods
  ✓ Allow customers to view billing history
  ✓ Allow customers to cancel subscriptions
  
  Cancellation behavior: Cancel at end of billing period
  ```

### Enable Radar (Fraud Prevention)

- [ ] **Activate Radar**
  ```
  Navigate to: Radar → Overview
  
  Enable Radar for Fraud Detection
  Review and enable recommended rules
  ```

### API Keys

- [ ] **Get Live API Keys**
  ```
  Navigate to: Developers → API Keys
  
  Publishable key: pk_live_...
  Secret key: sk_live_...
  ```

- [ ] **Update Environment Variables**
  ```bash
  # Add to production .env
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```

- [ ] **Update Edge Function Secrets**
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...
  ```

---

## Edge Functions Deployment

### Prepare Functions

- [ ] **Update Environment**
  ```typescript
  // Verify all environment variables are production-ready
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  requiredEnvVars.forEach(key => {
    if (!Deno.env.get(key)) {
      throw new Error(`Missing env var: ${key}`);
    }
  });
  ```

- [ ] **Test Functions Locally**
  ```bash
  # Test each function
  supabase functions serve stripe-webhook
  supabase functions serve create-subscription
  supabase functions serve cancel-subscription
  supabase functions serve request-refund
  supabase functions serve get-billing-portal
  ```

### Deploy to Production

- [ ] **Set Production Secrets**
  ```bash
  # Link to production project
  supabase link --project-ref prod-project-ref
  
  # Set all secrets
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...
  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
  
  # Verify secrets
  supabase secrets list
  ```

- [ ] **Deploy Functions**
  ```bash
  # Deploy all functions
  supabase functions deploy stripe-webhook
  supabase functions deploy create-subscription
  supabase functions deploy cancel-subscription
  supabase functions deploy request-refund
  supabase functions deploy get-billing-portal
  
  # Verify deployment
  supabase functions list
  ```

- [ ] **Test Function Endpoints**
  ```bash
  # Test create-subscription
  curl -i --location --request POST \
    'https://your-prod-project.supabase.co/functions/v1/create-subscription' \
    --header 'Authorization: Bearer YOUR_ANON_KEY' \
    --header 'Content-Type: application/json' \
    --data '{"priceId": "price_test123"}'
  
  # Should return 401 or appropriate auth error (not 404)
  ```

- [ ] **Monitor Function Logs**
  ```bash
  # Watch for errors
  supabase functions logs stripe-webhook --tail
  ```

---

## Frontend Deployment

### Update Configuration

- [ ] **Update Stripe Config**
  ```typescript
  // config/stripe.ts
  export const STRIPE_CONFIG = {
    publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!, // pk_live_...
    prices: {
      monthly: 'price_LIVE_MONTHLY_ID',  // Update with live price IDs
      annual: 'price_LIVE_ANNUAL_ID',     // Update with live price IDs
    },
  };
  ```

- [ ] **Update Supabase Config**
  ```typescript
  // Verify production URLs
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; // Production URL
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; // Production key
  ```

- [ ] **Update Environment Files**
  ```bash
  # .env.production
  EXPO_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```

### Build for Production

#### iOS

- [ ] **Prepare iOS Build**
  ```bash
  # Update version number
  # In app.json:
  {
    "expo": {
      "version": "1.1.0",
      "ios": {
        "buildNumber": "2"
      }
    }
  }
  ```

- [ ] **Build for App Store**
  ```bash
  eas build --platform ios --profile production
  ```

- [ ] **Test on TestFlight**
  - Upload to TestFlight
  - Test complete payment flow with real card
  - Verify webhooks processing
  - Test subscription management

- [ ] **Submit to App Store**
  ```bash
  eas submit --platform ios
  ```

#### Android

- [ ] **Prepare Android Build**
  ```bash
  # Update version
  # In app.json:
  {
    "expo": {
      "version": "1.1.0",
      "android": {
        "versionCode": 2
      }
    }
  }
  ```

- [ ] **Build for Play Store**
  ```bash
  eas build --platform android --profile production
  ```

- [ ] **Test on Internal Track**
  - Upload to Play Console internal testing
  - Test payment flow
  - Verify functionality

- [ ] **Submit to Play Store**
  ```bash
  eas submit --platform android
  ```

---

## Post-Deployment Verification

### Immediate Checks (Within 1 Hour)

- [ ] **Test User Signup**
  - Create new account with real email
  - Verify free tier assigned
  - Check database record created

- [ ] **Test Limit Enforcement**
  - Add 5 subscriptions
  - Verify can add 5th
  - Verify paywall appears on 6th attempt

- [ ] **Test Payment Flow**
  - Select premium plan
  - Enter real credit card (will be charged)
  - Complete payment
  - Verify upgrade to premium
  - Check database updated
  - Verify webhook received and processed

- [ ] **Test Webhook Processing**
  ```sql
  -- Check recent webhooks
  SELECT 
    event_type,
    processing_status,
    created_at
  FROM stripe_webhooks
  ORDER BY created_at DESC
  LIMIT 10;
  
  -- All should be 'processed', none 'failed'
  ```

- [ ] **Test Subscription Management**
  - View billing history
  - Update payment method
  - Access billing portal
  - Verify all working

- [ ] **Test Cancellation**
  - Cancel subscription
  - Verify cancels at end of period
  - Check database status

- [ ] **Request Test Refund**
  - Submit refund request (within 7 days)
  - Verify refund processed
  - Check downgrade occurs

### Monitoring Setup (Within 24 Hours)

- [ ] **Configure Error Tracking**
  ```typescript
  // Verify Sentry is capturing errors
  Sentry.captureMessage('Production deployment successful');
  ```

- [ ] **Set Up Alerts**
  - Payment failure rate > 10%
  - Webhook failure rate > 5%
  - API error rate > 2%
  - Database slow queries

- [ ] **Create Monitoring Dashboard**
  - Revenue metrics
  - Conversion funnel
  - Active users by tier
  - Payment success/failure rates

### Performance Verification

- [ ] **API Response Times**
  ```bash
  # Test limit check performance
  time curl -H "Authorization: Bearer $TOKEN" \
    https://your-api.supabase.co/rest/v1/rpc/can_user_add_subscription
  
  # Should be < 200ms
  ```

- [ ] **Database Query Performance**
  ```sql
  -- Check slow queries
  SELECT 
    query,
    mean_exec_time,
    calls
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000 -- > 1 second
  ORDER BY mean_exec_time DESC
  LIMIT 10;
  ```

- [ ] **Edge Function Performance**
  ```bash
  # Check function cold start times
  supabase functions logs stripe-webhook | grep "cold start"
  ```

### Data Integrity

- [ ] **Verify User Migration**
  ```sql
  -- All users should have subscription record
  SELECT COUNT(*) FROM auth.users
  WHERE id NOT IN (SELECT user_id FROM user_subscriptions);
  
  -- Should return 0
  ```

- [ ] **Check Orphaned Records**
  ```sql
  -- No subscriptions without users
  SELECT COUNT(*) FROM user_subscriptions
  WHERE user_id NOT IN (SELECT id FROM auth.users);
  
  -- Should return 0
  ```

- [ ] **Verify RLS Policies**
  ```sql
  -- Test that users can't see others' data
  SET request.jwt.claims.sub = 'user-1-id';
  SELECT COUNT(*) FROM user_subscriptions 
  WHERE user_id = 'user-2-id';
  
  -- Should return 0
  ```

---

## Monitoring and Alerts

### Daily Monitoring (First Week)

- [ ] Check Stripe Dashboard for payments
- [ ] Review webhook delivery success rate
- [ ] Check error logs in Sentry
- [ ] Monitor user signups and upgrades
- [ ] Review support tickets

### Weekly Monitoring

- [ ] Calculate conversion rates
- [ ] Review churn rate
- [ ] Analyze refund requests
- [ ] Check database performance
- [ ] Review slow queries

### Metrics to Track

```typescript
interface ProductionMetrics {
  // Business
  dailySignups: number;
  dailyUpgrades: number;
  dailyRevenue: number;
  conversionRate: number;
  churnRate: number;
  
  // Technical
  paymentSuccessRate: number;
  webhookSuccessRate: number;
  apiErrorRate: number;
  avgResponseTime: number;
  
  // User Experience
  averageTimeToUpgrade: number;
  paywallConversionRate: number;
  supportTickets: number;
}
```

---

## Rollback Plan

### When to Rollback

Rollback immediately if:
- Payment success rate < 50%
- Critical errors affecting all users
- Data corruption detected
- Security vulnerability discovered

### Rollback Procedure

1. **Pause New Signups**
   ```typescript
   // Add feature flag
   const SIGNUPS_ENABLED = false;
   
   if (!SIGNUPS_ENABLED) {
     throw new Error('Signups temporarily disabled');
   }
   ```

2. **Revert Database Changes**
   ```bash
   # Restore from backup
   psql -h prod-db.supabase.co -U postgres < prod_backup_TIMESTAMP.sql
   ```

3. **Revert Edge Functions**
   ```bash
   # Deploy previous version
   git checkout v1.0.0-pre-deployment
   supabase functions deploy
   ```

4. **Revert Stripe Configuration**
   - Switch back to test mode if needed
   - Disable live webhook endpoint
   - Re-enable test webhook

5. **Revert App Build**
   ```bash
   # Submit previous build
   eas submit --platform ios --id PREVIOUS_BUILD_ID
   eas submit --platform android --id PREVIOUS_BUILD_ID
   ```

6. **Notify Users**
   - Send email to affected users
   - Post status update
   - Provide timeline for fix

---

## Post-Deployment Tasks

### Immediate (Day 1)

- [ ] Monitor all systems for first 24 hours
- [ ] Respond to any user issues immediately
- [ ] Document any unexpected behavior
- [ ] Update team on deployment status

### Short-term (Week 1)

- [ ] Analyze conversion metrics
- [ ] Review error rates
- [ ] Optimize slow queries if found
- [ ] Address any user feedback
- [ ] Update documentation based on learnings

### Long-term (Month 1)

- [ ] Conduct post-deployment review
- [ ] Document lessons learned
- [ ] Plan performance optimizations
- [ ] Review and update monitoring
- [ ] Plan next features

---

## Sign-Off

### Deployment Team

- [ ] **Technical Lead**: _________________ Date: _______
- [ ] **DevOps Engineer**: _________________ Date: _______
- [ ] **QA Lead**: _________________ Date: _______
- [ ] **Product Manager**: _________________ Date: _______

### Go/No-Go Decision

**Deployment Status**: ⬜ GO  ⬜ NO-GO

**Decision Made By**: _________________

**Date/Time**: _________________

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

**End of Deployment Checklist**