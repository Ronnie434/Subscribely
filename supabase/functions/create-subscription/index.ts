/**
 * Create Subscription Edge Function
 * 
 * Handles the creation of a Stripe subscription for a user
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Validate input (billingCycle, priceId)
 * 3. Create or retrieve Stripe customer
 * 4. Create Stripe subscription with payment pending
 * 5. Store subscription in database
 * 6. Return client secret for payment confirmation
 * 
 * Request Body:
 * {
 *   "billingCycle": "monthly" | "yearly",
 *   "priceId": "price_xxx"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscriptionId": "sub_xxx",
 *     "clientSecret": "seti_xxx_secret_xxx",
 *     "status": "incomplete"
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  stripe, 
  corsHeaders, 
  generateIdempotencyKey,
  errorResponse,
  successResponse 
} from '../_shared/stripe.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
    const { billingCycle, priceId } = await req.json();

    // Validate input
    if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
      return errorResponse('Invalid billing cycle. Must be "monthly" or "yearly"');
    }

    if (!priceId || typeof priceId !== 'string') {
      return errorResponse('Invalid priceId');
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .single();

    if (existingSubscription) {
      return errorResponse('User already has an active subscription', 409);
    }

    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return errorResponse('User profile not found', 404);
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;

    // Check if user already has a Stripe customer ID
    const { data: existingCustomerRecord } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single();

    if (existingCustomerRecord?.stripe_customer_id) {
      stripeCustomerId = existingCustomerRecord.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: user.id,
        },
      }, {
        idempotencyKey: generateIdempotencyKey(`customer_${user.id}`),
      });
      stripeCustomerId = customer.id;
    }

    // Get premium tier ID
    const { data: premiumTier } = await supabase
      .from('subscription_tiers')
      .select('id')
      .eq('name', 'premium')
      .single();

    if (!premiumTier) {
      return errorResponse('Premium tier not found', 500);
    }

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { 
        save_default_payment_method: 'on_subscription' 
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        supabase_user_id: user.id,
        billing_cycle: billingCycle,
      },
    }, {
      idempotencyKey: generateIdempotencyKey(`subscription_${user.id}`),
    });

    // Extract payment intent client secret
    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent;
    const clientSecret = paymentIntent?.client_secret;

    if (!clientSecret) {
      return errorResponse('Failed to create payment intent', 500);
    }

    // Store subscription in database
    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        tier_id: premiumTier.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: 'trialing', // Will be updated by webhook
        billing_cycle: billingCycle,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Cancel the Stripe subscription if database insert fails
      await stripe.subscriptions.cancel(subscription.id);
      return errorResponse('Failed to create subscription record', 500);
    }

    // Log the transaction
    console.log(`Subscription created for user ${user.id}: ${subscription.id}`);

    // Return client secret for payment confirmation
    return successResponse({
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
      status: subscription.status,
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});