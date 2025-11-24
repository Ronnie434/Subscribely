import { supabase } from '../config/supabase';
import { Subscription, Database } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscriptionLimitService } from './subscriptionLimitService';
import { usageTrackingService } from './usageTrackingService';
import { SubscriptionLimitError } from '../utils/paywallErrors';

/**
 * MIGRATION NOTE:
 * This service is being replaced by recurringItemService.ts as part of Phase 4 refactoring.
 *
 * When feature flag 'useRecurringItemService' is enabled, calls are delegated to the new service.
 * This maintains backward compatibility during the migration period.
 *
 * @deprecated This service will be removed in v3.0.0. Use recurringItemService.ts instead.
 * @see {@link ./recurringItemService.ts} for the new implementation
 */

type DbSubscription = Database['public']['Tables']['subscriptions']['Row'];
type DbSubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
type DbSubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];

const STORAGE_KEY = '@subscriptions';
const MIGRATION_KEY = '@migration_complete';

/**
 * Convert database format (snake_case) to app format (camelCase)
 */
export function dbToApp(dbSub: DbSubscription): Subscription {
  return {
    id: dbSub.id,
    name: dbSub.name,
    cost: Number(dbSub.cost),
    billingCycle: dbSub.billing_cycle,
    renewalDate: dbSub.renewal_date,
    isCustomRenewalDate: dbSub.is_custom_renewal_date,
    notificationId: dbSub.notification_id || undefined,
    category: dbSub.category,
    color: dbSub.color || undefined,
    icon: dbSub.icon || undefined,
    domain: dbSub.domain || undefined,
    reminders: dbSub.reminders,
    description: dbSub.description || undefined,
    createdAt: dbSub.created_at,
    updatedAt: dbSub.updated_at,
    user_id: dbSub.user_id,
  };
}

/**
 * Convert app format (camelCase) to database insert format (snake_case)
 */
export function appToDbInsert(
  sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): DbSubscriptionInsert {
  return {
    user_id: userId,
    name: sub.name,
    cost: sub.cost,
    billing_cycle: sub.billingCycle,
    renewal_date: sub.renewalDate,
    is_custom_renewal_date: sub.isCustomRenewalDate ?? false,
    notification_id: sub.notificationId ?? null,
    category: sub.category,
    color: sub.color ?? null,
    icon: sub.icon ?? null,
    domain: sub.domain ?? null,
    reminders: sub.reminders ?? true,
    description: sub.description ?? null,
  };
}

/**
 * Convert app format (camelCase) to database update format (snake_case)
 */
export function appToDbUpdate(sub: Partial<Subscription>): DbSubscriptionUpdate {
  const update: DbSubscriptionUpdate = {};
  
  if (sub.name !== undefined) update.name = sub.name;
  if (sub.cost !== undefined) update.cost = sub.cost;
  if (sub.billingCycle !== undefined) update.billing_cycle = sub.billingCycle;
  if (sub.renewalDate !== undefined) update.renewal_date = sub.renewalDate;
  if (sub.isCustomRenewalDate !== undefined) update.is_custom_renewal_date = sub.isCustomRenewalDate;
  if (sub.notificationId !== undefined) update.notification_id = sub.notificationId ?? null;
  if (sub.category !== undefined) update.category = sub.category;
  if (sub.color !== undefined) update.color = sub.color ?? null;
  if (sub.icon !== undefined) update.icon = sub.icon ?? null;
  if (sub.domain !== undefined) update.domain = sub.domain ?? null;
  if (sub.reminders !== undefined) update.reminders = sub.reminders;
  if (sub.description !== undefined) update.description = sub.description ?? null;
  
  return update;
}

/**
 * Fetch all subscriptions for the authenticated user
 */
export async function fetchSubscriptions(): Promise<{
  data: Subscription[] | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Fetch subscriptions from database
    const { data, error } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    // Convert to app format
    const subscriptions = data.map(dbToApp);
    return { data: subscriptions, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscriptions';
    return { data: null, error: message };
  }
}

/**
 * Create a new subscription
 */
