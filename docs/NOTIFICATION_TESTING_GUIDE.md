# Notification Testing Guide

## Overview

This guide provides comprehensive testing procedures for the local notification system in the Renvo subscription tracking application. The app uses expo-notifications to deliver renewal reminders 24 hours before a subscription renews at 9:00 AM local time.

## Pre-Testing Setup

### Device Requirements

#### iOS
- **Minimum Version**: iOS 13.0+
- **Recommended**: iOS 15.0+ for full notification features
- **Physical Device Required**: Yes (simulator has limited notification support)
- **Test Devices**: Test on both newer (iOS 16+) and older (iOS 13-14) devices if possible

#### Android
- **Minimum Version**: Android 8.0 (API 26)+
- **Recommended**: Android 11+ for full notification channel support
- **Physical Device Required**: Yes (emulator notifications may behave differently)
- **Test Devices**: Test on multiple Android versions (8-14) due to OS behavior differences

### Build Configuration

#### Development Build

```bash
# Install dependencies
npm install

# iOS - Development build
npx expo run:ios --device

# Android - Development build
npx expo run:android --device
```

#### Production Build (for final testing)

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### Environment Setup

1. **Enable Notifications Permissions**
   - Fresh install for permission testing
   - Reset permissions: Settings > Apps > Renvo > Permissions

2. **Configure Test Data**
   - Create subscriptions with various renewal dates
   - Use dates that allow for notification scheduling (tomorrow or later)

3. **Enable Debug Logging**
   - Check terminal/console for notification logs
   - Look for log patterns: `📅 Scheduling notification...`, `✅ Scheduled notification...`

4. **Time Management**
   - Note your device's current time and timezone
   - For faster testing, consider creating subscriptions that renew tomorrow

## Test Scenarios

### Priority 1: Critical Path Tests

#### TC-01: Basic Notification Scheduling
**Priority**: P0 (Must Pass)
**Description**: Verify notification is scheduled when creating a new subscription with reminders enabled

**Test Data**:
- Subscription name: "Netflix"
- Cost: $15.99
- Billing cycle: Monthly
- Renewal date: Tomorrow's date
- Reminders: Enabled

#### TC-02: Permission Grant Flow
**Priority**: P0 (Must Pass)
**Description**: Verify app properly requests and handles notification permissions

#### TC-03: Notification Delivery
**Priority**: P0 (Must Pass)
**Description**: Verify notification appears at the correct time with correct content

### Priority 2: Feature Complete Tests

#### TC-04: Permission Denial Handling
**Priority**: P1 (Should Pass)
**Description**: Verify app handles permission denial gracefully

#### TC-05: Toggle Reminders Off
**Priority**: P1 (Should Pass)
**Description**: Verify notification is cancelled when user disables reminders

#### TC-06: Edit Subscription with Reminder
**Priority**: P1 (Should Pass)
**Description**: Verify notification is rescheduled when subscription details change

#### TC-07: Delete Subscription
**Priority**: P1 (Should Pass)
**Description**: Verify notification is cancelled when subscription is deleted

### Priority 3: Edge Cases

#### TC-08: Same-Day Renewal
**Priority**: P2 (Nice to Have)
**Description**: Verify no notification is scheduled for subscriptions renewing today

#### TC-09: Past Renewal Date
**Priority**: P2 (Nice to Have)
**Description**: Verify no notification is scheduled for past dates

#### TC-10: Multiple Subscriptions
**Priority**: P2 (Nice to Have)
**Description**: Verify multiple notifications can be scheduled simultaneously

#### TC-11: Background App State
**Priority**: P2 (Nice to Have)
**Description**: Verify notifications work when app is in background

#### TC-12: App Force Quit
**Priority**: P2 (Nice to Have)
**Description**: Verify notifications persist after force quitting the app

## Testing Procedures

### TC-01: Basic Notification Scheduling

#### Setup
1. Fresh install of the app or clear app data
2. Create a new user account or login
3. Ensure device time is accurate

