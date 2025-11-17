/**
 * Payment Service
 * 
 * Service layer for handling Stripe payment operations through Supabase Edge Functions
 * Provides methods for subscription creation, cancellation, refunds, and billing portal access
 */

import { supabase } from '../config/supabase';
import { SUBSCRIPTION_PLANS, STRIPE_ENDPOINTS } from '../config/stripe';
import type {
  CreateSubscriptionResponse,
  CancelSubscriptionResponse,
  RefundResponse,
  BillingPortalResponse,
  SubscriptionStatusResponse,
  BillingCycleType,
} from '../types';

/**
 * PaymentService class for managing subscription payments
 */
class PaymentService {
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
   * Call a Supabase Edge Function with authentication
   * @private
   */
  private async callEdgeFunction<T>(
    functionName: string,
    body?: any
  ): Promise<T> {
    const session = await this.getSession();

    const response = await supabase.functions.invoke(functionName, {
      body: body || {},
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.error) {
      console.error(`Edge function ${functionName} error:`, response.error);
      throw new Error(response.error.message || `Failed to call ${functionName}`);
    }

    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Operation failed');
    }

    return response.data.data as T;
  }

  /**
   * Initiate a new subscription
   * 
   * @param billingCycle - Monthly or yearly billing cycle
   * @returns Subscription details including client secret for payment confirmation
   * 
   * @example
   * ```typescript
   * const result = await paymentService.initiateSubscription('monthly');
   * // Use result.clientSecret with Stripe SDK to confirm payment
   * ```
   */
  async initiateSubscription(
    billingCycle: BillingCycleType
  ): Promise<CreateSubscriptionResponse> {
    const plan = SUBSCRIPTION_PLANS[billingCycle];
    
    if (!plan) {
      throw new Error(`Invalid billing cycle: ${billingCycle}`);
    }

    try {
      const result = await this.callEdgeFunction<CreateSubscriptionResponse>(
        'create-subscription',
        {
          billingCycle,
          priceId: plan.priceId,
        }
      );

      return result;
    } catch (error) {
      console.error('Error initiating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel an active subscription
   * 
   * @param immediate - If true, cancel immediately. If false (default), cancel at period end
   * @returns Cancellation details
   * 
   * @example
   * ```typescript
   * // Cancel at end of billing period
   * await paymentService.cancelSubscription(false);
   * 
   * // Cancel immediately
   * await paymentService.cancelSubscription(true);
   * ```
   */
  async cancelSubscription(
    immediate: boolean = false
  ): Promise<CancelSubscriptionResponse> {
    try {
      const result = await this.callEdgeFunction<CancelSubscriptionResponse>(
        'cancel-subscription',
        { immediate }
      );

      return result;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Request a refund for a subscription
   * 
   * @param subscriptionId - The subscription ID to refund
   * @param reason - Optional reason for the refund
   * @returns Refund details
   * 
   * @example
   * ```typescript
   * const result = await paymentService.requestRefund(
   *   'sub-123',
   *   'Not satisfied with service'
   * );
   * ```
   */
  async requestRefund(
    subscriptionId: string,
    reason?: string
  ): Promise<RefundResponse> {
    try {
      const result = await this.callEdgeFunction<RefundResponse>(
        'request-refund',
        {
          subscriptionId,
          reason,
        }
      );

      return result;
    } catch (error) {
      console.error('Error requesting refund:', error);
      throw error;
    }
  }

  /**
   * Get Stripe billing portal URL
   * 
   * @param returnUrl - Optional URL to return to after portal session
   * @returns Billing portal URL
   * 
   * @example
   * ```typescript
   * const { url } = await paymentService.getBillingPortalUrl();
   * // Open URL in browser
   * Linking.openURL(url);
   * ```
   */
  async getBillingPortalUrl(returnUrl?: string): Promise<BillingPortalResponse> {
    try {
      const result = await this.callEdgeFunction<BillingPortalResponse>(
        'get-billing-portal',
        returnUrl ? { returnUrl } : {}
      );

      return result;
    } catch (error) {
      console.error('Error getting billing portal:', error);
      throw error;
    }
  }

  /**
   * Check current subscription status
   * 
   * @returns Current subscription status and plan information
   * 
   * @example
   * ```typescript
   * const status = await paymentService.checkSubscriptionStatus();
   * if (status.hasActiveSubscription) {
   *   console.log('User has premium access');
   * }
   * ```
   */
  async checkSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      // Query user's current subscription
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier:subscription_tiers(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      // Determine if user has active subscription
      const hasActiveSubscription = subscription && 
        ['active', 'trialing'].includes(subscription.status);

      return {
        hasActiveSubscription,
        subscription: subscription || undefined,
        plan: hasActiveSubscription ? 'premium' : 'free',
      };
    } catch (error) {
      console.error('Error checking subscription status:', error);
      throw error;
    }
  }

  /**
   * Get subscription count for current user
   * 
   * @returns Number of subscriptions the user is tracking
   */
  async getSubscriptionCount(): Promise<number> {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      const { count, error } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting subscription count:', error);
      throw error;
    }
  }

  /**
   * Check if user can add more subscriptions based on their plan
   * 
   * @returns Whether user can add more subscriptions
   */
  async canAddSubscription(): Promise<boolean> {
    try {
      const [status, count] = await Promise.all([
        this.checkSubscriptionStatus(),
        this.getSubscriptionCount(),
      ]);

      // Premium users have unlimited subscriptions
      if (status.hasActiveSubscription) {
        return true;
      }

      // Free users are limited to 5 subscriptions
      const FREE_TIER_LIMIT = 5;
      return count < FREE_TIER_LIMIT;
    } catch (error) {
      console.error('Error checking if can add subscription:', error);
      throw error;
    }
  }

  /**
   * Get payment transaction history for current user
   * 
   * @returns List of payment transactions
   */
  async getPaymentHistory() {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      const { data: transactions, error } = await supabase
        .from('payment_transactions')
        .select(`
          *,
          user_subscription:user_subscriptions(*)
        `)
        .eq('user_subscription.user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return transactions || [];
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

// Export class for testing
export default PaymentService;