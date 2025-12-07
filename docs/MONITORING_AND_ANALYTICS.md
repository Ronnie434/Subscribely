# Apple IAP Monitoring & Analytics Plan - Phase 7
## Real-Time Monitoring, Alerting, and Performance Tracking

**Document Version:** 1.0.0  
**Created:** 2025-12-06  
**Status:** Production Ready  
**Target Audience:** Development Team, Operations  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Real-Time Monitoring](#real-time-monitoring)
3. [Alerting Strategy](#alerting-strategy)
4. [Analytics Dashboard](#analytics-dashboard)
5. [Tools & Integrations](#tools--integrations)
6. [Weekly Review Process](#weekly-review-process)
7. [Appendix](#appendix)

---

## Executive Summary

This document defines the monitoring and analytics strategy for the Apple IAP implementation. It provides:

- **Real-time monitoring** of critical IAP metrics
- **Alerting thresholds** for immediate incident response
- **Analytics dashboards** for business insights
- **Tool recommendations** for solo/small teams
- **Review processes** for continuous improvement

### Monitoring Philosophy

**For Solo/Small Teams:**
- Focus on **essential metrics** only
- Use **existing tools** (Supabase, App Store Connect)
- Set up **automated alerts** for critical issues
- Review **weekly** for trends and optimizations

### Key Principles

1. **Monitor what matters**: Focus on user-impacting metrics
2. **Alert on actionable items**: Only alert if action is needed
3. **Automate where possible**: Reduce manual checking
4. **Review regularly**: Learn and improve from data

---

## Real-Time Monitoring

### 1. IAP Transaction Metrics

Monitor these metrics to ensure purchases are working correctly.

#### 1.1 Purchase Success Rate

**What:** Percentage of purchase attempts that complete successfully

**Target:** >95%  
**Warning:** <95%  
**Critical:** <85%

**SQL Query:**
```sql
-- Purchase success rate (last 24 hours)
SELECT 
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**Example Output:**
```
total_attempts | successful | failed | success_rate
             10|          9 |      1|        90.00
```

**How to Monitor:**
- Run query every 1-2 hours during first week
- Set up daily automated report after stabilization

#### 1.2 Receipt Validation Success Rate

**What:** Percentage of receipts successfully validated by server

**Target:** >98%  
**Warning:** <95%  
**Critical:** <90%

**SQL Query:**
```sql
-- Receipt validation success rate (last 24 hours)
SELECT 
  COUNT(*) as total_validations,
  COUNT(*) FILTER (WHERE processing_status = 'processed') as processed,
  COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processing_status = 'processed') / NULLIF(COUNT(*), 0), 2) as validation_rate
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND notification_type = 'PURCHASE';
```

**Red Flags:**
- Sudden drop in validation rate
- Consistent failures for specific product IDs
- Timeouts or network errors

#### 1.3 Purchase Volume

**What:** Number of purchases per day/hour

**SQL Query:**
```sql
-- Purchases by hour (last 24 hours)
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as purchases,
  COUNT(*) FILTER (WHERE product_id = 'com.renvo.basic.monthly') as monthly,
  COUNT(*) FILTER (WHERE product_id = 'com.renvo.basic.yearly') as yearly
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND status = 'succeeded'
GROUP BY hour
ORDER BY hour DESC;
```

**What to Look For:**
- Sudden spikes (could indicate fraud or test purchases)
- Unexpected drops (could indicate broken purchase flow)
- Trends over time (growth, seasonality)

### 2. Webhook Processing Metrics

Monitor webhook events from Apple to ensure subscription updates are processed.

#### 2.1 Webhook Delivery Success Rate

**What:** Percentage of webhooks successfully processed

**Target:** >99%  
**Warning:** <95%  
**Critical:** <90%

**SQL Query:**
```sql
-- Webhook processing by type (last 24 hours)
SELECT 
  notification_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE processing_status = 'processed') as processed,
  COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE processing_status = 'processed') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM apple_webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_type
ORDER BY total DESC;
```

**Critical Event Types:**
- `SUBSCRIBED` - New subscription (must process)
- `DID_RENEW` - Renewal (must process for continued access)
- `EXPIRED` - Expiration (must downgrade user)
- `REFUND` - Refund (must revoke access)

#### 2.2 Webhook Processing Latency

**What:** Time taken to process webhook events

**Target:** <3 seconds (average)  
**Warning:** >5 seconds  
**Critical:** >10 seconds

**Supabase Function Logs Check:**
```bash
# View recent webhook processing times
supabase functions logs apple-webhook --limit 50 | grep "Processing time:"
```

**What to Look For:**
- Increasing latency trend
- Timeouts or errors
- Database query slowness

### 3. Subscription State Metrics

Track the health of user subscriptions.

#### 3.1 Active Subscriptions

**What:** Number of users with active Apple IAP subscriptions

**SQL Query:**
```sql
-- Active Apple IAP subscriptions
SELECT 
  subscription_tier,
  COUNT(*) as active_count,
  COUNT(*) FILTER (WHERE payment_provider = 'apple') as apple_iap_count
FROM profiles
WHERE subscription_status = 'active'
  AND subscription_tier = 'premium'
GROUP BY subscription_tier;
```

**Track Over Time:**
- New subscriptions per day
- Net subscriber growth
- Churn (cancellations)

#### 3.2 Subscription Status Distribution

**What:** Breakdown of subscription statuses

**SQL Query:**
```sql
-- Subscription status distribution
SELECT 
  subscription_status,
  COUNT(*) as user_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM profiles
WHERE subscription_tier = 'premium'
  AND payment_provider = 'apple'
GROUP BY subscription_status
ORDER BY user_count DESC;
```

**Expected Distribution:**
- `active`: >90%
- `canceled`: <5% (users who canceled but still have access)
- `past_due`: <3% (payment failures)
- `expired`: <2% (recently expired)

### 4. Business Metrics

Track revenue and growth metrics.

#### 4.1 Monthly Recurring Revenue (MRR)

**What:** Predictable monthly revenue from active subscriptions

**SQL Query:**
```sql
-- Calculate MRR from Apple IAP
SELECT 
  COUNT(*) as active_subs,
  SUM(
    CASE 
      WHEN apple_product_id LIKE '%monthly' THEN 4.99
      WHEN apple_product_id LIKE '%yearly' THEN 39.99 / 12.0
      ELSE 0
    END
  ) as mrr,
  -- Adjust for Apple's 30% commission (first year)
  SUM(
    CASE 
      WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
      WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12.0) * 0.70
      ELSE 0
    END
  ) as net_mrr
FROM profiles
WHERE subscription_status = 'active'
  AND payment_provider = 'apple'
  AND apple_original_transaction_id IS NOT NULL;
```

**What to Track:**
- MRR growth week-over-week
- Net MRR (after Apple commission)
- MRR by product (monthly vs yearly)

#### 4.2 Conversion Rate

**What:** Percentage of users who upgrade from free to premium

**SQL Query:**
```sql
-- Conversion rate (last 30 days)
WITH users AS (
  SELECT COUNT(DISTINCT id) as total_users
  FROM profiles
  WHERE created_at > NOW() - INTERVAL '30 days'
),
conversions AS (
  SELECT COUNT(DISTINCT user_id) as converted_users
  FROM apple_transactions
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND status = 'succeeded'
)
SELECT 
  users.total_users,
  conversions.converted_users,
  ROUND(100.0 * conversions.converted_users / NULLIF(users.total_users, 0), 2) as conversion_rate
FROM users, conversions;
```

**Benchmarks:**
- Good: >3%
- Average: 1-2%
- Needs improvement: <1%

#### 4.3 Average Revenue Per User (ARPU)

**What:** Average monthly revenue per active user

**SQL Query:**
```sql
-- ARPU for Apple IAP users
SELECT 
  COUNT(*) as active_users,
  SUM(
    CASE 
      WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
      WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12.0) * 0.70
      ELSE 0
    END
  ) as total_revenue,
  ROUND(
    SUM(
      CASE 
        WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
        WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12.0) * 0.70
        ELSE 0
      END
    ) / NULLIF(COUNT(*), 0), 
    2
  ) as arpu