#### Test Steps
1. Navigate to "Add Subscription" screen
2. Fill in subscription details:
   - Name: "Netflix"
   - Cost: $15.99
   - Billing frequency: Monthly
   - Enable "Set Renewal Date" toggle
   - Select tomorrow's date
   - Verify "Renewal Reminders" toggle is ON
3. Tap "Add Recurring Item" button
4. Wait for save confirmation
5. Check console logs for scheduling confirmation

#### Expected Results
- ✅ Subscription is saved successfully
- ✅ Console shows: `📅 Scheduling notification for Netflix...`
- ✅ Console shows: `✅ Scheduled notification for Netflix`
- ✅ Console shows notification ID and trigger time
- ✅ Trigger time is tomorrow at 9:00 AM local time
- ✅ No error messages in console

#### Verification Commands

```javascript
// Add to console or debug script
import * as Notifications from 'expo-notifications';

// Check all scheduled notifications
const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
console.log('Scheduled notifications:', scheduledNotifications);

// Expected output: Array with 1 notification for Netflix
// Trigger should be tomorrow at 9:00 AM
```

---

### TC-02: Permission Grant Flow

#### Setup
1. Fresh install or reset app permissions
2. Open Settings > Apps > Renvo > Permissions > Notifications: OFF

#### Test Steps
1. Launch the app
2. Observe the permission request prompt
3. Tap "Allow" on the permission dialog
4. Check console for permission confirmation

#### Expected Results (iOS)
- ✅ Permission alert appears on first launch
- ✅ Alert shows custom message about renewal reminders
- ✅ Console shows: `Notification permissions granted`
- ✅ Console shows Android channel setup (N/A for iOS)

#### Expected Results (Android)
- ✅ Permission request appears (Android 13+)
- ✅ Console shows: `Notification permissions granted`
- ✅ Console shows: Channel 'subscription-reminders' created
- ✅ Channel has HIGH importance
- ✅ Vibration pattern configured: [0, 250, 250, 250]

---

### TC-03: Notification Delivery

#### Setup
1. Complete TC-01 successfully
2. Set device time forward to test faster (optional, risky)
3. OR wait for actual notification time (recommended)

#### Test Steps - Real-Time Testing (Recommended)
1. Schedule subscription to renew at a time you can test (e.g., 2 hours from now)
2. Set trigger for 1 hour from now by adjusting renewal date
3. Keep device screen locked but charged
4. Wait for notification time
5. Observe notification appearance

#### Test Steps - Time Manipulation (Use with Caution)
1. Create subscription renewing tomorrow
2. Close app completely
3. **iOS**: Settings > General > Date & Time > Set Manually
4. **Android**: Settings > System > Date & Time > Set Manually
5. Advance time to tomorrow 9:00 AM
6. Wait 30 seconds for notification to trigger

#### Expected Results
- ✅ Notification appears at exactly 9:00 AM local time
- ✅ Notification title: "Subscription Renews Tomorrow"
- ✅ Notification body: "Your Netflix subscription ($15.99) renews tomorrow on [date]"
- ✅ Notification sound plays
- ✅ Badge count increases (iOS)
- ✅ Notification vibrates (Android)

#### Foreground Notification Handling
1. Keep app open and in foreground
2. Wait for notification time
3. Verify notification appears as banner/alert

**Expected Results**:
- ✅ Notification appears as banner at top (iOS)
- ✅ Notification appears as heads-up (Android)
- ✅ Sound plays
- ✅ Can tap to dismiss

#### Background Notification Handling
1. Send app to background (home button)
2. Wait for notification time
3. Verify notification appears in notification center

**Expected Results**:
- ✅ Notification appears in notification center
- ✅ App badge updates (iOS)
- ✅ Can tap notification to open app

---

### TC-04: Permission Denial Handling

#### Setup
1. Fresh install or reset permissions
2. Ensure notifications are not yet granted

#### Test Steps
1. Launch app
2. When permission prompt appears, tap "Don't Allow" (iOS) or "Deny" (Android)
3. Create a new subscription with reminders enabled
4. Check console logs
5. Try toggling reminders on/off

