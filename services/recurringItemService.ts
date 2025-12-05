/**
 * Recurring Item Service
 * 
 * Service for managing user's recurring expenses and items (e.g., Netflix, gym membership, rent).
 * This is the NEW terminology - "Recurring Items" refers to expenses users track.
 * 
 * IMPORTANT: "Subscription" now refers to the user's app subscription tier (Premium/Free).
 * For tracked expenses, use this service (Recurring Items).
 * 
 * Migration Note:
 * This service is part of the Phase 4 refactoring to clarify terminology.
 * It replaces subscriptionService.ts for tracked expenses.
 * Enable via feature flag: useRecurringItemService
 * 
 * @since v2.0.0
 * @see {@link ../docs/SERVICES_MIGRATION_GUIDE.md} for migration details
 */

import { supabase } from '../config/supabase';
import { RecurringItem, Database } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionLimitError } from '../utils/paywallErrors';
import { convertToRepeatInterval, convertFromRepeatInterval } from '../utils/repeatInterval';

type DbRecurringItem = Database['public']['Tables']['recurring_items']['Row'];
type DbRecurringItemInsert = Database['public']['Tables']['recurring_items']['Insert'];
type DbRecurringItemUpdate = Database['public']['Tables']['recurring_items']['Update'];

const STORAGE_KEY = '@recurring_items';
const MIGRATION_KEY = '@recurring_items_migration_complete';

/**
 * Convert database format (snake_case) to app format (camelCase)
 * 
 * @param dbItem - Database row from recurring_items table
 * @returns RecurringItem in app format
 */
export function dbToApp(dbItem: DbRecurringItem): RecurringItem {
  // Prefer repeat_interval if available, otherwise convert from legacy fields
  const repeat_interval = dbItem.repeat_interval ||
    convertToRepeatInterval(dbItem.charge_type, dbItem.billing_cycle);
  
  return {
    id: dbItem.id,
    user_id: dbItem.user_id,
    name: dbItem.name,
    cost: Number(dbItem.cost),
    repeat_interval,
    renewal_date: dbItem.renewal_date,
    is_custom_renewal_date: dbItem.is_custom_renewal_date,
    notification_id: dbItem.notification_id || undefined,
    category: dbItem.category,
    color: dbItem.color || undefined,
    icon: dbItem.icon || undefined,
    domain: dbItem.domain || undefined,
    reminders: dbItem.reminders,
    reminder_days_before: dbItem.reminder_days_before ?? 1,
    description: dbItem.description || undefined,
    status: dbItem.status,
    notes: dbItem.notes || undefined,
    created_at: dbItem.created_at,
    updated_at: dbItem.updated_at,
    // Keep legacy fields for backward compatibility
    billing_cycle: dbItem.billing_cycle,
    charge_type: dbItem.charge_type,
  };
}

/**
 * Convert app format to database insert format (snake_case)
 * 
 * @param item - RecurringItem without id and timestamps
 * @param userId - User ID to associate with this item
 * @returns Database insert object
 */
export function appToDbInsert(
  item: Omit<RecurringItem, 'id' | 'created_at' | 'updated_at' | 'user_id'>,
  userId: string
): DbRecurringItemInsert {
  // DUAL-WRITE: Write to both new repeat_interval and legacy fields
  const repeat_interval = item.repeat_interval ||
    convertToRepeatInterval(item.charge_type, item.billing_cycle);
  
  // Convert back to legacy format for backward compatibility
  const { chargeType, billingCycle } = convertFromRepeatInterval(repeat_interval);
  
  return {
    user_id: userId,
    name: item.name,
    cost: item.cost,
    // NEW field - this is what actually matters!
    repeat_interval,
    // Legacy fields (for backward compatibility during transition)
    billing_cycle: billingCycle,
    charge_type: chargeType,
    renewal_date: item.renewal_date,
    is_custom_renewal_date: item.is_custom_renewal_date ?? false,
    notification_id: item.notification_id ?? null,
    category: item.category,
    color: item.color ?? null,
    icon: item.icon ?? null,
    domain: item.domain ?? null,
    reminders: item.reminders ?? true,
    reminder_days_before: item.reminder_days_before ?? 1,
    description: item.description ?? null,
    status: item.status || 'active',
    notes: item.notes ?? null,
  };
}

