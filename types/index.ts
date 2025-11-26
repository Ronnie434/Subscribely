// ============================================================================
// BILLING CYCLE TYPES
// ============================================================================

/**
 * Billing cycle frequency for recurring items
 * @since v1.0.0
 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Charge type - recurring or one-time
 * @since v2.1.0
 */
export type ChargeType = 'recurring' | 'one_time';

// ============================================================================
// RECURRING ITEM TYPES (NEW TERMINOLOGY)
// ============================================================================

/**
 * Represents a recurring expense or item that users track
 * (e.g., Netflix, gym membership, rent, utilities)
 *
 * This is the preferred type for tracked expenses. The term "subscription"
 * now refers to the user's app subscription (Premium/Free tier).
 *
 * @since v2.0.0
 * @example
 * ```typescript
 * const netflixItem: RecurringItem = {
 *   id: '123',
 *   user_id: 'user-abc',
 *   name: 'Netflix',
 *   cost: 15.99,
 *   billing_cycle: 'monthly',
 *   category: 'Entertainment',
 *   renewal_date: '2024-01-01',
 *   status: 'active',
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-01T00:00:00Z'
 * };
 * ```
 */
export interface RecurringItem {
  id: string;
  user_id: string;
  name: string;
  cost: number;
  billing_cycle: BillingCycle;
  renewal_date: string;
  is_custom_renewal_date?: boolean;
  notification_id?: string | null;
  category: string;
  color?: string | null;
  icon?: string | null;
  domain?: string | null;
  reminders?: boolean;
  description?: string | null;
  charge_type?: ChargeType;
  status: 'active' | 'paused' | 'cancelled';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Use RecurringItem instead.
 * This alias is maintained for backward compatibility and will be removed in v3.0.0
 *
 * "Subscription" now refers to the user's app subscription (Premium/Free tier).
 * For tracked expenses, use RecurringItem.
 *
 * @see RecurringItem
 * @example
 * ```typescript
 * // OLD (deprecated):
 * const sub: Subscription = { ... };
 *
 * // NEW (preferred):
 * const item: RecurringItem = { ... };
 * ```
 */
export interface Subscription {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  renewalDate: string;
  isCustomRenewalDate?: boolean;
  notificationId?: string;
  category: string;
  color?: string;
  icon?: string;
  domain?: string;
  reminders?: boolean;
  description?: string;
  chargeType?: ChargeType;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
}

// ============================================================================
// NAVIGATION TYPES
// ============================================================================

/**
 * Navigation parameters for recurring items stack
 * @since v2.0.0
 */
export type RecurringItemsStackParamList = {
  Home: undefined;
  AddRecurringItem: { recurringItem?: RecurringItem };
  EditRecurringItem: { recurringItem: RecurringItem };
};

/**
 * @deprecated Use RecurringItemsStackParamList instead.
 * Maintained for backward compatibility until v3.0.0
 *
 * @see RecurringItemsStackParamList
 */
export type RootStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

/**
 * @deprecated Use RecurringItemsStackParamList instead.
 * Maintained for backward compatibility until v3.0.0
 *
 * @see RecurringItemsStackParamList
 */
export type SubscriptionsStackParamList = RootStackParamList;

// ============================================================================
// SUPABASE DATABASE TYPES
// ============================================================================

/**
 * Supabase database schema with typed table and function definitions
 * @since v2.0.0
 */
export interface Database {
  public: {
    Tables: {
      /**
       * Main table for storing user's recurring expenses/items
       * Replaces the old "subscriptions" table (which now refers to app subscription tiers)
       * @since v2.0.0
       */
      recurring_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date: boolean;
          notification_id: string | null;
          category: string;
          color: string | null;
          icon: string | null;
          domain: string | null;
          reminders: boolean;
          description: string | null;
          charge_type: ChargeType;
          status: 'active' | 'paused' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          charge_type?: ChargeType;
          status?: 'active' | 'paused' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cost?: number;
          billing_cycle?: BillingCycle;
          renewal_date?: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category?: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          charge_type?: ChargeType;
          status?: 'active' | 'paused' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * @deprecated This is now a database view for backward compatibility.
       * Use recurring_items table instead. Will be removed in v3.0.0
       * @see recurring_items
       */
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date: boolean;
          notification_id: string | null;
          category: string;
          color: string | null;
          icon: string | null;
          domain: string | null;
          reminders: boolean;
          description: string | null;
          charge_type: ChargeType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cost: number;
          billing_cycle: BillingCycle;
          renewal_date: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          charge_type?: ChargeType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cost?: number;
          billing_cycle?: BillingCycle;
          renewal_date?: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category?: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          description?: string | null;
          charge_type?: ChargeType;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * User profiles table
       * @since v1.0.0
       */
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * App subscription tiers (Free/Premium plans)
       * This is separate from recurring_items (user's tracked expenses)
       * @since v1.0.0
       */
      subscription_tiers: {
        Row: {
          id: string;
          name: 'free' | 'premium';
          max_subscriptions: number | null;
          price_monthly: number;
          price_yearly: number;
          stripe_product_id: string | null;
          stripe_price_id_monthly: string | null;
          stripe_price_id_yearly: string | null;
          features: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: 'free' | 'premium';
          max_subscriptions?: number | null;
          price_monthly: number;
          price_yearly: number;
          stripe_product_id?: string | null;
          stripe_price_id_monthly?: string | null;
          stripe_price_id_yearly?: string | null;
          features?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: 'free' | 'premium';
          max_subscriptions?: number | null;
          price_monthly?: number;
          price_yearly?: number;
          stripe_product_id?: string | null;
          stripe_price_id_monthly?: string | null;
          stripe_price_id_yearly?: string | null;
          features?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      /**
       * User's app subscription status (which tier they have)
       * This is separate from recurring_items (user's tracked expenses)
       * @since v1.0.0
       */
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing';
          billing_cycle: 'monthly' | 'yearly' | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing';
          billing_cycle?: 'monthly' | 'yearly' | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing';
          billing_cycle?: 'monthly' | 'yearly' | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      /**
       * Get the maximum number of recurring items a user can create based on their tier
       * @since v2.0.0
       */
      get_user_recurring_item_limit: {
        Args: { user_id: string };
        Returns: number;
      };
      /**
       * Check if user can add another recurring item
       * @since v2.0.0
       */
      can_user_add_recurring_item: {
        Args: { user_id: string };
        Returns: boolean;
      };
      /**
       * Check user's recurring item limit with detailed information
       * @since v2.0.0
       */
      check_recurring_item_limit: {
        Args: { user_id: string };
        Returns: { can_add: boolean; current_count: number; limit: number };
      };
      /**
       * @deprecated Use get_user_recurring_item_limit instead.
       * Maintained for backward compatibility until v3.0.0
       * @see get_user_recurring_item_limit
       */
      get_user_subscription_limit: {
        Args: { user_id: string };
        Returns: number;
      };
      /**
       * @deprecated Use can_user_add_recurring_item instead.
       * Maintained for backward compatibility until v3.0.0
       * @see can_user_add_recurring_item
       */
      can_user_add_subscription: {
        Args: { user_id: string };
        Returns: boolean;
      };
      /**
       * @deprecated Use check_recurring_item_limit instead.
       * Maintained for backward compatibility until v3.0.0
       * @see check_recurring_item_limit
       */
      check_subscription_limit: {
        Args: { user_id: string };
        Returns: { can_add: boolean; current_count: number; limit: number };
      };
    };
  };
}

// ============================================================================
// SERVICE PARAMETER TYPES FOR RECURRING ITEMS
// ============================================================================

/**
 * Parameters for creating a new recurring item
 * @since v2.0.0
 * @example
 * ```typescript
 * const params: CreateRecurringItemParams = {
 *   name: 'Netflix',
 *   cost: 15.99,
 *   billing_cycle: 'monthly',
 *   category: 'Entertainment',
 *   renewal_date: '2024-01-01',
 *   notes: 'Premium plan'
 * };
 * ```
 */
export interface CreateRecurringItemParams {
  name: string;
  cost: number;
  billing_cycle: 'monthly' | 'yearly';
  category: string;
  renewal_date: string;
  notes?: string;
  color?: string;
  icon?: string;
  domain?: string;
  reminders?: boolean;
  description?: string;
  is_custom_renewal_date?: boolean;
  charge_type?: ChargeType;
}

/**
 * @deprecated Use CreateRecurringItemParams instead.
 * Maintained for backward compatibility until v3.0.0
 * @see CreateRecurringItemParams
 */
export type CreateSubscriptionParams = CreateRecurringItemParams;

/**
 * Parameters for updating an existing recurring item
 * @since v2.0.0
 * @example
 * ```typescript
 * const params: UpdateRecurringItemParams = {
 *   id: '123',
 *   cost: 17.99, // Update only the cost
 *   status: 'paused'
 * };
 * ```
 */
export interface UpdateRecurringItemParams extends Partial<CreateRecurringItemParams> {
  id: string;
  status?: 'active' | 'paused' | 'cancelled';
}

/**
 * @deprecated Use UpdateRecurringItemParams instead.
 * Maintained for backward compatibility until v3.0.0
 * @see UpdateRecurringItemParams
 */
export type UpdateSubscriptionParams = UpdateRecurringItemParams;

// ============================================================================
// AUTH RELATED TYPES
// ============================================================================

/**
 * User profile information
 * @since v1.0.0
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Authentication state
 * @since v1.0.0
 */
export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// PAYWALL & PAYMENT TYPES (APP SUBSCRIPTION TIERS)
// ============================================================================

/**
 * App subscription plan (Free or Premium tier)
 * This is separate from recurring items (user's tracked expenses)
 * @since v1.0.0
 */
export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  priceMonthly: number;
  priceYearly: number;
  maxSubscriptions: number | null;
  features: string[];
}

/**
 * User's app subscription status
 * @since v1.0.0
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing';

/**
 * Payment transaction status
 * @since v1.0.0
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

/**
 * Billing cycle for app subscription
 * @since v1.0.0
 */
export type BillingCycleType = 'monthly' | 'yearly';

/**
 * User's app subscription information
 * This is separate from recurring items (user's tracked expenses)
 * @since v1.0.0
 */
export interface UserSubscription {
  id: string;
  userId: string;
  tierId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  billingCycle?: BillingCycleType;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment transaction record
 * @since v1.0.0
 */
export interface PaymentTransaction {
  id: string;
  userSubscriptionId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

/**
 * Refund request for app subscription
 * @since v1.0.0
 */
export interface RefundRequest {
  id: string;
  userSubscriptionId: string;
  stripeRefundId?: string;
  amount: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedAt: Date;
  processedAt?: Date;
}

/**
 * Stripe webhook event tracking
 * @since v1.0.0
 */
export interface StripeWebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  createdAt: Date;
}

// ============================================================================
// PAYMENT SERVICE TYPES (APP SUBSCRIPTION)
// ============================================================================

/**
 * Parameters for creating a new app subscription (Premium tier)
 * This is for the user's app subscription, not for recurring items they track
 * @since v1.0.0
 */
export interface CreateAppSubscriptionParams {
  billingCycle: BillingCycleType;
  priceId: string;
}

/**
 * Response from creating an app subscription
 * @since v1.0.0
 */
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string;
  status: string;
}

/**
 * Response from canceling an app subscription
 * @since v1.0.0
 */
export interface CancelSubscriptionResponse {
  success: boolean;
  subscriptionId: string;
  cancelAt: Date;
  status: string;
}

/**
 * Response from refund request
 * @since v1.0.0
 */
export interface RefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

/**
 * Response containing billing portal URL
 * @since v1.0.0
 */
export interface BillingPortalResponse {
  url: string;
}

/**
 * Response with user's app subscription status
 * @since v1.0.0
 */
export interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  subscription?: UserSubscription;
  plan: 'free' | 'premium';
}

// ============================================================================
// PAYWALL BACKEND SERVICE TYPES
// ============================================================================

/**
 * App subscription tier with all details including pricing and limits
 * This defines what users get with Free vs Premium tiers
 * @since v1.0.0
 */
export interface SubscriptionTier {
  id: string;
  name: 'free' | 'premium';
  maxSubscriptions: number | null; // null for unlimited
  priceMonthly: number;
  priceYearly: number;
  stripeProductId?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features: string[];
  isActive: boolean;
}

/**
 * Current recurring item limit status for a user
 * Shows how many recurring items they can track based on their tier
 * @since v2.0.0
 */
export interface RecurringItemLimitStatus {
  currentCount: number;
  maxAllowed: number | null; // null for unlimited
  remainingCount: number | null; // null for unlimited
  isPremium: boolean;
  canAddMore: boolean;
  tierName: 'free' | 'premium';
}

/**
 * @deprecated Use RecurringItemLimitStatus instead.
 * Maintained for backward compatibility until v3.0.0
 * @see RecurringItemLimitStatus
 */
export type SubscriptionLimitStatus = RecurringItemLimitStatus;

/**
 * Conversion funnel metrics for analytics
 * Tracks user progression through the upgrade flow
 * @since v1.0.0
 */
export interface ConversionMetrics {
  limitReachedCount: number;
  paywallShownCount: number;
  planSelectedCount: number;
  paymentInitiatedCount: number;
  paymentCompletedCount: number;
  paymentFailedCount: number;
  conversionRate: number; // percentage from limit_reached to payment_completed
}

/**
 * Usage tracking event types for analytics
 * @since v1.0.0
 */
export type UsageEventType =
  | 'limit_reached'
  | 'paywall_shown'
  | 'plan_selected'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed';

/**
 * Usage tracking event structure
 * @since v1.0.0
 */
export interface UsageTrackingEvent {
  id: string;
  userId: string;
  eventType: UsageEventType;
  eventContext?: string;
  eventData?: Record<string, any>;
  createdAt: string;
}

/**
 * Response from check_recurring_item_limit database function
 * @since v2.0.0
 */
export interface CheckRecurringItemLimitResponse {
  can_add: boolean;
  current_count: number;
  limit: number;
  is_premium: boolean;
  tier_name: 'free' | 'premium';
  reason?: string;
}

/**
 * @deprecated Use CheckRecurringItemLimitResponse instead.
 * Maintained for backward compatibility until v3.0.0
 * @see CheckRecurringItemLimitResponse
 */
export type CheckSubscriptionLimitResponse = CheckRecurringItemLimitResponse;

/**
 * Response from get_user_subscription_status database function
 * Returns the user's app subscription tier status (not their tracked recurring items)
 * @since v1.0.0
 */
export interface UserSubscriptionStatusResponse {
  tier_id: string;
  tier_name: string;
  subscription_limit: number;
  billing_cycle: string;
  status: string;
  stripe_customer_id?: string;
  current_period_end?: string;
}

/**
 * Billing information for displaying actual payment amounts
 * @since v1.0.0
 */
export interface BillingInfo {
  actualAmount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
}