FROM profiles
WHERE subscription_status = 'active'
  AND payment_provider = 'apple';
```

**Target ARPU:** $3.50+ (accounting for Apple commission and yearly average)

### 5. Performance Metrics

Monitor app and service performance.

#### 5.1 Supabase Edge Function Performance

**Check in Supabase Dashboard:**
1. Go to **Edge Functions** → **validate-apple-receipt**
2. View **Invocations** chart
3. Check **Errors** and **Duration**

**Targets:**
- Average duration: <2 seconds
- Error rate: <1%
- Timeout rate: 0%

#### 5.2 Database Query Performance

**SQL Query:**
```sql
-- Slow queries (if pg_stat_statements enabled)
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%apple%'
  AND mean_exec_time > 1000  -- queries > 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**What to Optimize:**
- Queries taking >1 second on average
- Frequently called slow queries
- Queries without proper indexes

---

## Alerting Strategy

### Alert Levels

**3 levels of urgency:**

| Level | Response Time | Notification Method |
|-------|---------------|---------------------|
| **Critical** | Immediate (24/7) | Email + SMS + Slack |
| **Warning** | Within 1-2 hours | Email + Slack |
| **Info** | Daily review | Email digest |

### Critical Alerts (Immediate Action)

**Trigger these alerts for issues requiring immediate attention:**