export async function createSubscription(
  subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{
  data: Subscription | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // CHECK SUBSCRIPTION LIMIT BEFORE ADDING
    const limitCheck = await subscriptionLimitService.checkCanAddSubscription();
    
    if (!limitCheck.canAdd) {
      // Track that user hit the limit
      await usageTrackingService.trackLimitReached('create_subscription').catch(err => {
        console.error('Failed to track limit reached:', err);
      });
      
      // Return error with detailed message
      const errorMessage = limitCheck.isPremium
        ? `You've reached your Premium plan limit of ${limitCheck.limit} subscriptions. Please contact support if you need more.`
        : `You've reached the free plan limit of ${limitCheck.limit} subscriptions. Upgrade to Premium for unlimited subscriptions.`;
      
      return { data: null, error: errorMessage };
    }

    // Convert to database format and insert
    const dbSubscription = appToDbInsert(subscription, session.user.id);
    
    const { data, error } = await supabase
      .from('recurring_items')
      .insert(dbSubscription)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Refresh limit status after successful creation
    await subscriptionLimitService.refreshLimitStatus().catch(err => {
      console.error('Failed to refresh limit status:', err);
    });

    // Convert back to app format
    const newSubscription = dbToApp(data);
    return { data: newSubscription, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create subscription';
    return { data: null, error: message };
  }
}

/**
 * Update an existing subscription
 */
export async function updateSubscription(
  id: string,
  updates: Partial<Subscription>
): Promise<{
  data: Subscription | null;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { data: null, error: sessionError.message };
    }
    
    if (!session) {
      return { data: null, error: 'No active session' };
    }

    // Convert to database format and update
    const dbUpdates = appToDbUpdate(updates);
    
    const { data, error } = await supabase
      .from('recurring_items')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', session.user.id) // Ensure user owns this subscription
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Convert back to app format
    const updatedSubscription = dbToApp(data);
    return { data: updatedSubscription, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update subscription';
    return { data: null, error: message };
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(id: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { success: false, error: sessionError.message };
    }
    
    if (!session) {
      return { success: false, error: 'No active session' };
    }

    const { error } = await supabase
      .from('recurring_items')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id); // Ensure user owns this subscription

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh limit status after deletion to update count
    await subscriptionLimitService.refreshLimitStatus().catch(err => {
      console.error('Failed to refresh limit status:', err);
    });

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete subscription';
    return { success: false, error: message };
  }
}

/**
 * Check if migration has already been completed
 */
async function hasMigrated(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MIGRATION_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Mark migration as complete
 */
async function setMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.error('Error setting migration complete:', error);
  }
}

/**
 * Migrate local subscriptions from AsyncStorage to Supabase
 * This is a one-time operation that runs after first authentication
 */
export async function migrateLocalSubscriptions(): Promise<{
  success: boolean;
  migratedCount: number;
  error: string | null;
}> {
  try {
    // Check if migration already completed
    const migrated = await hasMigrated();
    if (migrated) {
      return { success: true, migratedCount: 0, error: null };
    }

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return { success: false, migratedCount: 0, error: sessionError.message };
    }
    
    if (!session) {
      return { success: false, migratedCount: 0, error: 'No active session' };
    }

    // Check if user already has subscriptions in Supabase
    const { data: existingData } = await supabase
      .from('recurring_items')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    // If user already has data in Supabase, mark migration complete and return
    if (existingData && existingData.length > 0) {
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    // Get local subscriptions from AsyncStorage
    const localData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!localData) {
      // No local data to migrate
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    const localSubscriptions: Subscription[] = JSON.parse(localData);
    if (localSubscriptions.length === 0) {
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    // Convert and insert all subscriptions
    const dbSubscriptions = localSubscriptions.map(sub => 
      appToDbInsert(sub, session.user.id)
    );

    const { data, error } = await supabase
      .from('recurring_items')
      .insert(dbSubscriptions)
      .select();

    if (error) {
      return { success: false, migratedCount: 0, error: error.message };
    }

    // Mark migration as complete
    await setMigrationComplete();

    // Clear local storage after successful migration
    await AsyncStorage.removeItem(STORAGE_KEY);

    return {
      success: true,
      migratedCount: data?.length || 0,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to migrate subscriptions';
    return { success: false, migratedCount: 0, error: message };
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: string): string {
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (errorLower.includes('permission') || errorLower.includes('policy')) {
    return 'Permission denied. Please try signing in again.';
  }
  
  if (errorLower.includes('not found')) {
    return 'Subscription not found.';
  }
  
  if (errorLower.includes('session')) {
    return 'Session expired. Please sign in again.';
  }
  
  if (errorLower.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  return error;
}

/**
 * Check if real-time connection is available
 */
export function isRealtimeAvailable(): boolean {
  try {
    return supabase.realtime !== undefined;
  } catch (error) {
    console.error('Error checking realtime availability:', error);
    return false;
  }
}

/**
 * Get real-time connection status
 */
export function getRealtimeStatus(): string {
  try {
    // Access the realtime connection state
    const channels = supabase.getChannels();
    if (channels.length === 0) {
      return 'disconnected';
    }
    
    // Check if any channel is connected
    const hasConnectedChannel = channels.some(
      channel => channel.state === 'joined'
    );
    
    return hasConnectedChannel ? 'connected' : 'connecting';
  } catch (error) {
    console.error('Error getting realtime status:', error);
    return 'unknown';
  }
}