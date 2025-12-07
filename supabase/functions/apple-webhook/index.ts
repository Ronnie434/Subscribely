/**
 * Apple App Store Webhook Handler Supabase Edge Function
 * 
 * Handles App Store Server Notifications V2 for subscription lifecycle events.
 * Processes webhooks for renewals, cancellations, refunds, and other subscription changes.
 * 
 * @see https://developer.apple.com/documentation/appstoreservernotifications
 * @since Phase 4 - Backend Integration
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * CORS headers for webhook responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * App Store Server Notification types
 */
enum NotificationType {
  SUBSCRIBED = 'SUBSCRIBED',
  DID_RENEW = 'DID_RENEW',
  DID_FAIL_TO_RENEW = 'DID_FAIL_TO_RENEW',
  DID_CHANGE_RENEWAL_STATUS = 'DID_CHANGE_RENEWAL_STATUS',
  EXPIRED = 'EXPIRED',
  REFUND = 'REFUND',
  REVOKED = 'REVOKED',
  GRACE_PERIOD_EXPIRED = 'GRACE_PERIOD_EXPIRED',
  PRICE_INCREASE_CONSENT = 'PRICE_INCREASE_CONSENT',
}

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
  // Active Premium tier products - must match tier_id in subscription_tiers table
  'com.ronnie39.renvo.premium.monthly.v1': 'premium_tier',
  'com.ronnie39.renvo.premium.yearly.v1': 'premium_tier',
  // Future Pro tier products (when implemented)
  'com.ronnie39.renvo.pro.monthly': 'premium_tier',
  'com.ronnie39.renvo.pro.yearly': 'premium_tier',
};

interface WebhookPayload {
  signedPayload: string;
}

interface DecodedPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data: {
    appAppleId: number;
    bundleId: string;
    bundleVersion: string;
    environment: 'Sandbox' | 'Production';
    signedTransactionInfo: string;
    signedRenewalInfo?: string;
  };
  version: string;
  signedDate: number;
}

interface TransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  webOrderLineItemId: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expiresDate?: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
}

interface RenewalInfo {
  originalTransactionId: string;
  autoRenewProductId: string;
  productId: string;
  autoRenewStatus: number;
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
  priceIncreaseStatus?: number;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
}

/**
 * Decodes a JWT payload (simplified version - in production, verify signature)
 * Note: In production, you should verify the JWT signature using Apple's public keys
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode the payload (middle part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    throw new Error('Invalid JWT token');
  }
}

/**
 * Find user by original transaction ID
 */
async function findUserByTransactionId(
  supabase: any,
  originalTransactionId: string
): Promise<string | null> {
  console.log('[apple-webhook] 🔍 Finding user by transaction ID:', originalTransactionId);
  
  // Try to find in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('apple_original_transaction_id', originalTransactionId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[apple-webhook] ❌ Error finding user in profiles:', profileError);
  }

  if (profile) {
    console.log('[apple-webhook] ✅ User found in profiles:', profile.id);
    return profile.id;
  }

  // Try to find in apple_transactions table
  console.log('[apple-webhook] 🔍 Searching in apple_transactions table...');
  const { data: transaction, error: transactionError } = await supabase
    .from('apple_transactions')
    .select('user_id')
    .eq('original_transaction_id', originalTransactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (transactionError && transactionError.code !== 'PGRST116') {
    console.error('[apple-webhook] ❌ Error finding user in transactions:', transactionError);
  }

  if (transaction) {
    console.log('[apple-webhook] ✅ User found in transactions:', transaction.user_id);
    return transaction.user_id;
  }

  console.log('[apple-webhook] ❌ User not found for transaction ID:', originalTransactionId);
  return null;
}

/**
 * Handles subscription events
 */
