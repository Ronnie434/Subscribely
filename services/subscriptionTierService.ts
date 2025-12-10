/**
 * Subscription Tier Service
 *
 * Manages user's APP SUBSCRIPTION TIER (Premium/Free plans).
 *
 * IMPORTANT TERMINOLOGY CLARIFICATION:
 * - This service manages the user's subscription TO THE APP (Premium vs Free tier)
 * - It does NOT manage the recurring expenses/items that users track
 * - For tracked expenses (Netflix, gym, etc.), see recurringItemService.ts
 *
 * This service handles:
 * - Checking user's current tier (Free or Premium)
 * - Upgrading to Premium (payment processing)
 * - Downgrading to Free
 * - Querying tier features and limits
 *
 * @since v1.0.0
 * @see {@link ./recurringItemService.ts} for managing tracked expenses
 * @see {@link ./paymentService.ts} for Stripe payment operations
 */

import { supabase } from '../config/supabase';
import { paymentService } from './paymentService';
import { 
  subscriptionCache, 
  CacheKeys, 
  CacheTTL 
} from '../utils/subscriptionCache';
import { TierNotFoundError } from '../utils/paywallErrors';
import type { 
  SubscriptionTier, 
  BillingCycleType 
} from '../types';

/**
 * SubscriptionTierService class for tier management
 */
class SubscriptionTierService {
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
   * Get user's current subscription tier with all details
   * 
   * @returns Current subscription tier information
   * 
   * @example
   * ```typescript
   * const tier = await subscriptionTierService.getCurrentTier();
   * console.log(`Current tier: ${tier.name}`);
   * console.log(`Max subscriptions: ${tier.maxSubscriptions || 'Unlimited'}`);
   * ```
   */
  async getCurrentTier(): Promise<SubscriptionTier> {
    try {
      const userId = await this.getUserId();
      const cacheKey = CacheKeys.currentTier(userId);

      // Check cache first
      const cached = subscriptionCache.get<SubscriptionTier>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query user's current subscription and tier details
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          tier_id,
          billing_cycle,
          status,
          subscription_tiers (
            tier_id,
            name,
            description,
            monthly_price,
            annual_price,
            subscription_limit,
            features,
            is_active
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        // PGRST116 means no rows found - this is expected for free tier users
        if (error.code === 'PGRST116') {
          if (__DEV__) {
            console.log('[SubscriptionTier] No subscription record found, returning free tier');
          }
          return this.getFreeTier();
        }
        // Other errors are unexpected
        console.error('Error fetching current tier:', error);
        throw error;
      }

      if (!data || !data.subscription_tiers) {
        throw new TierNotFoundError('Tier data not found');
      }

      const tierData = Array.isArray(data.subscription_tiers) 
        ? data.subscription_tiers[0] 
        : data.subscription_tiers;

      const tier: SubscriptionTier = {
        id: tierData.tier_id,
        name: tierData.name as 'free' | 'premium',
        maxSubscriptions: tierData.subscription_limit === -1 
          ? null 
          : tierData.subscription_limit,
        priceMonthly: Number(tierData.monthly_price),
        priceYearly: Number(tierData.annual_price),
        features: Array.isArray(tierData.features) 
          ? tierData.features 
          : [],
        isActive: tierData.is_active,
      };

      // Cache the result
      subscriptionCache.set(cacheKey, tier, CacheTTL.MEDIUM);

      return tier;
    } catch (error) {
      console.error('Error in getCurrentTier:', error);
      throw new TierNotFoundError(
        'Unable to retrieve current tier',
        undefined
      );
    }
  }

