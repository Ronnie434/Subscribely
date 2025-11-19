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
      case 'invoice_payment.paid':  // Handle deprecated event name (used in older API versions)
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
 */
async function handleSubscriptionCreated(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = subscription.metadata.supabase_user_id;

  if (!userId) {
    console.error('No supabase_user_id in subscription metadata');
    return;
  }

  console.log(`Subscription created: ${subscription.id} for user ${userId}`);

  // Update or insert subscription record
  const { error } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: mapStripeStatus(subscription.status),
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
    }, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
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
      .select('id')
      .eq('name', 'free')
      .single();
    
    if (freeTier) {
      tierId = freeTier.id;
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
    .select('id')
    .eq('name', 'free')
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
      tier_id: freeTier.id,
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
  
  console.log('Processing invoice.payment_succeeded event');
  console.log('Invoice paid:', invoice.id);
  console.log('Subscription:', invoice.subscription);
  console.log('Customer:', invoice.customer);
  console.log('Amount:', invoice.amount_paid / 100);

  // STEP 1: Find user_subscription_id
  // Try to find subscription record either by:
  // 1. stripe_subscription_id (if invoice has subscription)
  // 2. stripe_customer_id (fallback for non-subscription invoices)
  
  let subRecord: any = null;
  
  if (invoice.subscription) {
    // Regular subscription payment
    console.log('🔍 Looking up subscription by stripe_subscription_id:', invoice.subscription);
    const { data } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, tier_id, status')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();
    subRecord = data;
  } else {
    // Non-subscription invoice - look up by customer ID
    console.log('⚠️ Invoice not associated with subscription - looking up by customer_id');
    const { data } = await supabase
      .from('user_subscriptions')
      .select('id, user_id, tier_id, status')
      .eq('stripe_customer_id', invoice.customer)
      .single();
    subRecord = data;
  }

  if (!subRecord) {
    console.error(`❌ No subscription record found for invoice ${invoice.id}`);
    console.error(`   - Subscription ID: ${invoice.subscription || 'null'}`);
    console.error(`   - Customer ID: ${invoice.customer}`);
    return;
  }

  console.log('✅ Found user_subscription record:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC] Current subscription state:');
  console.log('🔍 [DIAGNOSTIC]   - Subscription ID:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC]   - User ID:', subRecord.user_id);
  console.log('🔍 [DIAGNOSTIC]   - Current tier_id:', subRecord.tier_id);
  console.log('🔍 [DIAGNOSTIC]   - Current status:', subRecord.status);

  // STEP 2: Record payment transaction FIRST (always, regardless of subscription)
  const paymentIntentId = (invoice.payment_intent as string) || `invoice_${invoice.id}`;
  
  if (!invoice.payment_intent) {
    console.log('⚠️ payment_intent is NULL - using invoice.id as fallback:', paymentIntentId);
  }

  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      user_subscription_id: subRecord.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents
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
    });

  if (txError) {
    console.error('❌ Failed to insert payment transaction:', txError);
    console.error('Transaction data:', {
      user_subscription_id: subRecord.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid / 100,
    });
  } else {
    console.log('✅ Payment transaction recorded:', paymentIntentId);
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
  const billingCycle = invoice.lines?.data?.[0]?.plan?.interval || 'one-time';
  const { error: trackError } = await supabase
    .from('usage_tracking_events')
    .insert({
      user_id: subRecord.user_id,
      event_type: 'payment_completed',
      event_context: 'webhook_payment_success',
      event_data: {
        amount: invoice.amount_paid / 100,
        subscription_id: invoice.subscription || null,
        billing_cycle: billingCycle,
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
 */
async function handlePaymentIntentSucceeded(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.succeeded event');
  console.log('Payment Intent ID:', paymentIntent.id);
  console.log('Payment Intent status:', paymentIntent.status);

  // Extract metadata
  const userId = paymentIntent.metadata.user_id;
  const tier = paymentIntent.metadata.tier || 'Premium';

  if (!userId) {
    console.error('No user_id in payment intent metadata');
    return;
  }

  console.log('User ID from metadata:', userId);
  console.log('Tier from metadata:', tier);

  // Get the tier_id for the specified tier
  const { data: tierData, error: tierError } = await supabase
    .from('subscription_tiers')
    .select('tier_id')
    .eq('name', tier)
    .single();

  if (tierError || !tierData) {
    console.error('Failed to get tier:', tierError);
    throw new Error(`${tier} tier not found`);
  }

  console.log(`${tier} tier found:`, tierData.tier_id);

  // Find the user's subscription record
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id, status, tier_id')
    .eq('user_id', userId)
    .single();

  if (!subRecord) {
    console.error(`No subscription record found for user ${userId}`);
    return;
  }

  console.log('🔍 [DIAGNOSTIC] Current subscription state:');
  console.log('🔍 [DIAGNOSTIC]   - Subscription ID:', subRecord.id);
  console.log('🔍 [DIAGNOSTIC]   - Current status:', subRecord.status);
  console.log('🔍 [DIAGNOSTIC]   - Current tier_id:', subRecord.tier_id);

  // Update subscription to active with explicit tier upgrade
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      tier_id: tierData.tier_id, // Explicit tier upgrade
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subRecord.id);

  if (updateError) {
    console.error('Failed to update subscription:', updateError);
    throw updateError;
  }

  console.log(`✅ Subscription upgraded to ${tier} tier via payment_intent.succeeded`);

  // Verify the update
  const { data: updatedRecord } = await supabase
    .from('user_subscriptions')
    .select('tier_id, status')
    .eq('id', subRecord.id)
    .single();

  console.log('🔍 [DIAGNOSTIC] Subscription state AFTER payment_intent update:');
  console.log('🔍 [DIAGNOSTIC]   - New status:', updatedRecord?.status);
  console.log('🔍 [DIAGNOSTIC]   - New tier_id:', updatedRecord?.tier_id);
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(supabase: any, paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.payment_failed event');
  console.log('Payment Intent ID:', paymentIntent.id);
  console.log('Failure message:', paymentIntent.last_payment_error?.message);

  const userId = paymentIntent.metadata.user_id;

  if (!userId) {
    console.error('No user_id in payment intent metadata');
    return;
  }

  // Find the user's subscription record
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!subRecord) {
    console.error(`No subscription record found for user ${userId}`);
    return;
  }

  // Update subscription status to payment_failed
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'payment_failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subRecord.id);

  if (updateError) {
    console.error('Failed to update subscription status:', updateError);
    throw updateError;
  }

  console.log('✅ Subscription status updated to payment_failed');
}

/**
 * Handle invoice.payment_failed event
 */
async function handlePaymentFailed(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  
  if (!invoice.subscription) {
    console.log('Invoice not associated with subscription');
    return;
  }

  console.log(`Payment failed for invoice: ${invoice.id}`);

  // Get subscription record
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (!subRecord) {
    console.error(`No subscription record found for ${invoice.subscription}`);
    return;
  }

  // Record failed payment transaction
  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      user_subscription_id: subRecord.id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'failed',
    });

  if (txError) {
    console.error('Error recording failed payment:', txError);
  }

  // Update subscription to past_due or grace_period
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'grace_period', // Allow grace period before downgrading
      updated_at: new Date().toISOString(),
    })
    .eq('id', subRecord.id);

  if (updateError) {
    console.error('Error updating subscription status:', updateError);
    throw updateError;
  }
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
    .select('id')
    .eq('name', 'free')
    .single();

  if (freeTier) {
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        tier_id: freeTier.id,
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