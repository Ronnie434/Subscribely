/**
 * Paywall Test Helpers
 * 
 * Utility functions for testing paywall functionality.
 * These helpers allow you to simulate various user states
 * and conditions for testing limit enforcement and tier management.
 * 
 * WARNING: These functions should only be used in development/testing environments.
 */

import { supabase } from '../config/supabase';
import { subscriptionCache } from './subscriptionCache';
import type { ConversionMetrics } from '../types';

/**
 * PaywallTestHelpers class for testing utilities
 */
class PaywallTestHelpers {
  /**
   * Check if running in test/development environment
   * @private
   */
  private isTestEnvironment(): boolean {
    return __DEV__ || process.env.NODE_ENV === 'development';
  }

  /**
   * Get user ID (defaults to current user if not provided)
   * @private
   */
  private async getUserId(userId?: string): Promise<string> {
    if (userId) return userId;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return session.user.id;
  }

  /**
   * Set user to subscription limit by creating dummy subscriptions
   * 
   * WARNING: Only use in testing. This creates fake subscriptions.
   * 
   * @param userId - User ID (defaults to current user)
   * @param limit - Number of subscriptions to create (default: 5)
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.setUserToLimit();
   * // User now has 5 subscriptions
   * ```
   */
  async setUserToLimit(userId?: string, limit: number = 5): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('setUserToLimit can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      // Create dummy subscriptions up to limit
      const subscriptions = Array.from({ length: limit }, (_, i) => ({
        user_id: targetUserId,
        name: `Test Subscription ${i + 1}`,
        cost: 9.99,
        billing_cycle: 'monthly' as const,
        renewal_date: new Date().toISOString(),
        category: 'Entertainment',
        reminders: true,
      }));

      const { error } = await supabase
        .from('subscriptions')
        .insert(subscriptions);

      if (error) {
        throw error;
      }

      // Clear cache to reflect changes
      subscriptionCache.clear();

      console.log(`✓ Created ${limit} test subscriptions for user ${targetUserId}`);
    } catch (error) {
      console.error('Error setting user to limit:', error);
      throw error;
    }
  }

  /**
   * Make user a premium subscriber
   * 
   * WARNING: Only use in testing. This directly modifies database.
   * 
   * @param userId - User ID (defaults to current user)
   * @param billingCycle - Billing cycle (default: 'monthly')
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.makePremiumUser();
   * // User is now premium
   * ```
   */
  async makePremiumUser(
    userId?: string, 
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('makePremiumUser can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      // Update or insert user subscription
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: targetUserId,
          tier_id: 'premium',
          billing_cycle: billingCycle,
          status: 'active',
          stripe_customer_id: `test_cus_${Date.now()}`,
          stripe_subscription_id: `test_sub_${Date.now()}`,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      // Clear cache to reflect changes
      subscriptionCache.clear();

      console.log(`✓ Made user ${targetUserId} premium (${billingCycle})`);
    } catch (error) {
      console.error('Error making user premium:', error);
      throw error;
    }
  }

  /**
   * Reset user to free tier
   * 
   * WARNING: Only use in testing. This removes premium status.
   * 
   * @param userId - User ID (defaults to current user)
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.resetToFreeTier();
   * // User is back to free tier
   * ```
   */
  async resetToFreeTier(userId?: string): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('resetToFreeTier can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      // Update user subscription to free tier
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: targetUserId,
          tier_id: 'free',
          billing_cycle: 'none',
          status: 'active',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      // Clear cache to reflect changes
      subscriptionCache.clear();

      console.log(`✓ Reset user ${targetUserId} to free tier`);
    } catch (error) {
      console.error('Error resetting to free tier:', error);
      throw error;
    }
  }

  /**
   * Clear all usage tracking events for user
   * 
   * WARNING: Only use in testing. This deletes analytics data.
   * 
   * @param userId - User ID (defaults to current user)
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.clearUsageTracking();
   * // All usage events deleted
   * ```
   */
  async clearUsageTracking(userId?: string): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('clearUsageTracking can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      const { error } = await supabase
        .from('usage_tracking_events')
        .delete()
        .eq('user_id', targetUserId);

      if (error) {
        throw error;
      }

      console.log(`✓ Cleared usage tracking for user ${targetUserId}`);
    } catch (error) {
      console.error('Error clearing usage tracking:', error);
      throw error;
    }
  }

  /**
   * Get test metrics for a user
   * 
   * @param userId - User ID (defaults to current user)
   * @returns Test metrics object
   * 
   * @example
   * ```typescript
   * const metrics = await paywallTestHelpers.getTestMetrics();
   * console.log(`Subscriptions: ${metrics.subscriptionCount}`);
   * console.log(`Is Premium: ${metrics.isPremium}`);
   * ```
   */
  async getTestMetrics(userId?: string): Promise<{
    subscriptionCount: number;
    isPremium: boolean;
    tierName: string;
    canAddMore: boolean;
    usageEvents: number;
    conversionMetrics?: ConversionMetrics;
  }> {
    try {
      const targetUserId = await this.getUserId(userId);

      // Get subscription count
      const { count: subscriptionCount } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      // Get tier info
      const { data: userSub } = await supabase
        .from('user_subscriptions')
        .select('tier_id, status')
        .eq('user_id', targetUserId)
        .single();

      const isPremium = userSub?.tier_id === 'premium_tier' &&
                        ['active', 'trialing'].includes(userSub?.status);

      // Check if can add more
      const { data: limitCheck } = await supabase
        .rpc('can_user_add_subscription', { p_user_id: targetUserId })
        .single();

      // Get usage events count
      const { count: usageEvents } = await supabase
        .from('usage_tracking_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      return {
        subscriptionCount: subscriptionCount || 0,
        isPremium,
        tierName: userSub?.tier_id || 'free',
        canAddMore: limitCheck?.allowed || false,
        usageEvents: usageEvents || 0,
      };
    } catch (error) {
      console.error('Error getting test metrics:', error);
      throw error;
    }
  }

  /**
   * Delete all test subscriptions for a user
   * 
   * WARNING: Only use in testing. This deletes all subscriptions.
   * 
   * @param userId - User ID (defaults to current user)
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.deleteAllSubscriptions();
   * // All subscriptions deleted
   * ```
   */
  async deleteAllSubscriptions(userId?: string): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('deleteAllSubscriptions can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', targetUserId);

      if (error) {
        throw error;
      }

      // Clear cache to reflect changes
      subscriptionCache.clear();

      console.log(`✓ Deleted all subscriptions for user ${targetUserId}`);
    } catch (error) {
      console.error('Error deleting subscriptions:', error);
      throw error;
    }
  }

  /**
   * Simulate complete conversion funnel by creating all tracking events
   * 
   * WARNING: Only use in testing.
   * 
   * @param userId - User ID (defaults to current user)
   * @param completed - Whether to complete the funnel with payment
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.simulateConversionFunnel(undefined, true);
   * // All funnel events created including payment
   * ```
   */
  async simulateConversionFunnel(
    userId?: string, 
    completed: boolean = false
  ): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('simulateConversionFunnel can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      const events = [
        { event_type: 'limit_reached', event_context: 'test' },
        { event_type: 'paywall_shown', event_context: 'test' },
        { event_type: 'plan_selected', event_context: 'test', event_data: { plan: 'yearly' } },
        { event_type: 'payment_initiated', event_context: 'test', event_data: { plan: 'yearly', amount: 39 } },
      ];

      if (completed) {
        events.push({
          event_type: 'payment_completed',
          event_context: 'test',
          event_data: { plan: 'yearly', amount: 39, transaction_id: 'test_txn' },
        });
      } else {
        events.push({
          event_type: 'payment_failed',
          event_context: 'test',
          event_data: { plan: 'yearly', error: 'test error' },
        });
      }

      const eventsWithUser = events.map(event => ({
        ...event,
        user_id: targetUserId,
      }));

      const { error } = await supabase
        .from('usage_tracking_events')
        .insert(eventsWithUser);

      if (error) {
        throw error;
      }

      console.log(`✓ Simulated conversion funnel for user ${targetUserId} (${completed ? 'completed' : 'failed'})`);
    } catch (error) {
      console.error('Error simulating conversion funnel:', error);
      throw error;
    }
  }

  /**
   * Reset everything for a user (subscriptions, tier, usage tracking)
   * 
   * WARNING: Only use in testing. This resets all user data.
   * 
   * @param userId - User ID (defaults to current user)
   * 
   * @example
   * ```typescript
   * await paywallTestHelpers.resetEverything();
   * // User reset to clean state
   * ```
   */
  async resetEverything(userId?: string): Promise<void> {
    if (!this.isTestEnvironment()) {
      throw new Error('resetEverything can only be used in test environments');
    }

    try {
      const targetUserId = await this.getUserId(userId);

      // Delete all subscriptions
      await this.deleteAllSubscriptions(targetUserId);

      // Reset to free tier
      await this.resetToFreeTier(targetUserId);

      // Clear usage tracking
      await this.clearUsageTracking(targetUserId);

      // Clear cache
      subscriptionCache.clear();

      console.log(`✓ Reset everything for user ${targetUserId}`);
    } catch (error) {
      console.error('Error resetting everything:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const paywallTestHelpers = new PaywallTestHelpers();

// Export class for testing
export default PaywallTestHelpers;