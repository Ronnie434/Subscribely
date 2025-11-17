/**
 * Get Billing Portal Edge Function
 * 
 * Generates a Stripe billing portal URL for customers to manage their payment methods,
 * view invoices, and update billing information
 * 
 * Features:
 * - Creates Stripe billing portal session
 * - Returns secure portal URL
 * - Allows customer self-service for payment management
 * 
 * Request Body:
 * {
 *   "returnUrl": "string" (optional, defaults to app home)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "url": "https://billing.stripe.com/session/xxx"
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

    // Parse request body for optional return URL
    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || Deno.env.get('APP_URL') || 'https://yourapp.com';

    // Get user's subscription to find Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return errorResponse('No Stripe customer found. Please subscribe first.', 404);
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log(`Billing portal created for user ${user.id}: ${session.id}`);

    // Return portal URL
    return successResponse({
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating billing portal:', error);
    return errorResponse(
      error.message || 'An unexpected error occurred',
      500
    );
  }
});