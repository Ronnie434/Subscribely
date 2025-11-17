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
import { verifyWebhookSignature, errorResponse } from '../_shared/stripe.ts';

serve(async (req) => {
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return errorResponse('Missing signature', 400);
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return errorResponse('Invalid signature', 400);
    }

    // Check idempotency - have we processed this event before?
    const { data: existingEvent } = await supabase
      .from('stripe_webhooks')
      .select('id')
      .eq('event_id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
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
        await handlePaymentSucceeded(supabase, event);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(supabase, event);
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
        processed: true,
      });

    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Stripe from retrying
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
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
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
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
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
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
      cancel_at: new Date().toISOString(),
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
  
  if (!invoice.subscription) {
    console.log('Invoice not associated with subscription');
    return;
  }

  console.log(`Payment succeeded for invoice: ${invoice.id}`);

  // Get subscription record
  const { data: subRecord } = await supabase
    .from('user_subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (!subRecord) {
    console.error(`No subscription record found for ${invoice.subscription}`);
    return;
  }

  // Record payment transaction
  const { error: txError } = await supabase
    .from('payment_transactions')
    .insert({
      user_subscription_id: subRecord.id,
      stripe_payment_intent_id: invoice.payment_intent as string,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency,
      status: 'succeeded',
    });

  if (txError) {
    console.error('Error recording payment transaction:', txError);
  }

  // Update subscription status to active
  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subRecord.id);

  if (updateError) {
    console.error('Error updating subscription status:', updateError);
    throw updateError;
  }
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