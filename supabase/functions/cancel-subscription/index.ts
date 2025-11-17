/**
 * Cancel Subscription Edge Function
 * 
 * Handles subscription cancellation requests
 * 
 * Features:
 * - Cancel subscription at end of billing period (default)
 * - Immediate cancellation option
 * - Updates database records
 * - Returns updated subscription status
 * 
 * Request Body:
 * {
 *   "immediate": boolean (optional, default: false)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscriptionId": "sub_xxx",
 *     "cancelAt": "2024-01-01T00:00:00Z",
 *     "status": "active" | "canceled"
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
    const { immediate = false } = await req.json().catch(() => ({}));

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .single();

    if (subError || !subscription) {
      return errorResponse('No active subscription found', 404);
    }

    if (!subscription.stripe_subscription_id) {
      return errorResponse('Invalid subscription: missing Stripe ID', 400);
    }

    // Cancel the Stripe subscription
    let canceledSubscription;
    if (immediate) {
      // Cancel immediately
      canceledSubscription = await stripe.subscriptions.cancel(
        subscription.stripe_subscription_id
      );
    } else {
      // Cancel at period end (default behavior)
      canceledSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: true,
        }
      );
    }

    // Get free tier ID for immediate cancellation
    let tierId = subscription.tier_id;
    if (immediate) {
      const { data: freeTier } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', 'free')
        .single();
      
      if (freeTier) {
        tierId = freeTier.id;
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: immediate ? 'canceled' : 'active',
        tier_id: tierId,
        cancel_at: immediate 
          ? new Date().toISOString()
          : new Date(canceledSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return errorResponse('Failed to update subscription record', 500);
    }

    console.log(`Subscription canceled for user ${user.id}: ${subscription.stripe_subscription_id} (immediate: ${immediate})`);

    // Return success response
    return successResponse({
      subscriptionId: subscription.stripe_subscription_id,
      cancelAt: immediate 
        ? new Date().toISOString()
        : new Date(canceledSubscription.current_period_end * 1000).toISOString(),
      status: immediate ? 'canceled' : 'active',
      message: immediate 
        ? 'Subscription canceled immediately'
        : 'Subscription will cancel at the end of the billing period',
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});