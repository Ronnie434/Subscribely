# Subscription Management Interface Guide

## Overview

The Subscription Management interface provides users with comprehensive control over their premium subscriptions, replacing the previous alert dialog system with a full-featured dedicated screen.

## Features

### 1. Subscription Status Indicator
- **Visual Status Badges**: Active, Paused, Cancelled, Past Due, Trialing, Incomplete
- **Color-Coded**: Green (Active), Yellow (Paused/Trialing), Red (Cancelled/Past Due)
- **Sizes**: Small, Medium, Large
- **Location**: Displayed in subscription header

### 2. Pause/Resume Functionality
- **Pause Duration Options**: 1 Week, 2 Weeks, 1 Month, 2 Months, 3 Months
- **No Billing During Pause**: Users are not charged during the pause period
- **Data Preservation**: All subscription data remains intact
- **Auto-Resume**: Automatically resumes after selected duration
- **Manual Resume**: Users can resume anytime before auto-resume date

### 3. Billing Cycle Switching
- **Switch Between Plans**: Monthly ↔ Yearly
- **Proration Handling**: Automatic credit/charge calculation
- **Savings Display**: Shows percentage saved on yearly plans
- **Instant Switch**: Changes take effect immediately

### 4. Payment Method Management
- **Masked Display**: Shows card brand and last 4 digits (e.g., "Visa •••• 4242")
- **Stripe Portal Integration**: Updates handled through secure Stripe billing portal
- **Link Opens**: Opens Stripe portal in browser for secure updates

### 5. Billing Information Display
- **Current Plan**: Premium tier display
- **Billing Cycle**: Monthly or Yearly
- **Amount**: Current billing amount
- **Next Billing Date**: Clear date display
- **Billing History**: Expandable transaction history

### 6. Cancellation Workflow
- **Two Options**: 
  - Cancel at End of Period (keep access until billing period ends)
  - Cancel Immediately (lose access right away)
- **Clear Communication**: Explains what user will lose
- **Confirmation Required**: Double confirmation to prevent accidental cancellation
- **Data Preservation**: User data remains for potential resubscription

## Navigation Flow

```
Settings Screen
    ↓
Subscription Section
    ↓
"Manage Subscription" Button
    ↓
Subscription Management Screen
    ├── Payment Method Card
    ├── Billing Information
    ├── Pause/Resume Button → Pause Modal
    ├── Switch Billing Cycle → Billing Cycle Modal
    ├── Update Payment → Stripe Portal
    ├── Billing History → Transaction List
    └── Cancel Subscription → Cancel Modal
```

## Component Architecture

### SubscriptionStatusIndicator
```typescript
<SubscriptionStatusIndicator
  status="active" | "paused" | "cancelled" | "past_due" | "trialing" | "incomplete"
  size="small" | "medium" | "large"
  showLabel={true}
/>
```

### PauseSubscriptionModal
```typescript
<PauseSubscriptionModal
  visible={boolean}
  isCurrentlyPaused={boolean}
  onClose={() => void}
  onConfirm={(resumeDate?: Date) => Promise<void>}
/>
```

### SwitchBillingCycleModal
```typescript
<SwitchBillingCycleModal
  visible={boolean}
  currentCycle="monthly" | "yearly"
  onClose={() => void}
  onConfirm={(newCycle: "monthly" | "yearly") => Promise<void>}
/>
```

## Service Methods

### PaymentService

#### Pause Subscription
```typescript
await paymentService.pauseSubscription(resumeDate);
```

#### Resume Subscription
```typescript
await paymentService.resumeSubscription();
```

#### Switch Billing Cycle
```typescript
await paymentService.switchBillingCycle('yearly');
```

#### Get Billing Portal
```typescript
const { url } = await paymentService.getBillingPortalUrl();
Linking.openURL(url);
```

## User Experience Enhancements

### Haptic Feedback (iOS)
- Light impact on button presses
- Medium impact on modal opens
- Success/Error notifications on action completion

### Loading States
- Skeleton loaders during data fetch
- Inline activity indicators for async actions
- Disabled states during processing

### Error Handling
- Graceful error messages
- Retry options for failed operations
- Clear communication of issues

### Accessibility
- Proper accessibility labels
- Keyboard navigation support
- Screen reader compatible
- Color contrast compliance

## Database Schema Updates

### user_subscriptions Table
New fields added:
- `paused_at`: Timestamp when subscription was paused
- `resume_at`: Scheduled resume date
- `billing_cycle`: 'monthly' or 'yearly'

### Status Values
- `active`: Normal active subscription
- `paused`: Temporarily paused
- `cancelled`: Cancelled subscription
- `past_due`: Payment failed
- `trialing`: In trial period
- `incomplete`: Setup not completed

## Best Practices

### 1. Always Show Current State
- Display current subscription status prominently
- Show next billing date clearly
- Indicate any pending changes

### 2. Confirmation for Destructive Actions
- Pause requires confirmation
- Cancel requires double confirmation
- Switch billing cycle shows impact

### 3. Clear Communication
- Explain what happens with each action
- Show proration calculations
- Display savings on yearly plans

### 4. Error Recovery
- Provide retry options
- Show helpful error messages
- Log errors for debugging

### 5. Performance
- Use skeleton loaders
- Cache subscription data
- Minimize API calls

## Testing Checklist

- [ ] Subscription status displays correctly
- [ ] Pause modal shows correct options
- [ ] Resume works from paused state
- [ ] Billing cycle switch calculates proration
- [ ] Payment method displays masked correctly
- [ ] Billing portal opens successfully
- [ ] Billing history loads and displays
- [ ] Cancel modal confirms before cancelling
- [ ] All haptic feedback triggers correctly
- [ ] Loading states show appropriately
- [ ] Error messages are user-friendly
- [ ] Accessibility labels are present
- [ ] Works on both iOS and Android
- [ ] Handles offline scenarios gracefully
- [ ] Data refreshes after actions

## Analytics Events

Track these events for monitoring:
- `subscription_paused`
- `subscription_resumed`
- `billing_cycle_switched`
- `payment_method_updated`
- `billing_history_viewed`
- `subscription_cancelled`
- `cancellation_modal_opened`
- `billing_portal_opened`

## Future Enhancements

- **Subscription History**: Log of all subscription changes
- **Usage Analytics**: Track feature usage during pause
- **Discount Codes**: Apply promotional codes
- **Gift Subscriptions**: Allow gifting premium access
- **Family Plans**: Support multiple users
- **Referral Program**: Earn credits for referrals