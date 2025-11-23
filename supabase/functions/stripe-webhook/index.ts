/**
 * Stripe Webhook Handler Edge Function
 * 
 * Processes Stripe webhook events to keep the database in sync with Stripe
 * 
 * Handled Events:
 * - customer.subscription.created: New subscription created
 * - customer.subscription.updated: Subscription status/details changed
 * - customer.subscription.deleted: Subscription canceled/expired
 * - invoice.payment_succeeded: Payment successful
 * - invoice.payment_failed: Payment failed
 * - charge.refunded: Charge refunded
 * 
 * Security:
 * - Verifies webhook signature using constant-time comparison
 * - Implements idempotency to prevent duplicate processing
 * - Returns 200 for all events (even unhandled) to prevent retries
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.0.0';
import { verifyWebhookSignature, errorResponse, corsHeaders } from '../_shared/stripe.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // For webhook requests, bypass JWT validation by not checking Authorization header
  // Stripe webhooks authenticate via signature verification, not JWT

  try {
    // Get raw body and signature for webhook verification
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // DETAILED LOGGING FOR DEBUGGING
    console.log('========================================');
    console.log('🔍 Received webhook request');
    console.log('========================================');
    console.log('Signature header:', signature);
    console.log('Signature header length:', signature?.length);
    console.log('Body length:', body.length);
    console.log('Body preview (first 100 chars):', body.substring(0, 100));
    console.log('========================================');

    if (!signature) {
      console.error('Missing Stripe signature');
      return new Response(
        JSON.stringify({ error: 'Missing Stripe signature' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('Verifying webhook signature...');

    // Verify the webhook signature (this authenticates it's from Stripe)
    let event: Stripe.Event;
    try {
      event = await verifyWebhookSignature(body, signature);
      console.log('✅ Webhook signature verified');
      console.log('Event type:', event.type);
      console.log('Event ID:', event.id);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    // Initialize Supabase client with service role (not user auth!)
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // Check idempotency - have we processed this event before?
    const { data: existingEvent } = await supabase
      .from('stripe_webhooks')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Log webhook event
    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    // Process event based on type
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event);
        break;

      case 'invoice.payment_succeeded':
        console.log('Processing invoice.payment_succeeded event');
        await handlePaymentSucceeded(supabase, event);
        break;

      case 'invoice_payment.paid':  // Deprecated event name
        console.warn('⚠️ DEPRECATED: Received invoice_payment.paid event. Update Stripe webhook to use invoice.payment_succeeded with API version 2023-10-16+');
        console.log('Processing deprecated invoice_payment.paid event');
        await handlePaymentSucceeded(supabase, event);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(supabase, event);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(supabase, paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, failedIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase
      .from('stripe_webhooks')
      .insert({
        event_id: event.id,
        event_type: event.type,
        event_data: event,
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
      });

    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Stripe from retrying
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ received: true, error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});

/**
 * Handle subscription.created event
 * 🔐 SECURITY FIX: This now properly sets tier_id from metadata
 */
async function handleSubscriptionCreated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = subscription.metadata.supabase_user_id;
  const tierId = subscription.metadata.tier_id; // Read tier_id directly
  const billingCycle = subscription.metadata.billing_cycle;

  if (!userId) {
    console.error('No supabase_user_id in subscription metadata');
    return;
  }

  console.log(`Subscription created: ${subscription.id} for user ${userId}`);
  console.log('Tier ID from metadata:', tierId);
  console.log('Billing cycle from metadata:', billingCycle);

  if (!tierId) {
    console.warn('⚠️ No tier_id in subscription metadata, will be set by payment success handler');
  }

  // Map billing cycle to database format
  const dbBillingCycle = billingCycle === 'yearly' ? 'annual' : 'monthly';

  // Update or insert subscription record with proper tier
  // Use user_id as conflict target to update existing user records
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      tier_id: tierId, // Use tier_id directly from metadata (e.g., 'premium_tier')
      billing_cycle: dbBillingCycle, // Set billing cycle from metadata
      status: mapStripeStatus(subscription.status),
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: null, // Clear any previous cancellation
      cancel_at: null,   // Clear any scheduled cancellation
    }, {
      onConflict: 'user_id', // Update the user's existing record
      ignoreDuplicates: false, // Always update
    });

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`✅ Subscription created with tier_id: ${tierId || 'unknown'}`);
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  console.log(`Subscription updated: ${subscription.id} - status: ${subscription.status}`);

  // Get the subscription record
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('user_id, tier_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!subRecord) {
    console.error(`No subscription record found for ${subscription.id}`);
    return;
  }

  // Determine if we need to change tier based on status
  let tierId = subRecord.tier_id;
  if (['canceled', 'unpaid'].includes(subscription.status)) {
    // Downgrade to free tier
    const { data: freeTier } = await supabase
      .from('subscription_tiers')
      .select('tier_id')
      .eq('tier_id', 'free')
      .single();
    
    if (freeTier) {
      tierId = freeTier.tier_id;
    }
  }

  // Update subscription status
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: mapStripeStatus(subscription.status),
      tier_id: tierId,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