#### Alert 1: Purchase Success Rate Drop

**Trigger:** Purchase success rate <85% for 15 minutes  
**Impact:** Users cannot subscribe  
**Action:** Investigate and fix immediately

**SQL Alert Query:**
```sql
-- Run every 15 minutes
WITH recent_purchases AS (
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful
  FROM apple_transactions
  WHERE created_at > NOW() - INTERVAL '15 minutes'
)
SELECT 
  CASE 
    WHEN total > 0 AND (successful::float / total) < 0.85 
    THEN 'CRITICAL'
    ELSE 'OK'
  END as alert_level,
  total,
  successful,
  ROUND(100.0 * successful / NULLIF(total, 0), 2) as success_rate
FROM recent_purchases;
```

**Notification:**
```
🚨 CRITICAL ALERT: IAP Purchase Success Rate

Success Rate: 72% (below 85% threshold)
Period: Last 15 minutes
Successful: 5 out of 7 purchases

Action: Check Supabase function logs immediately
Link: https://[project].supabase.co/project/_/functions/validate-apple-receipt
```

#### Alert 2: Receipt Validation Failures

**Trigger:** >10% validation failures in 15 minutes  
**Impact:** Purchases not being processed  
**Action:** Check Supabase function logs and Apple API status

#### Alert 3: Webhook Delivery Failures

**Trigger:** >20% webhook failures in 30 minutes  
**Impact:** Subscription updates not processing  
**Action:** Check webhook endpoint and Supabase function

#### Alert 4: Database Errors

**Trigger:** Any database error in IAP-related functions  
**Impact:** Data corruption risk  
**Action:** Check database logs and connection

#### Alert 5: App Store Server API Down

**Trigger:** Multiple consecutive API failures  
**Impact:** Cannot validate receipts  
**Action:** Check Apple status page, wait for resolution

### Warning Alerts (Review Within 1-2 Hours)

**Trigger these for issues that need attention but aren't emergencies:**

#### Alert 6: Purchase Success Rate Degradation

**Trigger:** Success rate <95% (but >85%)  
**Impact:** Reduced conversion  
**Action:** Investigate cause, prepare fix

#### Alert 7: Elevated Error Rate

**Trigger:** Error rate >5% for any IAP function  
**Impact:** Poor user experience  
**Action:** Review logs, identify patterns

#### Alert 8: Slow Processing

**Trigger:** Avg webhook processing time >5 seconds  
**Impact:** Delayed subscription activation  
**Action:** Optimize queries or function code

#### Alert 9: Unusual Purchase Volume

**Trigger:** Purchase volume >2x or <0.5x normal  
**Impact:** Could indicate fraud or broken flow  
**Action:** Investigate pattern, check for abuse

