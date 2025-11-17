/**
 * Request Refund Edge Function
 * 
 * Handles refund requests for subscriptions within the 7-day refund window
 * 
 * Features:
 * - Validates refund eligibility (7-day window)
 * - Creates Stripe refund
 * - Updates database records
 * - Cancels subscription
 * - Downgrades user to free tier
 * 
 * Request Body:
 * {
 *   "subscriptionId": "uuid",
 *   "reason": "string" (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "refundId": "re_xxx",
 *     "amount": 4.99,
 *     "status": "succeeded"
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

const REFUND_WINDOW_DAYS = 7;

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
    const { subscriptionId, reason } = await req.json();

    if (!subscriptionId) {
      return errorResponse('subscriptionId is required');
    }

    // Get subscription record
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return errorResponse('Subscription not found', 404);
    }

    // Check if subscription is eligible for refund (within 7 days)
    const subscriptionDate = new Date(subscription.created_at);
    const now = new Date();
    const daysSinceSubscription = (now.getTime() - subscriptionDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceSubscription > REFUND_WINDOW_DAYS) {
      return errorResponse(
        `Refund window expired. Refunds are only available within ${REFUND_WINDOW_DAYS} days of subscription.`,
        400
      );
    }

    // Check if refund already requested/processed
    const { data: existingRefund } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('user_subscription_id', subscriptionId)
      .in('status', ['pending', 'approved', 'completed'])
      .single();

    if (existingRefund) {
      return errorResponse('Refund already requested for this subscription', 409);
    }

    // Get the most recent successful payment
    const { data: payment, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_subscription_id', subscriptionId)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !payment) {
      return errorResponse('No successful payment found for this subscription', 404);
    }

    // Create refund request record
    const { data: refundRequest, error: refundRequestError } = await supabase
      .from('refund_requests')
      .insert({
        user_subscription_id: subscriptionId,
        amount: payment.amount,
        reason: reason || 'Customer requested refund',
        status: 'approved', // Auto-approve within refund window
      })
      .select()
      .single();

    if (refundRequestError) {
      console.error('Error creating refund request:', refundRequestError);
      return errorResponse('Failed to create refund request', 500);
    }

    // Create Stripe refund
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          supabase_user_id: user.id,
          subscription_id: subscriptionId,
          refund_request_id: refundRequest.id,
        },
      });
    } catch (stripeError) {
      console.error('Stripe refund error:', stripeError);
      
      // Update refund request as rejected
      await supabase
        .from('refund_requests')
        .update({ 
          status: 'rejected',
          processed_at: new Date().toISOString(),
        })
        .eq('id', refundRequest.id);
      
      return errorResponse(`Stripe refund failed: ${stripeError.message}`, 500);
    }

    // Update refund request with Stripe refund ID
    await supabase
      .from('refund_requests')
      .update({
        stripe_refund_id: stripeRefund.id,
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundRequest.id);

    // Update payment transaction status
    await supabase
      .from('payment_transactions')
      .update({ status: 'refunded' })
      .eq('id', payment.id);

    // Cancel the Stripe subscription if it exists
    if (subscription.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (cancelError) {
        console.error('Error canceling Stripe subscription:', cancelError);
        // Continue even if cancellation fails - webhook will handle it
      }
    }

    // Get free tier ID
    const { data: freeTier } = await supabase
      .from('subscription_tiers')
      .select('id')
      .eq('name', 'free')
      .single();

    if (!freeTier) {
      console.error('Free tier not found');
      return errorResponse('Configuration error: free tier not found', 500);
    }

    // Update subscription to canceled and downgrade to free tier
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        tier_id: freeTier.id,
        cancel_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return errorResponse('Failed to update subscription', 500);
    }

    console.log(`Refund processed for user ${user.id}: ${stripeRefund.id} ($${payment.amount})`);

    // Return success response
    return successResponse({
      refundId: stripeRefund.id,
      amount: payment.amount,
      status: stripeRefund.status,
      message: 'Refund processed successfully. Your subscription has been canceled.',
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});