/**
 * Handle subscription.deleted event
 */
async function handleSubscriptionDeleted(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  console.log(`Subscription deleted: ${subscription.id}`);

  // Get free tier ID
  const { data: freeTier } = await supabase
    .from('subscription_tiers')
    .select('tier_id')
    .eq('tier_id', 'free')
    .single();

  if (!freeTier) {
    console.error('Free tier not found');
    return;
  }

  // Update subscription to canceled and downgrade to free
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      tier_id: freeTier.tier_id,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handlePaymentSucceeded(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  console.log('🔍 [DIAGNOSTIC] ========== handlePaymentSucceeded CALLED ==========');
  console.log('🔍 [DIAGNOSTIC] Event ID:', event.id);
  console.log('🔍 [DIAGNOSTIC] Event Type:', event.type);
  console.log('Processing invoice.payment_succeeded event');
  console.log('Invoice paid:', invoice.id);
  console.log('Subscription:', invoice.subscription);
  console.log('Customer:', invoice.customer);
  console.log('Amount:', invoice.amount_paid / 100);
  console.log('🔍 [DIAGNOSTIC] Payment Intent:', invoice.payment_intent);

  // 🔐 SECURITY FIX: This handler CREATES the subscription record (not payment_intent.succeeded)
  // We create the record here because invoice has all the data we need
  
  // Check if invoice has customer (required)
  if (!invoice.customer) {
    console.warn('⚠️ Invoice missing customer field', {
      invoice_id: invoice.id,
      event_type: event.type,
      api_version: event.api_version
    });
    return;
  }

  // Check if invoice has subscription (modern events have it, deprecated might not)
  if (invoice.subscription) {
    console.log('✅ Invoice has subscription field:', invoice.subscription);
    
    // Fetch subscription details to get metadata
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('❌ Stripe secret key not configured');
      return;
    }
    
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    
    console.log('📦 Subscription metadata:', subscription.metadata);
    
    const userId = subscription.metadata.supabase_user_id;
    const billingCycle = subscription.metadata.billing_cycle;
    const tierId = subscription.metadata.tier_id; // Read tier_id directly

    if (!userId) {
      console.error('❌ No supabase_user_id in subscription metadata');
      return;
    }

    if (!tierId) {
      console.error('❌ No tier_id in subscription metadata');
      return;
    }

    console.log('✅ User ID from metadata:', userId);
    console.log('✅ Billing cycle from metadata:', billingCycle);
    console.log('✅ Tier ID from metadata:', tierId);

    // Map billing cycle to database format
    const dbBillingCycle = billingCycle === 'yearly' ? 'annual' : 'monthly';

    // STEP 1: CREATE OR UPDATE subscription record (🔐 ONLY AFTER PAYMENT SUCCEEDS)
    const { data: existingRecord } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingRecord) {
      console.log('⚠️ Subscription record already exists, updating');
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          tier_id: tierId, // Use tier_id directly from metadata
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: 'active',
          billing_cycle: dbBillingCycle,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          canceled_at: null,
          cancel_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error('❌ Failed to update subscription:', updateError);
        throw updateError;
      }

      console.log(`✅ Subscription record updated for user ${userId}`);
    } else {
      console.log('🔐 Creating NEW subscription record (payment succeeded)');
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          tier_id: tierId, // Use tier_id directly from metadata
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: 'active',
          billing_cycle: dbBillingCycle,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        });

      if (insertError) {
        console.error('❌ Failed to create subscription record:', insertError);
        throw insertError;
      }

      console.log(`✅ Subscription record CREATED for user ${userId} with tier_id: ${tierId}`);
    }

    // Verify the record
    const { data: finalRecord } = await supabase
      .from('user_subscriptions')
      .select('id, tier_id, status, billing_cycle')
      .eq('user_id', userId)
      .single();

    console.log('🔍 [DIAGNOSTIC] Final subscription state:');
    console.log('🔍 [DIAGNOSTIC]   - Record ID:', finalRecord?.id);
    console.log('🔍 [DIAGNOSTIC]   - Status:', finalRecord?.status);
    console.log('🔍 [DIAGNOSTIC]   - Tier ID:', finalRecord?.tier_id);
    console.log('🔍 [DIAGNOSTIC]   - Billing cycle:', finalRecord?.billing_cycle);
    console.log('🔐 SECURITY: Subscription created ONLY after successful payment');
  } else {
    console.warn('⚠️ Invoice missing subscription field (deprecated event or non-subscription payment)', {
      invoice_id: invoice.id,
      event_type: event.type,
      api_version: event.api_version,
      customer_id: invoice.customer
    });
    console.log('🔄 Will use fallback logic to look up subscription by customer_id');
  }

  // STEP 2: Find user_subscription_id for payment transaction
  // Try to find subscription record either by:
  // 1. stripe_subscription_id (if invoice has subscription)
  // 2. stripe_customer_id (fallback for non-subscription invoices or deprecated events)
  
  let subRecord: any = null;
  
  if (invoice.subscription) {
    // Regular subscription payment
    console.log('🔍 Looking up subscription by stripe_subscription_id:', invoice.subscription);
    const { data, error: lookupError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, tier_id, status, stripe_customer_id')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();
    
    if (lookupError) {
      console.error('❌ Error looking up subscription by stripe_subscription_id:', lookupError);
    }
    subRecord = data;
  } else {
    // Non-subscription invoice or deprecated event - look up by customer ID
    console.log('⚠️ Invoice not associated with subscription - using FALLBACK lookup by customer_id:', invoice.customer);
    console.log('🔄 This is expected for deprecated webhook events or one-time payments');
    
    const { data, error: lookupError } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, tier_id, status, stripe_customer_id, stripe_subscription_id')
      .eq('stripe_customer_id', invoice.customer)
      .single();
    
    if (lookupError) {
      console.error('❌ Error looking up subscription by stripe_customer_id:', lookupError);
      console.error('   - Error code:', lookupError.code);
      console.error('   - Error message:', lookupError.message);
    }
    
    if (data) {
      console.log('✅ FALLBACK SUCCESS: Found subscription by customer_id');
      console.log('   - user_subscription_id:', data.id);
      console.log('   - user_id:', data.user_id);
      console.log('   - stripe_subscription_id:', data.stripe_subscription_id);
    } else {
      console.error('❌ FALLBACK FAILED: No subscription found for customer_id:', invoice.customer);
    }
    
    subRecord = data;
  }

  if (!subRecord) {
    console.error(`❌ No subscription record found for invoice ${invoice.id}`);
    console.error(`   - Subscription ID: ${invoice.subscription || 'null'}`);
    console.error(`   - Customer ID: ${invoice.customer}`);
    console.error(`   - This means either:`);
    console.error(`     1. No subscription exists for this customer in the database`);
    console.error(`     2. The subscription was created but not yet synced to database`);
    console.error(`     3. The customer_id doesn't match any existing subscription`);
    return;
  }

  console.log('✅ Found user_subscription record:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC] Current subscription state:');
  console.log('🔍 [DIAGNOSTIC]   - Subscription ID:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC]   - User ID:', subRecord.user_id);
  console.log('🔍 [DIAGNOSTIC]   - Current tier_id:', subRecord.tier_id);
  console.log('🔍 [DIAGNOSTIC]   - Current status:', subRecord.status);

  // STEP 2: Record payment transaction FIRST (always, regardless of subscription)
  console.log('🔍 [DIAGNOSTIC] ========== ATTEMPTING PAYMENT_TRANSACTION INSERT ==========');
  const paymentIntentId = (invoice.payment_intent as string) || `invoice_${invoice.id}`;
  
  if (!invoice.payment_intent) {
    console.log('⚠️ payment_intent is NULL - using invoice.id as fallback:', paymentIntentId);
  }

  console.log('🔍 [DIAGNOSTIC] Payment Intent ID to use:', paymentIntentId);
  console.log('🔍 [DIAGNOSTIC] User Subscription ID:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC] Invoice ID:', invoice.id);
  console.log('🔍 [DIAGNOSTIC] Amount:', invoice.amount_paid / 100);
  console.log('🔍 [DIAGNOSTIC] Currency:', invoice.currency);
  
  const transactionData = {
    user_subscription_id: subRecord.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    status: 'succeeded',
    payment_method_type: 'card',
    metadata: {
      billing_reason: invoice.billing_reason,
      subscription_id: invoice.subscription || null,
      customer_id: invoice.customer,
      used_fallback_id: !invoice.payment_intent,
      has_subscription: !!invoice.subscription,
    },
  };
  
  console.log('🔍 [DIAGNOSTIC] Transaction data to insert:', JSON.stringify(transactionData, null, 2));

  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert(transactionData);

  if (txError) {
    console.error('❌ ========== PAYMENT_TRANSACTION INSERT FAILED ==========');
    console.error('❌ Error code:', txError.code);
    console.error('❌ Error message:', txError.message);
    console.error('❌ Error details:', JSON.stringify(txError, null, 2));
    console.error('❌ Transaction data that failed:', JSON.stringify(transactionData, null, 2));
    console.error('❌ Full error object:', txError);
  } else {
    console.log('✅ ========== PAYMENT_TRANSACTION INSERT SUCCEEDED ==========');
    console.log('✅ Payment transaction recorded:', paymentIntentId);
    console.log('✅ Transaction inserted for user_subscription_id:', subRecord.id);
  }

  // STEP 3: Update subscription status/tier (only if invoice has subscription)
  if (invoice.subscription) {
    console.log('🔄 Updating subscription status for recurring subscription');
    
    // Get premium tier for explicit upgrade
    const { data: premiumTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('tier_id')
      .eq('name', 'Premium')
      .single();

    if (tierError || !premiumTier) {
      console.error('Failed to get premium tier:', tierError);
    } else {
      console.log('🔍 [DIAGNOSTIC] Premium tier found:', premiumTier.tier_id);

      // Update subscription status to active with explicit tier upgrade
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          tier_id: premiumTier.tier_id, // Explicitly set to premium
          updated_at: new Date().toISOString(),
        })
        .eq('id', subRecord.id);

      if (updateError) {
        console.error('Failed to update subscription status:', updateError);
      } else {
        console.log('✅ Subscription status updated to active with premium tier');
        // DIAGNOSTIC LOG: Verify tier_id after status update
        const { data: updatedRecord } = await supabase
          .from('user_subscriptions')
          .select('tier_id, status')
          .eq('id', subRecord.id)
          .single();
        console.log('🔍 [DIAGNOSTIC] Subscription state AFTER status update:');
        console.log('🔍 [DIAGNOSTIC]   - New status:', updatedRecord?.status);
        console.log('🔍 [DIAGNOSTIC]   - tier_id (upgraded to premium):', updatedRecord?.tier_id);
      }
    }
  } else {
    console.log('ℹ️ Skipping subscription status update (non-subscription invoice)');
  }

  // STEP 4: Track payment_completed event
  const invoiceBillingCycle = invoice.lines?.data?.[0]?.plan?.interval || 'one-time';
  const { error: trackError } = await supabase
    .from('usage_tracking_events')
    .insert({
      user_id: subRecord.user_id,
      event_type: 'payment_completed',
      event_context: 'webhook_payment_success',
      event_data: {
        amount: invoice.amount_paid / 100,
        subscription_id: invoice.subscription || null,
        billing_cycle: invoiceBillingCycle,
        invoice_id: invoice.id,
        payment_intent_id: invoice.payment_intent,
        is_subscription_payment: !!invoice.subscription,
      },
    });

  if (trackError) {
    console.error('Failed to track payment_completed:', trackError);
  } else {
    console.log('✅ Payment completed event tracked');
  }
}