### Info Alerts (Daily Digest)

**Trigger these for informational awareness:**

#### Alert 10: Daily Metrics Summary

**Schedule:** Every day at 9 AM

**Email Template:**
```
Daily Apple IAP Metrics Summary
Date: [YYYY-MM-DD]

📊 Purchase Metrics:
- Purchases: 12 (↑ 20% vs yesterday)
- Success Rate: 97.5%
- Validation Rate: 99.2%

💰 Revenue:
- New MRR: $59.88
- Total MRR: $487.23
- ARPU: $3.62

👥 Subscriptions:
- New subscribers: 12
- Active total: 147
- Churn: 2

⚠️ Issues:
- No critical issues
- 1 warning (webhook latency at 5.2s avg)

Full dashboard: [link]
```

#### Alert 11: Weekly Performance Report

**Schedule:** Every Monday at 9 AM

**Content:**
- Week-over-week growth
- Conversion rate trends
- Top issues encountered
- Action items for the week

### Setting Up Alerts

**Option 1: Simple Email Alerts (For Solo Devs)**

Use a scheduled job to run queries and send email:

```typescript
// Simple alert check (run every 15 minutes)
async function checkCriticalMetrics() {
  const { data } = await supabase.rpc('check_iap_health');
  
  if (data.purchase_success_rate < 0.85) {
    await sendEmail({
      to: 'you@example.com',
      subject: '🚨 CRITICAL: IAP Purchase Rate Low',
      body: `Success rate: ${data.purchase_success_rate * 100}%`
    });
  }
}
```

**Option 2: Supabase Database Webhooks**

Set up webhooks to trigger on specific database events.

**Option 3: Third-Party Monitoring (Optional)**

- **Sentry**: Error tracking and alerting
- **UptimeRobot**: Endpoint monitoring
- **Better Uptime**: Status page and alerts

---

## Analytics Dashboard

### Dashboard Structure

For solo/small teams, create a simple dashboard with 4 sections:

1. **Overview** - Key metrics at a glance
2. **Purchase Funnel** - Conversion tracking
3. **Revenue** - Financial metrics
4. **Operations** - System health

### 1. Overview Dashboard

**Metrics to Display:**

```
┌─────────────────────────────────────────┐
│         Apple IAP Overview              │
├─────────────────────────────────────────┤
│ Today's Metrics                         │
│                                         │
│ 🛒 Purchases: 12  (↑ 20%)              │
│ ✅ Success Rate: 97.5%                  │
│ 💰 MRR: $487.23  (↑ $59.88)            │
│ 👥 Active Subs: 147  (↑ 10)            │
└─────────────────────────────────────────┘
```

**SQL Query:**
```sql
-- Overview metrics (today)
SELECT 
  -- Purchases
  COUNT(*) FILTER (
    WHERE created_at > CURRENT_DATE 
    AND status = 'succeeded'
  ) as purchases_today,
  
  -- Success rate
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') 
    / NULLIF(COUNT(*), 0), 
    2
  ) as success_rate_today,
  
  -- Active subscriptions
  (SELECT COUNT(*) FROM profiles 
   WHERE subscription_status = 'active' 
   AND payment_provider = 'apple') as active_subs
   
FROM apple_transactions
WHERE created_at > CURRENT_DATE;
```

### 2. Purchase Funnel Dashboard

Track user journey from free to premium:

```
Free Users (1000)
     ↓ 5% hit limit
Limit Reached (50)
     ↓ 60% view paywall
Paywall Viewed (30)
     ↓ 40% select plan
Plan Selected (12)
     ↓ 75% complete purchase
Purchase Complete (9)
```

**Metrics:**
- **Free to Limit**: % of free users who hit 5-item limit
- **Limit to Paywall**: % who view upgrade modal
- **Paywall to Selection**: % who select a plan
- **Selection to Purchase**: % who complete payment
- **Overall Conversion**: Free users → Premium

