/**
 * Stripe Configuration for React Native
 * 
 * This file contains Stripe publishable key and product configuration
 * for the frontend React Native application
 */

// Stripe publishable key (safe to expose in frontend)
// Note: In Expo, environment variables must be prefixed with EXPO_PUBLIC_ to be accessible in React Native
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Stripe configuration
export const stripeConfig = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  merchantIdentifier: 'merchant.com.smartsubscriptiontracker', // For Apple Pay
  urlScheme: 'smartsubscriptiontracker', // For return URLs
};

// Subscription plan configuration
// NOTE: Replace these Price IDs with your actual Stripe Price IDs from the Stripe Dashboard
export const SUBSCRIPTION_PLANS = {
  monthly: {
    priceId: 'price_1SUXJY2MEnHaTSaA3VeJyYdX', // Replace with actual Stripe Price ID
    amount: 4.99,
    interval: 'month' as const,
    displayName: 'Monthly Premium',
    description: 'Unlimited subscriptions, billed monthly',
    features: [
      'Unlimited subscription tracking',
      'Advanced analytics',
      'Export capabilities',
      'Priority support',
    ],
  },
  yearly: {
    priceId: 'price_1SUXJY2MEnHaTSaAmQrK7lbY', // Replace with actual Stripe Price ID
    amount: 39.00,
    interval: 'year' as const,
    displayName: 'Yearly Premium',
    description: 'Unlimited subscriptions, billed annually',
    savingsText: 'Save 34%', // $59.88/year vs $39/year
    features: [
      'Unlimited subscription tracking',
      'Advanced analytics',
      'Export capabilities',
      'Priority support',
      'Best value - Save 34%',
    ],
  },
};

// Free tier configuration (for reference)
export const FREE_TIER = {
  name: 'Free',
  maxSubscriptions: 5,
  displayName: 'Free Plan',
  description: 'Track up to 5 subscriptions',
  features: [
    'Track up to 5 subscriptions',
    'Basic analytics',
    'Renewal reminders',
  ],
};

// Refund policy configuration
export const REFUND_POLICY = {
  windowDays: 7,
  description: 'Full refund available within 7 days of purchase',
};

// Stripe API endpoints (Supabase Edge Functions)
export const STRIPE_ENDPOINTS = {
  createSubscription: '/functions/v1/create-subscription',
  cancelSubscription: '/functions/v1/cancel-subscription',
  requestRefund: '/functions/v1/request-refund',
  getBillingPortal: '/functions/v1/get-billing-portal',
};

/**
 * Get plan details by billing cycle
 */
export function getPlanByBillingCycle(cycle: 'monthly' | 'yearly') {
  return SUBSCRIPTION_PLANS[cycle];
}

/**
 * Calculate savings for yearly plan
 */
export function calculateYearlySavings(): number {
  const monthlyTotal = SUBSCRIPTION_PLANS.monthly.amount * 12;
  const yearlyTotal = SUBSCRIPTION_PLANS.yearly.amount;
  return monthlyTotal - yearlyTotal;
}

/**
 * Calculate savings percentage for yearly plan
 */
export function calculateYearlySavingsPercentage(): number {
  const savings = calculateYearlySavings();
  const monthlyTotal = SUBSCRIPTION_PLANS.monthly.amount * 12;
  return Math.round((savings / monthlyTotal) * 100);
}