/**
 * Convert app format to database update format (snake_case)
 * 
 * @param item - Partial RecurringItem with fields to update
 * @returns Database update object
 */
export function appToDbUpdate(item: Partial<RecurringItem>): DbRecurringItemUpdate {
  const update: DbRecurringItemUpdate = {};
  
  if (item.name !== undefined) update.name = item.name;
  if (item.cost !== undefined) update.cost = item.cost;
  if (item.billing_cycle !== undefined) update.billing_cycle = item.billing_cycle;
  if (item.renewal_date !== undefined) update.renewal_date = item.renewal_date;
  if (item.is_custom_renewal_date !== undefined) update.is_custom_renewal_date = item.is_custom_renewal_date;
  if (item.notification_id !== undefined) update.notification_id = item.notification_id ?? null;
  if (item.category !== undefined) update.category = item.category;
  if (item.color !== undefined) update.color = item.color ?? null;
  if (item.icon !== undefined) update.icon = item.icon ?? null;
  if (item.domain !== undefined) update.domain = item.domain ?? null;
  if (item.reminders !== undefined) update.reminders = item.reminders;
  if (item.reminder_days_before !== undefined) update.reminder_days_before = item.reminder_days_before;
  if (item.description !== undefined) update.description = item.description ?? null;
  if (item.status !== undefined) update.status = item.status;
  if (item.notes !== undefined) update.notes = item.notes ?? null;
  
  return update;
}

/**
 * Fetch all recurring items for the authenticated user
 * 
 * Retrieves all expenses/items the user is tracking (Netflix, gym, etc.)
 * 
 * @returns Promise with recurring items array or error
 * 
 * @example
 * ```typescript
 * const { data, error } = await fetchRecurringItems();
 * if (data) {
 *   console.log(`User has ${data.length} recurring items`);
 * }
 * ```
 */
