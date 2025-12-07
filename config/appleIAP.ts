/**
 * Apple In-App Purchase (IAP) Configuration
 * 
 * Configuration for Apple IAP product IDs, pricing, and settings.
 * This file contains the foundational setup for StoreKit 2 with StoreKit 1 fallback.
 * 
 * @see docs/APPLE_IAP_IMPLEMENTATION_PLAN.md
 * @since Phase 2
 */

import { Platform } from 'react-native';

// ============================================================================
// PRODUCT IDS
// ============================================================================

/**
 * Apple IAP Product IDs
 * These must match the product IDs configured in App Store Connect
 *
 * Format: com.renvo.{tier}.{interval}.{version}
 */
export const IAP_PRODUCT_IDS = {
  // Premium tier products (currently the only tier)
  // NOTE: Product IDs MUST start with bundle identifier (com.ronnie39.renvo)
  basic_monthly: 'com.ronnie39.renvo.premium.monthly.v1',
  basic_yearly: 'com.ronnie39.renvo.premium.yearly.v1',
  
  // Future: Pro tier products (for when/if we add a pro tier)
  pro_monthly: 'com.ronnie39.renvo.pro.monthly',
  pro_yearly: 'com.ronnie39.renvo.pro.yearly',
} as const;

/**
 * Array of all product IDs for fetching from App Store
 */
export const ALL_PRODUCT_IDS = Object.values(IAP_PRODUCT_IDS);

/**
 * Currently active product IDs (Basic tier only for now)
 */
export const ACTIVE_PRODUCT_IDS = [
  IAP_PRODUCT_IDS.basic_monthly,
  IAP_PRODUCT_IDS.basic_yearly,
];

// ============================================================================
// SUBSCRIPTION GROUP
// ============================================================================

/**
 * Subscription group identifier from App Store Connect
 * All subscription products must belong to the same subscription group
 */
export const SUBSCRIPTION_GROUP_ID = 'premium_subscriptions';

// ============================================================================
// PRODUCT CONFIGURATION
// ============================================================================

/**
 * Product configuration matching Stripe pricing
 * Note: Actual prices are fetched from App Store, these are for display/reference
 */
export const IAP_PRODUCTS = {
  basic_monthly: {
    productId: IAP_PRODUCT_IDS.basic_monthly,
    amount: 4.99, // Reference price (actual price from App Store)
    interval: 'month' as const,
    displayName: 'Monthly Premium',
    description: 'Unlimited recurring items, billed monthly',
    features: [
      'Unlimited recurring item tracking',
      'Advanced analytics',
      'Export capabilities',
      'Priority support',
    ],
  },
  basic_yearly: {
    productId: IAP_PRODUCT_IDS.basic_yearly,
    amount: 39.99, // Reference price (actual price from App Store)
    interval: 'year' as const,
    displayName: 'Yearly Premium',
    description: 'Unlimited recurring items, billed annually',
    savingsText: 'Save 17%',
    features: [
      'Unlimited recurring item tracking',
      'Advanced analytics',
      'Export capabilities',
      'Priority support',
      'Best value - Save 17%',
    ],
  },
} as const;

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * IAP Environment (sandbox vs production)
 * In development, uses sandbox. In production, uses production App Store.
 */
export const IAP_ENVIRONMENT = __DEV__ ? 'sandbox' : 'production';

/**
 * Shared secret for receipt validation (server-side)
 * Note: This is a placeholder. The actual shared secret should be stored securely
 * on the backend and never exposed in the frontend code.
 */
export const IAP_SHARED_SECRET_PLACEHOLDER = 'YOUR_SHARED_SECRET_HERE';

// ============================================================================
// STOREKIT CONFIGURATION
// ============================================================================

/**
 * iOS version check for StoreKit 2 availability
 * StoreKit 2 requires iOS 15+
 */
export const STOREKIT_2_MIN_VERSION = 15;

/**
 * Check if StoreKit 2 is available on the current device
 */
export function isStoreKit2Available(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  
  // Platform.Version returns the iOS version as a string (e.g., "15.0")
  const iosVersion = parseInt(String(Platform.Version), 10);
  return iosVersion >= STOREKIT_2_MIN_VERSION;
}

/**
 * Get StoreKit version to use
 */
export function getStoreKitVersion(): 1 | 2 {
  return isStoreKit2Available() ? 2 : 1;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get product configuration by product ID
 */
export function getProductConfig(productId: string) {
  const key = Object.keys(IAP_PRODUCTS).find(
    k => IAP_PRODUCTS[k as keyof typeof IAP_PRODUCTS].productId === productId
  );
  
  if (!key) {
    return null;
  }
  
  return IAP_PRODUCTS[key as keyof typeof IAP_PRODUCTS];
}

/**
 * Check if a product ID is valid
 */
export function isValidProductId(productId: string): boolean {
  return (ACTIVE_PRODUCT_IDS as readonly string[]).includes(productId);
}

/**
 * Get product IDs by interval
 */
export function getProductIdsByInterval(interval: 'month' | 'year'): string[] {
  return Object.values(IAP_PRODUCTS)
    .filter(product => product.interval === interval)
    .map(product => product.productId);
}

/**
 * Map billing cycle to product ID
 */
export function getProductIdByBillingCycle(cycle: 'monthly' | 'yearly'): string {
  return cycle === 'monthly' 
    ? IAP_PRODUCT_IDS.basic_monthly 
    : IAP_PRODUCT_IDS.basic_yearly;
}

// ============================================================================
// APPLE IAP CONFIGURATION OBJECT
// ============================================================================

/**
 * Complete Apple IAP configuration
 * This object contains all necessary configuration for IAP integration
 */
export const APPLE_IAP_CONFIG = {
  productIds: ACTIVE_PRODUCT_IDS,
  subscriptionGroupId: SUBSCRIPTION_GROUP_ID,
  environment: IAP_ENVIRONMENT,
  storeKitVersion: getStoreKitVersion(),
  products: IAP_PRODUCTS,
} as const;

/**
 * Export type for IAP configuration
 */
export type AppleIAPConfig = typeof APPLE_IAP_CONFIG;