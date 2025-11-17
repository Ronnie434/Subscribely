# Supabase Edge Functions - Stripe Integration

This directory contains Supabase Edge Functions for handling Stripe payment operations in the Smart Subscription Tracker app.

## Overview

These Edge Functions serve as the backend API for all payment-related operations, providing a secure interface between the React Native frontend and Stripe's API.

### Functions

1. **create-subscription** - Create a new Stripe subscription
2. **stripe-webhook** - Handle Stripe webhook events
3. **cancel-subscription** - Cancel an existing subscription
4. **request-refund** - Process refund requests
5. **get-billing-portal** - Generate billing portal URL

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Stripe account (test mode)
- Environment variables configured (see [STRIPE_SETUP_GUIDE.md](../docs/STRIPE_SETUP_GUIDE.md))

## Local Development

### 1. Start Supabase Locally

```bash
supabase start
```

### 2. Serve Functions Locally

```bash
# Serve all functions
supabase functions serve

# Serve specific function
supabase functions serve create-subscription
```

Functions will be available at:
```
http://localhost:54321/functions/v1/{function-name}
```

### 3. Set Local Environment Variables

Create a `.env.local` file:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Function Documentation

### create-subscription

Creates a new Stripe subscription for the authenticated user.

**Endpoint**: `/functions/v1/create-subscription`

**Method**: POST

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "billingCycle": "monthly" | "yearly",
  "priceId": "price_xxx"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_xxx",
    "clientSecret": "seti_xxx_secret_xxx",
    "status": "incomplete"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:54321/functions/v1/create-subscription \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "billingCycle": "monthly",
    "priceId": "price_xxx"
  }'
```

**Error Codes**:
- `400` - Invalid input or validation error
- `401` - Unauthorized (missing or invalid token)
- `404` - User profile or tier not found
- `409` - User already has active subscription
- `500` - Internal server error

---

### stripe-webhook

Processes Stripe webhook events to keep database in sync.

**Endpoint**: `/functions/v1/stripe-webhook`

**Method**: POST

**Authentication**: None (verified via Stripe signature)

**Headers Required**:
- `stripe-signature` - Stripe webhook signature

**Handled Events**:
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription status changed
- `customer.subscription.deleted` - Subscription canceled/expired
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed
- `charge.refunded` - Charge refunded

**Response**:
```json
{
  "received": true
}
```

**Testing with Stripe CLI**:
```bash
# Forward webhooks to local function
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

**Security**:
- ALWAYS verifies webhook signature
- Implements idempotency to prevent duplicate processing
- Returns 200 for all events (even unhandled) to prevent retries

---

### cancel-subscription

Cancels an active subscription.

**Endpoint**: `/functions/v1/cancel-subscription`

**Method**: POST

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "immediate": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_xxx",
    "cancelAt": "2024-01-01T00:00:00Z",
    "status": "active",
    "message": "Subscription will cancel at the end of the billing period"
  }
}
```

**Example**:
```bash
# Cancel at end of period (default)
curl -X POST http://localhost:54321/functions/v1/cancel-subscription \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"immediate": false}'

# Cancel immediately
curl -X POST http://localhost:54321/functions/v1/cancel-subscription \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"immediate": true}'
```

**Behavior**:
- `immediate: false` - Subscription remains active until period end
- `immediate: true` - Subscription canceled immediately, user downgraded to free

---

### request-refund

Processes refund requests within the 7-day refund window.

**Endpoint**: `/functions/v1/request-refund`

**Method**: POST

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "subscriptionId": "uuid",
  "reason": "Customer requested refund"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "refundId": "re_xxx",
    "amount": 4.99,
    "status": "succeeded",
    "message": "Refund processed successfully. Your subscription has been canceled."
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:54321/functions/v1/request-refund \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriptionId": "550e8400-e29b-41d4-a716-446655440000",
    "reason": "Not satisfied with service"
  }'
```

**Refund Policy**:
- Full refund within 7 days of subscription
- Subscription automatically canceled upon refund
- User downgraded to free tier

**Error Codes**:
- `400` - Outside refund window or invalid request
- `404` - Subscription or payment not found
- `409` - Refund already requested
- `500` - Stripe refund failed

---

