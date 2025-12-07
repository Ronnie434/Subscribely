// ============================================================================
// BILLING CYCLE TYPES
// ============================================================================

/**
 * Billing cycle frequency for recurring items
 * @since v1.0.0
 * @deprecated Use RepeatInterval instead. Will be removed in v4.0.0
 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Charge type - recurring or one-time
 * @since v2.1.0
 * @deprecated Use RepeatInterval instead. Will be removed in v4.0.0
 */
export type ChargeType = 'recurring' | 'one_time';

// ============================================================================
// REPEAT INTERVAL TYPES (NEW)
// ============================================================================

/**
 * Repeat interval for recurring items
 * Replaces the combination of ChargeType and BillingCycle
 * @since v3.0.0
 */
export type RepeatInterval =
  | 'weekly'           // Every Week (7 days)
  | 'biweekly'         // Every 2 Weeks (14 days)
  | 'semimonthly'      // Twice Per Month (15 days)
  | 'monthly'          // Every Month (30 days)
  | 'bimonthly'        // Every 2 Months (60 days)
  | 'quarterly'        // Every 3 Months (90 days)
  | 'semiannually'     // Every 6 Months (180 days)
  | 'yearly'           // Every Year (365 days)
  | 'never';           // Never (one-time charge)

/**
 * Configuration for each repeat interval
 * @since v3.0.0
 */
export interface RepeatIntervalConfig {
  days: number;
  label: string;
  monthlyMultiplier: number;
}

/**
 * Mapping of repeat intervals to their configuration
 * @since v3.0.0
 */
export const REPEAT_INTERVAL_CONFIG: Record<RepeatInterval, RepeatIntervalConfig> = {
  weekly: { days: 7, label: 'Every Week', monthlyMultiplier: 4.33 },
  biweekly: { days: 14, label: 'Every 2 Weeks', monthlyMultiplier: 2.17 },
  semimonthly: { days: 15, label: 'Twice Per Month', monthlyMultiplier: 2 },
  monthly: { days: 30, label: 'Every Month', monthlyMultiplier: 1 },
  bimonthly: { days: 60, label: 'Every 2 Months', monthlyMultiplier: 0.5 },
  quarterly: { days: 90, label: 'Every 3 Months', monthlyMultiplier: 0.33 },
  semiannually: { days: 180, label: 'Every 6 Months', monthlyMultiplier: 0.167 },
  yearly: { days: 365, label: 'Every Year', monthlyMultiplier: 0.083 },
  never: { days: 0, label: 'One Time Only', monthlyMultiplier: 0 }
} as const;

// ============================================================================
// PAYMENT HISTORY TYPES
// ============================================================================

/**
 * Payment status for a recurring item renewal
 * @since v3.1.0
 */
export type PaymentHistoryStatus = 'paid' | 'skipped' | 'pending';

/**
 * Payment history record
 * Tracks whether user paid for a recurring item renewal
 * @since v3.1.0
 */
export interface PaymentHistory {
  id: string;
  recurring_item_id: string;
  user_id: string;
  due_date: string; // ISO date string (YYYY-MM-DD)
  payment_date?: string | null; // ISO date string (YYYY-MM-DD)
  status: PaymentHistoryStatus;
  amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Past due item with additional metadata
 * @since v3.1.0
 */
export interface PastDueItem extends RecurringItem {
  days_past_due: number;
}

/**
 * Result from recording a payment
 * @since v3.1.0
 */
export interface RecordPaymentResult {
  payment_id: string | null;
  new_renewal_date: string | null;
  success: boolean;
  error_message: string | null;
}

/**
 * Payment statistics for a user
 * @since v3.1.0
 */
export interface PaymentStats {
  total_payments: number;
  paid_count: number;
  skipped_count: number;
  pending_count: number;
  total_amount_paid: number;
  payment_rate: number; // Percentage
}

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
  repeat_interval: RepeatInterval;
  renewal_date: string;
  is_custom_renewal_date?: boolean;
  notification_id?: string | null;
  category: string;
  color?: string | null;
  icon?: string | null;
  domain?: string | null;
  reminders?: boolean;
  reminder_days_before?: number; // Number of days before renewal to send notification (default: 1)
  description?: string | null;
  status: 'active' | 'paused' | 'cancelled';
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // DEPRECATED: Keep for backward compatibility during migration
  /** @deprecated Use repeat_interval instead. Will be removed in v4.0.0 */
  billing_cycle?: BillingCycle;
  /** @deprecated Use repeat_interval instead. Will be removed in v4.0.0 */
  charge_type?: ChargeType;
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
  repeat_interval: RepeatInterval;
  renewalDate: string;
  isCustomRenewalDate?: boolean;
  notificationId?: string;
  category: string;
  color?: string;
  icon?: string;
  domain?: string;
  reminders?: boolean;
  reminderDaysBefore?: number; // Number of days before renewal to send notification (default: 1)
  description?: string;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
  
