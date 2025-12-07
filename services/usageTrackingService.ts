/**
 * Usage Tracking Service
 * 
 * Tracks user interactions with the paywall system for analytics
 * and conversion funnel optimization. Provides methods to track
 * various events from limit reached to payment completion.
 */

import { supabase } from '../config/supabase';
import { UsageTrackingError } from '../utils/paywallErrors';
import type { 
  UsageEventType, 
  ConversionMetrics,
  BillingCycleType 
} from '../types';

/**
 * UsageTrackingService class for analytics tracking
 */
class UsageTrackingService {
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
   * Track a usage event in the database
   * @private
   */
  private async trackEvent(
    eventType: UsageEventType,
    eventContext?: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      const userId = await this.getUserId();

      const { error } = await supabase
        .from('usage_tracking_events')
        .insert({
          user_id: userId,
          event_type: eventType,
          event_context: eventContext || null,
          event_data: eventData || {},
        });

      if (error) {
        console.error(`Failed to track ${eventType} event:`, error);
        // Don't throw - tracking failures shouldn't block user actions
      }
    } catch (error) {
      console.error(`Error tracking ${eventType} event:`, error);
      // Silently fail - analytics should never block user actions
    }
  }

  /**
   * Track when user hits their subscription limit
   * 
   * @param context - Optional context (e.g., 'add_subscription_screen')
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackLimitReached('add_subscription_flow');
   * ```
   */
  async trackLimitReached(context?: string): Promise<void> {
    try {
      await this.trackEvent('limit_reached', context || 'subscription_limit', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new UsageTrackingError(
        'Failed to track limit reached event',
        'limit_reached',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track when paywall modal is shown to user
   * 
   * @param planShown - Which plan was highlighted ('monthly' or 'yearly')
   * @param context - Optional context
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackPaywallShown('yearly', 'subscription_limit');
   * ```
   */
  async trackPaywallShown(
    planShown?: 'monthly' | 'yearly',
    context?: string
  ): Promise<void> {
    try {
      await this.trackEvent('paywall_shown', context || 'paywall_modal', {
        plan_shown: planShown,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new UsageTrackingError(
        'Failed to track paywall shown event',
        'paywall_shown',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track when user selects a plan
   * 
   * @param plan - Selected billing cycle
   * @param context - Optional context
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackPlanSelected('yearly');
   * ```
   */
  async trackPlanSelected(
    plan: 'monthly' | 'yearly',
    context?: string
  ): Promise<void> {
    try {
      await this.trackEvent('plan_selected', context || 'plan_selection', {
        plan,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new UsageTrackingError(
        'Failed to track plan selected event',
        'plan_selected',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track when payment process is initiated
   * 
   * @param plan - Billing cycle
   * @param amount - Payment amount
   * @param context - Optional context
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackPaymentInitiated('yearly', 39.99);
   * ```
   */
  async trackPaymentInitiated(
    plan: 'monthly' | 'yearly',
    amount: number,
    context?: string
  ): Promise<void> {
    try {
      await this.trackEvent('payment_initiated', context || 'payment_flow', {
        plan,
        amount,
        currency: 'usd',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new UsageTrackingError(
        'Failed to track payment initiated event',
        'payment_initiated',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track successful payment completion
   * 
   * @param plan - Billing cycle
   * @param amount - Payment amount
   * @param transactionId - Transaction identifier
   * @param context - Optional context
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackPaymentCompleted(
   *   'yearly',
   *   39.99,
   *   'txn_123abc'
   * );
   * ```
   */
  async trackPaymentCompleted(
    plan: 'monthly' | 'yearly',
    amount: number,
    transactionId: string,
    context?: string
  ): Promise<void> {
    try {
      await this.trackEvent('payment_completed', context || 'payment_success', {
        plan,
        amount,
        currency: 'usd',
        transaction_id: transactionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new UsageTrackingError(
        'Failed to track payment completed event',
        'payment_completed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Track failed payment attempt
   * 
   * @param plan - Billing cycle
   * @param error - Error message or reason
   * @param context - Optional context
   * 
   * @example
   * ```typescript
   * await usageTrackingService.trackPaymentFailed(
   *   'yearly', 
   *   'Card declined'
   * );
   * ```
   */
  async trackPaymentFailed(
    plan: 'monthly' | 'yearly',
    error: string,
    context?: string
  ): Promise<void> {
    try {
      await this.trackEvent('payment_failed', context || 'payment_error', {
        plan,
        error_message: error,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      throw new UsageTrackingError(
        'Failed to track payment failed event',
        'payment_failed',
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * Get conversion funnel metrics for analytics
   * 
   * Calculates conversion rates from limit reached through to payment completed.
   * Useful for admin dashboards and analytics.
   * 
   * @param userId - Optional user ID (defaults to current user)
   * @param startDate - Optional start date for filtering
   * @param endDate - Optional end date for filtering
   * @returns Conversion metrics object
   * 
   * @example
   * ```typescript
   * const metrics = await usageTrackingService.getConversionFunnelMetrics();
   * console.log(`Conversion rate: ${metrics.conversionRate}%`);
   * ```
   */
  async getConversionFunnelMetrics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ConversionMetrics> {
    try {
      const targetUserId = userId || await this.getUserId();

      // Build query
      let query = supabase
        .from('usage_tracking_events')
        .select('event_type')
        .eq('user_id', targetUserId);

      // Add date filters if provided
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching conversion metrics:', error);
        throw error;
      }

      // Count events by type
      const eventCounts = {
        limit_reached: 0,
        paywall_shown: 0,
        plan_selected: 0,
        payment_initiated: 0,
        payment_completed: 0,
        payment_failed: 0,
      };

      data?.forEach(event => {
        if (event.event_type in eventCounts) {
          eventCounts[event.event_type as UsageEventType]++;
        }
      });

      // Calculate conversion rate (limit_reached -> payment_completed)
      const conversionRate = eventCounts.limit_reached > 0
        ? (eventCounts.payment_completed / eventCounts.limit_reached) * 100
        : 0;

      return {
        limitReachedCount: eventCounts.limit_reached,
        paywallShownCount: eventCounts.paywall_shown,
        planSelectedCount: eventCounts.plan_selected,
        paymentInitiatedCount: eventCounts.payment_initiated,
        paymentCompletedCount: eventCounts.payment_completed,
        paymentFailedCount: eventCounts.payment_failed,
        conversionRate: Math.round(conversionRate * 100) / 100, // Round to 2 decimals
      };
    } catch (error) {
      console.error('Error getting conversion funnel metrics:', error);
      throw new UsageTrackingError(
        'Failed to get conversion metrics',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all usage events for current user
   * 
   * @param limit - Maximum number of events to return
   * @param eventType - Optional filter by event type
   * @returns Array of usage events
   */
  async getUserEvents(
    limit: number = 100,
    eventType?: UsageEventType
  ): Promise<any[]> {
    try {
      const userId = await this.getUserId();

      let query = supabase
        .from('usage_tracking_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user events:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserEvents:', error);
      return [];
    }
  }

  /**
   * Check if user has reached limit (useful for UI state)
   * 
   * @returns True if limit_reached event exists
   */
  async hasReachedLimit(): Promise<boolean> {
    try {
      const userId = await this.getUserId();

      const { data, error } = await supabase
        .from('usage_tracking_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'limit_reached')
        .limit(1);

      if (error) {
        console.error('Error checking limit reached status:', error);
        return false;
      }

      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error in hasReachedLimit:', error);
      return false;
    }
  }

  /**
   * Clear all usage tracking data for current user
   * (Useful for testing or user data deletion)
   * 
   * @returns Number of events deleted
   */
  async clearUserEvents(): Promise<number> {
    try {
      const userId = await this.getUserId();

      const { data, error } = await supabase
        .from('usage_tracking_events')
        .delete()
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error clearing user events:', error);
        throw error;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error in clearUserEvents:', error);
      throw new UsageTrackingError(
        'Failed to clear user events',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();

// Export class for testing
export default UsageTrackingService;