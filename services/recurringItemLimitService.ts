/**
 * Recurring Item Limit Service
 * 
 * Manages limits on how many recurring items (expenses) a user can track
 * based on their app subscription tier (Free/Premium).
 * 
 * IMPORTANT: This service manages limits for TRACKED EXPENSES (recurring items),
 * not the user's app subscription tier itself.
 * 
 * Migration Note:
 * This service is part of the Phase 4 refactoring to clarify terminology.
 * It replaces subscriptionLimitService.ts for recurring item limits.
 * Enable via feature flag: useRecurringItemLimitService
 * 
 * @since v2.0.0
 * @see {@link ../docs/SERVICES_MIGRATION_GUIDE.md} for migration details
 */

import { supabase } from '../config/supabase';
import {
  subscriptionCache,
  CacheKeys,
  CacheTTL
} from '../utils/subscriptionCache';
import {
  SubscriptionLimitError,
  TierNotFoundError
} from '../utils/paywallErrors';
import type {
  RecurringItemLimitStatus,
  CheckRecurringItemLimitResponse
} from '../types';

/**
 * RecurringItemLimitService class for managing recurring item limits
 */
class RecurringItemLimitService {
  /**
   * Get current user's authentication session
   * @private
   */
  private async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('User not authenticated');
    }
    return session;
  }

  /**
   * Get user ID from current session
   * @private
   */
  private async getUserId(): Promise<string> {
    const session = await this.getSession();
    return session.user.id;
  }


  /**
   * Check if user can add a new recurring item
   * 
   * Queries the database to determine if the user has room for more tracked items
   * based on their current tier (Free: 5 items, Premium: unlimited).
   * 
   * @returns Object with permission status and details
   * 
   * @example
   * ```typescript
   * const check = await recurringItemLimitService.checkCanAddRecurringItem();
   * if (!check.canAdd) {
   *   // Show upgrade prompt or paywall
   *   console.log(check.reason);
   * }
   * ```
   */
  async checkCanAddRecurringItem(): Promise<{
    canAdd: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
    isPremium: boolean;
  }> {
    try {
      const userId = await this.getUserId();
      const cacheKey = `can-add-item-${userId}`;

      // Check cache first
      const cached = subscriptionCache.get<CheckRecurringItemLimitResponse>(cacheKey);
      if (cached) {
        return {
          canAdd: cached.can_add,
          reason: cached.reason,
          currentCount: cached.current_count,
          limit: cached.limit,
          isPremium: cached.is_premium,
        };
      }

      // Query database using the recurring item limit check function
      const { data, error } = await supabase
        .rpc('can_user_add_recurring_item', { p_user_id: userId })
        .single();

      if (error) {
        console.error('Error checking recurring item limit:', error);
        // On error, default to allowing (graceful degradation)
        return {
          canAdd: true,
          currentCount: 0,
          limit: 5,
          isPremium: false,
          reason: 'Unable to check limit, proceeding...',
        };
      }

      // Cache the result with proper type assertion
      const responseData = data as any;
      const result: CheckRecurringItemLimitResponse = {
        can_add: responseData.allowed,
        current_count: responseData.current_count,
        limit: responseData.limit_count,
        is_premium: responseData.tier === 'premium_tier' || responseData.tier === 'premium',
        tier_name: responseData.tier,
        reason: responseData.allowed
          ? undefined
          : `You've reached your ${responseData.tier} plan limit of ${responseData.limit_count} recurring items.`,
      };

      subscriptionCache.set(cacheKey, result, CacheTTL.MEDIUM);

      return {
        canAdd: result.can_add,
        reason: result.reason,
        currentCount: result.current_count,
        limit: result.limit,
        isPremium: result.is_premium,
      };
    } catch (error) {
      console.error('Error in checkCanAddRecurringItem:', error);
      // Graceful degradation: allow on error
      return {
        canAdd: true,
        currentCount: 0,
        limit: 5,
        isPremium: false,
        reason: 'Error checking limit',
      };
    }
  }

  /**
   * Get current recurring item limit status with detailed information
   * 
   * Provides comprehensive information about the user's current usage
   * and available capacity for tracking recurring items.
   * 
   * @returns Complete recurring item limit status
   * 
   * @example
   * ```typescript
   * const status = await recurringItemLimitService.getRecurringItemLimitStatus();
   * console.log(`${status.currentCount} of ${status.maxAllowed} items tracked`);
   * console.log(`${status.remainingCount} slots available`);
   * ```
   */
  async getRecurringItemLimitStatus(): Promise<RecurringItemLimitStatus> {
    try {
      const userId = await this.getUserId();
      const cacheKey = CacheKeys.limitStatus(userId);

      // Check cache first
      const cached = subscriptionCache.get<RecurringItemLimitStatus>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get limit check data
      const check = await this.checkCanAddRecurringItem();

      // Calculate remaining count
      const maxAllowed = check.limit === -1 ? null : check.limit;
      const remainingCount = maxAllowed === null 
        ? null 
        : Math.max(0, check.limit - check.currentCount);

      const status: RecurringItemLimitStatus = {
        currentCount: check.currentCount,
        maxAllowed,
        remainingCount,
        isPremium: check.isPremium,
        canAddMore: check.canAdd,
        tierName: check.isPremium ? 'premium' : 'free',
      };

      // Cache the result
      subscriptionCache.set(cacheKey, status, CacheTTL.MEDIUM);

      return status;
    } catch (error) {
      console.error('Error getting recurring item limit status:', error);
      throw new TierNotFoundError(
        'Unable to retrieve recurring item limit status',
        undefined
      );
    }
  }

  /**
   * Enforce recurring item limit before executing a callback
   * 
   * Checks if the user can add more recurring items and throws an error if not.
   * Use this to guard operations that would create new recurring items.
   * 
   * @param callback - Function to execute if limit allows
   * @throws SubscriptionLimitError if limit is exceeded
   * 
   * @example
   * ```typescript
   * await recurringItemLimitService.enforceRecurringItemLimit(async () => {
   *   // Add recurring item logic here
   *   await createRecurringItem(itemData);
   * });
   * ```
   */
  async enforceRecurringItemLimit(callback: () => void | Promise<void>): Promise<void> {
    const check = await this.checkCanAddRecurringItem();

    if (!check.canAdd) {
      // Import usage tracking to log this event
      const { usageTrackingService } = await import('./usageTrackingService');
      await usageTrackingService.trackLimitReached().catch(err => {
        console.error('Failed to track limit reached event:', err);
      });

      throw new SubscriptionLimitError(
        check.reason || 'Recurring item limit reached',
        check.currentCount,
        check.limit,
        check.isPremium
      );
    }

    // Execute callback if limit allows
    await callback();
  }

  /**
   * Refresh limit status by clearing cache and re-fetching from database
   * 
   * Call this after operations that affect the recurring item count:
   * - Adding a new recurring item
   * - Deleting a recurring item
   * - Upgrading or downgrading app subscription tier
   * 
   * @example
   * ```typescript
   * await recurringItemService.createRecurringItem(newItem);
   * await recurringItemLimitService.refreshLimitStatus();
   * ```
   */
  async refreshLimitStatus(): Promise<void> {
    try {
      const userId = await this.getUserId();
      
      // Clear all related cache entries
      subscriptionCache.invalidate(CacheKeys.limitStatus(userId));
      subscriptionCache.invalidate(CacheKeys.subscriptionCount(userId));
      subscriptionCache.invalidate(CacheKeys.currentTier(userId));
      subscriptionCache.invalidate(CacheKeys.isPremium(userId));
      subscriptionCache.invalidate(CacheKeys.subscriptionStatus(userId));
      // Also invalidate the checkCanAddRecurringItem cache
      subscriptionCache.invalidate(`can-add-item-${userId}`);
      
      // Force clear the entire cache to prevent any stale data
      if (__DEV__) {
        console.log('🗑️ Forcing complete cache clear for recurring item limit refresh');
      }
      subscriptionCache.clear();

      // Pre-fetch fresh data
      await this.checkCanAddRecurringItem();
    } catch (error) {
      console.error('Error refreshing recurring item limit status:', error);
      // Don't throw - refresh is best-effort
    }
  }

  /**
   * Get recurring item count for current user
   * 
   * Counts how many recurring items (expenses) the user is currently tracking.
   * 
   * @returns Number of recurring items user has
   * 
   * @example
   * ```typescript
   * const count = await recurringItemLimitService.getRecurringItemCount();
   * console.log(`User is tracking ${count} recurring items`);
   * ```
   */
  async getRecurringItemCount(): Promise<number> {
    try {
      const userId = await this.getUserId();
      const cacheKey = CacheKeys.subscriptionCount(userId);

      // Check cache first
      const cached = subscriptionCache.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Query database
      const { count, error } = await supabase
        .from('recurring_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting recurring item count:', error);
        return 0;
      }

      const itemCount = count || 0;

      // Cache the result
      subscriptionCache.set(cacheKey, itemCount, CacheTTL.SHORT);

      return itemCount;
    } catch (error) {
      console.error('Error in getRecurringItemCount:', error);
      return 0;
    }
  }

  /**
   * Check if user is at their recurring item limit
   * 
   * Quick check to see if user cannot add more recurring items.
   * 
   * @returns True if user cannot add more recurring items
   * 
   * @example
   * ```typescript
   * const atLimit = await recurringItemLimitService.isAtLimit();
   * if (atLimit) {
   *   // Show upgrade prompt
   * }
   * ```
   */
  async isAtLimit(): Promise<boolean> {
    const check = await this.checkCanAddRecurringItem();
    return !check.canAdd;
  }

  /**
   * Get remaining recurring item slots available
   * 
   * Calculates how many more recurring items the user can add
   * before hitting their tier limit.
   * 
   * @returns Number of remaining slots, or null for unlimited (Premium)
   * 
   * @example
   * ```typescript
   * const remaining = await recurringItemLimitService.getRemainingSlots();
   * if (remaining !== null) {
   *   console.log(`You can add ${remaining} more items`);
   * } else {
   *   console.log('Unlimited items available (Premium)');
   * }
   * ```
   */
  async getRemainingSlots(): Promise<number | null> {
    const status = await this.getRecurringItemLimitStatus();
    return status.remainingCount;
  }

  /**
   * Check if user can add multiple recurring items
   * 
   * Useful when batch-importing or adding multiple items at once.
   * 
   * @param count - Number of recurring items to add
   * @returns True if user can add that many recurring items
   * 
   * @example
   * ```typescript
   * const canImport = await recurringItemLimitService.canAddMultiple(10);
   * if (canImport) {
   *   // Proceed with batch import
   * } else {
   *   // Show upgrade prompt
   * }
   * ```
   */
  async canAddMultiple(count: number): Promise<boolean> {
    const status = await this.getRecurringItemLimitStatus();
    
    // Premium users have unlimited
    if (status.maxAllowed === null) {
      return true;
    }

    // Check if there's enough room
    const remainingSlots = status.remainingCount || 0;
    return remainingSlots >= count;
  }
}

// Export singleton instance
export const recurringItemLimitService = new RecurringItemLimitService();

// Export class for testing
export default RecurringItemLimitService;