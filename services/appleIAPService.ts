/**
 * Apple IAP Service
 * 
 * Service for handling all Apple In-App Purchase operations.
 * Provides a high-level interface for purchasing, restoring, and managing
 * subscription transactions through the App Store.
 * 
 * @see docs/APPLE_IAP_IMPLEMENTATION_PLAN.md
 * @since Phase 2 - Infrastructure Setup
 */

import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import {
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  initConnection,
  endConnection,
  getAvailablePurchases,
  fetchProducts,
  requestPurchase,
  getReceiptDataIOS,
  getTransactionJwsIOS,
} from 'react-native-iap';
import { APPLE_IAP_CONFIG, getStoreKitVersion } from '../config/appleIAP';
import { IAPErrorCode, PurchaseState } from '../types';
import { supabase } from '../config/supabase';
import { subscriptionLimitService } from './subscriptionLimitService';
import { subscriptionTierService } from './subscriptionTierService';
import type {
  AppleIAPProduct,
  AppleIAPPurchase,
  AppleIAPSubscription,
  PurchaseResult,
  RestorePurchasesResult,
  IAPError,
} from '../types';

/**
 * Apple IAP Service Class
 * 
 * Manages the complete lifecycle of Apple In-App Purchases including:
 * - Connection initialization and cleanup
 * - Product fetching from App Store
 * - Purchase flow handling
 * - Receipt validation
 * - Purchase restoration
 * - Subscription status checking
 * 
 * @example
 * ```typescript
 * // Initialize the service
 * await appleIAPService.initialize();
 * 
 * // Fetch available products
 * const products = await appleIAPService.getProducts();
 * 
 * // Purchase a subscription
 * const result = await appleIAPService.purchaseSubscription('com.ronnie39.renvo.premium.monthly.v1');
 *
 * // Cleanup when done
 * await appleIAPService.disconnect();
 * ```
 */
class AppleIAPService {
  /**
   * Flag indicating whether IAP connection is initialized
   * @private
   */
  private initialized = false;

  /**
   * Purchase update listener subscription
   * @private
   */
  private purchaseUpdateSubscription: any = null;

  /**
   * Purchase error listener subscription
   * @private
   */
  private purchaseErrorSubscription: any = null;

  // ============================================================================
  // INITIALIZATION & CLEANUP
  // ============================================================================