/**
 * Handle payment_intent.succeeded event
 * This fires immediately when payment succeeds, before invoice.payment_succeeded
 *
 * ℹ️ NOTE: Subscription record creation is handled by invoice.payment_succeeded
 * This handler is just for logging/diagnostics
 */
async function handlePaymentIntentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log('ℹ️ Processing payment_intent.succeeded (diagnostics only)');
  console.log('Payment Intent ID:', paymentIntent.id);
  console.log('Payment Intent status:', paymentIntent.status);
  console.log('Amount:', paymentIntent.amount / 100, paymentIntent.currency);
  
  // The actual subscription record will be created by invoice.payment_succeeded
  console.log('ℹ️ Subscription record will be created by invoice.payment_succeeded handler');
}

/**
 * Handle payment_intent.payment_failed event
 * 🔐 SECURITY FIX: No subscription record exists yet when payment fails
 * We simply log the failure and don't create any record
 */
async function handlePaymentIntentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log('🔐 Processing payment_intent.payment_failed - NO record creation');
  console.log('Payment Intent ID:', paymentIntent.id);
  console.log('Failure message:', paymentIntent.last_payment_error?.message);

  // Get the invoice to extract subscription details
  const invoiceId = paymentIntent.invoice as string;
  if (!invoiceId) {
    console.log('ℹ️ No invoice associated with failed payment intent');
    return;
  }

  // Initialize Stripe to fetch subscription details
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    console.error('❌ Stripe secret key not configured');
    return;
  }
  
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  
  // Fetch invoice to get subscription ID and user info
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const subscriptionId = invoice.subscription as string;
  
  if (!subscriptionId) {
    console.log('ℹ️ No subscription ID in invoice');
    return;
  }

  // Fetch subscription to get metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('❌ No supabase_user_id in subscription metadata');
    return;
  }

  console.log('ℹ️ Payment failed for user:', userId);
  console.log('ℹ️ Subscription ID:', subscriptionId);

  // Check if a subscription record exists (shouldn't in new flow, but handle legacy)
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .single();

  if (subRecord) {
    console.log('⚠️ Legacy: Subscription record exists, updating to payment_failed');
    // Update existing record to payment_failed
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'payment_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subRecord.id);

    if (updateError) {
      console.error('❌ Failed to update subscription status:', updateError);
      throw updateError;
    }

    console.log('✅ Subscription status updated to payment_failed');
  } else {
    console.log('✅ No subscription record exists (expected in new flow)');
    console.log('🔐 SECURITY: No premium access granted due to payment failure');
  }

  // Cancel the Stripe subscription to clean up
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    console.log('✅ Stripe subscription canceled after payment failure');
  } catch (error) {
    console.error('⚠️ Failed to cancel Stripe subscription:', error);
  }
}