### get-billing-portal

Generates Stripe billing portal URL for self-service management.

**Endpoint**: `/functions/v1/get-billing-portal`

**Method**: POST

**Authentication**: Required (Bearer token)

**Request Body** (optional):
```json
{
  "returnUrl": "https://yourapp.com/settings"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/xxx"
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:54321/functions/v1/get-billing-portal \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"returnUrl": "exp://localhost:8081"}'
```

**Features**:
- Update payment methods
- View invoices
- Manage subscription
- View payment history

---

## Deployment

### Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy create-subscription
supabase functions deploy stripe-webhook
supabase functions deploy cancel-subscription
supabase functions deploy request-refund
supabase functions deploy get-billing-portal
```

### Deploy Single Function

```bash
supabase functions deploy create-subscription
```

### Verify Deployment

```bash
supabase functions list
```

## Environment Variables

Set these in Supabase:

```bash
# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# List secrets
supabase secrets list

# Delete secret
supabase secrets unset STRIPE_SECRET_KEY
```

## Testing

### Unit Testing

Each function can be tested independently:

```bash
# Test create-subscription
curl -X POST http://localhost:54321/functions/v1/create-subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"billingCycle": "monthly", "priceId": "price_xxx"}'
```

### Integration Testing

Test complete payment flow:

1. Create subscription
2. Confirm payment with Stripe SDK
3. Verify webhook processes event
4. Check database updates

### Webhook Testing

Use Stripe CLI:

```bash
# Forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Trigger events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger charge.refunded
```

## Debugging

### View Logs

```bash
# Real-time logs
supabase functions logs stripe-webhook --tail

# Specific function logs
supabase functions logs create-subscription

# Filter by time
supabase functions logs stripe-webhook --since 1h
```

### Common Issues

#### 1. Function Not Found (404)

**Solution**: Deploy the function
```bash
supabase functions deploy function-name
```

#### 2. Environment Variable Missing

**Solution**: Set the secret
```bash
supabase secrets set STRIPE_SECRET_KEY=your_key
```

#### 3. Authentication Failed

**Solution**: Ensure Bearer token is valid
```bash
# Get user token from Supabase auth
const { data: { session } } = await supabase.auth.getSession();
const token = session.access_token;
```

#### 4. CORS Error

**Solution**: Check CORS headers in function response
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

## Best Practices

### 1. Error Handling

```typescript
try {
  // Your code
} catch (error) {
  console.error('Error:', error);
  return errorResponse(error.message, 500);
}
```

### 2. Authentication

```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return errorResponse('Missing authorization', 401);
}

const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);
```

### 3. Idempotency

```typescript
// Check if already processed
const { data: existing } = await supabase
  .from('stripe_webhooks')
  .select('id')
  .eq('event_id', event.id)
  .single();

if (existing) {
  return successResponse({ duplicate: true });
}
```

### 4. Logging

```typescript
console.log(`Subscription created: ${subscriptionId} for user ${userId}`);
console.error('Error processing payment:', error);
```

## Security Considerations

1. **Never expose secret keys** - Use environment variables
2. **Verify webhook signatures** - Always verify in stripe-webhook
3. **Validate user input** - Check all request parameters
4. **Use service role carefully** - Only in Edge Functions
5. **Implement rate limiting** - Prevent abuse
6. **Log security events** - Monitor for suspicious activity

## Performance

- Functions timeout after 30 seconds by default
- Database connections are pooled
- Use async/await for concurrent operations
- Minimize external API calls

## Monitoring

Monitor function performance:

```bash
# View metrics
supabase functions stats create-subscription

# Check error rate
supabase functions logs stripe-webhook --filter error
```

## Support

For issues or questions:

1. Check function logs: `supabase functions logs function-name`
2. Verify environment variables: `supabase secrets list`
3. Review [Stripe Setup Guide](../docs/STRIPE_SETUP_GUIDE.md)
4. Check Stripe Dashboard for API logs

## Next Steps

After setting up Edge Functions:

1. ✅ Configure webhooks in Stripe Dashboard
2. ✅ Test all payment flows
3. ✅ Implement frontend integration (Phase 5)
4. ✅ Monitor function logs and errors
5. ✅ Prepare for production deployment