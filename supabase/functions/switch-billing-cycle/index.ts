/**
 * Switch Billing Cycle Edge Function
 * 
 * Handles subscription billing cycle changes (monthly <-> yearly)
 * 
 * Features:
 * - Updates Stripe subscription to new price
 * - Applies proration (credits unused time, charges difference)
 * - Webhook handles database sync
 * 
 * Request Body:
 * {
 *   "newBillingCycle": "monthly" | "yearly"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscriptionId": "sub_xxx",
 *     "newBillingCycle": "monthly" | "yearly",
 *     "prorationAmount": 36.50,
 *     "nextBillingDate": "2024-02-01T00:00:00Z"
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  stripe, 
  corsHeaders,
  errorResponse,
  successResponse 
} from '../_shared/stripe.ts';

// Stripe Price IDs (should match your Stripe Dashboard)
const PRICE_IDS = {
  monthly: 'price_1SUXJY2MEnHaTSaA3VeJyYdX',
  yearly: 'price_1SUXJY2MEnHaTSaAmQrK7lbY',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse request body
    const { newBillingCycle } = await req.json();

    if (!newBillingCycle || !['monthly', 'yearly'].includes(newBillingCycle)) {
      return errorResponse('Invalid billing cycle. Must be "monthly" or "yearly"', 400);
    }

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .single();

    if (subError || !subscription) {
      return errorResponse('No active subscription found', 404);
    }

    if (!subscription.stripe_subscription_id) {
      return errorResponse('Invalid subscription: missing Stripe ID', 400);
    }

    // Check if already on requested billing cycle
    const currentCycle = subscription.billing_cycle === 'annual' ? 'yearly' : 'monthly';
    if (currentCycle === newBillingCycle) {
      return errorResponse(`Already on ${newBillingCycle} billing cycle`, 400);
    }

    // Get the new price ID
    const newPriceId = PRICE_IDS[newBillingCycle as keyof typeof PRICE_IDS];
    if (!newPriceId) {
      return errorResponse('Invalid price configuration', 500);
    }

    console.log(`Switching billing cycle for user ${user.id}`);
    console.log(`From: ${currentCycle} to: ${newBillingCycle}`);
    console.log(`Subscription ID: ${subscription.stripe_subscription_id}`);
    console.log(`New Price ID: ${newPriceId}`);

    // Retrieve the Stripe subscription to get the subscription item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    if (!stripeSubscription.items.data[0]) {
      return errorResponse('Invalid subscription: no items found', 500);
    }

    const subscriptionItemId = stripeSubscription.items.data[0].id;

    console.log(`Subscription Item ID: ${subscriptionItemId}`);

    // Update the Stripe subscription with new price and proration
    // NOTE: When changing intervals (monthly <-> yearly), Stripe resets the billing
    // cycle anchor to the current date. This is required behavior - we can't maintain
    // the same renewal date when switching between different intervals.
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [{
          id: subscriptionItemId,
          price: newPriceId,
        }],
        // Always create an invoice immediately for the proration
        proration_behavior: 'always_invoice',
        // Update metadata to reflect new billing cycle
        metadata: {
          ...stripeSubscription.metadata,
          billing_cycle: newBillingCycle,
        },
      }
    );

    console.log(`Stripe subscription updated successfully`);
    console.log(`Status: ${updatedSubscription.status}`);
    console.log(`Current period end: ${new Date(updatedSubscription.current_period_end * 1000).toISOString()}`);

    // Get the upcoming invoice to show proration amount
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: updatedSubscription.customer as string,
      subscription: subscription.stripe_subscription_id,
    });

    const prorationAmount = upcomingInvoice.total / 100; // Convert cents to dollars

    console.log(`Proration amount: $${prorationAmount}`);

    // Note: Database update will be handled by the webhook (subscription.updated event)
    // We don't update the database here to avoid race conditions

    // Return success response
    return successResponse({
      subscriptionId: subscription.stripe_subscription_id,
      newBillingCycle,
      prorationAmount,
      nextBillingDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      message: `Billing cycle switched to ${newBillingCycle}. ${
        prorationAmount > 0 
          ? `You'll be charged $${prorationAmount.toFixed(2)} for the prorated difference.`
          : `You'll receive a credit of $${Math.abs(prorationAmount).toFixed(2)}.`
      }`,
    });

  } catch (error) {
    console.error('Error switching billing cycle:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return errorResponse('Payment failed: ' + error.message, 402);
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return errorResponse('Invalid request: ' + error.message, 400);
    }

    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});