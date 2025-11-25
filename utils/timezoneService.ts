import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import {
  requestNotificationPermissions,
  scheduleRenewalNotification,
  cancelNotification,
} from './notificationService';

const TIMEZONE_STORAGE_KEY = 'user_timezone';

/**
 * Gets the device's current timezone
 * @returns Timezone string (e.g., "America/Los_Angeles")
 */
export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Gets the last known timezone from storage
 */
export async function getStoredTimezone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TIMEZONE_STORAGE_KEY);
  } catch (error) {
    console.error('Error getting stored timezone:', error);
    return null;
  }
}

/**
 * Saves the current timezone to storage
 */
export async function saveTimezone(timezone: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
  } catch (error) {
    console.error('Error saving timezone:', error);
  }
}

/**
 * Reschedules all notifications for subscriptions with reminders enabled
 * This function cancels existing notifications and creates new ones based on current timezone
 */
async function scheduleRenewalNotifications(): Promise<void> {
  try {
    console.log('🔄 Rescheduling all notifications...');
    
    // Check for notification permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('⚠️ No notification permissions, skipping rescheduling');
      return;
    }
    
    // Fetch all subscriptions from Supabase
    const subscriptions = await storage.getAll();
    console.log(`📋 Found ${subscriptions.length} subscriptions`);
    
    // Filter subscriptions with reminders enabled
    const subscriptionsWithReminders = subscriptions.filter(
      sub => sub.reminders !== false
    );
    console.log(`🔔 ${subscriptionsWithReminders.length} subscriptions have reminders enabled`);
    
    // Reschedule each subscription
    for (const subscription of subscriptionsWithReminders) {
      try {
        // Cancel existing notification if it exists
        if (subscription.notificationId) {
          await cancelNotification(subscription.notificationId);
          console.log(`  ❌ Cancelled old notification for ${subscription.name}`);
        }
        
        // Schedule new notification in the new timezone
        const newNotificationId = await scheduleRenewalNotification(subscription);
        
        if (newNotificationId && newNotificationId !== subscription.notificationId) {
          // Update subscription with new notification ID
          await storage.save({
            ...subscription,
            notificationId: newNotificationId,
          });
          console.log(`  ✅ Rescheduled notification for ${subscription.name}`);
        } else if (!newNotificationId) {
          console.log(`  ⚠️ Could not schedule notification for ${subscription.name} (date may be in the past)`);
        }
      } catch (error) {
        console.error(`  ❌ Error rescheduling notification for ${subscription.name}:`, error);
        // Continue with next subscription even if one fails
      }
    }
    
    console.log('✅ Notification rescheduling complete');
  } catch (error) {
    console.error('Error in scheduleRenewalNotifications:', error);
    throw error;
  }
}

/**
 * Checks if timezone has changed and reschedules notifications if needed
 * Should be called on app launch
 * @returns True if timezone changed and rescheduling occurred
 */
export async function checkAndHandleTimezoneChange(): Promise<boolean> {
  try {
    const currentTimezone = getCurrentTimezone();
    const storedTimezone = await getStoredTimezone();
    
    // First launch - no stored timezone yet
    if (!storedTimezone) {
      console.log('First launch - saving timezone:', currentTimezone);
      await saveTimezone(currentTimezone);
      return false;
    }
    
    // Timezone hasn't changed
    if (currentTimezone === storedTimezone) {
      console.log('Timezone unchanged:', currentTimezone);
      return false;
    }
    
    // Timezone changed - reschedule notifications
    console.log(`Timezone changed from ${storedTimezone} to ${currentTimezone}`);
    console.log('Rescheduling all notifications...');
    
    // Reschedule all notifications
    await scheduleRenewalNotifications();
    
    // Save new timezone
    await saveTimezone(currentTimezone);
    
    console.log('Notifications rescheduled for new timezone');
    return true;
  } catch (error) {
    console.error('Error handling timezone change:', error);
    return false;
  }
}