#### Expected Results
- ✅ App continues to function normally
- ✅ No crash or error dialogs
- ✅ Console shows: `Notification permissions not granted`
- ✅ Subscription saves successfully
- ✅ `notificationId` field is undefined/null
- ✅ Toggle works but no notification scheduled
- ✅ No error messages visible to user

#### Re-granting Permissions
1. Go to device Settings > Apps > Renvo > Notifications
2. Enable notifications
3. Reopen app
4. Edit existing subscription
5. Verify notification now schedules

---

### TC-05: Toggle Reminders Off

#### Setup
1. Create subscription with reminders enabled
2. Verify notification is scheduled (check console)

#### Test Steps
1. Navigate to subscription list
2. Tap on the subscription to edit
3. Toggle "Renewal Reminders" switch to OFF
4. Tap "Save Changes"
5. Check console for cancellation message

#### Expected Results
- ✅ Toggle animates to OFF position
- ✅ Subscription updates successfully
- ✅ Console shows: `Cancelled notification with ID: [id]`
- ✅ `notificationId` is cleared from subscription
- ✅ No notification delivered at scheduled time

#### Verification Command

```javascript
// Check scheduled notifications
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
console.log('Remaining notifications:', scheduled);
// Should not include the cancelled subscription
```

---

### TC-06: Edit Subscription with Reminder

#### Setup
1. Create subscription renewing in 2 days
2. Verify initial notification is scheduled

#### Test Steps
1. Edit the subscription
2. Change renewal date to 3 days from now
3. Keep reminders enabled
4. Save changes
5. Check console logs

#### Expected Results
- ✅ Console shows: `Cancelled old notification for [name]`
- ✅ Console shows: `Rescheduled notification for [name], new ID: [new-id]`
- ✅ New notification scheduled for 9:00 AM, 2 days from now
- ✅ Old notification ID replaced with new one
- ✅ Original notification no longer appears

---

### TC-07: Delete Subscription

#### Setup
1. Create subscription with reminders enabled
2. Note the notification ID from console

#### Test Steps
1. Navigate to subscription list
2. Delete the subscription (swipe left or delete button)
3. Confirm deletion
4. Check console for notification cancellation

#### Expected Results
- ✅ Subscription deleted from list
- ✅ Console shows: `Cancelled notification with ID: [id]`
- ✅ Notification no longer scheduled
- ✅ Database record removed
- ✅ No notification appears at the scheduled time

---

### TC-08: Same-Day Renewal

#### Setup
1. Current time: Any time before 9:00 AM
2. Prepare to create subscription renewing today

#### Test Steps
1. Create new subscription
2. Set renewal date to TODAY
3. Enable reminders
4. Save subscription
5. Check console logs

#### Expected Results
- ✅ Subscription saves successfully
- ✅ Console shows: `❌ Renewal date for [name] is today or in the past, skipping notification`
- ✅ No notification scheduled
- ✅ `notificationId` is null/undefined
- ✅ No error to user (silent skip)

---

### TC-09: Past Renewal Date

#### Setup
1. Prepare to create subscription with past date

#### Test Steps
1. Create new subscription
2. Set renewal date to yesterday or earlier
3. Enable reminders
4. Save subscription
5. Check console logs

#### Expected Results
- ✅ Subscription saves successfully
- ✅ Console shows: `❌ Renewal date for [name] is today or in the past, skipping notification`
- ✅ No notification scheduled
- ✅ App suggests updating renewal date (optional UX improvement)

---

### TC-10: Multiple Subscriptions

#### Setup
1. Clean state with no subscriptions

#### Test Steps
1. Create 5 subscriptions with different renewal dates:
   - Netflix: Tomorrow
   - Spotify: 2 days from now
   - iCloud: 3 days from now
   - Disney+: 5 days from now
   - HBO Max: 7 days from now
2. Enable reminders for all
3. Check scheduled notifications

#### Expected Results
- ✅ All 5 subscriptions save successfully
- ✅ 5 notifications scheduled (check console)
- ✅ Each has unique notification ID
- ✅ Each has correct trigger time (9:00 AM day before renewal)
- ✅ No conflicts between notifications

