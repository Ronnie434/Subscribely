import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Read all environment variables
    const envVars = {
      PROJECT_URL: Deno.env.get('PROJECT_URL'),
      SERVICE_ROLE_KEY: Deno.env.get('SERVICE_ROLE_KEY') ? 'SET (hidden)' : 'NOT SET',
      STRIPE_SECRET_KEY: Deno.env.get('STRIPE_SECRET_KEY') ? 'SET (hidden)' : 'NOT SET',
      STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET') ? 'SET (hidden)' : 'NOT SET',
      STRIPE_PRICE_ID_MONTHLY: Deno.env.get('STRIPE_PRICE_ID_MONTHLY'),
      STRIPE_PRICE_ID_YEARLY: Deno.env.get('STRIPE_PRICE_ID_YEARLY'),
    };

    // Parse request body if present
    let billingCycle = 'yearly';
    try {
      const body = await req.json();
      billingCycle = body.billingCycle || 'yearly';
    } catch (e) {
      // No body, use default
    }

    // Show which Price ID would be used
    const envPriceId = billingCycle === 'monthly' 
      ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_ID_YEARLY');

    const hardcodedPriceId = billingCycle === 'monthly'
      ? 'price_1SUXJY2MEnHaTSaA3VeJyYdX'
      : 'price_1SUXJY2MEnHaTSaAmQrK7lbY';

    const finalPriceId = envPriceId || hardcodedPriceId;

    const result = {
      success: true,
      message: 'Debug configuration - no Stripe calls made',
      environment_variables: envVars,
      price_id_resolution: {
        billing_cycle: billingCycle,
        from_env_var: envPriceId || 'NOT FOUND',
        hardcoded_fallback: hardcodedPriceId,
        final_price_id_to_use: finalPriceId,
        source: envPriceId ? 'Environment Variable' : 'Hardcoded Fallback',
      },
      price_id_analysis: {
        value: finalPriceId,
        length: finalPriceId.length,
        type: typeof finalPriceId,
        starts_with: finalPriceId.substring(0, 10),
        ends_with: finalPriceId.substring(finalPriceId.length - 10),
        char_codes: Array.from(finalPriceId).map(c => c.charCodeAt(0)),
        trimmed: finalPriceId.trim(),
        equals_expected: finalPriceId === 'price_1SUXJY2MEnHaTSaAmQrK7lbY',
      }
    };

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});