**SQL Query:**
```sql
-- Purchase funnel (last 30 days)
WITH funnel AS (
  SELECT 
    COUNT(DISTINCT user_id) as total_free_users
  FROM profiles
  WHERE subscription_tier = 'free'
    AND created_at > NOW() - INTERVAL '30 days'
),
conversions AS (
  SELECT COUNT(DISTINCT user_id) as converted
  FROM apple_transactions
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND status = 'succeeded'
)
SELECT 
  funnel.total_free_users,
  conversions.converted,
  ROUND(100.0 * conversions.converted / NULLIF(funnel.total_free_users, 0), 2) as conversion_rate
FROM funnel, conversions;
```

**Optimization Targets:**
- Increase paywall view rate (add more CTAs)
- Improve plan selection rate (clearer pricing)
- Boost purchase completion (reduce friction)

### 3. Revenue Dashboard

**Metrics to Display:**

```
Revenue Metrics
───────────────────────────────────────
MRR:          $487.23  (↑ 13.1%)
ARR:          $5,846.76
Net MRR:      $341.06  (after commission)

Revenue by Plan:
  Monthly:    $312.34  (64%)
  Yearly:     $174.89  (36%)

Cohort Analysis:
  Month 0:    $120.00
  Month 1:    $98.50  (82% retained)
  Month 2:    $89.20  (91% retained)
```

**Key Metrics:**
- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue (MRR × 12)
- **Net MRR**: After Apple's 30% commission
- **Revenue Mix**: Monthly vs Yearly split
- **Cohort Retention**: Revenue retention by cohort

**SQL Query:**
```sql
-- Revenue breakdown
SELECT 
  -- Monthly revenue
  SUM(CASE 
    WHEN apple_product_id LIKE '%monthly' 
    THEN 4.99 
    ELSE 0 
  END) as monthly_revenue,
  
  -- Yearly revenue (monthly equivalent)
  SUM(CASE 
    WHEN apple_product_id LIKE '%yearly' 
    THEN 39.99 / 12.0 
    ELSE 0 
  END) as yearly_revenue,
  
  -- Total MRR
  SUM(CASE 
    WHEN apple_product_id LIKE '%monthly' THEN 4.99
    WHEN apple_product_id LIKE '%yearly' THEN 39.99 / 12.0
    ELSE 0 
  END) as total_mrr,
  
  -- Net MRR (after 30% Apple commission)
  SUM(CASE 
    WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
    WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12.0) * 0.70
    ELSE 0 
  END) as net_mrr
  
FROM profiles
WHERE subscription_status = 'active'
  AND payment_provider = 'apple';
```

### 4. Operations Dashboard

**System Health Metrics:**

```
System Health
───────────────────────────────────────
✅ Receipt Validation:    99.2%
✅ Webhook Processing:    99.8%
✅ Database Performance:  OK (23ms avg)
✅ Function Latency:      1.8s avg

Recent Errors (24h):      2
  - Receipt timeout:      1
  - Network error:        1

Uptime:                   99.95%
```

**Supabase Function Monitoring:**

Check in Supabase Dashboard:
1. **Functions** → **validate-apple-receipt**
   - Invocations: Should match purchase count
   - Errors: Should be <1%
   - Duration: Should be <3s average

2. **Functions** → **apple-webhook**
   - Invocations: Should match webhook events
   - Errors: Should be <1%
   - Duration: Should be <3s average

---

## Tools & Integrations

### Primary Tools (Essential)

#### 1. Supabase Dashboard

**What:** Built-in monitoring for database and functions

**Access:** https://app.supabase.com/project/[your-project]

**What to Monitor:**
- **Database** → **Performance**
  - Active connections
  - Query performance
  - Cache hit ratio
  
- **Edge Functions** → **Logs**
  - Function invocations
  - Errors and warnings
  - Execution duration

- **Database** → **Tables**
  - `apple_transactions` row count
  - `profiles` subscription distribution
  - `apple_webhook_events` processing status

**Frequency:** Daily check (5 minutes)

#### 2. App Store Connect Analytics

**What:** Apple's built-in analytics for IAP

**Access:** https://appstoreconnect.apple.com

