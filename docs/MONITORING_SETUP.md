# Monitoring Setup Guide - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Overview](#overview)
2. [Key Metrics to Monitor](#key-metrics-to-monitor)
3. [Logging Strategy](#logging-strategy)
4. [Error Tracking Setup](#error-tracking-setup)
5. [Stripe Monitoring](#stripe-monitoring)
6. [Supabase Monitoring](#supabase-monitoring)
7. [Analytics Dashboard](#analytics-dashboard)
8. [Alerting Rules](#alerting-rules)
9. [Performance Monitoring](#performance-monitoring)

---

## Overview

Effective monitoring is crucial for maintaining a healthy paywall system. This guide covers what to monitor, how to set up monitoring tools, and how to respond to issues.

### Monitoring Goals

1. **Business Health**: Track revenue, conversions, and user behavior
2. **Technical Health**: Monitor system performance and errors
3. **User Experience**: Ensure smooth payment flows and minimal friction
4. **Security**: Detect and prevent fraudulent activities

---

## Key Metrics to Monitor

### Business Metrics

#### Revenue Metrics
```typescript
interface RevenueMetrics {
  // Total revenue
  totalRevenue: number;              // All-time total
  monthlyRevenue: number;            // Current month
  averageRevenuePerUser: number;     // ARPU
  
  // Recurring revenue
  monthlyRecurringRevenue: number;   // MRR
  annualRecurringRevenue: number;    // ARR
  
  // Growth
  revenueGrowthRate: number;         // Month-over-month %
  newMRR: number;                    // New MRR this month
  expandedMRR: number;               // Upgrades
  contractedMRR: number;             // Downgrades
  churnedMRR: number;                // Lost MRR
}
```

**SQL Query for MRR**:
```sql
-- Calculate Monthly Recurring Revenue
SELECT 
  DATE_TRUNC('month', current_period_start) as month,
  COUNT(*) as active_subscriptions,
  SUM(
    CASE 
      WHEN billing_cycle = 'monthly' THEN 4.99
      WHEN billing_cycle = 'annual' THEN 39.00 / 12
      ELSE 0
    END
  ) as mrr
FROM public.user_subscriptions
WHERE status = 'active'
  AND tier_id = 'premium'
GROUP BY month
ORDER BY month DESC;
```

#### Conversion Metrics
```typescript
interface ConversionMetrics {
  // Funnel metrics
  paywallViewed: number;            // Users who saw paywall
  planSelected: number;             // Users who selected a plan
  paymentInitiated: number;         // Users who started payment
  paymentCompleted: number;         // Successful payments
  
  // Conversion rates
  paywallToPayment: number;         // % who pay after seeing paywall
  selectionToPayment: number;       // % who complete after selecting
  overallConversionRate: number;    // % of free users who convert
}
```

**SQL Query for Conversion Funnel**:
```sql
-- Conversion funnel for last 30 days
WITH funnel_events AS (
  SELECT 
    user_id,
    MAX(CASE WHEN event_type = 'limit_reached' THEN 1 ELSE 0 END) as saw_limit,
    MAX(CASE WHEN event_type = 'paywall_viewed' THEN 1 ELSE 0 END) as saw_paywall,
    MAX(CASE WHEN event_type = 'plan_selected' THEN 1 ELSE 0 END) as selected_plan,
    MAX(CASE WHEN event_type = 'payment_initiated' THEN 1 ELSE 0 END) as initiated_payment,
    MAX(CASE WHEN event_type = 'payment_completed' THEN 1 ELSE 0 END) as completed_payment
  FROM public.usage_tracking_events
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT 
  SUM(saw_limit) as users_hit_limit,
  SUM(saw_paywall) as users_saw_paywall,
  SUM(selected_plan) as users_selected_plan,
  SUM(initiated_payment) as users_initiated_payment,
  SUM(completed_payment) as users_completed_payment,
  ROUND(100.0 * SUM(completed_payment) / NULLIF(SUM(saw_paywall), 0), 2) as conversion_rate
FROM funnel_events;
```

#### User Distribution Metrics
```typescript
interface UserMetrics {
  // Tier distribution
  totalUsers: number;
  freeUsers: number;
  premiumUsers: number;
  
  // Subscription status
  activeSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  
  // Churn
  churnRate: number;                // Monthly churn %
  churnedUsers: number;             // Users lost this month
  retentionRate: number;            // % of users retained
}
```

**SQL Query for User Distribution**:
```sql
SELECT 
  tier_id,
  status,
  COUNT(*) as user_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.user_subscriptions
GROUP BY tier_id, status
ORDER BY tier_id, status;
```

### Technical Metrics

#### System Performance
```typescript
interface PerformanceMetrics {
  // API response times (ms)
  avgResponseTime: number;
  p50ResponseTime: number;          // Median
  p95ResponseTime: number;          // 95th percentile
  p99ResponseTime: number;          // 99th percentile
  
  // Throughput
  requestsPerMinute: number;
  successRate: number;              // % successful requests
  errorRate: number;                // % failed requests
  
  // Database
  avgQueryTime: number;
  slowQueries: number;              // Queries > 1s
  connectionPoolUtilization: number;
}
```

#### Webhook Processing
```typescript
interface WebhookMetrics {
  // Processing stats
  webhooksReceived: number;
  webhooksProcessed: number;
  webhooksFailed: number;
  
  // Performance
  avgProcessingTime: number;
  maxProcessingTime: number;
  
  // Reliability
  successRate: number;              // % successful
  retryRate: number;                // % requiring retries
  failureRate: number;              // % permanently failed
}
```

**SQL Query for Webhook Health**:
```sql
-- Webhook processing health (last 24 hours)
SELECT 
  event_type,
  COUNT(*) as total_events,
  SUM(CASE WHEN processing_status = 'processed' THEN 1 ELSE 0 END) as processed,
  SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN processing_status = 'processed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_seconds
FROM public.stripe_webhooks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total_events DESC;
```

#### Payment Processing
```typescript
interface PaymentMetrics {
  // Volume
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  
  // Success rates
  paymentSuccessRate: number;       // % successful
  paymentFailureRate: number;       // % failed
  
  // Failure reasons
  cardDeclined: number;
  insufficientFunds: number;
  networkErrors: number;
  otherErrors: number;
  
  // Refunds
  refundRequests: number;
  refundsProcessed: number;
  refundRate: number;               // % of payments refunded
}
```

**SQL Query for Payment Health**:
```sql
-- Payment processing health (last 30 days)
SELECT 
  status,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.payment_transactions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY transaction_count DESC;
```

---

## Logging Strategy

### What to Log

#### Critical Events (Always Log)
```typescript
// Payment events
logger.info('payment_initiated', {
  userId,
  plan: 'monthly',
  amount: 4.99,
  timestamp: new Date().toISOString()
});

logger.info('payment_succeeded', {
  userId,
  transactionId,
  amount: 4.99,
  paymentIntentId: 'pi_...'
});

logger.error('payment_failed', {
  userId,
  reason: 'card_declined',
  paymentIntentId: 'pi_...',
  errorCode: 'card_declined'
});
```

#### Subscription Lifecycle Events
```typescript
// User upgrades
logger.info('user_upgraded', {
  userId,
  fromTier: 'free',
  toTier: 'premium',
  plan: 'monthly'
});

// User downgrades
logger.info('user_downgraded', {
  userId,
  fromTier: 'premium',
  toTier: 'free',
  reason: 'subscription_canceled'
});

// Subscription canceled
logger.info('subscription_canceled', {
  userId,
  subscriptionId,
  cancelAtPeriodEnd: true,
  periodEnd: '2025-12-16'
});
```

#### Webhook Events
```typescript
// Webhook received
logger.info('webhook_received', {
  eventId: 'evt_...',
  eventType: 'invoice.payment_succeeded',
  timestamp: new Date().toISOString()
});

// Webhook processed
logger.info('webhook_processed', {
  eventId: 'evt_...',
  processingTime: 234, // ms
  status: 'success'
});

// Webhook failed
logger.error('webhook_failed', {
  eventId: 'evt_...',
  error: error.message,
  retryCount: 1
});
```

#### Limit Enforcement Events
```typescript
// User hit limit
logger.info('limit_reached', {
  userId,
  currentCount: 5,
  limit: 5,
  tier: 'free'
});

// Limit check performed
logger.debug('limit_checked', {
  userId,
  canAdd: false,
  currentCount: 5,
  limit: 5
});
```

### Log Levels

```typescript
enum LogLevel {
  ERROR = 'error',   // Critical errors requiring immediate attention
  WARN = 'warn',     // Warning conditions that should be reviewed
  INFO = 'info',     // Important business events
  DEBUG = 'debug'    // Detailed debugging information
}
```

### Structured Logging Format

```typescript
interface LogEntry {
  timestamp: string;           // ISO 8601 format
  level: LogLevel;
  message: string;
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: any;
  };
  metadata?: {
    source: string;            // 'app' | 'edge-function' | 'webhook'
    environment: string;       // 'development' | 'staging' | 'production'
    version: string;           // App version
  };
}
```

### Example Log Entry
```json
{
  "timestamp": "2025-11-16T20:00:00.000Z",
  "level": "info",
  "message": "payment_succeeded",
  "context": {
    "userId": "uuid-here",
    "transactionId": "txn_123",
    "amount": 4.99,
    "plan": "monthly",
    "paymentIntentId": "pi_abc123"
  },
  "metadata": {
    "source": "edge-function",
    "environment": "production",
    "version": "1.0.0"
  }
}
```

---

## Error Tracking Setup

### Recommended: Sentry Integration

#### 1. Install Sentry

```bash
npm install @sentry/react-native
npx @sentry/wizard -i reactNative
```

#### 2. Configure Sentry

```typescript
// App.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2, // 20% of transactions
  
  beforeSend(event, hint) {
    // Don't send errors from test users
    if (event.user?.email?.includes('test@')) {
      return null;
    }
    return event;
  },
  
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
    }),
  ],
});
```

#### 3. Track Paywall Errors

```typescript
// services/paymentService.ts
import * as Sentry from '@sentry/react-native';

try {
  await stripe.confirmPayment(clientSecret);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'payment',
      action: 'confirm_payment'
    },
    contexts: {
      payment: {
        plan: 'monthly',
        amount: 4.99
      }
    }
  });
  throw error;
}
```

#### 4. Track User Context

```typescript
// Set user context after login
Sentry.setUser({
  id: user.id,
  email: user.email,
  tier: subscriptionTier
});

// Clear on logout
Sentry.setUser(null);
```

### Error Categories to Track

```typescript
// Payment errors
Sentry.captureException(error, {
  tags: { category: 'payment', type: 'card_declined' }
});

// Webhook errors
Sentry.captureException(error, {
  tags: { category: 'webhook', type: 'processing_failed' }
});

// Database errors
Sentry.captureException(error, {
  tags: { category: 'database', type: 'query_timeout' }
});

// API errors
Sentry.captureException(error, {
  tags: { category: 'api', type: 'network_error' }
});
```

---

## Stripe Monitoring

### Stripe Dashboard Metrics

**Navigate to**: Dashboard → Home

Monitor:
- **Gross Volume**: Total payment volume
- **Successful Payments**: Count and amount
- **Failed Payments**: Count and reasons
- **Refunds**: Total refunded amount
- **Disputes**: Any payment disputes

### Stripe Alerts

**Set up alerts for**:
1. High failure rates (>5%)
2. Unusual refund volume
3. Payment disputes
4. Webhook delivery failures
5. API errors

**Configure in**: Dashboard → Settings → Notifications

### Stripe Radar (Fraud Prevention)

**Navigate to**: Radar → Rules

Monitor:
- High-risk payments blocked
- Fraud detection rate
- Manual review queue
- Blocked payments

### Webhook Monitoring

**Navigate to**: Developers → Webhooks → [Your Endpoint]

Check:
- Delivery success rate
- Recent events
- Failed deliveries
- Retry attempts

**Healthy webhook stats**:
- Success rate: >99%
- Average response time: <3s
- Failed events: <1%

---

## Supabase Monitoring

### Database Performance

**Navigate to**: Supabase Dashboard → Database → Performance

Monitor:
- Active connections
- Query performance
- Slow queries (>1s)
- Index usage
- Cache hit ratio

### Edge Function Logs

```bash
# Real-time logs
supabase functions logs stripe-webhook --tail

# Filter by time
supabase functions logs stripe-webhook --since 1h

# Search logs
supabase functions logs stripe-webhook | grep "error"
```

### Database Health Queries

```sql
-- Check connection pool
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections
FROM pg_stat_activity;

-- Slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 1000 -- queries > 1 second
ORDER BY mean_time DESC
LIMIT 10;

-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Analytics Dashboard

### Building a Custom Dashboard

**Option 1: Supabase + Metabase**

1. Install Metabase (open-source BI tool)
2. Connect to Supabase PostgreSQL
3. Create dashboards with SQL queries

**Option 2: Custom React Dashboard**

```typescript
// components/AdminDashboard.tsx
interface DashboardMetrics {
  revenue: RevenueMetrics;
  conversion: ConversionMetrics;
  users: UserMetrics;
  performance: PerformanceMetrics;
}

export function AdminDashboard() {
  const metrics = useMetrics();
  
  return (
    <View>
      <MetricCard title="MRR" value={`$${metrics.revenue.mrr}`} />
      <MetricCard title="Conversions" value={`${metrics.conversion.rate}%`} />
      <MetricCard title="Active Users" value={metrics.users.active} />
      <ChurnChart data={metrics.users.churnData} />
    </View>
  );
}
```

### Key Dashboard Views

#### 1. Revenue Dashboard
- MRR trend (line chart)
- Revenue by plan (pie chart)
- New vs churned MRR (bar chart)
- ARPU trend

#### 2. Conversion Dashboard
- Conversion funnel (funnel chart)
- Conversion rate trend (line chart)
- Drop-off points (table)
- Plan selection breakdown

#### 3. Operations Dashboard
- Payment success rate (gauge)
- Webhook processing rate (gauge)
- API response times (histogram)
- Error rate trend (line chart)

#### 4. User Health Dashboard
- Active users trend
- Churn rate
- Tier distribution
- Subscription status breakdown

---

## Alerting Rules

### Critical Alerts (Immediate Response)

```typescript
const criticalAlerts = {
  // Payment system down
  paymentFailureRate: {
    threshold: 50, // %
    window: '5m',
    action: 'page_oncall'
  },
  
  // Webhook processing failed
  webhookFailureRate: {
    threshold: 25, // %
    window: '15m',
    action: 'page_oncall'
  },
  
  // Database errors
  databaseErrors: {
    threshold: 10, // count
    window: '5m',
    action: 'page_oncall'
  }
};
```

### Warning Alerts (Review Within Hours)

```typescript
const warningAlerts = {
  // Elevated payment failures
  paymentFailureRate: {
    threshold: 10, // %
    window: '1h',
    action: 'slack_notification'
  },
  
  // High refund rate
  refundRate: {
    threshold: 10, // %
    window: '24h',
    action: 'email_notification'
  },
  
  // Slow API responses
  p95ResponseTime: {
    threshold: 2000, // ms
    window: '15m',
    action: 'slack_notification'
  }
};
```

### Information Alerts (Daily Review)

```typescript
const infoAlerts = {
  // Daily revenue summary
  dailyRevenue: {
    schedule: 'daily_9am',
    action: 'email_report'
  },
  
  // Weekly conversion report
  weeklyConversions: {
    schedule: 'weekly_monday',
    action: 'email_report'
  },
  
  // Monthly business metrics
  monthlyMetrics: {
    schedule: 'monthly_1st',
    action: 'detailed_report'
  }
};
```

---

## Performance Monitoring

### Application Performance Monitoring (APM)

#### Key Transactions to Monitor

```typescript
// Payment flow
const paymentTransaction = Sentry.startTransaction({
  name: 'payment_flow',
  op: 'payment'
});

const span1 = paymentTransaction.startChild({
  op: 'http',
  description: 'Create Payment Intent'
});
// ... API call
span1.finish();

const span2 = paymentTransaction.startChild({
  op: 'stripe',
  description: 'Confirm Payment'
});
// ... Stripe call
span2.finish();

paymentTransaction.finish();
```

#### Performance Benchmarks

| Operation | Target | Warning | Critical |
|-----------|--------|---------|----------|
| Limit Check | <200ms | <500ms | >1s |
| Payment Init | <1s | <2s | >3s |
| Payment Confirm | <3s | <5s | >10s |
| Webhook Process | <3s | <5s | >10s |
| API Calls | <500ms | <1s | >2s |
| Database Queries | <100ms | <500ms | >1s |

### Real User Monitoring (RUM)

Track user experience metrics:

```typescript
// Page load time
const loadStart = Date.now();
// ... page loads
const loadTime = Date.now() - loadStart;

Sentry.captureMessage('page_load_time', {
  level: 'info',
  extra: { duration: loadTime, page: 'PaymentScreen' }
});

// User interaction time
const interactionStart = Date.now();
// ... user action
const interactionTime = Date.now() - interactionStart;
```

---

## Monitoring Checklist

### Daily Checks
- [ ] Check Stripe Dashboard for any issues
- [ ] Review failed webhooks
- [ ] Check error rate in Sentry
- [ ] Verify payment success rate >95%
- [ ] Review recent support tickets

### Weekly Checks
- [ ] Analyze conversion funnel
- [ ] Review refund requests
- [ ] Check database performance
- [ ] Analyze user feedback
- [ ] Review slow queries

### Monthly Checks
- [ ] Calculate churn rate
- [ ] Analyze revenue trends
- [ ] Review feature usage
- [ ] Update pricing strategy
- [ ] Plan capacity needs

---

**End of Monitoring Setup Guide**