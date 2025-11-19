# Subscription Management Testing Guide

## Overview

This guide provides comprehensive test cases for all subscription management workflows, covering different subscription states, user scenarios, and edge cases.

## Test Environment Setup

### Prerequisites
- [ ] Test Stripe account configured
- [ ] Test payment methods added
- [ ] Multiple test users with different subscription states
- [ ] Database seeded with test data
- [ ] Analytics service configured (optional)

### Test Users

Create test users in these states:
1. **Free Tier User** - No active subscription
2. **Monthly Premium User** - Active monthly subscription
3. **Yearly Premium User** - Active yearly subscription
4. **Paused Subscription User** - Subscription in paused state
5. **Cancelled Subscription User** - Cancelled subscription
6. **Past Due User** - Payment failed, subscription past due
7. **Trial User** - In trial period

## Test Cases

### 1. Navigation Tests

#### TC-NAV-001: Navigate from Settings to Subscription Management
**Precondition:** User is logged in
**Steps:**
1. Open Settings screen
2. Locate Subscription section
3. Tap "Manage Subscription" or "Upgrade to Premium"
**Expected:** 
- Free users navigate to PlanSelection screen
- Premium users navigate to SubscriptionManagement screen
- Navigation is smooth with no errors
**Status:** ⬜ Pass ⬜ Fail

#### TC-NAV-002: Back Navigation
**Steps:**
1. Navigate to Subscription Management screen
2. Tap back button
**Expected:** Returns to Settings screen
**Status:** ⬜ Pass ⬜ Fail

### 2. Subscription Status Display

#### TC-STATUS-001: Active Status Display
**Precondition:** User has active premium subscription
**Steps:**
1. Open Subscription Management screen
**Expected:**
- Status badge shows "Active" in green
- Correct billing cycle displayed
- Next billing date shown
- Payment method visible (masked)
**Status:** ⬜ Pass ⬜ Fail

#### TC-STATUS-002: Paused Status Display
**Precondition:** User has paused subscription
**Steps:**
1. Open Subscription Management screen
**Expected:**
- Status badge shows "Paused" in yellow
- Resume date displayed
- Resume button visible
**Status:** ⬜ Pass ⬜ Fail

#### TC-STATUS-003: Cancelled Status Display
**Precondition:** User has cancelled subscription
**Steps:**
1. Open Subscription Management screen
**Expected:**
- Status badge shows "Cancelled" in red
- Access end date displayed
- Resubscribe option visible
**Status:** ⬜ Pass ⬜ Fail

### 3. Pause/Resume Functionality

#### TC-PAUSE-001: Pause Subscription - 1 Week
**Precondition:** Active premium subscription
**Steps:**
1. Tap "Pause Subscription"
2. Select "1 Week" option
3. Tap "Pause for 7 Days"
4. Confirm in alert
**Expected:**
- Success toast/message displayed
- Status changes to "Paused"
- Resume date = today + 7 days
- Analytics event tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-PAUSE-002: Pause Subscription - 3 Months
**Precondition:** Active premium subscription
**Steps:**
1. Tap "Pause Subscription"
2. Select "3 Months" option
3. Tap "Pause for 90 Days"
4. Confirm
**Expected:**
- Success message displayed
- Resume date = today + 90 days
- User not charged during pause
**Status:** ⬜ Pass ⬜ Fail

#### TC-PAUSE-003: Resume Paused Subscription
**Precondition:** Paused subscription
**Steps:**
1. Tap "Resume Subscription"
2. Confirm in modal
**Expected:**
- Success message
- Status changes to "Active"
- Billing resumes immediately
- Analytics event tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-PAUSE-004: Cancel During Pause Modal
**Steps:**
1. Open Pause modal
2. Tap "Cancel" button
**Expected:**
- Modal closes
- No changes to subscription
**Status:** ⬜ Pass ⬜ Fail

### 4. Billing Cycle Switching