  /**
   * Get the free tier details
   * @private
   */
  private async getFreeTier(): Promise<SubscriptionTier> {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('tier_id', 'free')
      .single();

    if (error || !data) {
      // Return default free tier if database query fails
      return {
        id: 'free',
        name: 'free',
        maxSubscriptions: 5,
        priceMonthly: 0,
        priceYearly: 0,
        features: ['cloud_sync', 'renewal_reminders', 'basic_stats'],
        isActive: true,
      };
    }

    return {
      id: data.tier_id,
      name: data.name as 'free' | 'premium',
      maxSubscriptions: data.subscription_limit === -1 
        ? null 
        : data.subscription_limit,
      priceMonthly: Number(data.monthly_price),
      priceYearly: Number(data.annual_price),
      features: Array.isArray(data.features) ? data.features : [],
      isActive: data.is_active,
    };
  }

  /**
   * Upgrade user to premium tier
   * 
   * Initiates the upgrade process by creating a payment subscription.
   * The actual tier upgrade happens via Stripe webhook after successful payment.
   * 
   * @param billingCycle - Monthly or yearly billing
   * @returns Payment details including client secret
   * 
   * @example
   * ```typescript
   * const result = await subscriptionTierService.upgradeToPremium('yearly');
   * // Use result.clientSecret with Stripe to complete payment
   * ```
   */
  async upgradeToPremium(billingCycle: BillingCycleType) {
    try {
      const userId = await this.getUserId();

      // Check if already premium
      const isPremium = await this.isPremiumUser();
      if (isPremium) {
        throw new Error('User is already on premium tier');
      }

      // Initiate payment through payment service
      const paymentResult = await paymentService.initiateSubscription(billingCycle);

      // Clear cache after initiating upgrade
      this.clearUserCache(userId);

      return paymentResult;
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      throw error;
    }
  }

  /**
   * Downgrade user to free tier
   * 
   * Cancels active subscription and downgrades to free tier.
   * If user has more than 5 subscriptions, they'll be in read-only mode.
   * 
   * @returns True if downgrade successful
   * 
   * @example
   * ```typescript
   * await subscriptionTierService.downgradeToFree();
   * ```
   */
  async downgradeToFree(): Promise<boolean> {
    try {
      const userId = await this.getUserId();

      // Call the database downgrade function
      const { data, error } = await supabase
        .rpc('downgrade_to_free', { p_user_id: userId });

      if (error) {
        console.error('Error downgrading to free:', error);
        throw error;
      }

      // Clear all cache after downgrade
      this.clearUserCache(userId);

      // Import and refresh limit service
      const { subscriptionLimitService } = await import('./subscriptionLimitService');
      await subscriptionLimitService.refreshLimitStatus();

      return data === true;
    } catch (error) {
      console.error('Error in downgradeToFree:', error);
      throw error;
    }
  }

  /**
   * Get all available subscription tiers
   * 
   * @returns Array of all active subscription tiers
   * 
   * @example
   * ```typescript
   * const tiers = await subscriptionTierService.getAvailableTiers();
   * tiers.forEach(tier => {
   *   console.log(`${tier.name}: $${tier.priceMonthly}/month`);
   * });
   * ```
   */
  async getAvailableTiers(): Promise<SubscriptionTier[]> {
    try {
      const cacheKey = CacheKeys.availableTiers();

      // Check cache first
      const cached = subscriptionCache.get<SubscriptionTier[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query all active tiers
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching available tiers:', error);
        throw error;
      }

      const tiers: SubscriptionTier[] = (data || []).map(tier => ({
        id: tier.tier_id,
        name: tier.name as 'free' | 'premium',
        maxSubscriptions: tier.subscription_limit === -1 
          ? null 
          : tier.subscription_limit,
        priceMonthly: Number(tier.monthly_price),
        priceYearly: Number(tier.annual_price),
        features: Array.isArray(tier.features) ? tier.features : [],
        isActive: tier.is_active,
      }));

      // Cache with longer TTL since tiers rarely change
      subscriptionCache.set(cacheKey, tiers, CacheTTL.VERY_LONG);

      return tiers;
    } catch (error) {
      console.error('Error in getAvailableTiers:', error);
      throw new TierNotFoundError('Unable to fetch available tiers');
    }
  }

