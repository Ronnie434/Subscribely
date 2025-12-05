import AsyncStorage from '@react-native-async-storage/async-storage';
import { Subscription } from '../types';
import {
  requestNotificationPermissions,
  scheduleRenewalNotification,
  cancelNotification,
  rescheduleNotification,
} from './notificationService';
import {
  fetchSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription as deleteSubscriptionFromDb,
  getErrorMessage,
} from '../services/subscriptionService';

const STORAGE_KEY = '@subscriptions';
const ONBOARDING_KEY = '@onboarding_complete';

/**
 * Legacy AsyncStorage functions - kept for fallback/cache
 */
const localStorage = {
  async getAll(): Promise<Subscription[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting subscriptions from local storage:', error);
      return [];
    }
  },

  async save(subscriptions: Subscription[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
      return true;
    } catch (error) {
      console.error('Error saving to local storage:', error);
      return false;
    }
  },

  async clear(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Error clearing local storage:', error);
      return false;
    }
  },
};

/**
 * Main storage API - now uses Supabase
 */
export const storage = {
  /**
   * Get all subscriptions from Supabase
   */
  async getAll(): Promise<Subscription[]> {
    try {
      const { data, error } = await fetchSubscriptions();
      
      if (error) {
        console.error('Error fetching subscriptions:', error);
        // Fallback to local storage if Supabase fails
        return await localStorage.getAll();
      }
      
      return data || [];
    } catch (error) {
      console.error('Error getting subscriptions:', error);
      // Fallback to local storage on error
      return await localStorage.getAll();
    }
  },

  /**
   * Check if a string is a valid UUID
   */
  isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  },

  /**
   * Save or update a subscription in Supabase
   */
  async save(subscription: Subscription): Promise<boolean> {
    try {
      let result;
      
      // Determine if this is an update or create
      // Only treat as update if ID is a valid UUID (from Supabase)
      const isExistingSubscription = subscription.id &&
                                     this.isValidUUID(subscription.id) &&
                                     subscription.createdAt;
      
      if (isExistingSubscription) {
        // Update existing subscription
        const { data, error } = await updateSubscription(subscription.id, subscription);
        
        if (error) {
          console.error('Error updating subscription:', getErrorMessage(error));
          return false;
        }
        
        result = data;
      } else {
        // Create new subscription (ignore any local ID)
        const subscriptionData = { ...subscription };
        // Remove fields that shouldn't be in create request
        delete (subscriptionData as any).createdAt;
        delete (subscriptionData as any).updatedAt;
        
        const { data, error } = await createSubscription(subscriptionData);
        
        if (error) {
          console.error('Error creating subscription:', getErrorMessage(error));
          return false;
        }
        
        result = data;
      }
      
      // Handle notifications if save was successful and reminders are enabled
      if (result && result.reminders !== false) {
        try {
          const hasPermission = await requestNotificationPermissions();
          if (hasPermission) {
            let notificationId: string | undefined;
            
            // Cancel existing notification first to prevent duplicates
            if (subscription.notificationId) {
              await cancelNotification(subscription.notificationId);
            }
            
            // Schedule new notification (will validate date internally)
            const scheduledId = await scheduleRenewalNotification(result);
            notificationId = scheduledId || undefined;
            
            // Update subscription with notification ID if we got one
            // If notificationId is undefined (date validation failed), clear it
            if (notificationId !== result.notificationId) {
              await updateSubscription(result.id, {
                notificationId
              });
            }
          }
        } catch (error) {
          console.error('Error scheduling notification:', error);
          // Don't fail the save operation if notification scheduling fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error saving subscription:', error);
      return false;
    }
  },

  /**
   * Delete a subscription from Supabase
   */
  async delete(id: string): Promise<boolean> {
    try {
      // Get subscription to cancel notifications
      const subscriptions = await this.getAll();
      const subscription = subscriptions.find(s => s.id === id);
      
      // Cancel notification if it exists
      if (subscription?.notificationId) {
        try {
          await cancelNotification(subscription.notificationId);
        } catch (error) {
          console.error('Error canceling notification:', error);
          // Continue with deletion even if notification cancellation fails
        }
      }
      
      // Delete from Supabase
      const { success, error } = await deleteSubscriptionFromDb(id);
      
      if (error) {
        console.error('Error deleting subscription:', getErrorMessage(error));
        return false;
      }
      
      return success;
    } catch (error) {
      console.error('Error deleting subscription:', error);
      return false;
    }
  },

  /**
   * Get a subscription by ID
   */
  async getById(id: string): Promise<Subscription | null> {
    try {
      const subscriptions = await this.getAll();
      return subscriptions.find((s) => s.id === id) || null;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  },

  /**
   * Refresh subscriptions from Supabase (for pull-to-refresh)
   */
  async refresh(): Promise<Subscription[]> {
    const { data, error } = await fetchSubscriptions();
    
    if (error) {
      throw new Error(getErrorMessage(error));
    }
    
    return data || [];
  },
};

// Export local storage utilities for migration purposes
export { localStorage };

// Onboarding storage functions
export const hasSeenOnboarding = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};

export const setOnboardingComplete = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (error) {
    console.error('Error setting onboarding complete:', error);
  }
};

