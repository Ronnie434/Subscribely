/**
 * Shared Stripe configuration and utilities for Supabase Edge Functions
 * This file provides a centralized Stripe client and webhook secret for use across all payment-related Edge Functions
 */

import Stripe from 'https://esm.sh/stripe@14.0.0';

// Initialize Stripe client with secret key from environment
export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Webhook secret for verifying Stripe webhook signatures
export const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

// Standard CORS headers for all Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify Stripe webhook signature using constant-time comparison
 * @param body - Raw request body
 * @param signature - Stripe signature from request headers
 * @returns Verified Stripe event object
 * @throws Error if signature verification fails
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

/**
 * Generate idempotency key for Stripe API calls
 * @param prefix - Optional prefix for the key
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(prefix: string = ''): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Standard error response format
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @returns Response object
 */
export function errorResponse(message: string, statusCode: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    }
  );
}

/**
 * Standard success response format
 * @param data - Response data
 * @param statusCode - HTTP status code
 * @returns Response object
 */
export function successResponse(data: any, statusCode: number = 200): Response {
  return new Response(
    JSON.stringify({ success: true, data }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    }
  );
}