  /**
   * Quick check if user has premium subscription
   * 
   * @returns True if user is premium
   * 
   * @example
   * ```typescript
   * const isPremium = await subscriptionTierService.isPremiumUser();
   * if (isPremium) {
   *   // Show premium features
   * }
   * ```
   */
  async isPremiumUser(): Promise<boolean> {
    console.log('[isPremiumUser] 🚀 === FUNCTION CALLED ===');
    
    try {
      const userId = await this.getUserId();
      console.log('[isPremiumUser] 👤 User ID:', userId);
      console.log('[isPremiumUser] ⚠️ NOTE: If you cancelled subscription but still seeing free tier, run database/fix_rpc_canceled_subscription.sql migration');
      
      // Clear cache for debugging
      const cacheKey = CacheKeys.isPremium(userId);
      console.log('[isPremiumUser] 🧹 FORCE CLEARING CACHE (debugging)');
      subscriptionCache.invalidate(cacheKey);
      
      console.log('[isPremiumUser] 🔑 Cache key:', cacheKey);

      // Check cache first
      const cached = subscriptionCache.get<boolean>(cacheKey);
      console.log('[isPremiumUser] 💾 Cache check result:', cached, '(null means not cached)');
      
      if (cached !== null) {
        console.log('[isPremiumUser] ⚡ RETURNING CACHED VALUE:', cached);
        return cached;
      }

      console.log('[isPremiumUser] 🔍 Cache miss, querying database...');

      // Check user's subscription status
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('tier_id, status, cancel_at_period_end, current_period_end')
        .eq('user_id', userId)
        .single();

      console.log('[isPremiumUser] 📊 Raw database result:', JSON.stringify({
        tier_id: data?.tier_id,
        status: data?.status,
        cancel_at_period_end: data?.cancel_at_period_end,
        current_period_end: data?.current_period_end,
        has_data: !!data
      }, null, 2));

      if (error) {
        // If no subscription record, user is free tier
        if (error.code === 'PGRST116') {
          subscriptionCache.set(cacheKey, false, CacheTTL.MEDIUM);
          return false;
        }
        throw error;
      }

      // Check if premium tier
      if (data.tier_id !== 'premium_tier') {
        subscriptionCache.set(cacheKey, false, CacheTTL.MEDIUM);
        return false;
      }

      // Handle canceled subscriptions that are still valid
      if (data.status === 'canceled') {
        console.log('[isPremiumUser] ⚠️ === CANCELED SUBSCRIPTION DETECTED ===');
        console.log('[isPremiumUser] 📋 Checking payment provider...');
        
        // Check if this is an Apple IAP subscription
        const { data: profile } = await supabase
          .from('profiles')
          .select('payment_provider')
          .eq('id', userId)
          .maybeSingle();
        
        console.log('[isPremiumUser] 💳 Payment provider:', profile?.payment_provider);
        
        // For Apple IAP, check apple_transactions for authoritative expiry date
        if (profile?.payment_provider === 'apple') {
          const { data: appleData } = await supabase
            .from('apple_transactions')
            .select('expiration_date, notification_type')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (appleData?.expiration_date) {
            const expiryDate = new Date(appleData.expiration_date);
            const now = new Date();
            const isStillValid = expiryDate > now;
            
            if (__DEV__) {
              console.log('[SubscriptionTier] 🍎 Apple canceled subscription check:', {
                expiryDate: expiryDate.toISOString(),
                now: now.toISOString(),
                isStillValid,
                daysRemaining: Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                notification_type: appleData.notification_type
              });
            }
            
            subscriptionCache.set(cacheKey, isStillValid, 300000);
            return isStillValid;
          }
        }
        
        // For Stripe or other providers, check user_subscriptions.current_period_end
        if (data.cancel_at_period_end && data.current_period_end) {
          const expiryDate = new Date(data.current_period_end);
          const now = new Date();
          const isStillValid = expiryDate > now;
          
          if (__DEV__) {
            console.log('[SubscriptionTier] 💳 Stripe/other canceled subscription check:', {
              expiryDate: expiryDate.toISOString(),
              now: now.toISOString(),
              isStillValid,
              daysRemaining: Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            });
          }
          
          subscriptionCache.set(cacheKey, isStillValid, 300000);
          return isStillValid;
        }
        
        // If neither Apple data nor Stripe current_period_end available, treat as expired
        subscriptionCache.set(cacheKey, false, 300000);
        return false;
      }

      // Check active statuses
      const isPremium = ['active', 'trialing', 'incomplete', 'past_due', 'paused'].includes(data.status);

      // Cache the result
      subscriptionCache.set(cacheKey, isPremium, CacheTTL.MEDIUM);

      return isPremium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      // Default to false on error
      return false;
    }
  }

