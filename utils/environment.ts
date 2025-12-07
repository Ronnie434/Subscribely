/**
 * Environment Detection Utilities
 * 
 * Utilities for detecting runtime environment (TestFlight, development, production)
 * to provide appropriate IAP and subscription management behavior.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Detect if app is running in TestFlight
 * 
 * TestFlight apps have specific characteristics:
 * - __DEV__ is false but it's not a production release
 * - appOwnership is 'expo' or undefined
 * - Has sandbox receipt (requires native check)
 * 
 * @returns {Promise<boolean>} True if running in TestFlight
 * 
 * @example
 * ```typescript
 * const isTF = await isRunningInTestFlight();
 * if (isTF) {
 *   console.log('Running in TestFlight sandbox');
 * }
 * ```
 */
export async function isRunningInTestFlight(): Promise<boolean> {
  // Only applicable to iOS
  if (Platform.OS !== 'ios') {
    return false;
  }

  // In development, always return true for testing
  // This allows testing sandbox behavior in development builds
  if (__DEV__) {
    return true;
  }
  
  // Check expo constants for TestFlight indicators
  const appOwnership = Constants.appOwnership;
  
  // TestFlight builds typically have null or 'expo' ownership
  // Production App Store builds have 'standalone' or similar
  if (appOwnership === null || appOwnership === 'expo') {
    return true;
  }
  
  // Additional heuristic: Check if we have an installationId
  // TestFlight builds often have different installation patterns
  if (Constants.installationId) {
    // If we have an installation ID but aren't in production, likely TestFlight
    // This is a heuristic and may need refinement
    return !Constants.isDevice || Constants.debugMode;
  }
  
  // Default: assume production if we can't determine
  return false;
}

/**
 * Detect if app is running in TestFlight (synchronous)
 * 
 * Simplified synchronous version for immediate checks.
 * Uses __DEV__ flag as primary indicator.
 * 
 * @returns {boolean} True if likely running in TestFlight
 * 
 * @example
 * ```typescript
 * if (isTestFlightEnvironment()) {
 *   // Show sandbox-specific instructions
 * }
 * ```
 */
export function isTestFlightEnvironment(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  // In development builds, treat as TestFlight for testing
  return __DEV__;
}

/**
 * Get current IAP environment
 * 
 * Determines whether to use sandbox or production IAP endpoints.
 * 
 * @returns {'sandbox' | 'production'} Current IAP environment
 * 
 * @example
 * ```typescript
 * const env = getIAPEnvironment();
 * console.log(`Using ${env} IAP environment`);
 * ```
 */
export function getIAPEnvironment(): 'sandbox' | 'production' {
  if (Platform.OS !== 'ios') {
    return 'production'; // Non-iOS platforms use production (Stripe)
  }

  // Development builds always use sandbox
  // Production builds use production
  // TestFlight builds use sandbox (but __DEV__ is false)
  return __DEV__ ? 'sandbox' : 'production';
}

/**
 * Check if we should use sandbox IAP features
 * 
 * Used to determine behavior like:
 * - Which subscription management UI to show
 * - Where to direct users for cancellation
 * - Whether to show sandbox-specific instructions
 * 
 * @returns {boolean} True if using sandbox environment
 * 
 * @example
 * ```typescript
 * if (isSandboxEnvironment()) {
 *   // Show: Settings → App Store → Sandbox Account
 * } else {
 *   // Show: App Store → Subscriptions
 * }
 * ```
 */
export function isSandboxEnvironment(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  // In development, we're always in sandbox
  return __DEV__;
}

/**
 * Get user-friendly environment name
 * 
 * @returns {string} Human-readable environment name
 * 
 * @example
 * ```typescript
 * console.log(`Running in ${getEnvironmentName()}`);
 * // Output: "Running in Development (Sandbox)"
 * ```
 */
export function getEnvironmentName(): string {
  if (__DEV__) {
    return 'Development (Sandbox)';
  }
  
  if (Platform.OS === 'ios') {
    // In a real TestFlight build, we'd need more sophisticated detection
    // For now, production builds are assumed to be from App Store
    return 'Production (App Store)';
  }
  
  return 'Production';
}

/**
 * Get subscription management URL based on environment
 * 
 * Returns the appropriate URL for managing subscriptions:
 * - Sandbox: Deep link to Settings app
 * - Production: App Store subscriptions URL
 * 
 * @returns {string} URL to open for subscription management
 * 
 * @example
 * ```typescript
 * const url = getSubscriptionManagementURL();
 * await Linking.openURL(url);
 * ```
 */
export function getSubscriptionManagementURL(): string {
  if (Platform.OS !== 'ios') {
    // Non-iOS: Redirect to web portal or other platform-specific management
    return 'https://apps.apple.com/account/subscriptions';
  }

  if (isSandboxEnvironment()) {
    // Sandbox: Open Settings app (user needs to navigate to App Store → Sandbox Account)
    // Note: There's no direct deep link to sandbox subscription management
    return 'app-settings:';
  } else {
    // Production: Direct link to App Store subscription management
    return 'https://apps.apple.com/account/subscriptions';
  }
}

/**
 * Get user instructions for subscription management
 * 
 * Returns environment-appropriate instructions for users to manage subscriptions.
 * 
 * @returns {string} Instructions text
 * 
 * @example
 * ```typescript
 * const instructions = getSubscriptionManagementInstructions();
 * Alert.alert('Manage Subscription', instructions);
 * ```
 */
export function getSubscriptionManagementInstructions(): string {
  if (Platform.OS !== 'ios') {
    return 'Visit your account settings to manage your subscription.';
  }

  if (isSandboxEnvironment()) {
    return (
      'You\'re using a TestFlight or development build. To manage this test subscription:\n\n' +
      '1. Open Settings\n' +
      '2. Scroll down → App Store\n' +
      '3. Scroll to bottom → SANDBOX ACCOUNT\n' +
      '4. Tap your sandbox account email\n' +
      '5. Tap "Manage"\n' +
      '6. Select your Renvo subscription\n\n' +
      'Note: Test subscriptions only appear in Sandbox Account, not in your regular Apple ID subscriptions.'
    );
  } else {
    return (
      'To manage your subscription:\n\n' +
      '1. Open Settings\n' +
      '2. Tap your name at the top\n' +
      '3. Tap "Subscriptions"\n' +
      '4. Select your Renvo subscription\n\n' +
      'Or tap "Open App Store" to go directly to subscription management.'
    );
  }
}

/**
 * Environment configuration object
 */
export const EnvironmentConfig = {
  isTestFlight: isTestFlightEnvironment,
  isSandbox: isSandboxEnvironment,
  environment: getIAPEnvironment,
  name: getEnvironmentName,
  subscriptionManagement: {
    url: getSubscriptionManagementURL,
    instructions: getSubscriptionManagementInstructions,
  },
} as const;