#### Verification Command

```javascript
const all = await Notifications.getAllScheduledNotificationsAsync();
console.log(`Total scheduled: ${all.length}`);
all.forEach(notif => {
  console.log(`- ${notif.content.title}: ${notif.trigger.date}`);
});
```

---

### TC-11: Background App State

#### Setup
1. Create subscription renewing in 1 minute (for quick test)
2. Schedule notification for immediate trigger

#### Test Steps
1. Create subscription with near-future renewal
2. Press home button (send app to background)
3. Wait for notification time
4. Observe notification delivery
5. Do NOT tap notification yet
6. Bring app to foreground manually
7. Observe app state

#### Expected Results
- ✅ Notification delivers while app is backgrounded
- ✅ Notification appears in notification center
- ✅ Sound and vibration work
- ✅ App data remains consistent
- ✅ Returning to app doesn't cause issues

---

### TC-12: App Force Quit

#### Setup
1. Create subscription renewing tomorrow
2. Verify notification scheduled

#### Test Steps
1. Create and save subscription
2. Force quit the app:
   - **iOS**: Double tap home, swipe up on app
   - **Android**: Recent apps > Swipe away
3. Wait several hours (or use time manipulation)
4. Observe notification delivery without reopening app

#### Expected Results
- ✅ Notification delivers at scheduled time
- ✅ App does not need to be running
- ✅ Notification appears in notification center
- ✅ Tapping notification opens app

**Note**: This tests the OS-level notification scheduling, which should work independently of app state.

---

## Platform-Specific Testing

### iOS-Specific Tests

#### Silent Notifications
1. Enable Do Not Disturb mode
2. Verify notification appears in Notification Center without sound
3. Verify notification banner appears when DND is off

#### Notification Settings
1. Settings > Notifications > Renvo
2. Test different alert styles:
   - Banner (temporary)
   - Banner (persistent)
   - Alerts (modal)
3. Verify each style works correctly

#### Badge Count
1. Create subscription with reminder
2. Wait for notification
3. Verify app icon badge shows "1"
4. Open notification center
5. Clear notification
6. Verify badge clears

### Android-Specific Tests

#### Notification Channels
1. Long-press on notification
2. Tap "All categories" or settings icon
3. Verify "Subscription Reminders" channel exists
4. Verify channel importance is HIGH
5. Test changing channel settings
6. Verify app respects user's channel preferences

#### Notification Actions
1. When notification appears, swipe down
2. Verify no action buttons (current limitation)
3. Verify can dismiss
4. Verify can tap to open app

#### Battery Optimization
1. Settings > Apps > Renvo > Battery
2. Set to "Optimize battery usage"
3. Verify notifications still deliver
4. Test with different battery saver modes

---

## Debugging Section

### Checking Scheduled Notifications

#### Method 1: Console Logging
Monitor the Metro bundler console for these log patterns:

```
📅 Scheduling notification for Netflix...
  Renewal date: 2024-01-15T08:00:00.000Z
  Current time: 2024-01-14T08:00:00.000Z
  Trigger time: 2024-01-14T09:00:00.000Z
✅ Scheduled notification for Netflix
  Notification ID: abc123-def456-ghi789
  Will trigger at: 1/14/2024 9:00:00 AM
```

#### Method 2: Debug Script
Add this to [`utils/notificationService.ts`](utils/notificationService.ts:0):

```typescript
export async function debugScheduledNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log('\n=== SCHEDULED NOTIFICATIONS DEBUG ===');
  console.log(`Total scheduled: ${scheduled.length}\n`);
  
  scheduled.forEach((notification, index) => {
    console.log(`[${index + 1}] ${notification.content.title}`);
    console.log(`    ID: ${notification.identifier}`);
    console.log(`    Body: ${notification.content.body}`);
    console.log(`    Trigger: ${new Date(notification.trigger.value * 1000).toLocaleString()}`);
    console.log(`    Data:`, notification.content.data);
    console.log('');
  });
  
  console.log('=====================================\n');
}
```

