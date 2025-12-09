/**
 * Mark Account Deleted Edge Function
 * 
 * Marks a user account for deletion with a 30-day grace period
 * 
 * Features:
 * - Soft delete the user account (sets deleted_at timestamp)
 * - Creates audit log entry for tracking
 * - Cancels active premium subscriptions automatically
 * - 30-day grace period before permanent deletion
 * 
 * Request Body:
 * {
 *   "reason"?: string  // Optional deletion reason
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Account marked for deletion. You have 30 days to recover your account.",
 *   "deletedAt": "2024-01-01T00:00:00Z",
 *   "gracePeriodEnds": "2024-01-31T00:00:00Z"
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  corsHeaders,
  errorResponse,
} from '../_shared/stripe.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    // ========================================================================
    // STEP 1: AUTHENTICATE USER
    // ========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return errorResponse('Missing authorization header', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return errorResponse('Unauthorized', 401);
    }

    console.log(`🔐 User authenticated: ${user.id}`);

    // ========================================================================
    // STEP 2: PARSE REQUEST BODY
    // ========================================================================
    const { reason } = await req.json().catch(() => ({}));
    
    // Extract IP address from request headers
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';

    console.log(`📝 Deletion request - Reason: ${reason || 'not provided'}, IP: ${ipAddress}`);

    // ========================================================================
    // STEP 3: MARK ACCOUNT AS DELETED IN PROFILES TABLE
    // ========================================================================
    const deletedAt = new Date().toISOString();
    
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ deleted_at: deletedAt })
      .eq('id', user.id);

    if (profileUpdateError) {
      console.error('Failed to update profile:', profileUpdateError);
      return errorResponse('Failed to mark account for deletion', 500);
    }

    console.log(`✅ Profile marked for deletion: ${user.id}`);

    // ========================================================================
    // STEP 4: INSERT AUDIT LOG ENTRY
    // ========================================================================
    const { error: logError } = await supabase
      .from('account_deletion_logs')
      .insert({
        user_id: user.id,
        deleted_at: deletedAt,
        reason: reason || null,
        ip_address: ipAddress,
      });

    if (logError) {
      console.error('Failed to create deletion log:', logError);
      // Continue execution - logging failure shouldn't block deletion
    } else {
      console.log(`✅ Deletion log created for user: ${user.id}`);
    }

    // ========================================================================
    // STEP 5: CHECK FOR ACTIVE PREMIUM SUBSCRIPTION
    // ========================================================================
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('id, status, stripe_subscription_id, tier_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .single();

    // Only cancel if there's an active subscription with a valid Stripe ID
    if (!subError && subscription && subscription.stripe_subscription_id) {
      console.log(`💳 Active subscription found: ${subscription.stripe_subscription_id}`);
      
      try {
        // Call the cancel-subscription Edge Function
        const cancelUrl = `${Deno.env.get('PROJECT_URL')}/functions/v1/cancel-subscription`;
        const cancelResponse = await fetch(cancelUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            immediate: false, // Cancel at period end to honor paid time
          }),
        });

        if (cancelResponse.ok) {
          const cancelData = await cancelResponse.json();
          console.log(`✅ Subscription cancelled successfully:`, cancelData);
        } else {
          const cancelError = await cancelResponse.text();
          console.error(`⚠️ Failed to cancel subscription (non-blocking):`, cancelError);
          // Don't fail the deletion if subscription cancellation fails
        }
      } catch (cancelError) {
        console.error(`⚠️ Error calling cancel-subscription (non-blocking):`, cancelError);
        // Don't fail the deletion if subscription cancellation fails
      }
    } else {
      console.log(`ℹ️ No active premium subscription to cancel`);
    }

    // ========================================================================
    // STEP 6: CALCULATE GRACE PERIOD END DATE
    // ========================================================================
    const gracePeriodEnds = new Date(deletedAt);
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);
    const gracePeriodEndsISO = gracePeriodEnds.toISOString();

    console.log(`⏳ Grace period ends: ${gracePeriodEndsISO}`);

    // ========================================================================
    // STEP 7: RETURN SUCCESS RESPONSE
    // ========================================================================
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account marked for deletion. You have 30 days to recover your account.',
        deletedAt,
        gracePeriodEnds: gracePeriodEndsISO,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error marking account for deletion:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});