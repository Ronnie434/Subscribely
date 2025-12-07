/**
 * Apple Receipt Validation Supabase Edge Function
 * 
 * Validates Apple IAP receipts using the App Store Server API.
 * This function is called after a purchase to validate the receipt
 * server-side and update the user's subscription status.
 * 
 * @see https://developer.apple.com/documentation/appstoreserverapi
 * @since Phase 4 - Backend Integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APPLE_APP_BUNDLE_ID = Deno.env.get('APPLE_APP_BUNDLE_ID')!;
const APPLE_SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET')!;

// Apple App Store API endpoints
const PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

/**
 * CORS headers for cross-origin requests
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Apple receipt validation statuses
 * @see https://developer.apple.com/documentation/appstorereceipts/status
 */
const RECEIPT_STATUS = {
  VALID: 0,
  // Client-side errors
  MALFORMED_RECEIPT: 21002,
  RECEIPT_NOT_AUTHENTICATED: 21003,
  SHARED_SECRET_MISMATCH: 21004,
  RECEIPT_SERVER_UNAVAILABLE: 21005,
  SUBSCRIPTION_EXPIRED: 21006,
  // Environment mismatches
  SANDBOX_RECEIPT_IN_PROD: 21007,
  PROD_RECEIPT_IN_SANDBOX: 21008,
  // Other errors
  INTERNAL_ERROR: 21009,
  ACCOUNT_NOT_FOUND: 21010,
};

/**
 * Product ID to tier mapping
 * NOTE: Product IDs must match bundle identifier prefix (com.ronnie39.renvo)
 * 
 * Current active products:
 * - com.ronnie39.renvo.premium.monthly.v1 (Premium Monthly)
 * - com.ronnie39.renvo.premium.yearly.v1 (Premium Yearly)
 * 
 * Future products (not yet active):
 * - com.ronnie39.renvo.pro.monthly (Pro Monthly)
 * - com.ronnie39.renvo.pro.yearly (Pro Yearly)
 */
const PRODUCT_TIER_MAP: Record<string, string> = {
  // Active Premium tier products
  'com.ronnie39.renvo.premium.monthly.v1': 'premium_tier',
  'com.ronnie39.renvo.premium.yearly.v1': 'premium_tier',
  // Future Pro tier products (when implemented)
  'com.ronnie39.renvo.pro.monthly': 'premium_tier',
  'com.ronnie39.renvo.pro.yearly': 'premium_tier',
};

interface ValidationRequest {
  receiptData: string;
  userId: string;
}

interface AppleReceiptResponse {
  status: number;
  environment: 'Production' | 'Sandbox';
  receipt: {
    bundle_id: string;
    application_version: string;
    in_app: AppleInAppPurchase[];
  };
  latest_receipt_info?: AppleInAppPurchase[];
  pending_renewal_info?: AppleRenewalInfo[];
}

interface AppleInAppPurchase {
  quantity: string;
  product_id: string;
  transaction_id: string;
  original_transaction_id: string;
  purchase_date: string;
  purchase_date_ms: string;
  expires_date?: string;
  expires_date_ms?: string;
  is_trial_period?: string;
  is_in_intro_offer_period?: string;
  web_order_line_item_id?: string;
}

interface AppleRenewalInfo {
  auto_renew_product_id: string;
  auto_renew_status: string;
  expiration_intent?: string;
  original_transaction_id: string;
  product_id: string;
}

/**
 * Validates receipt with Apple's servers
 */