**Navigate to:** App → Analytics → In-App Purchases

**Key Metrics:**
- **Proceeds**: Revenue (after Apple commission)
- **Paying Users**: Unique subscribers
- **Subscription Events**: New, renewals, cancellations
- **Conversion Rate**: Free to premium

**Frequency:** Weekly review (15 minutes)

#### 3. PostgreSQL Monitoring

**Direct Database Queries:**

```bash
# Connect to database
psql $DATABASE_URL

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC LIMIT 10;

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Optional Tools (Recommended)

#### 4. Error Tracking - Sentry (Optional)

**What:** Real-time error tracking and alerting

**Cost:** Free tier (5K events/month) or $26/month

**Setup:**
```typescript
// Install
npm install @sentry/react-native

// Initialize
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2,
});

// Track IAP errors
try {
  await appleIAPService.purchaseSubscription(productId);
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'apple-iap', action: 'purchase' }
  });
}
```

**Benefits:**
- Automatic error grouping
- Stack traces with source maps
- Email alerts for new errors
- Release tracking

#### 5. Uptime Monitoring - UptimeRobot (Optional)

**What:** Monitor API endpoint availability

**Cost:** Free (50 monitors) or $7/month

**Setup:**
1. Add monitor for receipt validation endpoint
2. Add monitor for webhook endpoint
3. Set alert email

**Monitors:**
- `https://[project].supabase.co/functions/v1/validate-apple-receipt` (every 5 min)
- `https://[project].supabase.co/functions/v1/apple-webhook` (every 5 min)

#### 6. Dashboard Tool - Metabase (Optional)

**What:** Open-source BI tool for custom dashboards

**Cost:** Free (self-hosted) or $85/month (cloud)

**Setup:**
1. Connect to Supabase PostgreSQL
2. Create dashboards with SQL queries
3. Schedule email reports

**Benefits:**
- Visual dashboards
- Scheduled reports
- Team access
- Custom queries

### Minimal Setup for Solo Devs

**If you want the simplest setup:**

1. **Supabase Dashboard** (included) - Check daily
2. **App Store Connect** (included) - Check weekly
3. **Email Alerts** (DIY) - Critical issues only
4. **Spreadsheet** (Google Sheets) - Weekly metrics tracking

**Total Cost:** $0 (using included tools only)

---

## Weekly Review Process

### Monday Morning Review (15 minutes)

**Objective:** Start week with clear understanding of metrics and priorities

**Checklist:**

1. **Review Last Week's Numbers**
   ```sql
   -- Week-over-week comparison
   WITH last_week AS (
     SELECT 
       COUNT(*) FILTER (WHERE status = 'succeeded') as purchases,
       SUM(CASE 
         WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
         WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12) * 0.70
         ELSE 0 
       END) as revenue
     FROM apple_transactions
     WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
   ),
   this_week AS (
     SELECT 
       COUNT(*) FILTER (WHERE status = 'succeeded') as purchases,
       SUM(CASE 
         WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
         WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12) * 0.70
         ELSE 0 
       END) as revenue
     FROM apple_transactions
     WHERE created_at > NOW() - INTERVAL '7 days'
   )
   SELECT 
     this_week.purchases,
     last_week.purchases as prev_week_purchases,
     ROUND(100.0 * (this_week.purchases - last_week.purchases) / NULLIF(last_week.purchases, 0), 2) as purchase_growth,
     this_week.revenue,
     last_week.revenue as prev_week_revenue,
     ROUND(100.0 * (this_week.revenue - last_week.revenue) / NULLIF(last_week.revenue, 0), 2) as revenue_growth
   FROM this_week, last_week;
   ```

2. **Check Critical Metrics**
   - [ ] Purchase success rate: >95%
   - [ ] Active subscriptions: Growing
   - [ ] MRR: Growing or stable
   - [ ] No critical errors

3. **Review Errors**
   ```bash
   # Check recent errors
   supabase functions logs validate-apple-receipt --limit 100 | grep -i "error"
   supabase functions logs apple-webhook --limit 100 | grep -i "error"
   ```