#### TC-CYCLE-001: Switch from Monthly to Yearly
**Precondition:** Monthly subscription active
**Steps:**
1. Tap "Switch Billing Cycle"
2. Select "Yearly" option
3. Review proration details
4. Tap "Switch to Yearly Billing"
5. Confirm
**Expected:**
- Success message
- Billing cycle updates to "Yearly"
- Proration calculated correctly
- Next charge reflects yearly amount
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-CYCLE-002: Switch from Yearly to Monthly
**Precondition:** Yearly subscription active
**Steps:**
1. Tap "Switch Billing Cycle"
2. Select "Monthly" option
3. Review credit information
4. Tap "Switch to Monthly Billing"
5. Confirm
**Expected:**
- Success message
- Billing cycle updates to "Monthly"
- Credit applied for unused period
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-CYCLE-003: Cancel Billing Cycle Switch
**Steps:**
1. Open billing cycle modal
2. Tap "Keep Current Plan"
**Expected:**
- Modal closes
- No changes made
**Status:** ⬜ Pass ⬜ Fail

### 5. Payment Method Management

#### TC-PAYMENT-001: Open Billing Portal
**Precondition:** Premium subscription
**Steps:**
1. Tap "Update Payment Method"
2. Wait for portal to open
**Expected:**
- Stripe billing portal opens in browser
- User can update payment method
- Returns to app after update
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-PAYMENT-002: Payment Method Display
**Precondition:** Payment method on file
**Steps:**
1. View Subscription Management screen
**Expected:**
- Payment method card visible
- Last 4 digits shown (e.g., "•••• 4242")
- Card brand displayed (Visa, Mastercard, etc.)
**Status:** ⬜ Pass ⬜ Fail

### 6. Billing History

#### TC-HISTORY-001: View Billing History
**Precondition:** User has transaction history
**Steps:**
1. Tap "View Billing History"
2. Review transaction list
**Expected:**
- History expands/shows
- Transactions listed with dates
- Status shown for each (Paid, Failed, Refunded)
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-HISTORY-002: Download Invoice
**Precondition:** Successful payment transaction
**Steps:**
1. Expand billing history
2. Tap "Download Invoice" on transaction
**Expected:**
- Invoice downloaded or opens
**Status:** ⬜ Pass ⬜ Fail

### 7. Subscription Cancellation

#### TC-CANCEL-001: Cancel at End of Period
**Precondition:** Active subscription
**Steps:**
1. Tap "Cancel Subscription"
2. Select "At End of Period"
3. Tap "Confirm Cancellation"
4. Confirm in alert
**Expected:**
- Success message
- Access continues until period end
- Status shows cancellation pending
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-CANCEL-002: Cancel Immediately
**Precondition:** Active subscription
**Steps:**
1. Tap "Cancel Subscription"
2. Select "Cancel Immediately"
3. Tap "Confirm Cancellation"
4. Confirm in alert
**Expected:**
- Success message
- Immediate loss of premium access
- Status changes to "Cancelled"
- Analytics tracked
**Status:** ⬜ Pass ⬜ Fail

#### TC-CANCEL-003: Cancel Cancellation Flow
**Steps:**
1. Open cancel modal
2. Tap "Keep Premium"
**Expected:**
- Modal closes
- Subscription remains active
**Status:** ⬜ Pass ⬜ Fail

### 8. Loading States & Error Handling

#### TC-LOAD-001: Initial Screen Loading
**Steps:**
1. Navigate to Subscription Management
**Expected:**
- Skeleton loaders visible during fetch
- Smooth transition to actual content
**Status:** ⬜ Pass ⬜ Fail

#### TC-ERROR-001: Network Error During Load
**Setup:** Disable network
**Steps:**
1. Navigate to Subscription Management
**Expected:**
- Error message displayed
- Retry option available
**Status:** ⬜ Pass ⬜ Fail

#### TC-ERROR-002: Failed Payment Method Update
**Setup:** Simulate Stripe API failure
**Steps:**
1. Attempt to update payment method
**Expected:**
- Error toast/alert shown
- User-friendly error message
- Option to retry
**Status:** ⬜ Pass ⬜ Fail

#### TC-ERROR-003: Failed Pause Operation
**Setup:** Simulate service failure
**Steps:**
1. Attempt to pause subscription
**Expected:**
- Error displayed
- Subscription state unchanged
- Error logged
**Status:** ⬜ Pass ⬜ Fail

### 9. Accessibility Tests

#### TC-A11Y-001: Screen Reader Navigation
**Setup:** Enable VoiceOver (iOS) or TalkBack (Android)
**Steps:**
1. Navigate through Subscription Management
**Expected:**
- All elements have labels
- Logical reading order
- Status clearly announced
**Status:** ⬜ Pass ⬜ Fail