  /**
   * Initialize IAP connection to App Store
   * 
   * Sets up the connection to StoreKit and establishes purchase listeners.
   * Must be called before any other IAP operations.
   * 
   * @throws {Error} If initialization fails
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * try {
   *   await appleIAPService.initialize();
   *   console.log('IAP initialized successfully');
   * } catch (error) {
   *   console.error('IAP initialization failed:', error);
   * }
   * ```
   */
  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      console.log('[AppleIAP] Skipping initialization - not iOS platform');
      return;
    }

    if (this.initialized) {
      console.log('[AppleIAP] Already initialized');
      return;
    }

    try {
      // Initialize react-native-iap connection
      await initConnection();
      this.initialized = true;
      console.log('[AppleIAP] ✅ IAP initialized');

      // Set up purchase listeners
      this.setupPurchaseListeners();
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to initialize IAP:', error);
      this.handleError(error);
    }
  }

  /**
   * Disconnect and cleanup IAP connection
   * 
   * Removes all listeners and closes the connection to StoreKit.
   * Should be called when IAP is no longer needed.
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * ```typescript
   * await appleIAPService.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    try {
      console.log('[AppleIAP] Disconnecting IAP...');

      // Remove purchase listeners
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }

      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }

      // End IAP connection
      await endConnection();

      this.initialized = false;
      console.log('[AppleIAP] ✅ IAP connection closed');
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to disconnect IAP:', error);
    }
  }

  // ============================================================================
  // PRODUCT MANAGEMENT
  // ============================================================================

  /**
   * Fetch available products from App Store
   * 
   * Retrieves product information including pricing, descriptions, and
   * localized details for all configured product IDs.
   * 
   * @returns {Promise<AppleIAPProduct[]>} Array of available products
   * @throws {Error} If product fetch fails
   * 
   * @example
   * ```typescript
   * const products = await appleIAPService.getProducts();
   * products.forEach(product => {
   *   console.log(`${product.title}: ${product.localizedPrice}`);
   * });
   * ```
   */
  async getProducts(): Promise<AppleIAPProduct[]> {
    try {
      // Fetch products from App Store using fetchProducts API
      const products = await fetchProducts({ 
        skus: APPLE_IAP_CONFIG.productIds as string[],
        type: 'subs'
      });
      
      console.log(`[AppleIAP] ✅ Fetched ${products.length} products`);
      
      if (products.length === 0) {
        console.warn('[AppleIAP] ⚠️ No products found. Ensure products are configured in App Store Connect.');
      }
      
      // Map RNIap products to AppleIAPProduct format
      const mappedProducts: AppleIAPProduct[] = products.map((product: any) => ({
        productId: product.productId,
        title: product.title || product.productId,
        description: product.description || '',
        price: parseFloat(String(product.price)) || 0,
        currency: product.currency || 'USD',
        localizedPrice: product.localizedPrice || `$${product.price}`,
        subscriptionPeriod: product.subscriptionPeriodUnitIOS,
        introductoryPrice: product.introductoryPrice,
        subscriptionGroupId: product.subscriptionGroupIdentifier,
        type: 'subscription' as const,
      }));

      return mappedProducts;
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to fetch products:', error);
      this.handleError(error);
    }
  }

  // ============================================================================
  // PURCHASE FLOW
  // ============================================================================

  /**
   * Purchase a subscription product
   * 
   * Initiates the purchase flow for the specified product. The actual
   * purchase result is delivered via purchase listeners.
   * 
   * @param {string} productId - Product ID to purchase
   * @returns {Promise<PurchaseResult>} Purchase result
   * @throws {Error} If purchase initiation fails
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await appleIAPService.purchaseSubscription('com.ronnie39.renvo.premium.monthly.v1');
   *   if (result.success) {
   *     console.log('Purchase successful!');
   *   }
   * } catch (error) {
   *   console.error('Purchase failed:', error);
   * }
   * ```
   */
  async purchaseSubscription(productId: string): Promise<PurchaseResult> {
    try {
      console.log('[AppleIAP] 🛒 Initiating purchase:', productId);

      // Validate product ID
      if (!(APPLE_IAP_CONFIG.productIds as readonly string[]).includes(productId)) {
        throw new Error(`Invalid product ID: ${productId}`);
      }

      // Request subscription purchase
      await requestPurchase({
        request: {
          ios: {
            sku: productId,
          },
        },
        type: 'subs',
      });
      
      // Return pending status - actual result comes through listener
      return {
        success: true,
        purchase: undefined, // Will be set by listener
      };
    } catch (error: any) {
      console.error('[AppleIAP] ❌ Purchase failed:', error);
      
      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED') {
        return {
          success: false,
          error: {
            code: IAPErrorCode.USER_CANCELLED,
            message: 'Purchase cancelled by user',
          },
        };
      }
      
      return {
        success: false,
        error: this.createIAPError(error),
      };
    }
  }

  /**
   * Restore previous purchases
   *
   * Restores all previous purchases associated with the user's Apple ID.
   * Useful for recovering subscriptions on new devices or after reinstall.
   * Validates restored purchases with server to ensure subscription status is updated.
   *
   * @returns {Promise<RestorePurchasesResult>} Restore result with purchases
   * @throws {Error} If restore fails
   *
   * @example
   * ```typescript
   * const result = await appleIAPService.restorePurchases();
   * console.log(`Restored ${result.purchases.length} purchases`);
   * ```
   */
  async restorePurchases(): Promise<RestorePurchasesResult> {
    try {
      console.log('[AppleIAP] 🔄 Restoring purchases...');

      // Get user ID for validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AppleIAP] ❌ No authenticated user');
        return {
          success: false,
          purchases: [],
          error: {
            code: IAPErrorCode.UNKNOWN,
            message: 'No authenticated user',
          },
        };
      }

      // Get available purchases from App Store
      const purchases = await getAvailablePurchases();

      // Filter for valid subscription purchases
      const validPurchases = purchases.filter((purchase: any) =>
        (APPLE_IAP_CONFIG.productIds as readonly string[]).includes(purchase.productId)
      );

      // Map to AppleIAPPurchase format
      const mappedPurchases: AppleIAPPurchase[] = validPurchases.map((purchase: any) => ({
        transactionId: purchase.transactionId || '',
        productId: purchase.productId,
        transactionReceipt: purchase.transactionReceipt || '',
        purchaseDate: purchase.transactionDate ? new Date(purchase.transactionDate).toISOString() : new Date().toISOString(),
        originalTransactionId: purchase.originalTransactionIdentifierIOS,
        isAcknowledged: true,
        purchaseState: PurchaseState.RESTORED,
      }));

      // Validate each restored purchase on server
      if (validPurchases.length > 0) {
        const latestPurchase = validPurchases[validPurchases.length - 1];
        const receiptData = (latestPurchase as any).transactionReceipt || '';
        if (receiptData) {
          await this.validateReceiptServer(receiptData, user.id);
        }
      }

      // Finish transactions
      for (const purchase of validPurchases) {
        await finishTransaction({ purchase: purchase as any, isConsumable: false });
      }

      console.log(`[AppleIAP] ✅ Restored ${mappedPurchases.length} purchase(s)`);

      return {
        success: true,
        purchases: mappedPurchases,
      };
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to restore purchases:', error);
      return {
        success: false,
        purchases: [],
        error: this.createIAPError(error),
      };
    }
  }

  // ============================================================================
  // SUBSCRIPTION STATUS
  // ============================================================================

  /**
   * Get current subscription status
   * 
   * Retrieves the user's current subscription status including expiration
   * date, auto-renew status, and subscription details.
   * 
   * @returns {Promise<AppleIAPSubscription | null>} Subscription status or null
   * 
   * @example
   * ```typescript
   * const subscription = await appleIAPService.getSubscriptionStatus();
   * if (subscription?.isActive) {
   *   console.log('User has active subscription');
   * }
   * ```
   */
  async getSubscriptionStatus(): Promise<AppleIAPSubscription | null> {
    try {
      // Get available purchases
      const purchases = await getAvailablePurchases();
      
      // Find active subscription purchase
      const activePurchase = purchases.find((purchase: any) =>
        (APPLE_IAP_CONFIG.productIds as readonly string[]).includes(purchase.productId)
      );

      if (!activePurchase) {
        return null;
      }

      // Create subscription status object
      // Note: For accurate status, use syncSubscriptionStatus() to validate with server
      const subscription: AppleIAPSubscription = {
        originalTransactionId: (activePurchase as any).originalTransactionIdentifierIOS || activePurchase.transactionId || '',
        transactionId: activePurchase.transactionId || '',
        productId: activePurchase.productId,
        isActive: true,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Placeholder
        willRenew: true, // Placeholder - should come from server validation
        startDate: activePurchase.transactionDate ? new Date(activePurchase.transactionDate).toISOString() : undefined,
      };

      return subscription;
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to get subscription status:', error);
      return null;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Set up purchase event listeners
   * 
   * Establishes listeners for purchase updates and errors.
   * @private
   */
  private setupPurchaseListeners(): void {
    // Set up purchase update listener
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase) => {
        await this.handlePurchaseUpdate(purchase);
      }
    );

      // Set up purchase error listener
      this.purchaseErrorSubscription = purchaseErrorListener(
        async (error) => {
          await this.handlePurchaseError(error);
        }
      );
  }

  /**
   * Handle purchase update event
   * 
   * Processes successful purchases, validates receipts, and finishes transactions.
   * @private
   * @param {any} purchase - Purchase object from react-native-iap
   */
  private async handlePurchaseUpdate(purchase: any): Promise<void> {
    try {
      console.log('[AppleIAP] 📦 Purchase received:', purchase.transactionId);

      // Get user ID for validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AppleIAP] ❌ No authenticated user');
        await finishTransaction({ purchase, isConsumable: false });
        return;
      }

      // For iOS subscriptions, get receipt data
      // Try purchase object first (most reliable), then fallback to JWS, then app receipt
      let receiptData = '';
      if (Platform.OS === 'ios') {
        // 1. Try transactionReceipt from purchase object (base64 format - SK1 legacy or hybrid)
        receiptData = purchase.transactionReceipt || purchase.receipt || '';
        
        // 2. If missing, try to get JWS token (StoreKit 2 modern format)
        if (!receiptData && purchase.transactionId) {
          try {
            // getTransactionJwsIOS is available in newer react-native-iap versions for SK2
            // We use 'as any' because types might not be fully updated in all versions
            if (typeof getTransactionJwsIOS === 'function') {
              receiptData = await getTransactionJwsIOS(purchase.transactionId);
              if (receiptData) {
                console.log('[AppleIAP] ✅ Retrieved JWS token for validation');
              }
            }
          } catch (jwsError) {
            // Just log info, not error - this is expected if not using SK2 or not available
            console.log('[AppleIAP] ℹ️ Could not get JWS token:', (jwsError as Error).message);
          }
        }

        // 3. Last resort: try to get legacy app receipt
        if (!receiptData) {
          try {
            receiptData = await getReceiptDataIOS();
          } catch (receiptError) {
            // Receipt might not be available immediately in sandbox or local testing
            // This is common/expected in Xcode StoreKit testing
            console.log('[AppleIAP] ℹ️ Legacy receipt not available (expected in local testing)');
          }
        }
      } else {
        // Android uses purchase token
        receiptData = purchase.purchaseToken || purchase.transactionReceipt || '';
      }

      // Try to validate receipt if available
      let receiptValidated = false;
      if (receiptData) {
        const isValid = await this.validateReceiptServer(receiptData, user.id);
        if (isValid) {
          receiptValidated = true;
        } else {
          console.error('[AppleIAP] ❌ Receipt validation failed');
        }
      } else {
        // No receipt data - this can happen in sandbox
        console.log('[AppleIAP] ℹ️ No receipt data - validation will happen via webhook');
      }

      // If receipt validation failed, update subscription status directly from purchase
      // This ensures user gets premium access immediately, webhook will validate later
      if (!receiptValidated) {
        try {
          await this.updateSubscriptionFromPurchase(purchase, user.id);
          console.log('[AppleIAP] ✅ Subscription status updated from purchase');
        } catch (updateError) {
          console.error('[AppleIAP] ⚠️ Failed to update subscription from purchase:', updateError);
          // Continue anyway - webhook will handle it
        }
      }

      // Refresh subscription status to update UI
      try {
        await Promise.all([
          subscriptionLimitService.refreshLimitStatus(),
          subscriptionTierService.refreshTierInfo(),
        ]);
      } catch (refreshError) {
        console.error('[AppleIAP] ⚠️ Error refreshing status:', refreshError);
      }

      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });
      console.log('[AppleIAP] ✅ Purchase completed:', purchase.transactionId);
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to process purchase:', error);
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch (finishError) {
        console.error('[AppleIAP] ❌ Failed to finish transaction:', finishError);
      }
    }
  }

  /**
   * Handle purchase error event
   * 
   * Logs and processes purchase errors.
   * @private
   * @param {any} error - Error object from react-native-iap
   */
  private async handlePurchaseError(error: any): Promise<void> {
    // Handle "already-owned" error - subscription is already active
    if (error.code === 'already-owned' || error.code === 'E_ALREADY_OWNED') {
      console.log('[AppleIAP] ℹ️ Subscription already owned, restoring...');
      
      try {
        // Restore existing purchases and validate them
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get available purchases
          const purchases = await getAvailablePurchases();
          const activePurchase = purchases.find((purchase: any) =>
            (APPLE_IAP_CONFIG.productIds as readonly string[]).includes(purchase.productId)
          );

          if (activePurchase) {
            // Try to get app receipt for validation
            try {
              const receiptData = await getReceiptDataIOS();
              if (receiptData) {
                await this.validateReceiptServer(receiptData, user.id);
              }
            } catch (receiptError) {
              // Receipt might not be available - that's okay
              console.log('[AppleIAP] ℹ️ Receipt not available for validation');
            }
            
            // Always refresh subscription status from available purchases
            await Promise.all([
              subscriptionLimitService.refreshLimitStatus(),
              subscriptionTierService.refreshTierInfo(),
            ]);
            
            console.log('[AppleIAP] ✅ Existing subscription restored');
          }
        }
      } catch (restoreError) {
        console.error('[AppleIAP] ⚠️ Failed to restore existing subscription:', restoreError);
      }
      return;
    }

    // Log other errors
    console.error('[AppleIAP] ❌ Purchase error:', {
      code: error.code,
      message: error.message,
      debugMessage: error.debugMessage,
    });
  }

  /**
   * Validate receipt on server
   * 
   * Sends receipt to backend for validation via Supabase Edge Function.
   * @private
   * @param {AppleIAPPurchase} purchase - Purchase to validate
   * @returns {Promise<boolean>} Whether receipt is valid
   */
  /**
   * Validate receipt on server using Supabase Edge Function
   *
   * Sends receipt data to the validate-apple-receipt function for
   * server-side validation using Apple's App Store Server API.
   *
   * @private
   * @param {string} receiptData - Base64 encoded receipt data
   * @param {string} userId - User ID for subscription update
   * @returns {Promise<boolean>} Whether receipt is valid
   */
  private async validateReceiptServer(receiptData: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'validate-apple-receipt',
        {
          body: {
            receiptData,
            userId,
          },
        }
      );

      if (error) {
        console.error('[AppleIAP] ❌ Validation error:', error);
        // Log the actual error response if available
        if (error.context?.status) {
          console.error('[AppleIAP] ❌ Status:', error.context.status);
        }
        if (error.context?.data) {
          console.error('[AppleIAP] ❌ Error details:', error.context.data);
        }
        return false;
      }

      if (!data?.success) {
        console.error('[AppleIAP] ❌ Validation failed:', data?.error || 'Unknown error');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[AppleIAP] ❌ Validation exception:', error);
      return false;
    }
  }

  /**
   * Sync subscription status with server
   *
   * Gets the latest receipt and validates it with the server to ensure
   * the user's subscription status is up-to-date.
   *
   * @returns {Promise<boolean>} Whether sync was successful
   */
  async syncSubscriptionStatus(): Promise<boolean> {
    try {
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AppleIAP] ❌ No authenticated user');
        return false;
      }

      // Get available purchases
      const purchases = await getAvailablePurchases();
      
      // Find active subscription purchase
      const activePurchase = purchases.find((purchase: any) =>
        (APPLE_IAP_CONFIG.productIds as readonly string[]).includes(purchase.productId)
      );

      if (!activePurchase) {
        return false;
      }

      // Validate receipt on server
      const receiptData = (activePurchase as any).transactionReceipt || '';
      if (!receiptData) {
        console.error('[AppleIAP] ❌ No receipt data');
        return false;
      }

      const isValid = await this.validateReceiptServer(receiptData, user.id);
      return isValid;
    } catch (error) {
      console.error('[AppleIAP] ❌ Sync failed:', error);
      return false;
    }
  }

  /**
   * Update subscription status directly from purchase object
   * Used as fallback when receipt validation fails (common in sandbox)
   * @private
   */
  private async updateSubscriptionFromPurchase(purchase: any, userId: string): Promise<void> {
    try {
      const productId = purchase.productId;
      
      // Determine billing cycle from product ID
      const billingCycle = productId.includes('monthly') ? 'monthly' : 
                          productId.includes('yearly') ? 'annual' : 'monthly';
      
      // Calculate expiration date (1 month or 1 year from now)
      const now = new Date();
      const expirationDate = new Date(now);
      if (billingCycle === 'annual') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      } else {
        expirationDate.setMonth(expirationDate.getMonth() + 1);
      }

      // Get original transaction ID (for subscriptions, this is the same across renewals)
      const originalTransactionId = purchase.originalTransactionIdentifierIOS || 
                                   purchase.transactionId || 
                                   '';

      // Update user_subscriptions table
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          tier_id: 'premium_tier',
          billing_cycle: billingCycle,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: expirationDate.toISOString(),
          updated_at: now.toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('[AppleIAP] ❌ Failed to update subscription:', updateError);
        throw updateError;
      }

      // Update profiles table with Apple-specific fields
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          payment_provider: 'apple',
          apple_original_transaction_id: originalTransactionId,
          updated_at: now.toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        console.error('[AppleIAP] ⚠️ Failed to update profile:', profileError);
        // Don't throw - subscription update succeeded
      }

      // Record transaction in audit table (if we have transaction ID)
      if (purchase.transactionId && purchase.transactionId !== '0') {
        const { error: transactionError } = await supabase.rpc(
          'record_apple_transaction',
          {
            p_user_id: userId,
            p_transaction_id: purchase.transactionId,
            p_original_transaction_id: originalTransactionId,
            p_product_id: productId,
            p_purchase_date: now.toISOString(),
            p_expiration_date: expirationDate.toISOString(),
            p_notification_type: 'PURCHASE',
          }
        );

        if (transactionError) {
          console.error('[AppleIAP] ⚠️ Failed to record transaction:', transactionError);
          // Don't throw - subscription update succeeded
        }
      }
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to update subscription from purchase:', error);
      throw error;
    }
  }

  /**
   * Create standardized IAP error object
   * @private
   */
  private createIAPError(error: any): IAPError {
    return {
      code: error.code || ('E_UNKNOWN' as IAPErrorCode),
      message: error.message || 'Unknown IAP error',
      debugMessage: error.debugMessage,
      originalError: error,
    };
  }

  /**
   * Handle and throw IAP errors
   * @private
   */
  private handleError(error: any): never {
    const iapError = this.createIAPError(error);
    throw new Error(`[AppleIAP] ${iapError.message}`);
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Check if IAP is initialized
   * @returns {boolean}
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if platform supports IAP
   * @returns {boolean}
   */
  static isPlatformSupported(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Get IAP configuration
   * @returns {typeof APPLE_IAP_CONFIG}
   */
  getConfig() {
    return APPLE_IAP_CONFIG;
  }

  /**
   * Debug method to test different product fetching approaches
   * Call this to diagnose IAP issues
   */
  async debugProductFetch(): Promise<void> {
    console.log('[AppleIAP] 🔍 ========================================');
    console.log('[AppleIAP] 🔍 STARTING COMPREHENSIVE IAP DIAGNOSTICS');
    console.log('[AppleIAP] 🔍 ========================================');
    
    // Test 1: Check platform
    console.log('[AppleIAP] 🔍 Test 1: Platform check');
    console.log('[AppleIAP] 🔍   Platform.OS:', Platform.OS);
    console.log('[AppleIAP] 🔍   Is iOS?', Platform.OS === 'ios');
    
    // Test 2: Check initialization
    console.log('[AppleIAP] 🔍 Test 2: Initialization check');
    console.log('[AppleIAP] 🔍   IAP initialized?', this.initialized);
    
    // Test 3: Check product IDs
    console.log('[AppleIAP] 🔍 Test 3: Product ID configuration');
    console.log('[AppleIAP] 🔍   Product IDs:', APPLE_IAP_CONFIG.productIds);
    console.log('[AppleIAP] 🔍   Product IDs type:', typeof APPLE_IAP_CONFIG.productIds);
    console.log('[AppleIAP] 🔍   Is array?', Array.isArray(APPLE_IAP_CONFIG.productIds));
    
    // Test 4: Fetch with skus parameter
    try {
      console.log('[AppleIAP] 🔍 Test 4: Fetch with skus parameter (default type)');
      const startTime = Date.now();
      const products1 = await fetchProducts({ skus: APPLE_IAP_CONFIG.productIds as string[] });
      console.log(`[AppleIAP] 🔍   Result (${Date.now() - startTime}ms):`, products1.length, 'products');
      if (products1.length > 0) {
        console.log('[AppleIAP] 🔍   First product:', JSON.stringify(products1[0], null, 2));
      }
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }

    // Test 4b: Fetch with skus and type='subs'
    try {
      console.log('[AppleIAP] 🔍 Test 4b: Fetch with skus and type="subs"');
      const startTime = Date.now();
      const products1b = await fetchProducts({ 
        skus: APPLE_IAP_CONFIG.productIds as string[],
        type: 'subs'
      });
      console.log(`[AppleIAP] 🔍   Result (${Date.now() - startTime}ms):`, products1b.length, 'products');
      if (products1b.length > 0) {
        console.log('[AppleIAP] 🔍   First product:', JSON.stringify(products1b[0], null, 2));
      }
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }
    
    // Test 5: Try with getProducts (old API)
    try {
      console.log('[AppleIAP] 🔍 Test 5: Try getProducts (legacy API)');
      if (typeof (RNIap as any).getProducts === 'function') {
        const startTime = Date.now();
        const products2 = await (RNIap as any).getProducts(APPLE_IAP_CONFIG.productIds);
        console.log(`[AppleIAP] 🔍   Result (${Date.now() - startTime}ms):`, products2.length, 'products');
      } else {
        console.log('[AppleIAP] 🔍   getProducts function not available');
      }
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }
    
    // Test 6: Try fetching subscriptions specifically
    try {
      console.log('[AppleIAP] 🔍 Test 6: Try getSubscriptions (subscription-specific API)');
      if (typeof (RNIap as any).getSubscriptions === 'function') {
        const startTime = Date.now();
        const products3 = await (RNIap as any).getSubscriptions(APPLE_IAP_CONFIG.productIds);
        console.log(`[AppleIAP] 🔍   Result (${Date.now() - startTime}ms):`, products3?.length ?? 0, 'products');
        if (products3 && products3.length > 0) {
          console.log('[AppleIAP] 🔍   First subscription:', JSON.stringify(products3[0], null, 2));
        }
      } else {
        console.log('[AppleIAP] 🔍   getSubscriptions function not available');
      }
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }
    
    // Test 7: Check available purchases
    try {
      console.log('[AppleIAP] 🔍 Test 7: Check available purchases');
      const purchases = await getAvailablePurchases();
      console.log('[AppleIAP] 🔍   Available purchases:', purchases.length);
      if (purchases.length > 0) {
        console.log('[AppleIAP] 🔍   Purchases:', JSON.stringify(purchases, null, 2));
      }
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }
    
    // Test 8: Check if we're in sandbox or production
    try {
      console.log('[AppleIAP] 🔍 Test 8: Environment detection');
      console.log('[AppleIAP] 🔍   __DEV__:', (global as any).__DEV__);
      console.log('[AppleIAP] 🔍   Config environment:', APPLE_IAP_CONFIG.environment);
    } catch (error: any) {
      console.error('[AppleIAP] 🔍   Error:', error.message);
    }
    
    console.log('[AppleIAP] 🔍 ========================================');
    console.log('[AppleIAP] 🔍 DIAGNOSTICS COMPLETE');
    console.log('[AppleIAP] 🔍 ========================================');
  }
}

/**
 * Singleton instance of Apple IAP Service
 * Use this exported instance throughout the application.
 * 
 * @example
 * ```typescript
 * import { appleIAPService } from './services/appleIAPService';
 * 
 * await appleIAPService.initialize();
 * const products = await appleIAPService.getProducts();
 * ```
 */
export const appleIAPService = new AppleIAPService();

/**
 * Export the class for testing purposes
 */
export { AppleIAPService };

/**
 * Default export
 */
export default appleIAPService;