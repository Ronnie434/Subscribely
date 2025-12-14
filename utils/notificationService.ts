import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Subscription } from '../types';
import { dateHelpers } from './dateHelpers';
import { utcTimestampToLocalDate } from './dateHelpers';

/**
 * Requests notification permissions from the user.
 * Handles platform-specific differences between iOS and Android.
 * 
 * @returns {Promise<boolean>} True if permissions were granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If permissions haven't been determined yet, ask the user
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('subscription-reminders', {
        name: 'Subscription Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    console.log('Notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Schedules a renewal notification for a subscription.
 * The notification is scheduled for 9:00 AM local time, X days before the renewal date.
 *
 * @param {Subscription} subscription - The subscription to schedule a notification for
 * @returns {Promise<string | null>} The notification identifier if scheduled, null otherwise
 */
export async function scheduleRenewalNotification(
  subscription: Subscription
): Promise<string | null> {
  try {
    console.log(`\n📅 Scheduling notification for ${subscription.name}...`);
    
    // Check if reminders are enabled for this subscription
    if (subscription.reminders === false) {
      console.log(`⚠️ Reminders disabled for ${subscription.name}, skipping notification`);
      return null;
    }

    // Get the number of days before renewal to send notification (default to 1 day)
    const daysBefore = subscription.reminderDaysBefore ?? 1;
    console.log(`  Reminder set for ${daysBefore} day(s) before renewal`);

    // Parse the renewal date
    const renewalDate = new Date(subscription.renewalDate);
    const now = new Date();
    
    console.log(`  Renewal date: ${renewalDate.toISOString()}`);
    console.log(`  Current time: ${now.toISOString()}`);
    
    // Convert UTC renewal date to local calendar date
    const renewalDateLocal = utcTimestampToLocalDate(subscription.renewalDate);
    
    // Get today in local timezone
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only schedule if renewal is in the future
    if (renewalDateLocal <= today) {
      console.log(`Renewal date for ${subscription.name} is today or in the past, skipping notification`);
      return null;
    }
    
    // Calculate trigger time: X days before renewal at 9 AM local time
    const triggerDate = new Date(renewalDateLocal);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0);

    console.log(`  Calculated trigger time: ${triggerDate.toISOString()}`);

    // Final check if the trigger date is in the past
    if (triggerDate <= now) {
      console.log(`❌ Trigger time for ${subscription.name} is in the past, skipping notification`);
      console.log(`  ${triggerDate.toISOString()} <= ${now.toISOString()}`);
      return null;
    }

    // Calculate days until notification
    const daysUntilNotification = Math.ceil((triggerDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  Days until notification: ${daysUntilNotification}`);

    // Format the renewal date for the notification message (use local date for correct display)
    const formattedRenewalDate = dateHelpers.formatDate(renewalDateLocal);

    // Create notification title and body based on days before
    const title = daysBefore === 1
      ? 'Payment Due Tomorrow'
      : `Payment Due in ${daysBefore} Days`;
    
    const daysText = daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`;
    const body = `Your ${subscription.name} ($${subscription.cost.toFixed(2)}) is due ${daysText} on ${formattedRenewalDate}`;

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.floor((triggerDate.getTime() - Date.now()) / 1000),
        repeats: false,
        channelId: Platform.OS === 'android' ? 'subscription-reminders' : undefined,
      },
    });

    console.log(`✅ Scheduled notification for ${subscription.name}`);
    console.log(`  Notification ID: ${notificationId}`);
    console.log(`  Will trigger at: ${triggerDate.toLocaleDateString()} ${triggerDate.toLocaleTimeString()}`);
    console.log(`  (in ${daysUntilNotification} days)\n`);
    
    return notificationId;
  } catch (error) {
    console.error(`Error scheduling notification for ${subscription.name}:`, error);
    return null;
  }
}

/**
 * Cancels a scheduled notification by its ID.
 * 
 * @param {string} notificationId - The ID of the notification to cancel
 * @returns {Promise<void>}
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Cancelled notification with ID: ${notificationId}`);
  } catch (error) {
    console.error(`Error cancelling notification ${notificationId}:`, error);
  }
}

/**
 * Reschedules a notification for a subscription.
 * Cancels the existing notification (if present) and schedules a new one.
 *
 * @param {Subscription} subscription - The subscription to reschedule notification for
 * @returns {Promise<string | null>} The new notification identifier if scheduled, null otherwise
 */
export async function rescheduleNotification(
  subscription: Subscription
): Promise<string | null> {
  try {
    // Cancel the old notification if it exists
    if (subscription.notificationId) {
      await cancelNotification(subscription.notificationId);
      console.log(`Cancelled old notification for ${subscription.name}`);
    }

    // Schedule a new notification
    const newNotificationId = await scheduleRenewalNotification(subscription);
    
    if (newNotificationId) {
      console.log(`Rescheduled notification for ${subscription.name}, new ID: ${newNotificationId}`);
    }

    return newNotificationId;
  } catch (error) {
    console.error(`Error rescheduling notification for ${subscription.name}:`, error);
    return null;
  }
}