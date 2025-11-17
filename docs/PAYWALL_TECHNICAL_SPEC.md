# Paywall System - Technical Specification

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Author**: System Architect
- **Status**: Draft

## Table of Contents
1. [System Overview](#system-overview)
2. [Business Requirements](#business-requirements)
3. [Technical Requirements](#technical-requirements)
4. [Integration Points](#integration-points)
5. [Success Criteria](#success-criteria)
6. [Constraints and Assumptions](#constraints-and-assumptions)

---

## 1. System Overview

### 1.1 Purpose
Implement a subscription-based paywall system to monetize the Smart Subscription Tracker application by offering a free tier with limited functionality and a premium tier with unlimited access.

### 1.2 Scope
This system encompasses:
- Subscription tier management (Free vs Premium)
- Payment processing via Stripe
- Subscription limit enforcement
- Usage tracking and analytics
- Refund and cancellation handling
- Grace period management for failed payments

### 1.3 Technology Stack
- **Frontend**: React Native with TypeScript
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Payment Provider**: Stripe (React Native SDK)
- **Platforms**: iOS and Android

---

## 2. Business Requirements

### 2.1 Subscription Tiers

#### Free Tier
- **Cost**: $0.00
- **Features**:
  - Maximum 5 subscription tracking entries
  - All core tracking functionality
  - Basic statistics
  - Cloud sync across devices
  - Renewal reminders

#### Premium Tier
- **Monthly Plan**: $4.99/month
- **Annual Plan**: $39.00/year (saves $19.88 annually)
- **Features**:
  - Unlimited subscription tracking entries
  - All Free tier features
  - Priority support (future)
  - Advanced analytics (future)

### 2.2 Business Rules

#### BR-001: Subscription Limit Enforcement
- Free tier users MUST be hard-blocked from adding subscriptions once they reach 5 entries
- Premium users have unlimited subscriptions
- Block occurs at creation attempt (before subscription is added to database)

#### BR-002: Downgrade Handling
- Users downgrading from Premium to Free with >5 subscriptions:
  - Keep all existing subscriptions in read-only mode
  - Can view, edit, and delete existing subscriptions
  - Cannot add new subscriptions until count ≤ 4
  - No automatic archiving or data loss

#### BR-003: Refund Policy
- 7-day cancellation window with full refund
- Refunds processed through Stripe
- User retains Premium access until end of billing period after cancellation
- No partial refunds for annual plans after 7 days

#### BR-004: Payment Failure Handling
- Grace period: 3 days for failed payments
- During grace period: User retains Premium access
- After grace period: Automatic downgrade to Free tier
- Email notifications at: failure, day 1, day 2, final day

#### BR-005: Trial Policy
- No free trial period for new users
- New users start on Free tier with 5-subscription limit
- First-time Premium subscribers billed immediately

### 2.3 Pricing Strategy
- Monthly: $4.99/month
- Annual: $39.00/year
- Billing handled by Stripe
- Prices in USD (expandable to other currencies in future)

---

## 3. Technical Requirements

### 3.1 Functional Requirements

#### FR-001: Subscription Limit Checking
```typescript
interface SubscriptionLimitCheck {
  canAddSubscription(): Promise<{
    allowed: boolean;
    currentCount: number;
    limit: number;
    tier: 'free' | 'premium';
  }>;
}
```
- Check performed before showing Add Subscription screen
- Real-time enforcement via client and server-side validation
- Database-level constraints via RLS policies

#### FR-002: Payment Flow
1. User taps "Upgrade to Premium" button
2. Present plan selection screen (Monthly/Annual)
3. Initialize Stripe payment sheet
4. Process payment via Stripe SDK
5. Webhook confirms payment success
6. Update user's subscription status in database
7. Refresh app state to grant Premium access

#### FR-003: Subscription Management
- View current plan and billing cycle
- Upgrade from Free to Premium
- Switch between Monthly and Annual
- Cancel subscription
- Request refund (within 7 days)
- Update payment method

#### FR-004: Analytics Tracking
```typescript
interface PaywallAnalytics {
  // Conversion funnel events
  paywallViewed: (userId: string, trigger: string) => void;
  planSelected: (userId: string, plan: 'monthly' | 'annual') => void;
  paymentInitiated: (userId: string, plan: string) => void;
  paymentCompleted: (userId: string, plan: string, amount: number) => void;
  paymentFailed: (userId: string, plan: string, error: string) => void;
}
```

#### FR-005: Webhook Handlers
Required Stripe webhooks:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`

### 3.2 Non-Functional Requirements

#### NFR-001: Performance
- Subscription limit check: < 200ms
- Payment sheet initialization: < 1s
- Webhook processing: < 3s
- Database queries: < 100ms (95th percentile)

#### NFR-002: Reliability
- Payment processing: 99.9% success rate (excluding user errors)
- Webhook delivery: At-least-once guarantee with idempotency
- Database transactions: ACID compliance
- Zero data loss on payment failures

#### NFR-003: Security
- PCI DSS compliance via Stripe
- Secure token storage using Expo SecureStore
- Encrypted communication (HTTPS/TLS)
- Row-level security on all subscription data
- No storage of payment card details

#### NFR-004: Scalability
- Support 10,000+ concurrent users
- Handle 100+ transactions per minute
- Webhook queue processing with retry logic
- Database connection pooling

---

## 4. Integration Points

### 4.1 Stripe Integration

#### 4.1.1 React Native SDK
```bash
npm install @stripe/stripe-react-native
```

**Components**:
- `StripeProvider`: Wrap app with Stripe context
- `useStripe()`: Hook for payment operations
- Payment Sheet for checkout flow

**Configuration**:
```typescript
const stripe = useStripe();
const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
```

#### 4.1.2 Products and Prices
Stripe Dashboard configuration:
```
Product: "Premium Subscription"
├── Price: "Monthly" - $4.99/month - Recurring
└── Price: "Annual" - $39.00/year - Recurring
```

#### 4.1.3 Customer Management
- Create Stripe Customer on first Premium purchase
- Store Stripe Customer ID in `user_subscriptions.stripe_customer_id`
- Link Supabase user ID to Stripe Customer via metadata

### 4.2 Supabase Integration

#### 4.2.1 Database Schema
Tables:
- `user_subscriptions`: Core subscription status
- `subscription_tiers`: Tier definitions
- `payment_transactions`: Transaction history
- `stripe_webhooks`: Webhook event log
- `refund_requests`: Refund tracking

#### 4.2.2 Edge Functions
```
/supabase/functions/
├── stripe-webhook/         # Handle Stripe events
├── create-payment-intent/  # Initialize payment
├── cancel-subscription/    # Cancel Premium
└── request-refund/         # Process refund requests
```

#### 4.2.3 Authentication
- Leverage existing Supabase Auth
- JWT tokens for API authentication
- RLS policies enforce data access

### 4.3 React Native App Integration

#### 4.3.1 New Screens
```
screens/
├── PaywallScreen.tsx           # Hard paywall display
├── UpgradeScreen.tsx           # Plan selection
├── SubscriptionManageScreen.tsx # Manage current plan
└── RefundRequestScreen.tsx     # Request refund
```

#### 4.3.2 Context Extensions
```typescript
// Extend AuthContext
interface AuthContext {
  user: User;
  subscriptionTier: 'free' | 'premium';
  canAddSubscription: boolean;
  subscriptionCount: number;
  subscriptionLimit: number;
}
```

#### 4.3.3 Service Layer
```
services/
├── paymentService.ts      # Stripe payment operations
├── subscriptionTier.ts    # Tier management
└── analytics.ts           # Paywall analytics
```

---

## 5. Success Criteria

### 5.1 Functional Success Criteria
- [ ] Free users cannot add >5 subscriptions
- [ ] Premium users can add unlimited subscriptions
- [ ] Payment flow completes successfully
- [ ] Webhooks process correctly with idempotency
- [ ] Refunds process within 24 hours
- [ ] Downgrades maintain data integrity
- [ ] Failed payments trigger grace period correctly

### 5.2 Technical Success Criteria
- [ ] Zero payment data stored locally
- [ ] All database operations use RLS policies
- [ ] Webhook events logged for audit trail
- [ ] Payment errors handled gracefully
- [ ] Offline mode degrades gracefully
- [ ] 99.9% uptime for payment processing

### 5.3 User Experience Success Criteria
- [ ] Clear indication of current tier and limits
- [ ] Seamless upgrade flow (< 3 taps)
- [ ] Transparent pricing display
- [ ] Easy cancellation process
- [ ] Immediate access after payment
- [ ] No data loss on tier changes

### 5.4 Business Success Criteria
- [ ] Conversion tracking implemented
- [ ] Revenue tracking accurate
- [ ] Refund rate < 5%
- [ ] Payment failure rate < 2%
- [ ] Support ticket volume manageable

---

## 6. Constraints and Assumptions

### 6.1 Constraints

#### Technical Constraints
- **TC-001**: Must use Stripe for payment processing (PCI compliance)
- **TC-002**: Must work offline for viewing existing data
- **TC-003**: Limited to Supabase Edge Function runtime (Deno)
- **TC-004**: React Native SDK limitations for iOS and Android
- **TC-005**: App Store and Google Play subscription policy compliance

#### Business Constraints
- **BC-001**: No promotional codes in initial release
- **BC-002**: Single currency (USD) initially
- **BC-003**: No family sharing in initial release
- **BC-004**: No lifetime license option
- **BC-005**: Limited to individual subscriptions (no business plans)

### 6.2 Assumptions

#### User Assumptions
- **UA-001**: Users have internet connectivity for payments
- **UA-002**: Users have valid payment methods
- **UA-003**: Users understand subscription model
- **UA-004**: Users primarily use one device

#### Technical Assumptions
- **TA-001**: Stripe webhooks are reliable (99.99% delivery)
- **TA-002**: Supabase has sufficient capacity
- **TA-003**: React Native SDK is stable
- **TA-004**: Database migrations won't cause downtime
- **TA-005**: Edge Functions have <500ms cold start

#### Business Assumptions
- **BA-001**: Pricing is competitive
- **BA-002**: 5-subscription limit is appropriate
- **BA-003**: Users will upgrade for unlimited access
- **BA-004**: Refund policy is acceptable
- **BA-005**: Monthly/Annual pricing ratio is optimal

---

## 7. Risk Assessment

### 7.1 High-Priority Risks

| Risk ID | Description | Probability | Impact | Mitigation |
|---------|-------------|-------------|--------|------------|
| R-001 | Stripe webhook failures | Medium | High | Implement retry logic + manual reconciliation |
| R-002 | Payment fraud | Low | High | Use Stripe Radar for fraud detection |
| R-003 | Database migration issues | Low | High | Test migrations in staging environment |
| R-004 | Race conditions in limit checks | Medium | Medium | Use database transactions + locks |
| R-005 | App Store rejection | Low | High | Follow platform guidelines strictly |

### 7.2 Medium-Priority Risks

| Risk ID | Description | Probability | Impact | Mitigation |
|---------|-------------|-------------|--------|------------|
| R-006 | High refund rate | Medium | Medium | Clear communication + value demonstration |
| R-007 | Poor conversion rate | Medium | Medium | A/B testing + UX optimization |
| R-008 | Stripe API changes | Low | Medium | Version pinning + monitoring changelog |
| R-009 | Edge Function cold starts | High | Low | Pre-warming + caching strategies |
| R-010 | Subscription sync issues | Low | Medium | Robust reconciliation process |

---

## 8. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Hard Paywall** | Complete block preventing action until payment |
| **Soft Paywall** | Prompt with option to dismiss |
| **Grace Period** | Time allowed after payment failure before downgrade |
| **RLS** | Row Level Security (Supabase database security) |
| **Edge Function** | Serverless function running on Supabase infrastructure |
| **Idempotency** | Ensuring duplicate requests have same effect as single request |

### Appendix B: References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Mobile SDK](https://stripe.com/docs/mobile/android)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Native Stripe SDK](https://github.com/stripe/stripe-react-native)
- [App Store Subscription Guidelines](https://developer.apple.com/app-store/subscriptions/)
- [Google Play Billing](https://developer.android.com/google/play/billing)

### Appendix C: Contact Information

- **Technical Lead**: [To be assigned]
- **Product Owner**: [To be assigned]
- **Stripe Support**: https://support.stripe.com
- **Supabase Support**: https://supabase.com/support

---

## Document Control

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-16 | System Architect | Initial draft |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Technical Lead | | | |
| Security Lead | | | |

---

**End of Technical Specification Document**