/**
 * Subscription Limit Service
 * 
 * Manages subscription limit enforcement based on user tier.
 * Provides methods to check limits, get status, and enforce restrictions.
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
  SubscriptionLimitStatus, 
  CheckSubscriptionLimitResponse 
} from '../types';

/**
 * SubscriptionLimitService class for managing subscription limits
 */
class SubscriptionLimitService {
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
   * Check if user can add a new subscription
   * 
   * @returns Object with permission status and details
   * 
   * @example
   * ```typescript
   * const check = await subscriptionLimitService.checkCanAddSubscription();
   * if (!check.canAdd) {
   *   // Show paywall or upgrade prompt
   *   console.log(check.reason);
   * }
   * ```
   */
  async checkCanAddSubscription(): Promise<{
    canAdd: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
    isPremium: boolean;
  }> {
    try {
      const userId = await this.getUserId();
      const cacheKey = `can-add-sub-${userId}`;

      // Check cache first
      const cached = subscriptionCache.get<CheckSubscriptionLimitResponse>(cacheKey);
      if (cached) {
        return {
          canAdd: cached.can_add,
          reason: cached.reason,
          currentCount: cached.current_count,
          limit: cached.limit,
          isPremium: cached.is_premium,
        };
      }

      // Query database using the check_subscription_limit function
      const { data, error } = await supabase
        .rpc('can_user_add_subscription', { p_user_id: userId })
        .single();

      if (error) {
        console.error('Error checking subscription limit:', error);
        // On error, default to allowing (graceful degradation)
        return {
          canAdd: true,
          currentCount: 0,
          limit: 5,
          isPremium: false,
          reason: 'Unable to check limit, proceeding...',
        };
      }

      // Cache the result
      const result: CheckSubscriptionLimitResponse = {
        can_add: data.allowed,
        current_count: data.current_count,
        limit: data.limit_count,
        is_premium: data.tier === 'premium_tier' || data.tier === 'premium',
        tier_name: data.tier,
        reason: data.allowed 
          ? undefined 
          : `You've reached your ${data.tier} plan limit of ${data.limit_count} subscriptions.`,
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
      console.error('Error in checkCanAddSubscription:', error);
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
   * Get current subscription limit status with detailed information
   * 
   * @returns Complete subscription limit status
   * 
   * @example
   * ```typescript
   * const status = await subscriptionLimitService.getSubscriptionLimitStatus();
   * console.log(`${status.currentCount} of ${status.maxAllowed} subscriptions used`);
   * ```
   */
  async getSubscriptionLimitStatus(): Promise<SubscriptionLimitStatus> {
    try {
      const userId = await this.getUserId();
      const cacheKey = CacheKeys.limitStatus(userId);

      // Check cache first
      const cached = subscriptionCache.get<SubscriptionLimitStatus>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get limit check data
      const check = await this.checkCanAddSubscription();

      // Calculate remaining count
      const maxAllowed = check.limit === -1 ? null : check.limit;
      const remainingCount = maxAllowed === null 
        ? null 
        : Math.max(0, check.limit - check.currentCount);

      const status: SubscriptionLimitStatus = {
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
      console.error('Error getting subscription limit status:', error);
      throw new TierNotFoundError(
        'Unable to retrieve subscription limit status',
        undefined
      );
    }
  }

  /**
   * Enforce subscription limit before executing a callback
   * 
   * @param callback - Function to execute if limit allows
   * @throws SubscriptionLimitError if limit is exceeded
   * 
   * @example
   * ```typescript
   * await subscriptionLimitService.enforceSubscriptionLimit(async () => {
   *   // Add subscription logic here
   * });
   * ```
   */
  async enforceSubscriptionLimit(callback: () => void | Promise<void>): Promise<void> {
    const check = await this.checkCanAddSubscription();

    if (!check.canAdd) {
      // Import usage tracking to log this event
      const { usageTrackingService } = await import('./usageTrackingService');
      await usageTrackingService.trackLimitReached().catch(err => {
        console.error('Failed to track limit reached event:', err);
      });

      throw new SubscriptionLimitError(
        check.reason || 'Subscription limit reached',
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
   * Call this after:
   * - Adding or deleting a subscription
   * - Upgrading or downgrading tier
   * - Any change that affects subscription count or tier
   * 
   * @example
   * ```typescript
   * await subscriptionService.createSubscription(newSub);
   * await subscriptionLimitService.refreshLimitStatus();
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
      // CRITICAL: Also invalidate the checkCanAddSubscription cache
      subscriptionCache.invalidate(`can-add-sub-${userId}`);

      // Optionally pre-fetch fresh data
      await this.checkCanAddSubscription();
    } catch (error) {
      console.error('Error refreshing limit status:', error);
      // Don't throw - refresh is best-effort
    }
  }

  /**
   * Get subscription count for current user
   * 
   * @returns Number of subscriptions user has
   */
  async getSubscriptionCount(): Promise<number> {
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
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting subscription count:', error);
        return 0;
      }

      const subscriptionCount = count || 0;

      // Cache the result
      subscriptionCache.set(cacheKey, subscriptionCount, CacheTTL.SHORT);

      return subscriptionCount;
    } catch (error) {
      console.error('Error in getSubscriptionCount:', error);
      return 0;
    }
  }

  /**
   * Check if user is at their subscription limit
   * 
   * @returns True if user cannot add more subscriptions
   */
  async isAtLimit(): Promise<boolean> {
    const check = await this.checkCanAddSubscription();
    return !check.canAdd;
  }

  /**
   * Get remaining subscription slots available
   * 
   * @returns Number of remaining slots, or null for unlimited
   */
  async getRemainingSlots(): Promise<number | null> {
    const status = await this.getSubscriptionLimitStatus();
    return status.remainingCount;
  }

  /**
   * Check if user can add multiple subscriptions
   * 
   * @param count - Number of subscriptions to add
   * @returns True if user can add that many subscriptions
   */
  async canAddMultiple(count: number): Promise<boolean> {
    const status = await this.getSubscriptionLimitStatus();
    
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
export const subscriptionLimitService = new SubscriptionLimitService();

// Export class for testing
export default SubscriptionLimitService;