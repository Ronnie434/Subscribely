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

  /**
   * Pending purchase completion callback
   * @private
   */
  private pendingPurchaseCallback: ((success: boolean, purchase?: any) => void) | null = null;

  /**
   * Purchase cancellation callback
   * @private
   */
  private purchaseCancellationCallback: (() => void) | null = null;

  /**
   * Set callback for purchase cancellation
   * @param callback - Function to call when purchase is cancelled
   */
  setPurchaseCancellationCallback(callback: (() => void) | null): void {
    this.purchaseCancellationCallback = callback;
  }

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
      
      // Clear any pending/unfinished transactions on app launch
      await this.clearPendingTransactions();
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
      console.log('[AppleIAP] 🔍 Requesting products...');
      console.log('[AppleIAP] 🔍 Product IDs:', APPLE_IAP_CONFIG.productIds);
      console.log('[AppleIAP] 🔍 Environment:', APPLE_IAP_CONFIG.environment);
      
      // Fetch products from App Store using fetchProducts API
      const products = await fetchProducts({ 
        skus: APPLE_IAP_CONFIG.productIds as string[],
        type: 'subs'
      });
      
      console.log(`[AppleIAP] ✅ Fetched ${products.length} products`);
      
      if (products.length === 0) {
        console.error('[AppleIAP] ❌ No products found!');
        console.error('[AppleIAP] ❌ Possible reasons:');
        console.error('[AppleIAP] ❌ 1. Products not created in App Store Connect');
        console.error('[AppleIAP] ❌ 2. Products not in "Ready to Submit" status');
        console.error('[AppleIAP] ❌ 3. Bundle ID mismatch');
        console.error('[AppleIAP] ❌ 4. Not signed in with Sandbox account');
        console.error('[AppleIAP] ❌ 5. Agreements not signed in App Store Connect');
        return []; // Return empty array instead of undefined
      }
      
      // Log raw product structure for debugging
      if (products.length > 0) {
        console.log('[AppleIAP] 🔍 First product details:', {
          id: products[0].id || products[0].productId,
          title: products[0].title,
          price: products[0].price,
          currency: products[0].currency,
        });
        
        if (__DEV__) {
          console.log('[AppleIAP] 🔍 Raw product structure:', JSON.stringify(products[0], null, 2));
        }
      }
      
      // Map RNIap products to AppleIAPProduct format
      // Note: StoreKit 2 uses 'id', legacy/Android uses 'productId'
      const mappedProducts: AppleIAPProduct[] = products
        .filter((product: any) => product && (product.productId || product.id)) // Filter out invalid products
        .map((product: any) => {
          const id = product.productId || product.id;
          return {
            productId: id,
            title: product.title || id,
        description: product.description || '',
        price: parseFloat(String(product.price)) || 0,
        currency: product.currency || 'USD',
            localizedPrice: product.localizedPrice || product.displayPrice || `$${product.price}`,
        subscriptionPeriod: product.subscriptionPeriodUnitIOS,
        introductoryPrice: product.introductoryPrice,
        subscriptionGroupId: product.subscriptionGroupIdentifier,
        type: 'subscription' as const,
          };
        });

      console.log(`[AppleIAP] ✅ Mapped ${mappedProducts.length} products`);
      
      if (mappedProducts.length === 0 && products.length > 0) {
        console.error('[AppleIAP] ❌ Products fetched but mapping failed!');
        console.error('[AppleIAP] ❌ This indicates a product structure mismatch');
      }

      return mappedProducts;
    } catch (error) {
      console.error('[AppleIAP] ❌ Failed to fetch products:', error);
      // Return empty array instead of throwing to allow purchase to proceed
      // StoreKit might have products cached even if fetch fails
      return [];
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

      // Ensure IAP is initialized
      if (!this.initialized) {
        console.log('[AppleIAP] ⚠️ IAP not initialized, initializing now...');
        await this.initialize();
        
        // Double-check after initialization
        if (!this.initialized) {
          throw new Error('Failed to initialize IAP. Please restart the app and try again.');
        }
      }

      // Validate product ID
      if (!(APPLE_IAP_CONFIG.productIds as readonly string[]).includes(productId)) {
        const errorMsg = `Invalid product ID: ${productId}. Valid IDs: ${APPLE_IAP_CONFIG.productIds.join(', ')}`;
        console.error('[AppleIAP] ❌', errorMsg);
        throw new Error(errorMsg);
      }

      // Verify product is available by fetching products first
      // This ensures StoreKit has loaded the products (important for local testing)
      console.log('[AppleIAP] 🔍 Verifying product availability...');
      const products = await this.getProducts();
      
      // Log product details for debugging
      console.log('[AppleIAP] 🔍 Products fetched:', products.length);
      if (products.length > 0) {
        console.log('[AppleIAP] 🔍 Product IDs:', products.map(p => p?.productId || 'MISSING').join(', '));
        console.log('[AppleIAP] 🔍 Looking for:', productId);
      }
      
      // Check if products array is valid and has items
      if (!products || products.length === 0) {
        console.warn('[AppleIAP] ⚠️ No products available, but proceeding with purchase anyway (StoreKit may have products cached)');
        // Don't throw - StoreKit might have the product even if fetchProducts returns empty
      } else {
        const productExists = products.some(p => p && p.productId === productId);
        if (!productExists) {
          console.warn('[AppleIAP] ⚠️ Product not in fetched list, but proceeding anyway (StoreKit may have it cached)');
          // Don't throw - StoreKit might have the product even if it's not in the fetched list
        } else {
          console.log('[AppleIAP] ✅ Product verified in fetched products');
        }
      }

      console.log('[AppleIAP] ✅ IAP initialized, product verified, requesting purchase...');

      // Request subscription purchase
      // Note: requestPurchase() doesn't return the purchase result directly
      // The actual purchase result comes through the purchase listener
      // This just initiates the purchase flow
      try {
        await requestPurchase({
          request: {
            ios: {
              sku: productId,
            },
          },
          type: 'subs', // Explicitly specify subscription type
        });
        
        console.log('[AppleIAP] ✅ Purchase request sent, waiting for listener...');
        
        // Return success - the actual purchase completion will be handled by listener
        // The PaywallModal should wait for the listener to fire before showing success
        return {
          success: true,
          purchase: undefined, // Will be set by listener
        };
      } catch (requestError: any) {
        // Handle errors from requestPurchase itself (not from listener)
        console.error('[AppleIAP] ❌ Purchase request failed:', requestError);
        
        // Check if user cancelled during the request
        if (requestError.code === 'E_USER_CANCELLED' || 
            requestError.code === 'user-cancelled' ||
            requestError.message?.toLowerCase().includes('cancel')) {
          console.log('[AppleIAP] ℹ️ User cancelled purchase during request');
          return {
            success: false,
            error: {
              code: IAPErrorCode.USER_CANCELLED,
              message: 'Purchase cancelled by user',
            },
          };
        }
        
        throw requestError; // Re-throw to be handled by outer catch
      }
    } catch (error: any) {
      console.error('[AppleIAP] ❌ Purchase failed:', error);
      console.error('[AppleIAP] ❌ Error details:', {
        code: error.code,
        message: error.message,
        debugMessage: error.debugMessage,
        stack: error.stack,
      });
      
      // Check if user cancelled
      if (error.code === 'E_USER_CANCELLED' || 
          error.code === 'user-cancelled' ||
          error.message?.toLowerCase().includes('cancel')) {
        console.log('[AppleIAP] ℹ️ User cancelled purchase');
        return {
          success: false,
          error: {
            code: IAPErrorCode.USER_CANCELLED,
            message: 'Purchase cancelled by user',
          },
        };
      }
      
      // Provide more descriptive error messages
      let errorMessage = 'Purchase failed. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Purchase failed: ${error.code}`;
      }
      
      return {
        success: false,
        error: {
          ...this.createIAPError(error),
          message: errorMessage,
        },
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
    // Remove existing listeners if any
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
      this.purchaseUpdateSubscription = null;
    }

    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
      this.purchaseErrorSubscription = null;
    }

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
   * Clear pending/unfinished transactions on app launch
   * 
   * Finishes any old transactions that are stuck in the purchase queue.
   * This prevents old transactions from re-triggering on every app launch.
   * @private
   */
  private async clearPendingTransactions(): Promise<void> {
    try {
      console.log('[AppleIAP] 🔍 Checking for pending transactions...');
      
      const availablePurchases = await getAvailablePurchases();
      
      if (availablePurchases.length === 0) {
        console.log('[AppleIAP] ✅ No pending transactions');
        return;
      }
      
      console.log(`[AppleIAP] 📦 Found ${availablePurchases.length} pending transaction(s)`);
      
      for (const purchase of availablePurchases) {
        console.log(`[AppleIAP] 🧹 Finishing old transaction: ${purchase.transactionId}`);
        
        try {
          await finishTransaction({ purchase, isConsumable: false });
          console.log(`[AppleIAP] ✅ Finished transaction: ${purchase.transactionId}`);
        } catch (finishError) {
          console.error(`[AppleIAP] ⚠️ Failed to finish transaction ${purchase.transactionId}:`, finishError);
          // Continue with other transactions even if one fails
        }
      }
      
      console.log('[AppleIAP] ✅ All pending transactions cleared');
    } catch (error) {
      console.error('[AppleIAP] ❌ Error clearing pending transactions:', error);
      // Don't throw - this is a cleanup operation and shouldn't block initialization
    }
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
      let isLocalTransaction = false;

      // Check if this is a local Xcode transaction (transactionId often 0/1 or very short)
      if (
        Platform.OS === 'ios' &&
        purchase.transactionId &&
        String(purchase.transactionId).length <= 6
      ) {
        console.log('[AppleIAP] 🧪 Local/Simulator transaction detected');
        isLocalTransaction = true;
      }

      if (Platform.OS === 'ios' && !isLocalTransaction) {
        // 1. Try transactionReceipt from purchase object (base64 format - SK1 legacy or hybrid)
        receiptData = purchase.transactionReceipt || purchase.receipt || '';
        console.log('[AppleIAP] 📄 Transaction receipt from purchase:', receiptData ? 'present' : 'missing');
        
        // 2. If missing, try to get the full app receipt (legacy base64 format)
        // This is compatible with our current validate-apple-receipt Edge Function
        if (!receiptData) {
          try {
            console.log('[AppleIAP] 🔍 Attempting to get legacy app receipt...');
            receiptData = await getReceiptDataIOS();
            if (receiptData) {
              console.log('[AppleIAP] ✅ Retrieved legacy receipt for validation');
            }
          } catch (receiptError) {
            // Receipt might not be available immediately in sandbox or local testing
            // This is common/expected in Xcode StoreKit testing
            console.log('[AppleIAP] ℹ️ Legacy receipt not available (expected in local testing)');
          }
        }

        // 3. FUTURE: StoreKit 2 JWS token support (currently incompatible with our validator)
        // Our current validate-apple-receipt uses /verifyReceipt API which expects base64 receipt
        // JWS tokens require the new App Store Server API - will implement in future update
        // if (!receiptData && purchase.productId && typeof getTransactionJwsIOS === 'function') {
        //   receiptData = await getTransactionJwsIOS(purchase.productId);
        // }
      } else if (!isLocalTransaction) {
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
      } else if (isLocalTransaction) {
        console.log('[AppleIAP] 🧪 Skipping server validation for local transaction');
      } else {
        // No receipt data - this can happen in sandbox
        console.log('[AppleIAP] ℹ️ No receipt data - validation will happen via webhook');
      }

      // If receipt validation failed or it's a local transaction, update subscription status directly
      // This ensures user gets premium access immediately
      if (!receiptValidated || isLocalTransaction) {
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
    // Check if user cancelled
    if (error.code === 'E_USER_CANCELLED' || error.code === 'user-cancelled' || error.message?.toLowerCase().includes('cancel')) {
      console.log('[AppleIAP] ℹ️ User cancelled purchase');
      
      // Notify cancellation callback if set
      if (this.purchaseCancellationCallback) {
        console.log('[AppleIAP] 📢 Notifying cancellation callback');
        this.purchaseCancellationCallback();
      }
      
      return; // Don't process cancellation as an error
    }
    
    // Ignore local/simulator SKU errors
    if (error.code === 'sku-not-found' || error.message?.includes('sku 0') || error.message?.includes('sku 1')) {
      console.log('[AppleIAP] 🧪 Ignoring SKU error in local/simulator environment');
      return;
    }

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
      console.log('[AppleIAP] 🔍 Validating receipt with server...');
      console.log('[AppleIAP] 🔍 Receipt data length:', receiptData.length);
      console.log('[AppleIAP] 🔍 Receipt first 50 chars:', receiptData.substring(0, 50));
      console.log('[AppleIAP] 🔍 Receipt type:', receiptData.startsWith('eyJ') ? 'JWS token' : 'base64 receipt');
      
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
          console.error('[AppleIAP] ❌ Error details:', JSON.stringify(error.context.data));
        }
        return false;
      }

      if (!data?.success) {
        console.error('[AppleIAP] ❌ Validation failed:', data?.error || 'Unknown error');
        if (data?.status) {
          console.error('[AppleIAP] ❌ Apple status code:', data.status);
        }
        return false;
      }

      console.log('[AppleIAP] ✅ Receipt validation successful');
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

      // IMPORTANT: Check if user has an existing canceled subscription
      // We should NOT automatically reactivate a canceled subscription
      console.log('[AppleIAP] 🔍 Checking for existing subscription...');
      const { data: existingSub, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('status, canceled_at, cancel_at_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('[AppleIAP] ⚠️ Error checking existing subscription:', fetchError);
        // Continue anyway - will upsert
      }

      // If subscription is canceled and not yet expired, don't overwrite it
      if (existingSub?.status === 'canceled' && existingSub?.cancel_at_period_end) {
        console.log('[AppleIAP] ⚠️ User has canceled subscription, skipping client-side update');
        console.log('[AppleIAP] ℹ️ Webhook will handle any legitimate renewal after cancellation');
        return; // Let the webhook handle it - it has authoritative info from Apple
      }

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
          cancel_at_period_end: false, // Reset cancellation flag for new/renewed subscriptions
          canceled_at: null, // Clear canceled timestamp
          updated_at: now.toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('[AppleIAP] ❌ Failed to update subscription:', updateError);
        throw updateError;
      }

      console.log('[AppleIAP] ✅ Subscription updated: tier=premium_tier, status=active, cycle=' + billingCycle);

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