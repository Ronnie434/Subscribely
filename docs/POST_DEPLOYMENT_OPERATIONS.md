# Apple IAP Post-Deployment Operations - Phase 7
## Ongoing Maintenance and Day-to-Day Operations Guide

**Document Version:** 1.0.0  
**Created:** 2025-12-06  
**Status:** Production Ready  
**Target Audience:** Development Team, Operations  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Day 1-7: Intensive Monitoring](#day-1-7-intensive-monitoring)
3. [Week 2-4: Stabilization Period](#week-2-4-stabilization-period)
4. [Month 2+: Steady State Operations](#month-2-steady-state-operations)
5. [Ongoing Maintenance Tasks](#ongoing-maintenance-tasks)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Support Escalation Tiers](#support-escalation-tiers)
8. [Appendix](#appendix)

---

## Executive Summary

This document provides operational procedures for maintaining the Apple IAP system after deployment. It covers:

- **Intensive monitoring** (First week) - Hourly checks, rapid response
- **Stabilization** (Weeks 2-4) - Daily monitoring, optimization
- **Steady state** (Month 2+) - Weekly reviews, routine maintenance
- **Ongoing tasks** - Monthly, quarterly, annual maintenance
- **Issue resolution** - Common problems and solutions
- **Support tiers** - Escalation procedures

### Operations Philosophy

**For Solo/Small Teams:**
- Front-load effort in first week (intensive monitoring)
- Establish routines early (daily checks become habit)
- Automate what you can (alerts, reports)
- Document as you go (save time for future you)

### Time Commitment

| Period | Time Required | Focus |
|--------|---------------|-------|
| **Day 1-7** | 2-4 hours/day | Intensive monitoring, rapid fixes |
| **Week 2-4** | 1-2 hours/day | Stabilization, optimization |
| **Month 2+** | 3-5 hours/week | Routine maintenance, improvements |

---

## Day 1-7: Intensive Monitoring

### Overview

**Objective:** Ensure smooth launch and catch issues immediately

**Frequency:** Check metrics every 2-4 hours (yes, even evenings!)

**Why Intensive:** First week is critical for:
- Catching launch bugs before they affect many users
- Building confidence in the system
- Establishing baseline metrics
- Identifying unexpected patterns

### Daily Schedule Template

```
DAY 1-7 DAILY SCHEDULE
─────────────────────────────────────

08:00 AM - Morning Check (30 min)
  □ Review overnight metrics
  □ Check for critical alerts
  □ Read Supabase function logs
  □ Verify no outages

12:00 PM - Midday Check (15 min)
  □ Purchase success rate check
  □ Review new App Store reviews
  □ Check support tickets

04:00 PM - Afternoon Check (15 min)
  □ Metrics review
  □ Error log scan
  □ Performance check

08:00 PM - Evening Check (15 min)
  □ End-of-day metrics
  □ Set alerts for overnight
  □ Note any issues for tomorrow

Total: ~75 min/day (distributed)
```

### Morning Check (8:00 AM - 30 minutes)

**Step 1: Review Overnight Metrics** (10 min)

```sql
-- Overnight summary (last 12 hours)
SELECT 
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful_purchases,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_purchases,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate,
  COUNT(DISTINCT user_id) as unique_purchasers
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '12 hours';
```

**Expected:**
- Successful purchases: >0 (if you have traffic)
- Success rate: >95%
- Failed purchases: <5% of total

**Step 2: Check Critical Alerts** (5 min)

```bash
# Check email for any automated alerts
# Review Slack notifications (if set up)

# Check Supabase for errors
supabase functions logs validate-apple-receipt --limit 50 | grep -i "error"
supabase functions logs apple-webhook --limit 50 | grep -i "error"
```

**Action:** If errors found, investigate immediately. See [Common Issues](#common-issues--solutions).

**Step 3: Verify System Health** (10 min)

Check Supabase Dashboard:
- **Functions** → **validate-apple-receipt**
  - Invocations chart trending up? ✅
  - Error rate <1%? ✅
  - Duration <3s average? ✅

- **Functions** → **apple-webhook**
  - Receiving events? ✅
  - Processing successfully? ✅

- **Database** → **Performance**
  - Connections normal? ✅
  - No slow queries? ✅

**Step 4: Document Notes** (5 min)

Keep a simple log:
```
DATE: 2025-12-06
MORNING CHECK:
- Purchases: 8 overnight (success rate: 100%)
- No errors in logs
- System healthy
- Action items: None
```

### Midday Check (12:00 PM - 15 minutes)

**Step 1: Quick Metrics Check** (5 min)

```sql
-- Today's metrics so far
SELECT 
  COUNT(*) as purchases_today,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate,
  SUM(CASE 
    WHEN apple_product_id LIKE '%monthly' THEN 4.99
    WHEN apple_product_id LIKE '%yearly' THEN 39.99
    ELSE 0 
  END) as revenue_today
FROM apple_transactions
WHERE created_at > CURRENT_DATE;
```

**Step 2: Check User Feedback** (5 min)

- **App Store Reviews**: Check for new reviews
  - Navigate to App Store Connect → Ratings and Reviews
  - Respond to negative reviews within 24 hours
  - Note common themes

- **Support Tickets**: Scan new tickets
  - Any IAP-related issues?
  - Common pain points?
  - Urgent issues requiring immediate attention?

**Step 3: Performance Spot Check** (5 min)

```bash
# Check recent function performance
supabase functions logs validate-apple-receipt --limit 20

# Look for:
# - Response times >3s (slow)
# - Timeout errors
# - Validation failures
```

### Afternoon Check (4:00 PM - 15 minutes)

**Step 1: Metrics Review** (8 min)

```sql
-- Detailed metrics for today
SELECT 
  -- Purchase metrics
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate,
  
  -- Revenue
  SUM(CASE 
    WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99
    WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99
    ELSE 0 
  END) as gross_revenue,
  
  -- Product mix
  COUNT(*) FILTER (WHERE apple_product_id LIKE '%monthly' AND status = 'succeeded') as monthly_sales,
  COUNT(*) FILTER (WHERE apple_product_id LIKE '%yearly' AND status = 'succeeded') as yearly_sales
  
FROM apple_transactions
WHERE created_at > CURRENT_DATE;
```

**Compare to targets:**
- Success rate >95%? ✅ / ❌
- Revenue on track? ✅ / ❌
- Product mix reasonable? ✅ / ❌

**Step 2: Error Pattern Check** (7 min)

```sql
-- Errors today by type
SELECT 
  error_message,
  COUNT(*) as occurrence_count
FROM apple_transactions
WHERE created_at > CURRENT_DATE
  AND status = 'failed'
GROUP BY error_message
ORDER BY occurrence_count DESC;
```

**Action:** If same error appears >3 times, investigate immediately.

### Evening Check (8:00 PM - 15 minutes)

**Step 1: End-of-Day Summary** (10 min)

```sql
-- Complete day summary
WITH daily_stats AS (
  SELECT 
    COUNT(*) as total_purchases,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(DISTINCT user_id) as unique_purchasers,
    SUM(CASE 
      WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
      WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99 * 0.70
      ELSE 0 
    END) as net_revenue
  FROM apple_transactions
  WHERE created_at > CURRENT_DATE
)
SELECT 
  *,
  ROUND(100.0 * successful / NULLIF(total_purchases, 0), 2) as success_rate
FROM daily_stats;
```

**Document in Daily Log:**
```
DATE: 2025-12-06 - DAY 1
SUMMARY:
- Total purchases: 15
- Success rate: 93.3% (14 succeeded, 1 failed)
- Unique purchasers: 14
- Net revenue: $48.93
- Issues: 1 failed purchase (card declined - user error)
- Status: ✅ Healthy
```

**Step 2: Prepare for Tomorrow** (5 min)

- [ ] Any bugs to fix overnight?
- [ ] Any urgent issues for tomorrow?
- [ ] Set expectations for tomorrow's metrics
- [ ] Enable overnight alerts (if not already)

### Critical Issues Checklist (Use if anything goes wrong)

**If Purchase Success Rate <85%:**

1. **Immediate (5 min)**
   ```bash
   # Check function logs
   supabase functions logs validate-apple-receipt --tail
   
   # Look for:
   # - API errors from Apple
   # - Timeout errors
   # - Network issues
   ```

2. **Investigate (15 min)**
   - Is Apple's API down? Check [Apple System Status](https://www.apple.com/support/systemstatus/)
   - Are Supabase functions responding?
   - Database connection issues?
   - Environment variables missing?

3. **Fix or Rollback (30 min)**
   - If fixable quickly → Deploy fix
   - If not fixable → Consider rollback (see [`DEPLOYMENT_STRATEGY.md`](DEPLOYMENT_STRATEGY.md#rollback-procedures))

**If No Purchases for >2 Hours (During Expected Traffic):**

1. Test purchase flow manually:
   - Open app
   - Navigate to paywall
   - Attempt purchase with sandbox account
   - Note where it fails

2. Check App Store Connect:
   - Are IAP products still approved?
   - Any policy violations?
   - Products in correct status?

3. Verify code deployment:
   - Correct build version deployed?
   - Feature flags enabled?
   - Environment set to production?

### Weekend Considerations

**If deploying on Friday:**
- Plan for weekend monitoring (especially Saturday morning)
- Have rollback plan ready
- Consider delaying to Monday if possible

**Weekend Schedule (Lighter):**
- Morning check: 10 AM
- Evening check: 6 PM
- Be available for critical alerts

---

## Week 2-4: Stabilization Period

### Overview

**Objective:** Stabilize operations, optimize performance, establish routines

**Frequency:** Daily checks (reduced from hourly to daily)

**Why Important:** Transition from intensive monitoring to sustainable operations

### Daily Routine (30-60 minutes)

#### Morning Daily Check (9:00 AM - 30 minutes)

**Step 1: Yesterday's Performance** (10 min)

```sql
-- Yesterday's complete summary
SELECT 
  DATE(created_at) as date,
  COUNT(*) as purchases,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(CASE 
    WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
    WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99 * 0.70
    ELSE 0 
  END) as net_revenue
FROM apple_transactions
WHERE created_at >= CURRENT_DATE - 1
  AND created_at < CURRENT_DATE
GROUP BY DATE(created_at);
```

**Compare to Week 1:**
- Purchase volume trending up/stable/down?
- Success rate maintained >95%?
- Any unusual patterns?

**Step 2: Check for Issues** (10 min)

```bash
# Scan yesterday's logs for errors
supabase functions logs validate-apple-receipt --since 24h | grep -i "error"

# Check webhook processing
supabase functions logs apple-webhook --since 24h | grep -i "failed"
```

**Action:** 
- No errors → Proceed with day
- Errors found → Investigate root cause
- Pattern detected → Plan optimization

**Step 3: Review User Feedback** (10 min)

- **App Store Reviews**: Any new reviews mentioning IAP?
- **Support Tickets**: Any IAP-related tickets from yesterday?
- **Trends**: Common issues emerging?

**Document:**
```
WEEK 2 - DAY 8 (2025-12-07)
─────────────────────────────
Yesterday: 22 purchases, 95.5% success, $69.30 revenue
Errors: 1 validation timeout (resolved automatically)
Feedback: No issues reported
Action items: None
Status: ✅ Stable
```

#### Optional Evening Check (6:00 PM - 10 minutes)

**Quick health check:**

```sql
-- Today so far
SELECT 
  COUNT(*) as purchases_today,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate
FROM apple_transactions
WHERE created_at > CURRENT_DATE;
```

**Only investigate if:**
- Success rate <90%
- Zero purchases (when expected >0)
- Critical alert received

### Weekly Tasks (Week 2-4)

#### Monday: Week Planning (15 minutes)

- Review last week's metrics
- Set goals for current week
- Plan any optimizations
- Schedule maintenance if needed

#### Wednesday: Mid-Week Check (20 minutes)

```sql
-- Week-to-date performance
SELECT 
  COUNT(*) as purchases_wtd,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate_wtd,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(CASE 
    WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
    WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99 * 0.70
    ELSE 0 
  END) as net_revenue_wtd
FROM apple_transactions
WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE);
```

**Checkpoint:**
- On track for weekly goals?
- Any adjustments needed?
- Performance issues to address?

#### Friday: Week Wrap-Up (30 minutes)

- Complete weekly summary
- Document learnings
- Plan next week
- Update documentation if needed

**Weekly Summary Template:**
```
WEEK 2 SUMMARY (2025-12-07 to 2025-12-13)
──────────────────────────────────────────
Metrics:
- Purchases: 127 (↑ 15% vs Week 1)
- Success rate: 96.2% (target: >95%) ✅
- Revenue: $443.19 net (↑ 12% vs Week 1)
- Active subs: 234 (↑ 127 new this week)

Issues:
- 3 timeout errors (under investigation)
- 2 webhook delivery delays (resolved)

Optimizations:
- Added index on apple_transactions.created_at
- Improved error messaging for card declines

Learnings:
- Most purchases happen evening hours (6-10 PM)
- Yearly subscriptions mostly from existing users

Next Week Plan:
- Continue daily monitoring
- Implement retry logic for timeouts
- Add performance dashboard
```

### Optimization Focus (Weeks 2-4)

**Week 2: Performance**
- Optimize slow database queries
- Improve function response times
- Add caching where appropriate

**Week 3: User Experience**
- Refine error messages
- Streamline purchase flow
- Improve restore UX

**Week 4: Analytics**
- Set up automated reports
- Create performance dashboard
- Establish baseline metrics

---

## Month 2+: Steady State Operations

### Overview

**Objective:** Maintain system health with routine maintenance

**Frequency:** Weekly reviews + automated monitoring

**Effort:** 3-5 hours/week (down from 7-14 hours in first month)

### Weekly Routine (3-5 hours/week)

#### Monday: Weekly Review & Planning (1 hour)

**Step 1: Review Last Week** (30 min)

```sql
-- Complete week analysis
WITH weekly_stats AS (
  SELECT 
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as purchases,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE 
      WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
      WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99 * 0.70
      ELSE 0 
    END) as net_revenue
  FROM apple_transactions
  WHERE created_at >= NOW() - INTERVAL '2 weeks'
  GROUP BY week
  ORDER BY week DESC
)
SELECT 
  week,
  purchases,
  successful,
  ROUND(100.0 * successful / NULLIF(purchases, 0), 2) as success_rate,
  unique_users,
  ROUND(net_revenue, 2) as net_revenue,
  ROUND(net_revenue / NULLIF(successful, 0), 2) as avg_transaction_value
FROM weekly_stats;
```

**Analyze:**
- Growth trend (purchases, revenue)
- Success rate stability
- User acquisition
- Revenue per transaction

**Step 2: Set Weekly Goals** (15 min)

Example goals:
- Maintain >95% success rate
- Grow active subscriptions by 5%
- Reduce support tickets by 10%
- Implement [specific optimization]

**Step 3: Plan Tasks** (15 min)

Prioritize:
1. Critical issues (if any)
2. Performance optimizations
3. Feature improvements
4. Documentation updates

#### Wednesday: Mid-Week Spot Check (30 minutes)

Quick health check - no deep analysis needed:

```sql
-- This week so far
SELECT 
  COUNT(*) as purchases,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) as success_rate,
  COUNT(DISTINCT user_id) as new_subscribers
FROM apple_transactions
WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE);
```

**Quick checks:**
- [ ] Success rate >95%?
- [ ] No critical errors in logs?
- [ ] User feedback normal?
- [ ] On track for weekly goals?

#### Friday: Week Wrap-Up (30 minutes)

- Document week's results
- Update metrics spreadsheet
- Note learnings
- Prepare for next week

### Monthly Tasks (1st Monday of Each Month)

#### Monthly Deep Dive (2 hours)

**Step 1: Comprehensive Metrics Analysis** (45 min)

```sql
-- Monthly performance review
WITH monthly_stats AS (
  SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as purchases,
    COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
    COUNT(DISTINCT user_id) as unique_purchasers,
    SUM(CASE 
      WHEN status = 'succeeded' AND apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
      WHEN status = 'succeeded' AND apple_product_id LIKE '%yearly' THEN 39.99 * 0.70
      ELSE 0 
    END) as net_revenue,
    AVG(CASE 
      WHEN status = 'succeeded' THEN 
        EXTRACT(EPOCH FROM (updated_at - created_at))
      ELSE NULL 
    END) as avg_purchase_duration_seconds
  FROM apple_transactions
  WHERE created_at >= NOW() - INTERVAL '3 months'
  GROUP BY month
  ORDER BY month DESC
)
SELECT 
  month,
  purchases,
  successful,
  ROUND(100.0 * successful / NULLIF(purchases, 0), 2) as success_rate,
  unique_purchasers,
  ROUND(net_revenue, 2) as net_revenue,
  ROUND(avg_purchase_duration_seconds, 1) as avg_duration_sec
FROM monthly_stats;
```

**Analyze:**
- Month-over-month growth
- Success rate trends
- Purchase duration trends
- Revenue patterns

**Step 2: Cohort Analysis** (30 min)

```sql
-- Subscriber retention by cohort
WITH cohorts AS (
  SELECT 
    DATE_TRUNC('month', MIN(created_at)) as cohort_month,
    user_id,
    COUNT(*) as transaction_count
  FROM apple_transactions
  WHERE status = 'succeeded'
  GROUP BY user_id
)
SELECT 
  cohort_month,
  COUNT(*) as cohort_size,
  AVG(transaction_count) as avg_renewals_per_user,
  COUNT(*) FILTER (WHERE transaction_count > 1) as retained_users,
  ROUND(100.0 * COUNT(*) FILTER (WHERE transaction_count > 1) / NULLIF(COUNT(*), 0), 2) as retention_rate
FROM cohorts
GROUP BY cohort_month
ORDER BY cohort_month DESC;
```

**Insights:**
- Which cohorts have best retention?
- Are newer cohorts performing better?
- What's the average customer lifetime?

**Step 3: Strategic Planning** (45 min)

- Review goals for next month
- Plan major improvements
- Consider pricing adjustments
- Schedule maintenance windows

---

## Ongoing Maintenance Tasks

### Monthly Tasks (2-3 hours)

#### Task 1: Review Apple IAP Product Pricing (30 min)

**Schedule:** First Monday of each month

**Actions:**
- [ ] Check if pricing competitive
- [ ] Review App Store pricing tiers
- [ ] Consider seasonal adjustments
- [ ] Monitor competitor pricing
- [ ] Plan A/B test if needed

**Resources:**
- App Store Connect → Pricing and Availability
- Competitor apps in Finance category

#### Task 2: iOS Version Compatibility Check (20 min)

**Schedule:** After each major iOS release

**Actions:**
- [ ] Check Apple's iOS version distribution
- [ ] Test IAP on new iOS version
- [ ] Verify StoreKit 2 compatibility
- [ ] Update minimum iOS version if needed

```typescript
// Check StoreKit version in use
import { getStoreKitVersion } from '../config/appleIAP';

console.log('Using StoreKit', getStoreKitVersion());
// Should be 2 for iOS 15+
```

#### Task 3: Update Test Scenarios (30 min)

**Schedule:** Monthly or after code changes

**Actions:**
- [ ] Review sandbox test scenarios
- [ ] Add new edge cases discovered
- [ ] Update test documentation
- [ ] Re-run critical tests

**Update:** [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md)

#### Task 4: Security Audit of Receipt Validation (45 min)

**Schedule:** Monthly

**Actions:**
- [ ] Review receipt validation logic
- [ ] Check for security vulnerabilities
- [ ] Update Apple root certificates if needed
- [ ] Verify shared secret security
- [ ] Check for replay attacks in logs

```sql
-- Check for suspicious transaction patterns
SELECT 
  user_id,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT apple_original_transaction_id) as unique_original_ids,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) > 5  -- More than 5 transactions in a week
ORDER BY transaction_count DESC;
```

#### Task 5: Documentation Review & Update (30 min)

**Schedule:** Monthly

**Actions:**
- [ ] Update screenshots if UI changed
- [ ] Fix broken links
- [ ] Add new FAQs from support tickets
- [ ] Update troubleshooting guides
- [ ] Verify all commands still work

**Documents to Review:**
- [`DEPLOYMENT_STRATEGY.md`](DEPLOYMENT_STRATEGY.md)
- [`MONITORING_AND_ANALYTICS.md`](MONITORING_AND_ANALYTICS.md)
- [`POST_DEPLOYMENT_OPERATIONS.md`](POST_DEPLOYMENT_OPERATIONS.md)
- [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md)

### Quarterly Tasks (4-5 hours)

#### Task 1: Comprehensive Performance Review (2 hours)

**Schedule:** Every 3 months

**Actions:**
- [ ] Analyze 3-month trends
- [ ] Review all metrics against goals
- [ ] Identify optimization opportunities
- [ ] Plan major improvements

**Metrics to Review:**
- Purchase success rate trend
- Revenue growth
- User acquisition cost
- Customer lifetime value
- Churn rate
- Support ticket trends

#### Task 2: User Satisfaction Survey (1 hour)

**Schedule:** Quarterly

**Actions:**
- [ ] Create short survey (5-7 questions)
- [ ] Send to recent purchasers
- [ ] Analyze feedback
- [ ] Implement improvements

**Sample Questions:**
1. How satisfied are you with the purchase experience? (1-5)
2. Was the pricing clear and transparent? (Yes/No)
3. Did you encounter any issues? (Open text)
4. Would you recommend Renvo? (1-10)

#### Task 3: Subscription Tier Evaluation (1 hour)

**Schedule:** Quarterly

**Actions:**
- [ ] Analyze subscription mix (monthly vs yearly)
- [ ] Review pricing effectiveness
- [ ] Consider new tiers/offerings
- [ ] Evaluate promotional strategies

```sql
-- Subscription tier distribution
SELECT 
  CASE 
    WHEN apple_product_id LIKE '%monthly' THEN 'Monthly'
    WHEN apple_product_id LIKE '%yearly' THEN 'Yearly'
    ELSE 'Other'
  END as tier,
  COUNT(*) as active_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  SUM(CASE 
    WHEN apple_product_id LIKE '%monthly' THEN 4.99 * 0.70
    WHEN apple_product_id LIKE '%yearly' THEN (39.99 / 12) * 0.70
    ELSE 0 
  END) as monthly_revenue
FROM profiles
WHERE subscription_status = 'active'
  AND payment_provider = 'apple'
GROUP BY tier;
```

**Target:** >30% yearly subscriptions (higher LTV)

#### Task 4: Competitive Analysis (1 hour)

**Schedule:** Quarterly

**Actions:**
- [ ] Review competitor subscription models
- [ ] Check competitor pricing
- [ ] Analyze competitor IAP implementation
- [ ] Identify differentiation opportunities

### Annual Tasks (6-8 hours)

#### Task 1: Full Security Audit (3 hours)

**Schedule:** Annually

**Actions:**
- [ ] Comprehensive security review
- [ ] Update all dependencies
- [ ] Review access controls
- [ ] Check for vulnerabilities
- [ ] Update security documentation

#### Task 2: Terms of Service Review (1 hour)

**Schedule:** Annually (and when regulations change)

**Actions:**
- [ ] Review Terms of Service
- [ ] Update subscription terms
- [ ] Check compliance with regulations
- [ ] Update refund policy
- [ ] Get legal review if needed

#### Task 3: Privacy Policy Update (1 hour)

**Schedule:** Annually (and when data practices change)

**Actions:**
- [ ] Review Privacy Policy
- [ ] Update IAP data collection details
- [ ] Check GDPR/CCPA compliance
- [ ] Update Apple's data usage disclosures
- [ ] Get legal review if needed

#### Task 4: Major Feature Planning (2 hours)

**Schedule:** Annually

**Actions:**
- [ ] Review year's performance
- [ ] Plan next year's roadmap
- [ ] Consider new subscription features
- [ ] Evaluate promotional offers
- [ ] Plan pricing adjustments

**Considerations:**
- Introductory pricing
- Win-back offers
- Upgrade incentives
- Family sharing
- Gifting subscriptions

#### Task 5: Infrastructure Scaling Assessment (1-2 hours)

**Schedule:** Annually

**Actions:**
- [ ] Review database performance trends
- [ ] Check Supabase usage limits
- [ ] Plan for capacity increases
- [ ] Evaluate cost optimizations
- [ ] Consider infrastructure upgrades

---

## Common Issues & Solutions

### Issue 1: Receipt Validation Timeouts

**Symptoms:**
- Users report "Purchase not processing"
- Success rate drops to 85-90%
- Logs show timeout errors

**Root Causes:**
- Apple API slow response
- Network latency
- Function timeout too low

**Solution:**

```typescript
// Update validation function with retry logic
async function validateReceiptWithRetry(receiptData: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await validateReceiptWithApple(receiptData);
      return result;
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

**Prevention:**
- Monitor validation latency
- Set appropriate timeouts
- Implement retry logic

### Issue 2: Webhook Delivery Failures

**Symptoms:**
- Subscriptions not renewing automatically
- Users still have access after cancellation
- Database out of sync with Apple

**Root Causes:**
- Webhook endpoint down
- Function errors
- Network issues

**Solution:**

1. **Check webhook endpoint:**
```bash
curl -X POST https://[project].supabase.co/functions/v1/apple-webhook \
  -H "Content-Type: application/json" \
  -d '{"signedPayload":"test"}'
```

2. **Review function logs:**
```bash
supabase functions logs apple-webhook | grep -i "error"
```

3. **Manual sync if needed:**
```sql
-- Manually update subscription based on App Store Connect
UPDATE profiles
SET 
  subscription_status = 'active',
  subscription_tier = 'premium',
  apple_receipt_expiration_date = '2025-01-06'
WHERE id = '[user_id]';
```

**Prevention:**
- Monitor webhook success rate
- Set up webhook retry in App Store Connect
- Implement idempotency checks

### Issue 3: Sandbox vs Production Confusion

**Symptoms:**
- Validation fails with "sandbox receipt in production"
- Users can't purchase in production

**Root Causes:**
- Testing with sandbox account in production
- Environment variable set incorrectly
- Wrong Apple API endpoint

**Solution:**

```typescript
// Ensure proper environment detection
const APPLE_API_URL = __DEV__ 
  ? 'https://sandbox.itunes.apple.com/verifyReceipt'
  : 'https://buy.itunes.apple.com/verifyReceipt';

// In edge function, try production first, fallback to sandbox
try {
  result = await validateWithProduction(receipt);
} catch (error) {
  if (error.status === 21007) {
    // Sandbox receipt in production, retry with sandbox
    result = await validateWithSandbox(receipt);
  }
}
```

**Prevention:**
- Clear environment indicators in logs
- Document sandbox vs production testing
- Separate test accounts

### Issue 4: User Has Active Subscription but App Shows Free Tier

**Symptoms:**
- User purchased successfully
- Database shows active subscription
- App still shows free tier UI

**Root Causes:**
- Cache not refreshed
- State management issue
- Receipt validation pending

**Solution:**

1. **Force subscription status refresh:**
```typescript
// In app
await appleIAPService.syncSubscriptionStatus();
```

2. **Check database:**
```sql
SELECT 
  subscription_tier,
  subscription_status,
  payment_provider,
  apple_original_transaction_id
FROM profiles
WHERE id = '[user_id]';
```

3. **If database correct but app wrong:**
- Clear app cache
- Force logout/login
- Reinstall app (last resort)

**Prevention:**
- Implement real-time subscription status
- Add "Refresh Status" button in settings
- Better state management

### Issue 5: High Refund Rate

**Symptoms:**
- Multiple refund requests
- Revenue reversals
- User complaints

**Root Causes:**
- Unclear subscription terms
- Unexpected charges
- Feature not meeting expectations
- Technical issues

**Solution:**

1. **Immediate:**
- Review refund requests
- Identify patterns
- Fix technical issues

2. **Short-term:**
- Improve subscription disclosure
- Add trial period (if applicable)
- Better onboarding

3. **Long-term:**
- Improve product value
- Better communication
- Proactive support

```sql
-- Track refund rate
SELECT 
  COUNT(*) FILTER (WHERE notification_type = 'REFUND') as refunds,
  COUNT(*) as total_transactions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE notification_type = 'REFUND') / NULLIF(COUNT(*), 0), 2) as refund_rate
FROM apple_transactions
WHERE created_at > NOW() - INTERVAL '30 days';
```

**Target:** <3% refund rate

---

## Support Escalation Tiers

### Tier 1: Self-Service (User)

**Handle:** Common questions, basic troubleshooting

**Resources:**
- In-app FAQ
- Help center articles
- "Restore Purchases" button

**Common Questions:**
- How do I cancel? → Link to App Store settings
- How do I restore? → "Restore Purchases" button
- Where do I manage? → App Store subscription management

**Success Rate:** 60-70% of issues resolved

### Tier 2: Support Team (Email/Chat)

**Handle:** Purchase issues, account problems, refund requests

**Tools:**
- User ID lookup
- Transaction history
- Subscription status checker

**Common Issues:**
- Purchase not showing up
- Billing questions
- Account access problems

**Response Time:** <24 hours

**Sample Response Templates:**

**Issue: Purchase Not Showing**
```
Hi [User],

I see you made a purchase on [date], but it's not showing in your account.

Let's try these steps:
1. Open Renvo app
2. Go to Settings
3. Tap "Restore Purchases"
4. Sign in with the Apple ID you used to purchase

This should restore your premium access. If it doesn't work, please reply with:
- Your Apple ID email
- Screenshot of your purchase receipt

We'll get this resolved quickly!

Best,
[Name]
```

**Success Rate:** 25-30% of issues resolved

### Tier 3: Engineering (Developer)

**Handle:** Technical issues, bugs, system problems

**Tools:**
- Direct database access
- Supabase function logs
- Apple transaction lookup

**Common Issues:**
- Receipt validation failures
- Webhook processing errors
- Database sync issues
- System bugs

**Response Time:** <4 hours for critical, <2 days for non-critical

**Escalation Criteria:**
- Purchase fails repeatedly (not user error)
- System error affecting multiple users
- Data corruption
- Security issue

**Process:**

1. **Triage** (5 min)
   - Is this a user issue or system issue?
   - How many users affected?
   - Critical or can wait?

2. **Investigate** (15-30 min)
   - Check logs
   - Query database
   - Reproduce if possible

3. **Fix** (varies)
   - Apply hotfix if critical
   - Create bug ticket for non-critical
   - Document resolution

4. **Communicate** (5 min)
   - Update support team
   - Respond to user
   - Document for future

### Emergency Contact

**Critical Issues (System Down):**
- Developer on-call: [phone]
- Backup contact: [phone]
- Escalation: [manager phone]

**Response Time:** <15 minutes for critical alerts

---

## Appendix

### A. Weekly Metrics Template

```
WEEK [N] REPORT - [Date Range]
═══════════════════════════════════════

📊 KEY METRICS
──────────────
Purchases:          [N] (↑/↓ [N]% vs last week)
Success Rate:       [N]% (target: >95%)
Net Revenue:        $[N] (↑/↓ [N]% vs last week)
Active Subs:        [N] (↑ [N] new)
ARPU:              $[N]

📈 TRENDS
──────────
Purchase volume:    Increasing / Stable / Decreasing
Success rate:       Stable / Improving / Degrading
User acquisition:   [N] new subscribers
Churn:             [N] cancellations ([N]%)

🐛 ISSUES
──────────
Critical:          [N] ([list])
Warnings:          [N] ([list])
Resolved:          [N] ([list])

✅ ACCOMPLISHMENTS
──────────────────
- [Achievement 1]
- [Achievement 2]

📋 NEXT WEEK
────────────
Goals:
- [Goal 1]
- [Goal 2]

Tasks:
- [Task 1]
- [Task 2]
```

### B. Incident Response Checklist

```markdown
INCIDENT RESPONSE CHECKLIST
═══════════════════════════

□ Severity assessed (Critical / Major / Minor)
□ Affected users identified
□ Root cause investigated
□ Immediate mitigation applied
□ Stakeholders notified
□ Fix implemented
□ Verification completed
□ Post-mortem scheduled
□ Documentation updated
□ Prevention measures added

SEVERITY LEVELS:
─────────────────
Critical:  >100 users affected OR purchase flow down
Major:     10-100 users affected OR degraded performance
Minor:     <10 users affected OR cosmetic issue
```

### C. Useful Commands Reference

```bash
# Check recent purchases
psql $DATABASE_URL -c "SELECT COUNT(*), status FROM apple_transactions WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status;"

# Monitor function logs in real-time
supabase functions logs validate-apple-receipt --tail

# Check webhook processing
psql $DATABASE_URL -c "SELECT notification_type, COUNT(*), processing_status FROM apple_webhook_events WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY notification_type, processing_status;"

# Quick health check
curl https://[project].supabase.co/functions/v1/validate-apple-receipt -X POST

# Database performance
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 5;"
```

---

**Document Maintained By:** Development Team  
**Last Review:** 2025-12-06  
**Next Review:** Monthly (first Monday)