Usage in app:
```typescript
import { debugScheduledNotifications } from './utils/notificationService';

// Call anywhere in your app during development
await debugScheduledNotifications();
```

#### Method 3: React Native Debugger
1. Install React Native Debugger
2. Enable "Debug Remote JS"
3. Open Console tab
4. Run: `await Notifications.getAllScheduledNotificationsAsync()`

### Manually Triggering Test Notifications

#### Immediate Test Notification
Add this helper function:

```typescript
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification 🧪',
      body: 'This is a test notification. If you see this, notifications are working!',
      sound: true,
    },
    trigger: {
      seconds: 2, // Trigger in 2 seconds
    },
  });
  console.log('Test notification scheduled for 2 seconds from now');
}
```

Usage:
```typescript
import { sendTestNotification } from './utils/notificationService';

// In a test screen or button handler
await sendTestNotification();
```

### Common Issues and Troubleshooting

#### Issue: Notifications Not Appearing

**Symptoms**: Console shows notification scheduled, but nothing appears

**Possible Causes**:
1. Permissions not granted
2. Device notification settings disabled
3. Do Not Disturb mode enabled (iOS)
4. Battery saver blocking (Android)
5. Time already passed for trigger

**Solutions**:
```typescript
// Check permission status
const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);

// Check scheduled notifications
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
console.log('Scheduled count:', scheduled.length);

// Verify device settings
// iOS: Settings > Notifications > Renvo > Allow Notifications: ON
// Android: Settings > Apps > Renvo > Notifications > ON
```

#### Issue: Multiple Notifications for Same Subscription

**Symptoms**: User receives duplicate notifications

**Possible Causes**:
1. Old notification not cancelled before scheduling new one
2. Notification ID not stored properly
3. Multiple save operations

**Solutions**:
```typescript
// Check for duplicates
const scheduled = await Notifications.getAllScheduledNotificationsAsync();
const subscriptionIds = scheduled.map(n => n.content.data?.subscriptionId);
const duplicates = subscriptionIds.filter((id, index) => 
  subscriptionIds.indexOf(id) !== index
);
console.log('Duplicate subscription IDs:', duplicates);

// Cancel all for a subscription
const notificationsForSub = scheduled.filter(
  n => n.content.data?.subscriptionId === 'specific-id'
);
for (const notif of notificationsForSub) {
  await Notifications.cancelScheduledNotificationAsync(notif.identifier);
}
```

#### Issue: Wrong Notification Time

**Symptoms**: Notification appears at wrong time or not at 9:00 AM

**Possible Causes**:
1. Timezone issues
2. Date calculation error
3. Device time settings

**Debug Script**:
```typescript
const renewalDate = new Date('2024-01-15'); // Your renewal date
const triggerDate = new Date(renewalDate);
triggerDate.setDate(triggerDate.getDate() - 1);
triggerDate.setHours(9, 0, 0, 0);

console.log('Renewal Date:', renewalDate.toISOString());
console.log('Trigger Date:', triggerDate.toISOString());
console.log('Trigger Local:', triggerDate.toLocaleString());
console.log('Current Time:', new Date().toISOString());
console.log('Seconds until trigger:', (triggerDate.getTime() - Date.now()) / 1000);
```

#### Issue: Notification Doesn't Navigate to Subscription

**Symptoms**: Tapping notification opens app but doesn't show specific subscription

**Note**: This is a known limitation (TODO in code at [`App.tsx:60`](App.tsx:60))

**Current Behavior**:
```typescript
// In App.tsx
const subscription = Notifications.addNotificationResponseReceivedListener(response => {
  console.log('Notification tapped:', response.notification.request.content);
  // Navigation to specific subscription could be added here in the future
});
```

**Workaround**: User must manually navigate to subscription list

#### Issue: iOS Simulator Not Showing Notifications

**Symptoms**: Everything works in console but no visual notification

**Solution**: This is expected behavior. iOS simulator has limited notification support. **Always test on physical device.**

#### Issue: Android Notifications Not Playing Sound

