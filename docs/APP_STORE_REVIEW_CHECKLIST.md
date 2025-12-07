# App Store Review Checklist - Apple IAP

Complete preparation guide for App Store submission with In-App Purchases.

## Document Information
- **Version**: 1.0.0
- **Created**: 2025-12-06
- **Phase**: Phase 6 - Testing & Validation
- **Purpose**: Ensure App Store approval on first submission

---

## Table of Contents

1. [Overview](#overview)
2. [App Store Review Guidelines Compliance](#app-store-review-guidelines-compliance)
3. [Required IAP Implementation Elements](#required-iap-implementation-elements)
4. [App Metadata Requirements](#app-metadata-requirements)
5. [TestFlight Beta Testing](#testflight-beta-testing)
6. [Review Notes for Apple](#review-notes-for-apple)
7. [Common Rejection Reasons & Mitigation](#common-rejection-reasons--mitigation)
8. [Pre-Submission Checklist](#pre-submission-checklist)

---

## Overview

### Apple's IAP Requirements

Apps offering digital content or services must use **Apple In-App Purchase** exclusively. This includes:
- ✅ Subscriptions (your implementation)
- ✅ Premium features
- ✅ Digital content
- ❌ NO external payment links
- ❌ NO Stripe/other payment mentions on iOS

### Review Timeline

**Typical Timeline**:
- Submit → 24-48 hours → Under Review
- Review → 24-48 hours → Approved/Rejected
- **Total**: 2-4 days (first submission)

**Expedited Review**: Available for critical bug fixes only

---

## App Store Review Guidelines Compliance

### Guideline 3.1: In-App Purchase

#### 3.1.1 - In-App Purchase (REQUIRED)

**Requirement**: Apps offering digital goods or services must use Apple IAP.

**Your Implementation**:
- ✅ Subscriptions use Apple IAP on iOS
- ✅ No external payment processing on iOS
- ✅ Stripe removed from iOS build
- ✅ Digital content (unlimited tracking) via IAP

**Verification**:
```typescript
// PaymentScreen.tsx or PaywallModal.tsx
if (Platform.OS === 'ios') {
  // Apple IAP only
  await appleIAPService.purchaseSubscription(productId);
} else {
  // Other platforms can use Stripe
  await handleStripePayment();
}
```

#### 3.1.2 - Subscriptions (REQUIRED)

**Requirement**: Auto-renewable subscriptions must:
- Clearly state subscription terms
- Display price and billing period
- Show auto-renewal disclosure
- Provide cancellation instructions

**Your Implementation Checklist**:
- [ ] Subscription terms clearly visible in [`PaywallModal`](../components/PaywallModal.tsx)
- [ ] Price displayed: "$4.99/month" or "$39.99/year"
- [ ] Auto-renewal disclosure present
- [ ] Link to subscription management in App Store
- [ ] "Restore Purchases" button visible

**Required Disclosures**:
```
• Payment will be charged to iTunes Account at confirmation of purchase
• Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period
• Account will be charged for renewal within 24 hours prior to the end of the current period
• Subscriptions may be managed by the user and auto-renewal may be turned off by going to the user's Account Settings after purchase
• Links to Privacy Policy and Terms of Use
```

#### 3.1.3 - Other Purchase Methods (FORBIDDEN)

**Requirement**: NO external payment methods or links to website payment.

**Your Compliance**:
- [ ] No "Buy on web" buttons on iOS
- [ ] No Stripe payment forms on iOS
- [ ] No external URLs for payment
- [ ] No mentions of "cheaper on web"
- [ ] No email signup links that lead to payment

**Common Violations to Avoid**:
- ❌ "Subscribe on our website for less"
- ❌ "Upgrade at [website]"
- ❌ Links to external subscription management
- ❌ Email prompts for external purchase

#### 3.1.5 - Cryptocurrency (Not Applicable)

Not relevant to your app.

### Guideline 2.1: App Completeness

#### 2.1 - Performance (REQUIRED)

**Requirement**: App must be complete, functional, and ready for review.

**Your Checklist**:
- [ ] All features functional (no "Coming Soon" placeholders)
- [ ] No crashes or major bugs
- [ ] Tested on latest iOS version
- [ ] Works in both portrait and landscape (if supported)
- [ ] No placeholder content or Lorem Ipsum text

#### 2.3 - Accurate Metadata (REQUIRED)

**Requirement**: Screenshots and descriptions must accurately reflect the app.

**Your Checklist**:
- [ ] Screenshots show actual app interface
- [ ] Description matches functionality
- [ ] No misleading claims
- [ ] Privacy policy accessible

### Guideline 5.1: Privacy

#### 5.1.1 - Privacy Policy (REQUIRED)

**Requirement**: Apps that collect data must have privacy policy.

**Your Checklist**:
- [ ] Privacy policy publicly accessible
- [ ] URL provided in App Store Connect
- [ ] Policy includes IAP data collection
- [ ] Policy covers Supabase data storage
- [ ] Policy mentions Apple transaction data

**Privacy Policy URL**: Provide in App Store Connect

**Sample Privacy Additions for IAP**:
```
## In-App Purchases

When you make a purchase through Apple In-App Purchase, we collect:
- Transaction ID (from Apple)
- Product ID purchased
- Purchase date and expiration date
- Subscription status

This data is used to verify your subscription and provide premium features.
We do not store your payment information - this is handled securely by Apple.
```

#### 5.1.2 - Data Use and Sharing (REQUIRED)

**Requirement**: Disclose data collection practices in App Store Connect.

**Your Configuration**:

**Data Types Collected**:
- [ ] Contact Info: Email address (for account)
- [ ] Identifiers: User ID (Supabase auth)
- [ ] Purchases: Transaction history (IAP)
- [ ] User Content: Subscription data

**Data Use**:
- [ ] App Functionality
- [ ] Analytics
- [ ] Product Personalization

**Data Linked to User**: Yes
**Data Used for Tracking**: No

---

## Required IAP Implementation Elements

### 1. Restore Purchases Button (REQUIRED)

**Location**: Settings screen or subscription management

**Implementation Checklist**:
- [ ] "Restore Purchases" button visible and accessible
- [ ] Button functions correctly
- [ ] Success/failure messages shown
- [ ] Handles no-purchase scenario gracefully

**Code Reference**: [`settings screen`](../screens/SettingsScreen.tsx) or [`PaywallModal`](../components/PaywallModal.tsx)

**Example Implementation**:
```typescript
<TouchableOpacity onPress={handleRestorePurchases}>
  <Text>Restore Purchases</Text>
</TouchableOpacity>
```

**Testing**:
- Tap button with active purchase → Success message
- Tap button with no purchase → "No purchases found" message

---

### 2. Subscription Terms Display (REQUIRED)

**Location**: Before purchase, during payment flow

**Required Elements**:
- [ ] Monthly subscription: "$4.99 per month"
- [ ] Yearly subscription: "$39.99 per year"
- [ ] Auto-renewal disclosure
- [ ] Billing period clearly stated
- [ ] Cancellation instructions link

**Example Layout** (in [`PaywallModal`](../components/PaywallModal.tsx)):
```typescript
<View>
  <Text style={styles.price}>$4.99/month</Text>
  <Text style={styles.terms}>
    • Subscription renews automatically
    • Cancel anytime in App Store settings
    • Payment charged to iTunes Account
  </Text>
  <TouchableOpacity onPress={openSubscriptionManagement}>
    <Text>Manage Subscription →</Text>
  </TouchableOpacity>
</View>
```

---

### 3. Subscription Management Link (REQUIRED)

**Requirement**: Link to Apple's subscription management.

**Implementation**:
```typescript
import { Linking } from 'react-native';

const openSubscriptionManagement = () => {
  Linking.openURL('https://apps.apple.com/account/subscriptions');
};
```

**Location**: 
- [ ] Settings screen
- [ ] Subscription details page
- [ ] After successful purchase

---

### 4. Auto-Renewal Disclosure (REQUIRED)

**Requirement**: Must clearly state subscription auto-renews.

**Placement**: Near purchase button

**Example Text**:
```
Your subscription will automatically renew unless cancelled at least 
24 hours before the end of the current period. Manage or cancel your 
subscription in App Store settings.
```

**Visibility**: 
- [ ] Readable font size (minimum 9pt)
- [ ] Sufficient contrast
- [ ] Not hidden behind scroll

---

### 5. Terms of Service (REQUIRED)

**Requirement**: Link to Terms of Service must be accessible.

**Implementation**:
- [ ] Link in app settings
- [ ] Link in paywall/purchase screen
- [ ] Terms include subscription-specific clauses

**URL**: Provide publicly accessible URL

**Required Subscription Terms**:
- Subscription duration
- Automatic renewal
- Pricing
- Refund policy (Apple's policy)
- Cancellation instructions

---

### 6. Privacy Policy Link (REQUIRED)

**Requirement**: Must be accessible from app and App Store.

**Locations**:
- [ ] App Store Connect: Privacy Policy URL field
- [ ] In-app: Settings screen
- [ ] In-app: Sign-up screen
- [ ] In-app: Before purchase

---

## App Metadata Requirements

### App Store Connect Configuration

#### 1. App Information

**Name**: 
```
Renvo - Subscription Tracker
```
(30 characters max)

**Subtitle** (Optional):
```
Track Monthly Expenses
```
(30 characters max)

**Category**:
- Primary: **Finance**
- Secondary: **Productivity** (optional)

#### 2. Pricing and Availability

**Price**: Free (in-app purchases)

**Availability**: All territories (175+ countries)

**In-App Purchases**:
- [ ] Monthly Premium: $4.99
- [ ] Yearly Premium: $39.99

#### 3. App Description

See [`APP_STORE_SUBMISSION.md`](APP_STORE_SUBMISSION.md) for complete description.

**Key Points to Include**:
- Subscription management features
- Unlimited tracking (premium feature)
- Renewal reminders
- Analytics and insights
- NO external payment mentions

#### 4. Keywords

```
subscription,tracker,budget,expense,finance,recurring,bills,monthly,payment,manager
```
(100 characters max)

**Optimization Tips**:
- Include "subscription" (primary)
- Include "tracker" (primary)
- No duplicate words
- No app names
- Comma-separated, no spaces after commas

#### 5. Screenshots (REQUIRED)

**Required Sizes**:
- iPhone 6.7" (1290 x 2796) - **REQUIRED**
- iPhone 6.5" (1284 x 2778) - **REQUIRED**

**Recommended Sequence**:
1. Home screen showing subscriptions
2. Paywall with IAP pricing (IMPORTANT)
3. Subscription details
4. Statistics/analytics
5. Settings with "Restore Purchases"

**Guidelines**:
- Show actual app interface
- Include subscription purchase screen
- Show "Restore Purchases" button
- Clean, professional data
- High resolution, no blur

#### 6. App Preview Video (Optional)

**Recommended**: 20-30 second video

**Content**:
- Show subscription management
- Demonstrate IAP purchase flow
- Highlight premium features
- Show restore purchases

---

## TestFlight Beta Testing

### Internal Testing (REQUIRED)

**Purpose**: Verify everything works before external testing.

**Duration**: 1-2 days

**Checklist**:
- [ ] Build uploaded to TestFlight
- [ ] Internal testers invited
- [ ] All team members test
- [ ] IAP purchases tested
- [ ] No critical bugs found

**Team Size**: 25-100 internal testers (Apple Developer team members)

### External Testing (RECOMMENDED)

**Purpose**: Get user feedback on purchase flow.

**Duration**: 3-7 days

**Checklist**:
- [ ] External testers invited (up to 10,000)
- [ ] Beta App Review passed (24-48 hours)
- [ ] Feedback collected
- [ ] Purchase flow validated
- [ ] Cross-device testing completed

**Focus Areas**:
- Purchase completion rate
- UI/UX feedback
- Subscription restoration
- Performance on various iOS versions

### Beta Testing Feedback Collection

**Questions for Testers**:
1. Was the purchase process clear?
2. Did you understand the subscription terms?
3. Was the pricing transparent?
4. Did "Restore Purchases" work?
5. Any confusing elements?

---

## Review Notes for Apple

### Demo Account (REQUIRED)

Apple reviewers need a working test account.

**Account Details to Provide**:
```
Username: reviewer@renvo-test.com
Password: [secure password]

Instructions:
1. Launch app and sign in with above credentials
2. Tap "Upgrade to Premium" to access paywall
3. Choose "Monthly" or "Yearly" subscription
4. Use sandbox test account for purchase:
   - Apple ID: [sandbox email]
   - Password: [sandbox password]
5. Purchase will complete in sandbox mode
6. Premium features will unlock immediately
```

**Important Notes for Reviewers**:
```
• App uses Apple In-App Purchase for subscriptions
• Receipt validation handled server-side via Supabase
• Subscriptions can be managed in App Store settings
• "Restore Purchases" button available in Settings
• All purchases in review are in sandbox environment
```

### Explaining Your Implementation

**Server-Side Validation Note**:
```
Note to Reviewer:
Subscription validation is performed server-side using Apple's 
App Store Server API. After purchase, receipts are validated 
with Apple's servers and subscription status is updated in our 
Supabase database. This ensures security and prevents fraud.

Webhook URL configured: https://[project].supabase.co/functions/v1/apple-webhook
```

**Dual-Provider Context** (if needed):
```
Note: This app supports multiple platforms. On iOS, all 
subscriptions use Apple In-App Purchase exclusively. Web 
and Android versions (if applicable) may use alternative 
payment methods per platform requirements.
```

### Features Requiring Explanation

**1. Unlimited Tracking Feature**:
```
Premium subscription unlocks unlimited recurring item tracking.
Free tier limited to 3 items. This is digital content requiring IAP.
```

**2. Restore Purchases**:
```
Users can restore previous purchases by tapping "Restore Purchases" 
in Settings. This syncs subscription across devices using the same 
Apple ID.
```

**3. Subscription Management**:
```
Users manage subscriptions through App Store settings. A direct 
link is provided in-app. Cancellations are processed by Apple.
```

---

## Common Rejection Reasons & Mitigation

### Rejection 1: Missing "Restore Purchases"

**Reason**: Guideline 3.1.1 - Must provide way to restore purchases

**Mitigation**:
- [ ] Add visible "Restore Purchases" button
- [ ] Place in Settings or Subscription screen
- [ ] Test functionality thoroughly
- [ ] Include in screenshots

**Response to Reviewer** (if rejected):
```
We have added a "Restore Purchases" button in the Settings 
screen (Screenshot #5). The feature has been tested and successfully 
restores subscriptions across devices.
```

---

### Rejection 2: Confusing Subscription Terms

**Reason**: Guideline 3.1.2 - Terms not clear enough

**Mitigation**:
- [ ] Use plain language
- [ ] Display price prominently
- [ ] State billing period clearly
- [ ] Show auto-renewal disclosure
- [ ] Add cancellation instructions

**Required Elements**:
```
✅ "$4.99 per month" (not just "$4.99")
✅ "Renews automatically"
✅ "Cancel in App Store settings"
✅ "Charged to iTunes Account"
```

---

### Rejection 3: External Payment Links

**Reason**: Guideline 3.1.3 - External payment methods not allowed

**Mitigation**:
- [ ] Remove ALL Stripe references on iOS
- [ ] No "Buy on website" buttons
- [ ] No external subscription links
- [ ] Platform-specific code:
```typescript
{Platform.OS !== 'ios' && (
  <Button onPress={openWebsite}>Visit Website</Button>
)}
```

---

### Rejection 4: Non-Functional in Review

**Reason**: Guideline 2.1 - App doesn't work during review

**Mitigation**:
- [ ] Provide working demo account
- [ ] Ensure server-side validation works in production
- [ ] Verify webhook URL accessible
- [ ] Test with multiple sandbox accounts
- [ ] Include clear test instructions

**Verification Steps** (before submission):
```bash
# Test receipt validation endpoint
curl -X POST https://[project].supabase.co/functions/v1/validate-apple-receipt \
  -H "Authorization: Bearer [token]" \
  -d '{"receiptData":"test","userId":"test"}'

# Test webhook endpoint
curl -X POST https://[project].supabase.co/functions/v1/apple-webhook \
  -H "Content-Type: application/json" \
  -d '{"signedPayload":"test"}'
```

---

### Rejection 5: Privacy Policy Issues

**Reason**: Guideline 5.1.1 - Missing or inadequate privacy policy

**Mitigation**:
- [ ] Privacy policy publicly accessible
- [ ] Covers IAP data collection
- [ ] Mentions Apple transaction data
- [ ] Includes third-party services (Supabase)
- [ ] Clear data usage explanation

**Required Sections**:
- What data is collected
- How data is used
- Data storage (Supabase)
- User rights
- Contact information

---

### Rejection 6: Misleading Screenshots

**Reason**: Guideline 2.3.3 - Screenshots don't reflect app

**Mitigation**:
- [ ] Use actual app interface
- [ ] No mockups or concept designs
- [ ] Show real features, not "coming soon"
- [ ] Match current build functionality
- [ ] Include subscription purchase screen

---

## Pre-Submission Checklist

### IAP Configuration (App Store Connect)

- [ ] Monthly subscription product created and approved
- [ ] Yearly subscription product created and approved
- [ ] Products in "Ready to Submit" state
- [ ] Subscription group configured
- [ ] Pricing set for all territories
- [ ] Localization completed
- [ ] Tax category selected

### Code Implementation

- [ ] [`appleIAPService.ts`](../services/appleIAPService.ts) fully implemented
- [ ] Receipt validation working (test with sandbox)
- [ ] Webhook handler deployed and tested
- [ ] Database migration executed
- [ ] "Restore Purchases" button functional
- [ ] Subscription terms displayed
- [ ] No Stripe references on iOS
- [ ] Error handling tested

### Backend & Database

- [ ] Supabase functions deployed:
  - validate-apple-receipt
  - apple-webhook
- [ ] Environment variables set:
  - APPLE_APP_BUNDLE_ID
  - APPLE_SHARED_SECRET
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- [ ] Database tables created:
  - apple_transactions
  - profiles (with Apple fields)
- [ ] Webhook URL configured in App Store Connect
- [ ] Database functions created:
  - record_apple_transaction
  - update_user_apple_subscription

### Testing Completed

- [ ] Sandbox testing completed (see [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md))
- [ ] All 50+ test scenarios passed
- [ ] Purchase flow tested on multiple devices
- [ ] Restoration tested
- [ ] Receipt validation verified
- [ ] Webhooks tested
- [ ] Edge cases handled

### App Metadata

- [ ] App name finalized (30 chars)
- [ ] Subtitle written (30 chars)
- [ ] Description complete (4000 chars max)
- [ ] Keywords optimized (100 chars)
- [ ] Screenshots prepared (6.7" and 6.5")
- [ ] App preview video (optional)
- [ ] App icon (1024x1024)
- [ ] Category selected (Finance)

### Legal & Compliance

- [ ] Privacy policy publicly accessible
- [ ] Privacy policy URL added to App Store Connect
- [ ] Terms of Service available
- [ ] Subscription terms included in ToS
- [ ] In-app privacy policy link
- [ ] In-app terms of service link

### TestFlight

- [ ] Internal testing completed
- [ ] External testing completed (recommended)
- [ ] Feedback collected and addressed
- [ ] Beta App Review passed
- [ ] No critical bugs reported

### Review Notes

- [ ] Demo account created and tested
- [ ] Sandbox account credentials documented
- [ ] Step-by-step instructions written
- [ ] Server-side validation explained
- [ ] Feature explanations prepared

### Build

- [ ] Build uploaded to App Store Connect
- [ ] Build processed successfully
- [ ] Version number incremented
- [ ] Build notes added
- [ ] App Store Connect shows "Ready for Review"

### Final Verification

- [ ] All features working on latest iOS
- [ ] No crashes or critical bugs
- [ ] Tested on iPhone and iPad (if supported)
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Launch time < 3 seconds

---

## Submission Process

### Step 1: Upload Build

```bash
# Build for App Store
eas build --platform ios --profile production

# Or using Xcode
# Product → Archive → Distribute App
```

### Step 2: Complete App Store Connect

1. Select build
2. Add screenshots
3. Fill in all metadata
4. Add review notes
5. Select rating
6. Submit for review

### Step 3: Wait for Review

**Timeline**:
- Waiting for Review: 24-48 hours
- In Review: 24-48 hours
- Total: 2-4 days average

**Status Updates**:
- "Waiting for Review"
- "In Review"
- "Pending Developer Release" (approved!)
- OR "Rejected" (with reasons)

### Step 4: If Rejected

1. **Read rejection reasons carefully**
2. **Check Resolution Center in App Store Connect**
3. **Fix issues mentioned**
4. **Test thoroughly**
5. **Reply to reviewer or resubmit**

**Response Template**:
```
Thank you for your feedback. We have addressed the issue:

[Specific changes made]

The [feature/button/disclosure] is now visible in [location].
Please see Screenshot #[X] showing the implementation.

We have tested this thoroughly and confirmed it meets guideline [X.X.X].

Thank you for your time reviewing our app.
```

### Step 5: Release

**Options after approval**:
1. **Automatic Release**: App goes live immediately
2. **Manual Release**: You choose when to release
3. **Scheduled Release**: Set specific date/time

**Recommendation**: Manual release for first version

---

## Post-Approval Tasks

### Immediate (Day 1)

- [ ] Announce launch on social media
- [ ] Update website with App Store link
- [ ] Send email to beta testers thanking them
- [ ] Monitor App Store reviews
- [ ] Check analytics for adoption

### Week 1

- [ ] Monitor subscription conversion rate
- [ ] Track IAP revenue in App Store Connect
- [ ] Check for user-reported issues
- [ ] Respond to App Store reviews
- [ ] Verify webhooks processing correctly

### Month 1

- [ ] Analyze subscription metrics
- [ ] Review churn rate
- [ ] Plan improvements based on feedback
- [ ] Consider promotional offers
- [ ] Update screenshots if needed

---

## Resources

### Apple Documentation

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [In-App Purchase Guidelines](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)
- [TestFlight Beta Testing](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

### Internal Resources

- [`SANDBOX_TESTING_GUIDE.md`](SANDBOX_TESTING_GUIDE.md) - Complete testing procedures
- [`AUTOMATED_TESTING_PLAN.md`](AUTOMATED_TESTING_PLAN.md) - Test suite documentation
- [`APP_STORE_SUBMISSION.md`](APP_STORE_SUBMISSION.md) - Metadata guide
- [`TESTING_EXECUTION_GUIDE.md`](TESTING_EXECUTION_GUIDE.md) - Day-by-day schedule

---

## Emergency Contacts

**If Issues During Review**:
1. Check App Store Connect Resolution Center
2. Review rejection reasons
3. Fix issues and resubmit
4. Use "Reply to App Review" if needed

**Apple Developer Support**:
- https://developer.apple.com/contact/
- Phone support for urgent issues

---

## Checklist Summary

Quick reference for submission day:

```
✅ IAP products approved in App Store Connect
✅ All code tested in sandbox
✅ "Restore Purchases" button visible
✅ Subscription terms clearly stated
✅ Privacy policy accessible
✅ Screenshots show IAP functionality
✅ Demo account provided
✅ TestFlight testing completed
✅ Build uploaded and processed
✅ All metadata complete
✅ Ready for review!
```

---

**Version History**:
- v1.0.0 (2025-12-06): Initial App Store review checklist