async function handleSubscriptionEvent(
  supabase: any,
  notificationType: string,
  transactionInfo: TransactionInfo,
  renewalInfo?: RenewalInfo
): Promise<void> {
  console.log('[apple-webhook] 🔄 handleSubscriptionEvent called');
  console.log('[apple-webhook] 🔄 Notification type:', notificationType);
  
  const {
    transactionId,
    originalTransactionId,
    productId,
    purchaseDate,
    expiresDate,
  } = transactionInfo;

  // Find user by transaction ID
  console.log('[apple-webhook] 🔍 Finding user by transaction ID:', originalTransactionId);
  const userId = await findUserByTransactionId(supabase, originalTransactionId);
  
  if (!userId) {
    console.error('[apple-webhook] ❌ User not found for transaction:', originalTransactionId);
    throw new Error('User not found for transaction');
  }

  console.log('[apple-webhook] ✅ User found:', userId);

  const tier = PRODUCT_TIER_MAP[productId] || 'premium_tier';
  const purchaseDateStr = new Date(purchaseDate).toISOString();
  const expiresDateStr = expiresDate ? new Date(expiresDate).toISOString() : null;
  
  console.log('[apple-webhook] 📝 Subscription details:');
  console.log('[apple-webhook] 📝   Tier:', tier);
  console.log('[apple-webhook] 📝   Product ID:', productId);
  console.log('[apple-webhook] 📝   Purchase Date:', purchaseDateStr);
  console.log('[apple-webhook] 📝   Expires Date:', expiresDateStr || 'N/A');

  // Record transaction in audit table
  console.log('[apple-webhook] 💾 Recording transaction...');
  const { error: transactionError } = await supabase.rpc('record_apple_transaction', {
    p_user_id: userId,
    p_transaction_id: transactionId,
    p_original_transaction_id: originalTransactionId,
    p_product_id: productId,
    p_purchase_date: purchaseDateStr,
    p_expiration_date: expiresDateStr,
    p_notification_type: notificationType,
  });

  if (transactionError) {
    console.error('[apple-webhook] ❌ Failed to record transaction:', transactionError);
  } else {
    console.log('[apple-webhook] ✅ Transaction recorded');
  }

  // Update user profile based on notification type
  console.log('[apple-webhook] 🔄 Updating user profile based on notification type...');
  switch (notificationType) {
    case NotificationType.SUBSCRIBED:
    case NotificationType.DID_RENEW:
      // Activate or renew subscription using helper function
      console.log('[apple-webhook] ✅ Activating/renewing subscription...');
      const { data: updateResult, error: updateError } = await supabase.rpc(
        'update_apple_iap_subscription',
        {
          p_user_id: userId,
          p_tier_id: tier,
          p_status: 'active',
          p_original_transaction_id: originalTransactionId,
          p_expiration_date: expiresDateStr,
          p_product_id: productId,
        }
      );
      
      if (updateError) {
        console.error('[apple-webhook] ❌ Failed to update subscription:', updateError);
      } else {
        console.log(`[apple-webhook] ✅ Subscription ${notificationType} for user ${userId}`);
      }
      break;

    case NotificationType.DID_FAIL_TO_RENEW:
      // Mark subscription as payment failed
      console.log('[apple-webhook] ⚠️ Payment failed for user:', userId);
      const { error: failError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      if (failError) {
        console.error('[apple-webhook] ❌ Failed to update subscription (payment failed):', failError);
      } else {
        console.log(`[apple-webhook] ✅ Payment failed status updated for user ${userId}`);
      }
      break;

    case NotificationType.DID_CHANGE_RENEWAL_STATUS:
      // Handle auto-renew status changes
      console.log('[apple-webhook] 🔄 Auto-renew status change for user:', userId);
      if (renewalInfo) {
        const willRenew = renewalInfo.autoRenewStatus === 1;
        console.log(`[apple-webhook] 📝 Auto-renew ${willRenew ? 'enabled' : 'disabled'} for user ${userId}`);
        
        if (!willRenew) {
          // User disabled auto-renew, mark as canceled but still active until expiration
          console.log('[apple-webhook] 🚫 User disabled auto-renew, marking as canceled...');
          const { error: cancelError } = await supabase
            .from('user_subscriptions')
            .update({
              status: 'canceled',
              cancel_at_period_end: true,
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);
          
          if (cancelError) {
            console.error('[apple-webhook] ❌ Failed to update subscription (canceled):', cancelError);
          } else {
            console.log(`[apple-webhook] ✅ Subscription canceled for user ${userId}`);
          }
        }
      } else {
        console.log('[apple-webhook] ⚠️ No renewal info available for auto-renew status change');
      }
      break;

    case NotificationType.EXPIRED:
    case NotificationType.GRACE_PERIOD_EXPIRED:
      // Subscription expired, downgrade to free
      console.log('[apple-webhook] ⏰ Subscription expired for user:', userId);
      const { error: expireError } = await supabase
        .from('user_subscriptions')
        .update({
          tier_id: 'free',
          status: 'canceled',
          billing_cycle: 'none',
          current_period_end: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      if (expireError) {
        console.error('[apple-webhook] ❌ Failed to update subscription (expired):', expireError);
      } else {
        console.log(`[apple-webhook] ✅ Subscription expired and downgraded to free for user ${userId}`);
      }
      break;

    case NotificationType.REFUND:
    case NotificationType.REVOKED:
      // Handle refunds and revocations - revert to free tier
      console.log('[apple-webhook] 💰 Refund/revocation for user:', userId);
      const refund_status = notificationType === NotificationType.REFUND ? 'canceled' : 'canceled';
      console.log('[apple-webhook] 📝 Setting status:', refund_status);
      
      const { error: refundError } = await supabase
        .from('user_subscriptions')
        .update({
          tier_id: 'free',
          status: refund_status,
          billing_cycle: 'none',
          current_period_end: null,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      // Also clear Apple tracking fields in profiles
      await supabase
        .from('profiles')
        .update({
          apple_receipt_expiration_date: null,
          apple_original_transaction_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      
      if (refundError) {
        console.error('[apple-webhook] ❌ Failed to update subscription (refund/revoked):', refundError);
      } else {
        console.log(`[apple-webhook] ✅ Subscription ${notificationType.toLowerCase()}, reverted to free tier for user ${userId}`);
      }
      break;

    default:
      console.log(`[apple-webhook] ⚠️ Unhandled notification type: ${notificationType}`);
  }
}

/**
 * Main handler function
 */
serve(async (req) => {
  console.log('[apple-webhook] ========================================');
  console.log('[apple-webhook] 📥 Webhook request received');
  console.log('[apple-webhook] Method:', req.method);
  console.log('[apple-webhook] URL:', req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[apple-webhook] ✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse webhook payload
    console.log('[apple-webhook] 📦 Parsing webhook payload...');
    const payload: WebhookPayload = await req.json();
    console.log('[apple-webhook] 📦 Payload keys:', Object.keys(payload));
    console.log('[apple-webhook] 📦 Has signedPayload:', !!payload.signedPayload);

    if (!payload.signedPayload) {
      console.error('[apple-webhook] ❌ Missing signedPayload');
      return new Response(
        JSON.stringify({ error: 'Missing signedPayload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Decode the signed payload (JWT)
    // Note: In production, verify the JWT signature using Apple's public keys
    console.log('[apple-webhook] 🔓 Decoding JWT payload...');
    const decodedPayload: DecodedPayload = decodeJWT(payload.signedPayload);
    
    console.log('[apple-webhook] 📋 Notification details:');
    console.log('[apple-webhook] 📋   Type:', decodedPayload.notificationType);
    console.log('[apple-webhook] 📋   Subtype:', decodedPayload.subtype || 'N/A');
    console.log('[apple-webhook] 📋   UUID:', decodedPayload.notificationUUID);
    console.log('[apple-webhook] 📋   Environment:', decodedPayload.data.environment);
    console.log('[apple-webhook] 📋   Bundle ID:', decodedPayload.data.bundleId);

    // Decode transaction info
    console.log('[apple-webhook] 🔓 Decoding transaction info...');
    const transactionInfo: TransactionInfo = decodeJWT(
      decodedPayload.data.signedTransactionInfo
    );
    
    console.log('[apple-webhook] 📝 Transaction info:');
    console.log('[apple-webhook] 📝   Transaction ID:', transactionInfo.transactionId);
    console.log('[apple-webhook] 📝   Original Transaction ID:', transactionInfo.originalTransactionId);
    console.log('[apple-webhook] 📝   Product ID:', transactionInfo.productId);
    console.log('[apple-webhook] 📝   Purchase Date:', new Date(transactionInfo.purchaseDate).toISOString());
    console.log('[apple-webhook] 📝   Expires Date:', transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate).toISOString() : 'N/A');

    // Decode renewal info if present
    let renewalInfo: RenewalInfo | undefined;
    if (decodedPayload.data.signedRenewalInfo) {
      console.log('[apple-webhook] 🔓 Decoding renewal info...');
      renewalInfo = decodeJWT(decodedPayload.data.signedRenewalInfo);
      console.log('[apple-webhook] 📝 Renewal info:', JSON.stringify(renewalInfo, null, 2));
    } else {
      console.log('[apple-webhook] ℹ️ No renewal info in payload');
    }

    // Initialize Supabase client with service role
    console.log('[apple-webhook] 🔐 Initializing Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('[apple-webhook] ✅ Supabase client initialized');

    // Handle the notification
    console.log('[apple-webhook] 🔄 Processing subscription event...');
    await handleSubscriptionEvent(
      supabase,
      decodedPayload.notificationType,
      transactionInfo,
      renewalInfo
    );
    console.log('[apple-webhook] ✅ Subscription event processed');

    // Return success response (200 OK is required by Apple)
    console.log('[apple-webhook] ✅ Webhook processed successfully');
    console.log('[apple-webhook] ========================================');
    
    return new Response(
      JSON.stringify({
        success: true,
        notificationType: decodedPayload.notificationType,
        notificationUUID: decodedPayload.notificationUUID,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[apple-webhook] ❌ Webhook processing error:', error);
    console.error('[apple-webhook] ❌ Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[apple-webhook] ❌ Error details:', JSON.stringify(error, null, 2));
    console.log('[apple-webhook] ========================================');
    
    // Return 200 OK even on error to prevent Apple from retrying
    // Log the error for manual investigation
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});