async function validateReceiptWithApple(
  receiptData: string,
  isProduction: boolean = true
): Promise<AppleReceiptResponse> {
  const url = isProduction ? PRODUCTION_URL : SANDBOX_URL;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      'receipt-data': receiptData,
      'password': APPLE_SHARED_SECRET,
      'exclude-old-transactions': true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apple API request failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Main handler function
 */
serve(async (req) => {
  console.log('[validate-apple-receipt] ========================================');
  console.log('[validate-apple-receipt] 📥 Request received');
  console.log('[validate-apple-receipt] Method:', req.method);
  console.log('[validate-apple-receipt] URL:', req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[validate-apple-receipt] ✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.json();
    console.log('[validate-apple-receipt] 📦 Request body keys:', Object.keys(requestBody));
    console.log('[validate-apple-receipt] 📦 userId:', requestBody.userId);
    console.log('[validate-apple-receipt] 📦 receiptData length:', requestBody.receiptData?.length || 0);
    
    const { receiptData, userId }: ValidationRequest = requestBody;

    if (!receiptData || !userId) {
      console.error('[validate-apple-receipt] ❌ Missing required fields');
      console.error('[validate-apple-receipt] ❌ receiptData:', receiptData ? 'present' : 'missing');
      console.error('[validate-apple-receipt] ❌ userId:', userId ? 'present' : 'missing');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: receiptData and userId',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate receipt format - should be base64 encoded string
    console.log('[validate-apple-receipt] 🔍 Validating receipt format...');
    console.log('[validate-apple-receipt] 🔍 Receipt first 50 chars:', receiptData.substring(0, 50));
    
    // Check if it looks like a JWS token (starts with "eyJ") instead of base64 receipt
    if (receiptData.startsWith('eyJ')) {
      console.error('[validate-apple-receipt] ❌ Receipt appears to be a JWS token, not base64 receipt!');
      console.error('[validate-apple-receipt] ❌ This function only accepts legacy base64 receipt format');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid receipt format: JWS tokens are not supported. Please send base64 encoded receipt.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Basic base64 validation
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Regex.test(receiptData)) {
      console.error('[validate-apple-receipt] ❌ Receipt data is not valid base64 format');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid receipt format: not valid base64 encoded data',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[validate-apple-receipt] ✅ Request validated');
    console.log('[validate-apple-receipt] 🔐 Initializing Supabase client...');
    
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('[validate-apple-receipt] ✅ Supabase client initialized');

    // Validate receipt with Apple (try production first)
    let appleResponse: AppleReceiptResponse;
    try {
      console.log('[validate-apple-receipt] 🍎 Validating receipt with Apple Production API...');
      console.log('[validate-apple-receipt] 🍎 Receipt data length:', receiptData.length);
      console.log('[validate-apple-receipt] 🍎 Bundle ID expected:', APPLE_APP_BUNDLE_ID);
      
      const startTime = Date.now();
      appleResponse = await validateReceiptWithApple(receiptData, true);
      const duration = Date.now() - startTime;
      
      console.log(`[validate-apple-receipt] 🍎 Apple API response received (${duration}ms)`);
      console.log('[validate-apple-receipt] 🍎 Response status:', appleResponse.status);
      console.log('[validate-apple-receipt] 🍎 Environment:', appleResponse.environment);
      
      // If we get sandbox receipt in production, retry with sandbox
      if (appleResponse.status === RECEIPT_STATUS.SANDBOX_RECEIPT_IN_PROD) {
        console.log('[validate-apple-receipt] 🔄 Sandbox receipt detected, retrying with Sandbox API...');
        appleResponse = await validateReceiptWithApple(receiptData, false);
        console.log('[validate-apple-receipt] 🍎 Sandbox response status:', appleResponse.status);
      }
    } catch (error) {
      console.error('[validate-apple-receipt] ❌ Apple validation error:', error);
      console.error('[validate-apple-receipt] ❌ Error details:', JSON.stringify(error, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to validate receipt with Apple',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check validation status
    if (appleResponse.status !== RECEIPT_STATUS.VALID) {
      console.error('[validate-apple-receipt] ❌ Invalid receipt status:', appleResponse.status);
      
      // Provide detailed error messages based on status code
      let errorMessage = `Invalid receipt (status: ${appleResponse.status})`;
      let shouldRetry = false;
      
      switch (appleResponse.status) {
        case RECEIPT_STATUS.MALFORMED_RECEIPT:
          errorMessage = 'Receipt data is malformed or corrupted (21002). This usually means the receipt data is not valid base64 or is incomplete.';
          console.error('[validate-apple-receipt] 💡 Suggestion: Check if receipt data is valid base64 encoded string');
          console.error('[validate-apple-receipt] 💡 Receipt sample:', receiptData.substring(0, 100));
          break;
        case RECEIPT_STATUS.RECEIPT_NOT_AUTHENTICATED:
          errorMessage = 'Receipt could not be authenticated (21003)';
          break;
        case RECEIPT_STATUS.SHARED_SECRET_MISMATCH:
          errorMessage = 'Shared secret does not match (21004)';
          console.error('[validate-apple-receipt] ⚠️ Check APPLE_SHARED_SECRET environment variable');
          break;
        case RECEIPT_STATUS.RECEIPT_SERVER_UNAVAILABLE:
          errorMessage = 'Apple receipt server is temporarily unavailable (21005)';
          shouldRetry = true;
          break;
        case RECEIPT_STATUS.SUBSCRIPTION_EXPIRED:
          errorMessage = 'Subscription has expired (21006)';
          break;
        case RECEIPT_STATUS.INTERNAL_ERROR:
          errorMessage = 'Apple internal error (21009)';
          shouldRetry = true;
          break;
        case RECEIPT_STATUS.ACCOUNT_NOT_FOUND:
          errorMessage = 'Account not found (21010)';
          break;
        default:
          errorMessage = `Unknown receipt validation error (status: ${appleResponse.status})`;
      }
      
      console.error('[validate-apple-receipt] ❌ Error:', errorMessage);
      if (shouldRetry) {
        console.error('[validate-apple-receipt] 💡 This error may be temporary, consider retrying');
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          status: appleResponse.status,
          shouldRetry,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[validate-apple-receipt] ✅ Receipt status is valid');

    // Verify bundle ID matches
    console.log('[validate-apple-receipt] 🔍 Checking bundle ID...');
    console.log('[validate-apple-receipt] 🔍 Expected:', APPLE_APP_BUNDLE_ID);
    console.log('[validate-apple-receipt] 🔍 Received:', appleResponse.receipt.bundle_id);
    
    if (appleResponse.receipt.bundle_id !== APPLE_APP_BUNDLE_ID) {
      console.error('[validate-apple-receipt] ❌ Bundle ID mismatch');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Receipt bundle ID does not match app',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[validate-apple-receipt] ✅ Bundle ID matches');

    // Get the latest receipt info (for subscriptions)
    const latestReceipts = appleResponse.latest_receipt_info || appleResponse.receipt.in_app;
    console.log('[validate-apple-receipt] 📋 Receipt info count:', latestReceipts?.length || 0);
    
    if (!latestReceipts || latestReceipts.length === 0) {
      console.error('[validate-apple-receipt] ❌ No purchase information found in receipt');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No purchase information found in receipt',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find the latest active subscription
    console.log('[validate-apple-receipt] 🔍 Finding active subscription...');
    const now = Date.now();
    console.log('[validate-apple-receipt] 🔍 Current time:', new Date(now).toISOString());
    
    const activeSubscription = latestReceipts
      .filter(purchase => {
        const expiresMs = purchase.expires_date_ms ? parseInt(purchase.expires_date_ms) : 0;
        const isActive = expiresMs > now;
        console.log(`[validate-apple-receipt] 🔍 Product: ${purchase.product_id}, Expires: ${expiresMs ? new Date(expiresMs).toISOString() : 'N/A'}, Active: ${isActive}`);
        return isActive;
      })
      .sort((a, b) => {
        const aExpires = parseInt(a.expires_date_ms || '0');
        const bExpires = parseInt(b.expires_date_ms || '0');
        return bExpires - aExpires;
      })[0];

    if (!activeSubscription) {
      console.error('[validate-apple-receipt] ❌ No active subscription found in receipt');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No active subscription found in receipt',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[validate-apple-receipt] ✅ Active subscription found:', activeSubscription.product_id);

    // Extract transaction details
    const {
      transaction_id,
      original_transaction_id,
      product_id,
      purchase_date_ms,
      expires_date_ms,
    } = activeSubscription;
    
    console.log('[validate-apple-receipt] 📝 Transaction details:');
    console.log('[validate-apple-receipt] 📝   Transaction ID:', transaction_id);
    console.log('[validate-apple-receipt] 📝   Original Transaction ID:', original_transaction_id);
    console.log('[validate-apple-receipt] 📝   Product ID:', product_id);

    // Determine subscription tier
    const tier = PRODUCT_TIER_MAP[product_id] || 'premium_tier';
    console.log('[validate-apple-receipt] 🎯 Subscription tier:', tier);

    // Convert dates
    const purchaseDate = new Date(parseInt(purchase_date_ms));
    const expirationDate = expires_date_ms ? new Date(parseInt(expires_date_ms)) : null;
    console.log('[validate-apple-receipt] 📅 Purchase date:', purchaseDate.toISOString());
    console.log('[validate-apple-receipt] 📅 Expiration date:', expirationDate?.toISOString() || 'N/A');

    // Check for replay attack (transaction already processed)
    console.log('[validate-apple-receipt] 🔍 Checking for existing transaction...');
    const { data: existingTransaction, error: checkError } = await supabase
      .from('apple_transactions')
      .select('id')
      .eq('transaction_id', transaction_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[validate-apple-receipt] ⚠️ Error checking existing transaction:', checkError);
    }

    if (existingTransaction) {
      console.log('[validate-apple-receipt] ℹ️ Transaction already processed:', transaction_id);
      // Return success but indicate already processed
      return new Response(
        JSON.stringify({
          success: true,
          alreadyProcessed: true,
          subscription: {
            tier,
            expirationDate: expirationDate?.toISOString(),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Record transaction in audit table
    console.log('[validate-apple-receipt] 💾 Recording transaction in database...');
    const { error: transactionError } = await supabase.rpc(
      'record_apple_transaction',
      {
        p_user_id: userId,
        p_transaction_id: transaction_id,
        p_original_transaction_id: original_transaction_id,
        p_product_id: product_id,
        p_purchase_date: purchaseDate.toISOString(),
        p_expiration_date: expirationDate?.toISOString() || null,
        p_notification_type: 'PURCHASE',
      }
    );

    if (transactionError) {
      console.error('[validate-apple-receipt] ❌ Failed to record transaction:', transactionError);
    } else {
      console.log('[validate-apple-receipt] ✅ Transaction recorded');
    }

    // Update user subscription using helper function
    console.log('[validate-apple-receipt] 👤 Updating user subscription...');
    const { error: profileError } = await supabase.rpc(
      'update_apple_iap_subscription',  // Use the new helper function we created
      {
        p_user_id: userId,
        p_tier_id: tier,
        p_status: 'active',
        p_original_transaction_id: original_transaction_id,
        p_expiration_date: expirationDate?.toISOString() || null,
        p_product_id: product_id,
      }
    );

    if (profileError) {
      console.error('[validate-apple-receipt] ❌ Failed to update profile:', profileError);
      console.error('[validate-apple-receipt] ❌ Profile error details:', JSON.stringify(profileError, null, 2));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update user subscription status',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[validate-apple-receipt] ✅ User subscription updated');

    // Success response
    console.log('[validate-apple-receipt] ✅ Validation successful');
    console.log('[validate-apple-receipt] ========================================');
    
    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          tier,
          productId: product_id,
          transactionId: transaction_id,
          originalTransactionId: original_transaction_id,
          purchaseDate: purchaseDate.toISOString(),
          expirationDate: expirationDate?.toISOString(),
          environment: appleResponse.environment,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[validate-apple-receipt] ❌ Validation error:', error);
    console.error('[validate-apple-receipt] ❌ Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[validate-apple-receipt] ❌ Error details:', JSON.stringify(error, null, 2));
    console.log('[validate-apple-receipt] ========================================');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});