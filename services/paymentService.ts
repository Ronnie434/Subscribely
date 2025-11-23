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
   * Pause an active subscription
   *
   * @param resumeDate - Optional date when subscription should automatically resume
   * @returns Pause confirmation details
   *
   * @example
   * ```typescript
   * // Pause for 30 days
   * const resumeDate = new Date();
   * resumeDate.setDate(resumeDate.getDate() + 30);
   * await paymentService.pauseSubscription(resumeDate);
   * ```
   */
  async pauseSubscription(resumeDate?: Date): Promise<{ success: boolean; message: string }> {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      // Get current subscription
      const { data: subscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !subscription) {
        throw new Error('No active subscription found');
      }

      // Update subscription status to paused
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          resume_at: resumeDate ? resumeDate.toISOString() : null,
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: resumeDate
          ? `Subscription paused until ${resumeDate.toLocaleDateString()}`
          : 'Subscription paused successfully',
      };
    } catch (error) {
      console.error('Error pausing subscription:', error);
      throw error;
    }
  }

  /**
   * Resume a paused subscription
   *
   * @returns Resume confirmation details
   *
   * @example
   * ```typescript
   * await paymentService.resumeSubscription();
   * ```
   */
  async resumeSubscription(): Promise<{ success: boolean; message: string }> {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      // Get current subscription
      const { data: subscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError || !subscription) {
        throw new Error('No subscription found');
      }

      // Update subscription status to active
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          paused_at: null,
          resume_at: null,
        })
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      return {
        success: true,
        message: 'Subscription resumed successfully',
      };
    } catch (error) {
      console.error('Error resuming subscription:', error);
      throw error;
    }
  }

  /**
   * Switch subscription billing cycle
   *
   * @param newCycle - The new billing cycle (monthly or yearly)
   * @returns Billing cycle switch confirmation
   *
   * @example
   * ```typescript
   * // Switch from monthly to yearly
   * await paymentService.switchBillingCycle('yearly');
   * ```
   */
  async switchBillingCycle(newCycle: BillingCycleType): Promise<{ success: boolean; message: string; prorationAmount?: number }> {
    try {
      const session = await this.getSession();
      const userId = session.user.id;

      const plan = SUBSCRIPTION_PLANS[newCycle];
      
      if (!plan) {
        throw new Error(`Invalid billing cycle: ${newCycle}`);
      }

      // Get current subscription to check status
      const { data: subscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('billing_cycle, status')
        .eq('user_id', userId)
        .single();

      if (fetchError || !subscription) {
        throw new Error('No active subscription found');
      }

      // Check if already on the requested cycle
      const currentCycle = subscription.billing_cycle === 'annual' ? 'yearly' : 'monthly';
      if (currentCycle === newCycle) {
        throw new Error(`Already on ${newCycle} billing cycle`);
      }

      // Call edge function to update Stripe subscription with proration
      const result = await this.callEdgeFunction<{
        subscriptionId: string;
        newBillingCycle: string;
        prorationAmount: number;
        nextBillingDate: string;
        message: string;
      }>('switch-billing-cycle', {
        newBillingCycle: newCycle,
      });

      // Database will be updated by webhook (subscription.updated event)
      
      return {
        success: true,
        message: result.message,
        prorationAmount: result.prorationAmount,
      };
    } catch (error) {
      console.error('Error switching billing cycle:', error);
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
        ['active', 'trialing', 'incomplete', 'past_due', 'paused'].includes(subscription.status);

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
          id,
          amount,
          currency,
          status,
          created_at,
          stripe_invoice_id,
          stripe_payment_intent_id,
          user_subscription:user_subscriptions!inner(user_id)
        `)
        .eq('user_subscription.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      // Transform to match UI interface
      return (transactions || []).map(item => ({
        id: item.id,
        amount: item.amount,
        currency: item.currency,
        status: item.status as 'succeeded' | 'failed' | 'refunded',
        created_at: item.created_at,
        stripe_invoice_id: item.stripe_invoice_id,
        stripe_payment_intent_id: item.stripe_payment_intent_id,
      }));
    } catch (error) {
      console.error('Error getting payment history:', error);
      throw new Error('Failed to load billing history');
    }
  }

  /**
   * Get downloadable invoice URL from Stripe
   * Fetches on-demand to avoid storing URLs (they can expire)
   *
   * @param stripeInvoiceId - The Stripe invoice ID
   * @returns Invoice URL that can be opened in browser
   */
  async getInvoiceUrl(stripeInvoiceId: string): Promise<string> {
    try {
      const result = await this.callEdgeFunction<{ url: string }>(
        'get-invoice-url',
        { invoiceId: stripeInvoiceId }
      );
      return result.url;
    } catch (error) {
      console.error('Error fetching invoice URL:', error);
      throw new Error('Unable to retrieve invoice. Please try again.');
    }
  }

  /**
   * Fetches the most recent successful payment amount for the current user
   * @returns The payment amount or null if no payments exist
   */
  async getUserBillingInfo(): Promise<number | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('payment_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;
      return data.amount;
    } catch (error) {
      console.error('Error fetching billing info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();

// Export class for testing
export default PaymentService;