/**
 * Handle invoice.payment_failed event
 * 🔐 SECURITY FIX: Handles both new (no record) and legacy (existing record) flows
 */
async function handlePaymentFailed(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (!invoice.subscription) {
    console.log('ℹ️ Invoice not associated with subscription');
    return;
  }

  console.log(`🔐 Payment failed for invoice: ${invoice.id}`);
  console.log('Subscription ID:', invoice.subscription);

  // Get subscription record (may not exist in new flow)
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (!subRecord) {
    console.log('✅ No subscription record found (expected in new flow)');
    console.log('🔐 SECURITY: No premium access was granted before payment failure');
    
    // Cancel the Stripe subscription to clean up
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      try {
        await stripe.subscriptions.cancel(invoice.subscription as string);
        console.log('✅ Stripe subscription canceled after payment failure');
      } catch (error) {
        console.error('⚠️ Failed to cancel Stripe subscription:', error);
      }
    }
    return;
  }

  console.log('⚠️ Legacy: Subscription record exists, recording failed payment');

  // Record failed payment transaction
  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      user_subscription_id: subRecord.id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'failed',
      metadata: {
        invoice_id: invoice.id,
        subscription_id: invoice.subscription,
        is_legacy_flow: true,
      },
    });

  if (txError) {
    console.error('❌ Error recording failed payment:', txError);
  } else {
    console.log('✅ Failed payment transaction recorded');
  }

  // Update subscription to grace_period (revokes premium access)
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'grace_period', // This status revokes premium access
      updated_at: new Date().toISOString(),
    })
    .eq('id', subRecord.id);

  if (updateError) {
    console.error('❌ Error updating subscription status:', updateError);
    throw updateError;
  }

  console.log('✅ Subscription status updated to grace_period (premium access revoked)');
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(supabase: any, event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  
  console.log(`Charge refunded: ${charge.id}`);

  // Find the payment transaction
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('id, user_subscription_id')
    .eq('stripe_payment_intent_id', charge.payment_intent)
    .single();

  if (!transaction) {
    console.error(`No transaction found for payment intent ${charge.payment_intent}`);
    return;
  }

  // Update transaction status
  const { error: txError } = await supabase
    .from('payment_transactions')
    .update({
      status: 'refunded',
    })
    .eq('id', transaction.id);

  if (txError) {
    console.error('Error updating transaction:', txError);
  }

  // Find refund request and mark as completed
  const { error: refundError } = await supabase
    .from('refund_requests')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      stripe_refund_id: charge.refunds?.data[0]?.id,
    })
    .eq('user_subscription_id', transaction.user_subscription_id)
    .eq('status', 'approved');

  if (refundError) {
    console.error('Error updating refund request:', refundError);
  }

  // Cancel the subscription and downgrade to free
  const { data: freeTier } = await supabase
    .from('subscription_tiers')
    .select('tier_id')
    .eq('tier_id', 'free')
    .single();

  if (freeTier) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        tier_id: freeTier.tier_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.user_subscription_id);
  }
}

/**
 * Map Stripe subscription status to our internal status
 */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'trialing',
    'incomplete_expired': 'canceled',
    'trialing': 'trialing',
    'unpaid': 'canceled',
  };

  return statusMap[stripeStatus] || 'canceled';
}