  /**
   * Get tier by ID
   * 
   * @param tierId - Tier identifier ('free' or 'premium')
   * @returns Tier details
   */
  async getTierById(tierId: string): Promise<SubscriptionTier> {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('tier_id', tierId)
        .single();

      if (error || !data) {
        throw new TierNotFoundError(`Tier not found: ${tierId}`, tierId);
      }

      return {
        id: data.tier_id,
        name: data.name as 'free' | 'premium',
        maxSubscriptions: data.subscription_limit === -1 
          ? null 
          : data.subscription_limit,
        priceMonthly: Number(data.monthly_price),
        priceYearly: Number(data.annual_price),
        features: Array.isArray(data.features) ? data.features : [],
        isActive: data.is_active,
      };
    } catch (error) {
      console.error('Error fetching tier by ID:', error);
      throw new TierNotFoundError(`Unable to fetch tier: ${tierId}`, tierId);
    }
  }

  /**
   * Get premium tier details
   * 
   * @returns Premium tier information
   */
  async getPremiumTier(): Promise<SubscriptionTier> {
    return this.getTierById('premium');
  }

  /**
   * Check if user has an active payment subscription
   * 
   * @returns True if user has active Stripe subscription
   */
  async hasActivePaymentSubscription(): Promise<boolean> {
    try {
      const userId = await this.getUserId();

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id, status')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      return Boolean(data.stripe_subscription_id) && 
             ['active', 'trialing'].includes(data.status);
    } catch (error) {
      console.error('Error checking payment subscription:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for a user
   * @private
   */
  private clearUserCache(userId: string): void {
    subscriptionCache.invalidate(CacheKeys.currentTier(userId));
    subscriptionCache.invalidate(CacheKeys.isPremium(userId));
    subscriptionCache.invalidate(CacheKeys.limitStatus(userId));
    subscriptionCache.invalidate(CacheKeys.subscriptionCount(userId));
    subscriptionCache.invalidate(CacheKeys.subscriptionStatus(userId));
  }

  /**
   * Refresh tier information for current user
   *
   * Call this after:
   * - Successful payment
   * - Subscription cancellation
   * - Webhook updates
   */
  async refreshTierInfo(): Promise<void> {
    try {
      const userId = await this.getUserId();
      this.clearUserCache(userId);
      
      // Add delay to allow database commit to complete
      // This prevents race conditions after subscription updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Pre-fetch fresh data with retry logic
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          await this.getCurrentTier();
          await this.isPremiumUser();
          break; // Success, exit loop
        } catch (error: any) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw error; // Give up after max attempts
          }
          // Wait before retry with increasing delays
          const delay = attempts === 1 ? 500 : attempts === 2 ? 1000 : attempts === 3 ? 1500 : 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Error refreshing tier info:', error);
      // Don't throw - refresh is best-effort
    }
  }
}

// Export singleton instance
export const subscriptionTierService = new SubscriptionTierService();

// Export class for testing
export default SubscriptionTierService;