**Symptoms**: Notification appears silently

**Check Channel Settings**:
```typescript
// Verify channel configuration
if (Platform.OS === 'android') {
  const channel = await Notifications.getNotificationChannelAsync(
    'subscription-reminders'
  );
  console.log('Channel config:', channel);
  // Should show importance: HIGH, sound enabled
}
```

**Solution**: Recreate channel with correct settings or ask user to check channel settings in device Settings > Apps > Renvo > Notifications.

### Logging Locations

#### Metro Bundler Console
```bash
# Start metro with notifications visible
npx expo start

# Look for these log patterns:
# - "📅 Scheduling notification..."
# - "✅ Scheduled notification..."
# - "Cancelled notification..."
# - "Error scheduling notification..."
```

#### Xcode Console (iOS)
```bash
# Open Xcode
# Window > Devices and Simulators
# Select your device
# View Device Logs
# Filter by: "Renvo" or "notification"
```

#### Android Studio Logcat (Android)
```bash
# Open Android Studio
# View > Tool Windows > Logcat
# Filter by package: com.ronnie39.renvo
# Search for: "notification", "scheduled", "triggered"
```

#### React Native Debugger
```bash
# Install
brew install --cask react-native-debugger

# Enable in app
# Shake device > Debug Remote JS

# Open debugger
# Check Console tab for notification logs
```

---

## Deployment Checklist

### Pre-Production Testing

- [ ] **Permissions Flow**
  - [ ] Test fresh install permission request
  - [ ] Test permission denial and re-granting
  - [ ] Verify permission prompt shows appropriate message

- [ ] **Core Functionality**
  - [ ] Create subscription with reminders enabled
  - [ ] Verify notification schedules correctly
  - [ ] Verify notification delivers at exact time (9:00 AM)
  - [ ] Verify notification content is accurate

- [ ] **Platform Testing**
  - [ ] Test on multiple iOS devices (iOS 13-17)
  - [ ] Test on multiple Android devices (Android 8-14)
  - [ ] Test on different screen sizes
  - [ ] Test in light and dark mode

- [ ] **Edge Cases**
  - [ ] Same-day renewal (should not notify)
  - [ ] Past date renewal (should not notify)
  - [ ] Multiple subscriptions (all should notify)
  - [ ] Toggle reminders off (should cancel)
  - [ ] Edit subscription (should reschedule)
  - [ ] Delete subscription (should cancel)

- [ ] **Background Behavior**
  - [ ] App in background (should deliver)
  - [ ] App force quit (should deliver)
  - [ ] Device restart (should deliver)
  - [ ] Low battery mode (should deliver)

- [ ] **Production Build**
  - [ ] Build production APK/IPA
  - [ ] Test on physical devices
  - [ ] Verify no debug logs in production
  - [ ] Verify notification icons display correctly

### Known Limitations to Document

Document these limitations in user-facing materials:

1. **Fixed Notification Time**
   - Notifications always arrive at 9:00 AM local time
   - No user customization available
   - Consider future enhancement for custom times

2. **Single Reminder Only**
   - Only one notification 24 hours before renewal
   - No follow-up reminders
   - No snooze functionality

3. **No Push Notifications**
   - All notifications are local (device-scheduled)
   - No remote server-triggered notifications
   - Notifications scheduled at subscription creation time

4. **Limited Navigation**
   - Tapping notification opens app to home screen
   - Does not navigate directly to specific subscription
   - User must manually find the subscription

5. **iOS Simulator Limitations**
   - Notifications don't appear visually in iOS simulator
   - Always test on physical device

### User Communication

#### Onboarding Tips
- Explain the 9:00 AM notification time during setup
- Show example notification during first subscription creation
- Request notification permissions with clear explanation

#### In-App Messaging
```
"Renewal Reminders"
Get notified 24 hours before your subscription renews. 
Notifications arrive at 9:00 AM local time.
```

