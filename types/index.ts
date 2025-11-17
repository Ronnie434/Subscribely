export type BillingCycle = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  renewalDate: string; // ISO date string
  /** Indicates whether the user manually set the renewal date (vs auto-generated) */
  isCustomRenewalDate?: boolean;
  /** Stores the notification identifier for scheduled reminders (used to cancel/update notifications) */
  notificationId?: string;
  category: string;
  color?: string;
  /** Optional icon identifier for the service (e.g., 'netflix', 'spotify') */
  icon?: string;
  /** Company domain for fetching logo from Clearbit API */
  domain?: string;
  /** Optional flag to enable/disable renewal reminder notifications */
  reminders?: boolean;
  /** Optional description/notes about the subscription */
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** User ID from Supabase auth (for multi-user support) */
  user_id?: string;
}
export type RootStackParamList = {
  Home: undefined;
  AddSubscription: { subscription?: Subscription };
  EditSubscription: { subscription: Subscription };
};

// Supabase Database Types
export interface Database {
  public: {
    Tables: {
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
          created_at?: string;
          updated_at?: string;
        };
      };
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
    };
  };
}

// Auth related types
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}

// Paywall & Payment Types
export interface SubscriptionPlan {
  id: string;
  name: 'free' | 'premium';
  priceMonthly: number;
  priceYearly: number;
  maxSubscriptions: number | null;
  features: string[];
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'grace_period' | 'trialing';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type BillingCycleType = 'monthly' | 'yearly';

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

export interface PaymentTransaction {
  id: string;
  userSubscriptionId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

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

export interface StripeWebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  createdAt: Date;
}

// Payment Service Types
export interface CreateSubscriptionParams {
  billingCycle: BillingCycleType;
  priceId: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string;
  status: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  subscriptionId: string;
  cancelAt: Date;
  status: string;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

export interface BillingPortalResponse {
  url: string;
}

export interface SubscriptionStatusResponse {
  hasActiveSubscription: boolean;
  subscription?: UserSubscription;
  plan: 'free' | 'premium';
}

// ============================================================================
// PAYWALL BACKEND SERVICE TYPES
// ============================================================================

/**
 * Subscription tier with all details including pricing and limits
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
 * Current subscription limit status for a user
 */
export interface SubscriptionLimitStatus {
  currentCount: number;
  maxAllowed: number | null; // null for unlimited
  remainingCount: number | null; // null for unlimited
  isPremium: boolean;
  canAddMore: boolean;
  tierName: 'free' | 'premium';
}

/**
 * Conversion funnel metrics for analytics
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
 * Usage tracking event types
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
 * Response from check_subscription_limit database function
 */
export interface CheckSubscriptionLimitResponse {
  can_add: boolean;
  current_count: number;
  limit: number;
  is_premium: boolean;
  tier_name: 'free' | 'premium';
  reason?: string;
}

/**
 * Response from get_user_subscription_status database function
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