export async function fetchRecurringItems(): Promise<{
  data: RecurringItem[] | null;
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

    // Fetch recurring items from database
    const { data, error } = await supabase
      .from('recurring_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    // Convert to app format
    const recurringItems = data.map(dbToApp);
    return { data: recurringItems, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch recurring items';
    return { data: null, error: message };
  }
}

/**
 * Create a new recurring item
 * 
 * Adds a new expense/item for the user to track.
 * Automatically checks subscription limits before creating.
 * 
 * @param item - RecurringItem data without id and timestamps
 * @returns Promise with created recurring item or error
 * 
 * @example
 * ```typescript
 * const { data, error } = await createRecurringItem({
 *   name: 'Netflix',
 *   cost: 15.99,
 *   billing_cycle: 'monthly',
 *   category: 'Entertainment',
 *   renewal_date: '2024-01-01',
 *   status: 'active'
 * });
 * ```
 */
export async function createRecurringItem(
  item: Omit<RecurringItem, 'id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<{
  data: RecurringItem | null;
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

    // CHECK RECURRING ITEM LIMIT BEFORE ADDING
    const { recurringItemLimitService: limitService } = await import('./recurringItemLimitService');
    const limitCheck = await limitService.checkCanAddRecurringItem();
    
    if (!limitCheck.canAdd) {
      // Track that user hit the limit
      const { usageTrackingService } = await import('./usageTrackingService');
      await usageTrackingService.trackLimitReached('create_recurring_item').catch(err => {
        console.error('Failed to track limit reached:', err);
      });
      
      // Return error with detailed message
      const errorMessage = limitCheck.isPremium
        ? `You've reached your Premium plan limit of ${limitCheck.limit} recurring items. Please contact support if you need more.`
        : `You've reached the free plan limit of ${limitCheck.limit} recurring items. Upgrade to Premium for unlimited tracking.`;
      
      return { data: null, error: errorMessage };
    }

    // Convert to database format and insert
    const dbItem = appToDbInsert(item, session.user.id);
    
    const { data, error } = await supabase
      .from('recurring_items')
      .insert(dbItem)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Refresh limit status after successful creation
    const { recurringItemLimitService: limitService2 } = await import('./recurringItemLimitService');
    await limitService2.refreshLimitStatus().catch(err => {
      console.error('Failed to refresh limit status:', err);
    });

    // Convert back to app format
    const newItem = dbToApp(data);
    return { data: newItem, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create recurring item';
    return { data: null, error: message };
  }
}

/**
 * Update an existing recurring item
 * 
 * Modifies an existing expense/item the user is tracking.
 * 
 * @param id - ID of the recurring item to update
 * @param updates - Partial RecurringItem with fields to update
 * @returns Promise with updated recurring item or error
 * 
 * @example
 * ```typescript
 * const { data, error } = await updateRecurringItem('item-123', {
 *   cost: 17.99,
 *   status: 'paused'
 * });
 * ```
 */
export async function updateRecurringItem(
  id: string,
  updates: Partial<RecurringItem>
): Promise<{
  data: RecurringItem | null;
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
      .eq('user_id', session.user.id) // Ensure user owns this item
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    // Convert back to app format
    const updatedItem = dbToApp(data);
    return { data: updatedItem, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update recurring item';
    return { data: null, error: message };
  }
}

/**
 * Delete a recurring item
 * 
 * Removes an expense/item from the user's tracking.
 * 
 * @param id - ID of the recurring item to delete
 * @returns Promise with success status or error
 * 
 * @example
 * ```typescript
 * const { success, error } = await deleteRecurringItem('item-123');
 * if (success) {
 *   console.log('Item deleted successfully');
 * }
 * ```
 */
export async function deleteRecurringItem(id: string): Promise<{
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
      .eq('user_id', session.user.id); // Ensure user owns this item

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh limit status after deletion to update count
    const { recurringItemLimitService } = await import('./recurringItemLimitService');
    await recurringItemLimitService.refreshLimitStatus().catch(err => {
      console.error('Failed to refresh limit status:', err);
    });

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete recurring item';
    return { success: false, error: message };
  }
}

/**
 * Check if migration has already been completed
 * @private
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
 * @private
 */
async function setMigrationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.error('Error setting migration complete:', error);
  }
}

/**
 * Migrate local recurring items from AsyncStorage to Supabase
 * 
 * This is a one-time operation that runs after first authentication.
 * It migrates data from the old local storage to the cloud database.
 * 
 * @returns Promise with migration result
 */
export async function migrateLocalRecurringItems(): Promise<{
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

    // Check if user already has recurring items in database
    const { data: existingData } = await supabase
      .from('recurring_items')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1);

    // If user already has data, mark migration complete and return
    if (existingData && existingData.length > 0) {
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    // Get local recurring items from AsyncStorage
    const localData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!localData) {
      // No local data to migrate
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    const localItems: RecurringItem[] = JSON.parse(localData);
    if (localItems.length === 0) {
      await setMigrationComplete();
      return { success: true, migratedCount: 0, error: null };
    }

    // Convert and insert all recurring items
    const dbItems = localItems.map(item => 
      appToDbInsert(item, session.user.id)
    );

    const { data, error } = await supabase
      .from('recurring_items')
      .insert(dbItems)
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
    const message = err instanceof Error ? err.message : 'Failed to migrate recurring items';
    return { success: false, migratedCount: 0, error: message };
  }
}

/**
 * Get user-friendly error message
 * 
 * @param error - Raw error message
 * @returns Human-readable error message
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
    return 'Recurring item not found.';
  }
  
  if (errorLower.includes('session')) {
    return 'Session expired. Please sign in again.';
  }
  
  if (errorLower.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (errorLower.includes('limit')) {
    return error; // Keep limit messages as-is
  }
  
  return error;
}

/**
 * Check if real-time connection is available
 * 
 * @returns True if real-time updates are supported
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
 * 
 * @returns Connection status string
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