#### FAQ Entries
```
Q: When will I receive renewal reminders?
A: You'll receive a notification at 9:00 AM (your local time) 
   the day before your subscription renews.

Q: Can I change the notification time?
A: Currently, reminders are sent at 9:00 AM. Custom times 
   may be added in a future update.

Q: Why didn't I receive a notification?
A: Make sure notifications are enabled in your device settings:
   iOS: Settings > Notifications > Renvo
   Android: Settings > Apps > Renvo > Notifications
```

#### App Store Description
```
📬 SMART REMINDERS
Never miss a renewal! Get notified 24 hours before your 
subscription renews, giving you time to review or cancel 
if needed.
```

### Release Notes Template

```markdown
## Notifications
- ✅ Local notification system for renewal reminders
- ✅ Notifications delivered 24 hours before renewal at 9:00 AM
- ✅ Per-subscription toggle to enable/disable reminders
- ✅ Platform-optimized notification channels (Android)
- ⚠️ Known limitation: Notification time not customizable (9:00 AM fixed)
- ⚠️ Known limitation: Tapping notification doesn't navigate to specific subscription
```

### Post-Launch Monitoring

After release, monitor for:

1. **User Feedback**
   - Reviews mentioning "notifications not working"
   - Support tickets about missing reminders
   - Requests for custom notification times

2. **Analytics**
   - Track permission grant/deny rates
   - Monitor notification open rates
   - Track reminder toggle usage

3. **Platform Updates**
   - iOS notification policy changes
   - Android notification channel requirements
   - expo-notifications library updates

4. **Future Enhancements**
   - Custom notification times
   - Multiple reminders per subscription
   - Notification action buttons (mark as paid, view details)
   - Smart notification timing based on user patterns
   - Deep linking to specific subscription on tap

---

## Appendix

### Quick Reference: Notification Flow

```
User Creates Subscription
         ↓
   Reminders Enabled?
    ↙YES        NO↘
Schedule            Skip
Notification        Notification
    ↓                   ↓
Store NotificationID    Store null ID
    ↓                   ↓
Renewal Date Valid?     Save Complete
    ↙YES        NO↘
24h Before       Skip
@ 9:00 AM        (date too soon)
    ↓
Notification
Delivered
```

### Useful Terminal Commands

```bash
# Check app permissions (iOS)
xcrun simctl privacy <device-id> grant notifications com.ronnie39.renvo

# Check scheduled notifications count
npx expo start
# Then in app console:
const count = (await Notifications.getAllScheduledNotificationsAsync()).length;

# Clear all notifications
await Notifications.cancelAllScheduledNotificationsAsync();

# View device logs (iOS)
xcrun simctl spawn booted log stream --predicate 'subsystem contains "expo"'

# View device logs (Android)
adb logcat | grep -i notification
```

### Testing Checklist Template

Use this for each test session:

```markdown
## Test Session: [Date]
**Device**: [iPhone 14 Pro / Samsung Galaxy S23]
**OS Version**: [iOS 17.0 / Android 14]
**App Version**: [1.0.0]
**Build Type**: [Development / Production]

### Tests Completed
- [ ] TC-01: Basic Scheduling
- [ ] TC-02: Permission Grant
- [ ] TC-03: Notification Delivery
- [ ] TC-04: Permission Denial
- [ ] TC-05: Toggle Reminders
- [ ] TC-06: Edit Subscription
- [ ] TC-07: Delete Subscription
- [ ] TC-08: Same-Day Renewal
- [ ] TC-09: Past Date
- [ ] TC-10: Multiple Subscriptions
- [ ] TC-11: Background State
- [ ] TC-12: Force Quit

### Issues Found
1. [Description]
2. [Description]

### Notes
[Any observations, edge cases, or concerns]
```

---

## Support Resources

- **expo-notifications Documentation**: https://docs.expo.dev/versions/latest/sdk/notifications/
- **iOS Notification Guidelines**: https://developer.apple.com/design/human-interface-guidelines/notifications
- **Android Notification Channels**: https://developer.android.com/develop/ui/views/notifications/channels
- **Project Issue Tracker**: [GitHub link]
- **Notification Service Code**: [`utils/notificationService.ts`](utils/notificationService.ts:0)