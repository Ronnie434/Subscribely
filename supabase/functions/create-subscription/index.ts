/**
 * Create Subscription Edge Function
 *
 * Handles the creation of a Stripe subscription for a user
 *
 * Flow:
 * 1. Authenticate user
 * 2. Validate billing cycle
 * 3. Get Stripe Price ID from environment variables
 * 4. Create or retrieve Stripe customer
 * 5. Create Stripe subscription with payment pending
 * 6. Store subscription in database
 * 7. Return client secret for payment confirmation
 *
 * Request Body:
 * {
 *   "billingCycle": "monthly" | "yearly"
 * }
 *
 * Environment Variables Required:
 * - STRIPE_PRICE_ID_MONTHLY: Stripe Price ID for monthly subscription
 * - STRIPE_PRICE_ID_YEARLY: Stripe Price ID for yearly subscription
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscriptionId": "sub_xxx",
 *     "clientSecret": "pi_xxx_secret_xxx",
 *     "customerId": "cus_xxx",
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

// Global error handlers to catch unhandled errors
globalThis.addEventListener('error', (event) => {
  console.error('🚨 Global error event:', event.error);
  console.error('Message:', event.message);
  console.error('Filename:', event.filename);
  console.error('Line:', event.lineno);
});

globalThis.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason);
  console.error('Promise:', event.promise);
});

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create Supabase client with user's JWT token for authentication
    // This ensures the user's JWT is validated correctly
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader, // Use the full "Bearer xxx" string
          },
        },
      }
    );

    // Get the authenticated user (JWT is already in the client headers)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ User authenticated:', user.id);
    console.log('User email:', user.email);

    // Parse request body
    const { billingCycle } = await req.json();
    console.log('📥 Request body:', JSON.stringify({ billingCycle }));

    // Validate billing cycle
    if (!billingCycle || (billingCycle !== 'monthly' && billingCycle !== 'yearly')) {
      return new Response(
        JSON.stringify({ error: 'Invalid billing cycle. Must be "monthly" or "yearly"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get the correct Stripe Price ID from environment variables
    console.log('🔍 Environment variables check:');
    console.log('STRIPE_PRICE_ID_MONTHLY:', Deno.env.get('STRIPE_PRICE_ID_MONTHLY'));
    console.log('STRIPE_PRICE_ID_YEARLY:', Deno.env.get('STRIPE_PRICE_ID_YEARLY'));
    
    const envPriceId = billingCycle === 'monthly'
      ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_ID_YEARLY');

    // TEMPORARY TEST: Hardcoded Price IDs for debugging
    const hardcodedPriceId = billingCycle === 'monthly'
      ? 'price_1SUXJY2MEnHaTSaA3VeJyYdX'
      : 'price_1SUXJY2MEnHaTSaAmQrK7lbY';

    const priceId = envPriceId || hardcodedPriceId;

    console.log('🧪 Price ID resolution:');
    console.log('  - Billing cycle:', billingCycle);
    console.log('  - From ENV:', envPriceId || 'NOT FOUND');
    console.log('  - Hardcoded fallback:', hardcodedPriceId);
    console.log('  - Final Price ID to use:', priceId);

    if (!priceId) {
      console.error(`❌ Missing Stripe Price ID for ${billingCycle} billing cycle`);
      console.error('Both environment variable and hardcoded fallback failed!');
      return new Response(
        JSON.stringify({
          error: 'Stripe configuration error',
          details: `Price ID not configured for ${billingCycle} billing`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('💰 Using Price ID:', priceId);
    console.log('Source:', envPriceId ? 'Environment Variable' : 'Hardcoded Fallback');

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

    // Use email directly from authenticated user
    // This is more reliable than querying profiles table
    const userEmail = user.email;
    
    if (!userEmail) {
      console.error('❌ User has no email in auth record');
      return errorResponse('User email not found', 400);
    }

    console.log('✅ Using email from auth:', userEmail);

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;

    console.log('🔍 Checking for existing Stripe customer...');

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
      console.log('✅ Found existing Stripe customer:', stripeCustomerId);
    } else {
      // Create new Stripe customer with detailed error handling
      try {
        console.log('🔄 Calling Stripe API to create customer...');
        console.log('Customer email:', userEmail);
        console.log('User ID:', user.id);
        
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            supabase_user_id: user.id,
          },
        }, {
          idempotencyKey: generateIdempotencyKey(`customer_${user.id}`),
        });
        
        console.log('✅ SUCCESS: Stripe customer SUCCESSFULLY created');
        console.log('Customer ID:', customer.id);
        console.log('Customer email:', customer.email);
        console.log('Customer created at:', customer.created);
        console.log('Customer metadata:', JSON.stringify(customer.metadata));
        console.log('Customer object:', JSON.stringify(customer));
        
        stripeCustomerId = customer.id;
      } catch (stripeError: any) {
        console.error('❌ STRIPE CUSTOMER CREATION FAILED:');
        console.error('Stripe error type:', stripeError.type);
        console.error('Stripe error code:', stripeError.code);
        console.error('Stripe error message:', stripeError.message);
        console.error('Stripe error status:', stripeError.statusCode);
        console.error('Stripe error decline_code:', stripeError.decline_code);
        console.error('Stripe error details:', JSON.stringify(stripeError, null, 2));
        
        // Return detailed error to help debug
        return new Response(
          JSON.stringify({
            error: 'Stripe customer creation failed',
            message: stripeError.message,
            type: stripeError.type,
            code: stripeError.code,
            statusCode: stripeError.statusCode,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    console.log('✅ Customer ID confirmed:', stripeCustomerId);
    console.log('🔍 Looking up premium tier in database...');
    console.log('Querying subscription_tiers table...');

    // Get premium tier with correct column names
    const { data: premiumTier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('tier_id, name, description, monthly_price, annual_price, subscription_limit, features, is_active')
      .eq('name', 'Premium')  // Note: Capital P to match inserted data
      .eq('is_active', true)
      .single();

    if (tierError) {
      console.error('❌ Premium tier lookup failed:');
      console.error('Database error:', tierError);
      return errorResponse(`Premium tier not found in database: ${tierError.message}`, 500);
    }

    if (!premiumTier) {
      console.error('❌ Premium tier not found in database');
      console.error('This usually means the subscription_tiers table is not set up correctly');
      return errorResponse('Premium tier configuration missing', 500);
    }

    console.log('✅ Premium tier found:', premiumTier.tier_id);
    console.log('Tier name:', premiumTier.name);
    console.log('Monthly price:', premiumTier.monthly_price);
    console.log('Annual price:', premiumTier.annual_price);
    console.log('Subscription limit:', premiumTier.subscription_limit);
    console.log('📝 Proceeding to create subscription...');

    // Create Stripe subscription with detailed error handling
    let subscription: any;
    try {
      console.log('🔄 Calling Stripe API to create subscription...');
      console.log('Customer ID:', stripeCustomerId);
      console.log('Price ID:', priceId);
      console.log('User ID:', user.id);
      console.log('Billing cycle:', billingCycle);
      
      subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete', // Don't charge immediately - wait for payment method
        payment_settings: {
          payment_method_types: ['card'], // ✅ FIX: Specify accepted payment methods
          save_default_payment_method: 'on_subscription' // Save payment method when user pays
        },
        expand: ['latest_invoice.payment_intent'], // Get payment intent in response
        metadata: {
          supabase_user_id: user.id,
          billing_cycle: billingCycle,
          tier: premiumTier.name, // ✅ FIX: Add tier to metadata for webhook identification
        },
      }, {
        idempotencyKey: generateIdempotencyKey(`subscription_${user.id}`),
      });

      console.log('✅ SUCCESS: Stripe subscription SUCCESSFULLY created');
      console.log('Subscription ID:', subscription.id);
      console.log('Subscription status:', subscription.status);
      console.log('Subscription customer:', subscription.customer);
      console.log('Subscription items:', JSON.stringify(subscription.items));
      console.log('Latest invoice type:', typeof subscription.latest_invoice);
      console.log('Subscription metadata:', JSON.stringify(subscription.metadata));
      console.log('🔍 DIAGNOSTIC: Payment settings sent:', {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      });
      console.log('Subscription object:', JSON.stringify(subscription));
      
    } catch (stripeError: any) {
      console.error('❌ STRIPE SUBSCRIPTION CREATION FAILED:');
      console.error('Stripe error type:', stripeError.type);
      console.error('Stripe error code:', stripeError.code);
      console.error('Stripe error message:', stripeError.message);
      console.error('Stripe error status:', stripeError.statusCode);
      console.error('Stripe error decline_code:', stripeError.decline_code);
      console.error('Stripe error param:', stripeError.param);
      console.error('Stripe error details:', JSON.stringify(stripeError, null, 2));
      
      // Return detailed error to help debug
      return new Response(
        JSON.stringify({
          error: 'Stripe subscription creation failed',
          message: stripeError.message,
          type: stripeError.type,
          code: stripeError.code,
          statusCode: stripeError.statusCode,
          param: stripeError.param,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Extract payment intent client secret with detailed logging
    console.log('📦 Extracting payment intent from subscription...');
    
    const invoice = subscription.latest_invoice as any;
    if (!invoice || typeof invoice === 'string') {
      console.error('❌ Failed to get invoice from subscription');
      console.error('Latest invoice value:', invoice);
      return errorResponse('Failed to get invoice from subscription', 500);
    }
    
    console.log('✅ Invoice found:', invoice.id);
    console.log('Invoice payment intent type:', typeof invoice.payment_intent);

    const paymentIntent = invoice.payment_intent as any;
    if (!paymentIntent || typeof paymentIntent === 'string') {
      console.error('❌ Failed to get payment intent from invoice');
      console.error('Payment intent value:', paymentIntent);
      return errorResponse('Failed to get payment intent from invoice', 500);
    }

    console.log('✅ Payment intent found:', paymentIntent.id);
    console.log('Payment intent status:', paymentIntent.status);

    // 🔍 DIAGNOSTIC: Track payment intent configuration
    console.log('🔍 DIAGNOSTIC: Payment Intent Details', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer,
      payment_method: paymentIntent.payment_method,
      automatic_payment_methods: paymentIntent.automatic_payment_methods,
      confirmation_method: paymentIntent.confirmation_method,
      capture_method: paymentIntent.capture_method,
      metadata: paymentIntent.metadata,
      client_secret_exists: !!paymentIntent.client_secret,
    });

    const clientSecret = paymentIntent.client_secret;
    if (!clientSecret) {
      console.error('❌ Failed to get client secret from payment intent');
      return errorResponse('Failed to get client secret from payment intent', 500);
    }

    console.log('✅ Got client secret for mobile payment');
    console.log('Client secret format:', clientSecret.substring(0, 10) + '...');

    // Map frontend billing cycle to database values
    // Frontend uses 'yearly', but database constraint expects 'annual'
    const dbBillingCycle = billingCycle === 'yearly' ? 'annual' : 'monthly';

    console.log('💾 Saving subscription to database...');
    console.log('Billing cycle mapping:', billingCycle, '->', dbBillingCycle);

    // Store subscription in database using UPSERT
    // This allows users to re-subscribe after canceling
    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        tier_id: premiumTier.tier_id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: 'trialing', // Will be updated by webhook
        billing_cycle: dbBillingCycle,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        canceled_at: null, // Clear any previous cancellation
        cancel_at: null,   // Clear any scheduled cancellation
      }, {
        onConflict: 'user_id', // Update existing record for same user
        ignoreDuplicates: false, // Always update
      });

    if (insertError) {
      console.error('❌ Database upsert error:', insertError);
      console.error('Upsert error details:', JSON.stringify(insertError, null, 2));
      // Cancel the Stripe subscription if database operation fails
      await stripe.subscriptions.cancel(subscription.id);
      return errorResponse('Failed to create subscription record', 500);
    }

    console.log('✅ Database updated successfully');
    console.log(`📝 Transaction completed: Subscription ${subscription.id} created for user ${user.id}`);

    // Prepare response data
    const responseData = {
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
      customerId: stripeCustomerId,
      status: subscription.status,
    };

    console.log('📤 Returning response to client:');
    console.log('Response data:', JSON.stringify(responseData, null, 2));
    
    return successResponse(responseData);

    } catch (innerError) {
      // This catches expected errors in main logic
      console.error('❌ Caught error in main logic:');
      console.error('Error:', innerError);
      console.error('Error type:', typeof innerError);
      console.error('Error name:', innerError?.name);
      console.error('Error message:', innerError?.message);
      console.error('Error code:', innerError?.code);
      console.error('Error status:', innerError?.status);
      console.error('Full error:', JSON.stringify(innerError, Object.getOwnPropertyNames(innerError), 2));
      
      if (innerError?.stack) {
        console.error('Stack trace:', innerError.stack);
      }
      
      // Return error to client with details
      return new Response(
        JSON.stringify({
          error: innerError?.message || 'Unknown error',
          details: innerError?.toString(),
          type: innerError?.name,
          code: innerError?.code,
          stack: innerError?.stack,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
  } catch (outerError) {
    // This catches EVERYTHING else, including uncaught errors
    console.error('🚨 UNCAUGHT ERROR - TOP LEVEL:');
    console.error('Outer error:', outerError);
    console.error('Type:', typeof outerError);
    console.error('String:', String(outerError));
    console.error('JSON:', JSON.stringify(outerError, Object.getOwnPropertyNames(outerError)));
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: String(outerError),
        type: 'UncaughtError',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});