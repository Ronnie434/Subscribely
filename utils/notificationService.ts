import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Subscription } from '../types';

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
 * The notification is scheduled for 9:00 AM local time, 24 hours before the renewal date.
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

    // Parse the renewal date
    const renewalDate = new Date(subscription.renewalDate);
    const now = new Date();
    
    console.log(`  Renewal date: ${renewalDate.toISOString()}`);
    console.log(`  Current time: ${now.toISOString()}`);
    
    // Reset hours for date comparison
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const renewalDateOnly = new Date(renewalDate);
    renewalDateOnly.setHours(0, 0, 0, 0);
    
    console.log(`  Renewal date (date only): ${renewalDateOnly.toISOString()}`);
    console.log(`  Today (date only): ${today.toISOString()}`);
    
    // Check if renewal date is in the future (must be tomorrow or later to get a notification)
    console.log(`  Today (date only): ${today.toISOString()}`);
    
    if (renewalDateOnly <= today) {
      console.log(`❌ Renewal date for ${subscription.name} is today or in the past, skipping notification`);
      console.log(`  ${renewalDateOnly.toISOString()} <= ${today.toISOString()}`);
      return null;
    }
    
    // Calculate trigger time: 24 hours before renewal date at 9:00 AM
    const triggerDate = new Date(renewalDate);
    triggerDate.setDate(triggerDate.getDate() - 1); // Subtract 24 hours
    triggerDate.setHours(9, 0, 0, 0); // Set to 9:00 AM local time

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

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Subscription Renews Tomorrow',
        body: `Your ${subscription.name} subscription ($${subscription.cost.toFixed(2)}) renews tomorrow`,
        data: {
          subscriptionId: subscription.id,
          subscriptionName: subscription.name,
        },
        sound: true,
      },
      trigger: {
        date: triggerDate,
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