#### TC-A11Y-002: Keyboard Navigation
**Setup:** External keyboard connected
**Steps:**
1. Navigate using Tab/Arrow keys
**Expected:**
- All interactive elements focusable
- Focus visible
- Can activate with Enter/Space
**Status:** ⬜ Pass ⬜ Fail

#### TC-A11Y-003: Color Contrast
**Steps:**
1. Review all text and UI elements
**Expected:**
- Minimum 4.5:1 contrast ratio for text
- Status colors distinguishable
**Status:** ⬜ Pass ⬜ Fail

### 10. Platform-Specific Tests

#### TC-IOS-001: Haptic Feedback
**Platform:** iOS only
**Steps:**
1. Tap various buttons (pause, cancel, etc.)
**Expected:**
- Appropriate haptic feedback on each tap
- Success/error haptics on completion
**Status:** ⬜ Pass ⬜ Fail

#### TC-IOS-002: Safe Area Handling
**Platform:** iOS with notch
**Steps:**
1. View on device with notch
**Expected:**
- Content not obscured by notch
- Proper spacing around status bar
**Status:** ⬜ Pass ⬜ Fail

#### TC-ANDROID-001: Back Button Behavior
**Platform:** Android
**Steps:**
1. Navigate through modals
2. Press hardware back button
**Expected:**
- Modals close appropriately
- Navigation stack maintained
**Status:** ⬜ Pass ⬜ Fail

### 11. Edge Cases

#### TC-EDGE-001: Rapid Tap Prevention
**Steps:**
1. Rapidly tap "Pause Subscription" multiple times
**Expected:**
- Only one request processed
- Button disabled during operation
**Status:** ⬜ Pass ⬜ Fail

#### TC-EDGE-002: Subscription State Change During View
**Setup:** Subscription expires while viewing
**Steps:**
1. Open screen with active subscription
2. Wait for subscription to expire
**Expected:**
- Screen updates to reflect new state
- User notified of change
**Status:** ⬜ Pass ⬜ Fail

#### TC-EDGE-003: Offline Mode
**Setup:** No internet connection
**Steps:**
1. Attempt any subscription action
**Expected:**
- Offline message displayed
- Actions disabled appropriately
**Status:** ⬜ Pass ⬜ Fail

## Analytics Verification

### Events to Verify

For each action, verify these analytics events are tracked:
- [x] `subscription_paused` - with duration parameter
- [x] `subscription_resumed`
- [x] `billing_cycle_switched` - with from/to parameters
- [x] `payment_method_updated`
- [x] `billing_history_viewed`
- [x] `subscription_cancelled` - with cancellation type
- [x] `pause_modal_opened`
- [x] `billing_cycle_modal_opened`
- [x] `cancellation_modal_opened`
- [x] `billing_portal_opened`
- [x] `subscription_management_viewed`

## Performance Tests

### TC-PERF-001: Screen Load Time
**Expected:** < 2 seconds on 4G connection
**Status:** ⬜ Pass ⬜ Fail

### TC-PERF-002: Modal Animation Smoothness
**Expected:** 60 FPS during modal transitions
**Status:** ⬜ Pass ⬜ Fail

### TC-PERF-003: Memory Usage
**Expected:** No memory leaks during navigation
**Status:** ⬜ Pass ⬜ Fail

## Test Report Template

```
Test Session: [Date]
Tester: [Name]
Device: [Model]
OS Version: [Version]
Build: [Build Number]

Total Tests: __/82
Passed: __
Failed: __
Skipped: __

Critical Issues: __
Major Issues: __
Minor Issues: __

Notes:
[Add any observations or issues found]
```

## Sign-Off Checklist

- [ ] All critical paths tested
- [ ] Error scenarios verified
- [ ] Accessibility compliance confirmed
- [ ] Analytics tracking verified
- [ ] Performance acceptable
- [ ] No blocking issues
- [ ] Documentation updated
- [ ] Test report filed

## Automation Recommendations

Consider automating these high-priority test cases:
1. Navigation flows (TC-NAV-*)
2. Status display validation (TC-STATUS-*)
3. Basic pause/resume (TC-PAUSE-001, TC-PAUSE-003)
4. Billing cycle switching (TC-CYCLE-001, TC-CYCLE-002)
5. Error handling (TC-ERROR-*)

Use frameworks like:
- Detox (React Native)
- Appium
- Maestro