  // DEPRECATED: Keep for backward compatibility during migration
  /** @deprecated Use repeat_interval instead. Will be removed in v4.0.0 */
  billingCycle?: BillingCycle;
  /** @deprecated Use repeat_interval instead. Will be removed in v4.0.0 */
  chargeType?: ChargeType;
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
          repeat_interval: RepeatInterval;
          renewal_date: string;
          is_custom_renewal_date: boolean;
          notification_id: string | null;
          category: string;
          color: string | null;
          icon: string | null;
          domain: string | null;
          reminders: boolean;
          reminder_days_before: number;
          description: string | null;
          status: 'active' | 'paused' | 'cancelled';
          notes: string | null;
          created_at: string;
          updated_at: string;
          // Legacy fields for backward compatibility
          billing_cycle: BillingCycle;
          charge_type: ChargeType;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cost: number;
          repeat_interval?: RepeatInterval;
          renewal_date: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          reminder_days_before?: number;
          description?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          // Legacy fields for backward compatibility during transition
          billing_cycle?: BillingCycle;
          charge_type?: ChargeType;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cost?: number;
          repeat_interval?: RepeatInterval;
          renewal_date?: string;
          is_custom_renewal_date?: boolean;
          notification_id?: string | null;
          category?: string;
          color?: string | null;
          icon?: string | null;
          domain?: string | null;
          reminders?: boolean;
          reminder_days_before?: number;
          description?: string | null;
          status?: 'active' | 'paused' | 'cancelled';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          // Legacy fields for backward compatibility during transition
          billing_cycle?: BillingCycle;
          charge_type?: ChargeType;
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
 * User type for authentication
 * @since v1.0.0
 */
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  aud?: string;
  email_confirmed_at?: string | null;
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

// ============================================================================
// APPLE IN-APP PURCHASE (IAP) TYPES
// ============================================================================

/**
 * Payment provider type
 * Distinguishes between Stripe and Apple IAP payment methods
 * @since v3.2.0 (Phase 2)
 */
export type PaymentProvider = 'stripe' | 'apple';

/**
 * Purchase state for IAP transactions
 * Tracks the current state of a purchase flow
 * @since v3.2.0 (Phase 2)
 */
export enum PurchaseState {
  /** No active purchase */
  IDLE = 'idle',
  /** Purchase in progress */
  PURCHASING = 'purchasing',
  /** Purchase completed successfully */
  PURCHASED = 'purchased',
  /** Purchase failed */
  FAILED = 'failed',
  /** Purchase restored from previous transaction */
  RESTORED = 'restored',
}

/**
 * Apple IAP Product information from App Store
 * Represents a product fetched from the App Store
 * @since v3.2.0 (Phase 2)
 */
export interface AppleIAPProduct {
  /** Product identifier from App Store Connect */
  productId: string;
  /** Product title */
  title?: string;
  /** Product description */
  description?: string;
  /** Price in local currency as number */
  price: number;
  /** Currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Localized price string (e.g., '$4.99') */
  localizedPrice: string;
  /** Subscription period (for subscriptions) */
  subscriptionPeriod?: string;
  /** Introductory price (if available) */
  introductoryPrice?: string;
  /** Subscription group identifier */
  subscriptionGroupId?: string;
  /** Product type */
  type?: 'subscription' | 'consumable' | 'non-consumable';
}

/**
 * Apple IAP Purchase transaction
 * Represents a completed or pending purchase transaction
 * @since v3.2.0 (Phase 2)
 */
export interface AppleIAPPurchase {
  /** Unique transaction identifier */
  transactionId: string;
  /** Product identifier that was purchased */
  productId: string;
  /** Transaction receipt (base64 encoded for iOS) */
  transactionReceipt: string;
  /** Date of purchase (ISO 8601 string) */
  purchaseDate: string;
  /** Original transaction ID (for subscription renewals) */
  originalTransactionId?: string;
  /** Quantity purchased */
  quantity?: number;
  /** Whether the purchase has been acknowledged */
  isAcknowledged?: boolean;
  /** Purchase state */
  purchaseState?: PurchaseState;
  /** Purchase token (Android) */
  purchaseToken?: string;
}

/**
 * Apple IAP Subscription status
 * Represents the current state of a user's subscription
 * @since v3.2.0 (Phase 2)
 */
export interface AppleIAPSubscription {
  /** Original transaction ID (unique per subscription) */
  originalTransactionId: string;
  /** Latest transaction ID */
  transactionId: string;
  /** Product ID of the subscription */
  productId: string;
  /** Whether the subscription is currently active */
  isActive: boolean;
  /** Subscription expiration date (ISO 8601 string) */
  expirationDate: string;
  /** Auto-renew status */
  willRenew: boolean;
  /** Subscription start date (ISO 8601 string) */
  startDate?: string;
  /** Whether subscription is in trial period */
  isTrialPeriod?: boolean;
  /** Whether subscription is in intro offer period */
  isIntroOfferPeriod?: boolean;
  /** Grace period expiration date (if in grace period) */
  gracePeriodExpirationDate?: string;
  /** Cancellation date (if cancelled) */
  cancellationDate?: string;
}

/**
 * IAP Error types
 * Common error scenarios in IAP flows
 * @since v3.2.0 (Phase 2)
 */
export enum IAPErrorCode {
  /** User cancelled the purchase */
  USER_CANCELLED = 'E_USER_CANCELLED',
  /** Network connection error */
  NETWORK_ERROR = 'E_NETWORK_ERROR',
  /** Product not available */
  PRODUCT_NOT_AVAILABLE = 'E_PRODUCT_NOT_AVAILABLE',
  /** Receipt validation failed */
  RECEIPT_VALIDATION_FAILED = 'E_RECEIPT_VALIDATION_FAILED',
  /** Purchase already owned */
  ALREADY_OWNED = 'E_ALREADY_OWNED',
  /** Service unavailable */
  SERVICE_UNAVAILABLE = 'E_SERVICE_UNAVAILABLE',
  /** Unknown error */
  UNKNOWN = 'E_UNKNOWN',
}

/**
 * IAP Error object
 * @since v3.2.0 (Phase 2)
 */
export interface IAPError {
  /** Error code */
  code: IAPErrorCode | string;
  /** Error message */
  message: string;
  /** Debug message (additional details) */
  debugMessage?: string;
  /** Original error object */
  originalError?: any;
}

/**
 * Purchase result from IAP service
 * @since v3.2.0 (Phase 2)
 */
export interface PurchaseResult {
  /** Whether the purchase was successful */
  success: boolean;
  /** Purchase transaction (if successful) */
  purchase?: AppleIAPPurchase;
  /** Error (if failed) */
  error?: IAPError;
}

/**
 * Restore purchases result
 * @since v3.2.0 (Phase 2)
 */
export interface RestorePurchasesResult {
  /** Whether restore was successful */
  success: boolean;
  /** Array of restored purchases */
  purchases: AppleIAPPurchase[];
  /** Error (if failed) */
  error?: IAPError;
}

/**
 * IAP initialization options
 * @since v3.2.0 (Phase 2)
 */
export interface IAPInitOptions {
  /** Whether to automatically finish transactions */
  autoFinishTransactions?: boolean;
  /** Whether to enable debug logging */
  debugLogging?: boolean;
}

/**
 * Receipt validation request
 * @since v3.2.0 (Phase 2)
 */
export interface ReceiptValidationRequest {
  /** Transaction ID */
  transactionId: string;
  /** Product ID */
  productId: string;
  /** Transaction receipt */
  transactionReceipt: string;
  /** Platform (ios or android) */
  platform?: string;
}

/**
 * Receipt validation response
 * @since v3.2.0 (Phase 2)
 */
export interface ReceiptValidationResponse {
  /** Whether the receipt is valid */
  isValid: boolean;
  /** Subscription information (if valid) */
  subscription?: AppleIAPSubscription;
  /** Error message (if invalid) */
  error?: string;
}