4. **Set Weekly Goals**
   - What to optimize this week?
   - Any issues to address?
   - Experiments to run?

### Friday Afternoon Review (10 minutes)

**Objective:** Reflect on week's performance and plan for next week

**Checklist:**

1. **Review Weekly Goals**
   - [ ] Did we hit targets?
   - [ ] What worked well?
   - [ ] What needs improvement?

2. **Document Learnings**
   - Add to lessons learned doc
   - Update troubleshooting guide
   - Note any patterns observed

3. **Plan Next Week**
   - Prioritize optimization tasks
   - Schedule any maintenance
   - Set next week's goals

### Monthly Deep Dive (1 hour)

**Objective:** Comprehensive analysis and strategic planning

**Schedule:** First Monday of each month

**Agenda:**

1. **Performance Analysis (20 min)**
   - Review all metrics for the month
   - Compare to previous month
   - Identify trends

2. **Cohort Analysis (15 min)**
   ```sql
   -- Cohort retention analysis
   WITH cohorts AS (
     SELECT 
       DATE_TRUNC('month', created_at) as cohort_month,
       user_id,
       created_at
     FROM apple_transactions
     WHERE status = 'succeeded'
   )
   SELECT 
     cohort_month,
     COUNT(DISTINCT user_id) as cohort_size,
     COUNT(DISTINCT CASE 
       WHEN DATE_TRUNC('month', CURRENT_DATE) = cohort_month 
       THEN user_id 
     END) as retained_month_0,
     COUNT(DISTINCT CASE 
       WHEN DATE_TRUNC('month', CURRENT_DATE) = cohort_month + INTERVAL '1 month' 
       THEN user_id 
     END) as retained_month_1
   FROM cohorts
   GROUP BY cohort_month
   ORDER BY cohort_month DESC;
   ```

3. **Optimization Opportunities (15 min)**
   - Where can we improve conversion?
   - Any bottlenecks in funnel?
   - Performance optimizations needed?

4. **Strategic Planning (10 min)**
   - Revenue goals for next month
   - Feature experiments to try
   - Marketing initiatives

---

## Appendix

### A. Sample Monitoring Script

```typescript
// monitor-iap.ts
// Run this script every 15 minutes via cron

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIAPHealth() {
  // Check purchase success rate
  const { data: purchases } = await supabase
    .from('apple_transactions')
    .select('status')
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if (!purchases) return;

  const successRate = purchases.filter(p => p.status === 'succeeded').length / purchases.length;

  if (successRate < 0.85) {
    await sendAlert('CRITICAL', `Purchase success rate: ${(successRate * 100).toFixed(1)}%`);
  } else if (successRate < 0.95) {
    await sendAlert('WARNING', `Purchase success rate: ${(successRate * 100).toFixed(1)}%`);
  }
}

async function sendAlert(level: string, message: string) {
  // Send email, Slack message, etc.
  console.log(`[${level}] ${message}`);
}

checkIAPHealth();
```

### B. Useful SQL Queries

```sql
-- Top 10 most active subscribers
SELECT 
  user_id,
  apple_original_transaction_id,
  COUNT(*) as transaction_count,
  MAX(created_at) as latest_activity
FROM apple_transactions
GROUP BY user_id, apple_original_transaction_id
ORDER BY transaction_count DESC
LIMIT 10;

-- Failed purchases analysis
SELECT 
  error_message,
  COUNT(*) as occurrence_count,
  MAX(created_at) as last_occurred
FROM apple_transactions
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY occurrence_count DESC;

-- Webhook processing delays
SELECT 
  notification_type,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_delay_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - created_at))) as max_delay_seconds
FROM apple_webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND processed_at IS NOT NULL
GROUP BY notification_type;
```

### C. Dashboard Examples

**Simple Google Sheets Dashboard:**

Create a sheet with these columns:
- Date
- Purchases
- Success Rate
- MRR
- Active Subs
- Notes

Update weekly with SQL query results. Use charts for trends.

---

**Document Maintained By:** Development Team  
**Last Review:** 2025-12-06  
**Next Review:** Post-deployment (Week 2)