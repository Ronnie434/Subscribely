# Stripe Setup Guide

This guide walks you through setting up Stripe for the Smart Subscription Tracker paywall system, including creating products, configuring webhooks, and deploying Edge Functions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create Stripe Account](#create-stripe-account)
3. [Set Up Products and Prices](#set-up-products-and-prices)
4. [Configure Environment Variables](#configure-environment-variables)
5. [Deploy Supabase Edge Functions](#deploy-supabase-edge-functions)
6. [Configure Webhooks](#configure-webhooks)
7. [Testing](#testing)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:

- [ ] Supabase project set up with paywall database tables (Phase 2 completed)
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Stripe CLI installed (for webhook testing)
- [ ] Node.js and npm installed

## Create Stripe Account

### 1. Sign Up for Stripe

1. Go to [https://stripe.com](https://stripe.com)
2. Click "Start now" and create an account
3. Complete the email verification
4. You'll start in **Test Mode** (recommended for development)

### 2. Get API Keys

1. Navigate to **Developers** → **API keys** in the Stripe Dashboard
2. You'll see two types of keys:
   - **Publishable key** (`pk_test_...`) - Safe to use in frontend
   - **Secret key** (`sk_test_...`) - Keep this secure, server-side only

3. Copy both keys - you'll need them for environment variables

> **Important**: Never commit secret keys to version control!

## Set Up Products and Prices

### 1. Create Premium Product

1. Go to **Products** in Stripe Dashboard
2. Click **+ Add product**
3. Fill in product details:
   - **Name**: Premium Subscription
   - **Description**: Unlimited subscription tracking with premium features
   - **Image**: Upload your app icon (optional)

### 2. Create Monthly Price

1. In the product page, under **Pricing**:
   - **Price**: $4.99
   - **Billing period**: Monthly
   - **Currency**: USD
2. Click **Add price**
3. Copy the **Price ID** (starts with `price_`)
4. Save this as `STRIPE_PRICE_ID_MONTHLY`

### 3. Create Yearly Price

1. Click **Add another price**
2. Fill in:
   - **Price**: $39.00
   - **Billing period**: Yearly
   - **Currency**: USD
3. Click **Add price**
4. Copy the **Price ID** (starts with `price_`)
5. Save this as `STRIPE_PRICE_ID_YEARLY`

## Configure Environment Variables

### 1. Update .env File

Create or update your `.env` file with the Stripe keys:

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Price IDs
STRIPE_PRICE_ID_MONTHLY=price_your_monthly_id
STRIPE_PRICE_ID_YEARLY=price_your_yearly_id

# App URL (for billing portal)
APP_URL=exp://localhost:8081
```

### 2. Configure Supabase Secrets

Set the Stripe keys as Supabase secrets for Edge Functions:

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Deploy Supabase Edge Functions

### 1. Deploy All Functions

From your project root, deploy all Edge Functions:

```bash
# Deploy create-subscription
supabase functions deploy create-subscription

# Deploy stripe-webhook
supabase functions deploy stripe-webhook

# Deploy cancel-subscription
supabase functions deploy cancel-subscription

# Deploy request-refund
supabase functions deploy request-refund

# Deploy get-billing-portal
supabase functions deploy get-billing-portal
```

### 2. Verify Deployment

Check that functions are deployed:

```bash
supabase functions list
```

You should see all 5 functions listed.

### 3. Get Function URLs

Your Edge Function URLs will be:

```
https://your-project-ref.supabase.co/functions/v1/create-subscription
https://your-project-ref.supabase.co/functions/v1/stripe-webhook
https://your-project-ref.supabase.co/functions/v1/cancel-subscription
https://your-project-ref.supabase.co/functions/v1/request-refund
https://your-project-ref.supabase.co/functions/v1/get-billing-portal
```

## Configure Webhooks

### 1. Create Webhook Endpoint

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **+ Add endpoint**
3. Enter your webhook URL:
   ```
   https://your-project-ref.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`

5. Click **Add endpoint**

### 2. Get Webhook Signing Secret

1. Click on your newly created webhook endpoint
2. Click **Reveal** under **Signing secret**
3. Copy the secret (starts with `whsec_`)
4. Update your environment variables:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

### 3. Verify Webhook

Stripe will send a test event to verify your webhook endpoint. Check the webhook logs to ensure it's working.

## Testing

### 1. Install Stripe CLI

For local testing:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

### 2. Test Webhooks Locally

Forward webhooks to your local Edge Function:

```bash
# Login to Stripe CLI
stripe login

# Forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# In another terminal, trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### 3. Test Payment Flow

Use Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires 3D Secure**: `4000 0027 6000 3184`

All test cards:
- Use any future expiration date
- Use any 3-digit CVC
- Use any billing ZIP code

### 4. Test Subscription Creation

```bash
# Test creating a subscription
curl -X POST https://your-project-ref.supabase.co/functions/v1/create-subscription \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "billingCycle": "monthly",
    "priceId": "price_your_monthly_id"
  }'
```

## Security Best Practices

### 1. Key Management

- ✅ **DO**: Use test keys (`pk_test_`, `sk_test_`) during development
- ✅ **DO**: Store secret keys in Supabase secrets, never in code
- ✅ **DO**: Use environment variables for configuration
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Expose secret keys in frontend code
- ❌ **DON'T**: Share API keys via email or chat

### 2. Webhook Security

- ✅ **ALWAYS** verify webhook signatures
- ✅ **USE** HTTPS only for webhook endpoints
- ✅ **IMPLEMENT** idempotency to prevent duplicate processing
- ✅ **LOG** all webhook events for debugging

### 3. Error Handling

- ✅ **CATCH** all Stripe API errors
- ✅ **RETURN** appropriate HTTP status codes
- ✅ **LOG** errors for debugging
- ✅ **PROVIDE** user-friendly error messages

### 4. Rate Limiting

- Implement rate limiting on Edge Functions
- Use Stripe's retry logic for failed webhooks
- Handle 429 (rate limit) errors gracefully

## Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Failed

**Problem**: Webhook returns 400 "Invalid signature"

**Solutions**:
- Verify webhook secret is correct in Supabase secrets
- Ensure you're using the raw request body for verification
- Check that the signature header is being passed correctly

#### 2. Edge Function Timeout

**Problem**: Edge Function times out during Stripe API calls

**Solutions**:
- Check Stripe API status: [https://status.stripe.com](https://status.stripe.com)
- Verify network connectivity from Supabase
- Increase function timeout in `supabase/functions/config.toml`

#### 3. Customer Not Found

**Problem**: "No such customer" error

**Solutions**:
- Verify customer ID is stored correctly in database
- Check that customer exists in Stripe Dashboard
- Ensure you're using the correct Stripe account (test vs. live)

#### 4. Price ID Not Found

**Problem**: "No such price" error

**Solutions**:
- Verify price IDs are correct in environment variables
- Check that prices are active in Stripe Dashboard
- Ensure you're using test price IDs with test keys

#### 5. Database Permission Errors

**Problem**: RLS policy denies database operation

**Solutions**:
- Verify RLS policies are set up correctly (Phase 2)
- Ensure Edge Functions use service role key
- Check that user is authenticated

### Debugging Tips

1. **Check Edge Function Logs**:
   ```bash
   supabase functions logs stripe-webhook
   ```

2. **View Stripe Dashboard Logs**:
   - Go to **Developers** → **Events**
   - View all API requests and webhooks

3. **Test in Isolation**:
   - Test each Edge Function independently
   - Use curl or Postman to debug requests
   - Check response payloads

4. **Monitor Database**:
   - Query `stripe_webhooks` table for processed events
   - Check `user_subscriptions` for status updates
   - Review `payment_transactions` for payment records

## Going Live

When you're ready to go live:

### 1. Activate Live Mode

1. Go to Stripe Dashboard
2. Toggle from **Test Mode** to **Live Mode**
3. Complete Stripe account activation (provide business details)

### 2. Update Keys

1. Get live API keys from Stripe Dashboard
2. Update environment variables with live keys:
   ```bash
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   ```
3. Update Supabase secrets:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   ```

### 3. Create Live Products

1. Recreate products in live mode
2. Update price IDs in environment variables
3. Redeploy Edge Functions if needed

### 4. Update Webhooks

1. Create new webhook endpoint for live mode
2. Update webhook URL if using different domain
3. Configure same events as test mode
4. Update webhook secret

### 5. Test Live Payments

- Use real credit cards (your own) to test
- Verify payments appear in Stripe Dashboard
- Check database records are created correctly
- Test webhook events fire correctly

## Support

For additional help:

- **Stripe Documentation**: [https://stripe.com/docs](https://stripe.com/docs)
- **Stripe Support**: [https://support.stripe.com](https://support.stripe.com)
- **Supabase Documentation**: [https://supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord**: [https://discord.supabase.com](https://discord.supabase.com)

## Next Steps

After completing this setup:

1. ✅ Test all payment flows thoroughly
2. ✅ Implement Phase 4 (Subscription Limit Enforcement)
3. ✅ Implement Phase 5 (Paywall UI Components)
4. ✅ Conduct end-to-end testing
5. ✅ Prepare for production deployment