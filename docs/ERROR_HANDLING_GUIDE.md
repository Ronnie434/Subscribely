# Error Handling Guide - Paywall System

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Error Handling Philosophy](#error-handling-philosophy)
2. [Error Categories](#error-categories)
3. [Payment Errors](#payment-errors)
4. [Database Errors](#database-errors)
5. [Stripe Integration Errors](#stripe-integration-errors)
6. [Edge Function Errors](#edge-function-errors)
7. [Network Errors](#network-errors)
8. [Error Response Format](#error-response-format)
9. [User-Facing Error Messages](#user-facing-error-messages)
10. [Error Recovery Strategies](#error-recovery-strategies)

---

## Error Handling Philosophy

### Core Principles

1. **Fail Gracefully**: Never crash the app, always provide a fallback
2. **User-Friendly**: Show clear, actionable error messages
3. **Developer-Friendly**: Log detailed error information for debugging
4. **Secure**: Never expose sensitive information in error messages
5. **Recoverable**: Provide clear paths to resolution

### Error Handling Hierarchy

```typescript
try {
  // Attempt operation
  await processPayment();
} catch (error) {
  // 1. Log the error for developers
  console.error('Payment processing failed:', error);
  
  // 2. Track in error monitoring
  Sentry.captureException(error);
  
  // 3. Show user-friendly message
  Alert.alert(
    'Payment Failed',
    'We couldn\'t process your payment. Please check your card details and try again.',
    [{ text: 'OK' }]
  );
  
  // 4. Provide recovery option
  setShowRetryButton(true);
}
```

---

## Error Categories

### 1. Payment Errors
- Card declined
- Insufficient funds
- Invalid card details
- Authentication required
- Processing timeout

### 2. Database Errors
- Connection timeout
- Query failure
- Constraint violation
- RLS policy violation
- Transaction rollback

### 3. API Errors
- Network timeout
- Server error (5xx)
- Client error (4xx)
- Rate limiting
- Authentication failure

### 4. Business Logic Errors
- Subscription limit reached
- Invalid tier transition
- Refund not eligible
- Duplicate operation

### 5. System Errors
- Memory exhaustion
- Edge function timeout
- Webhook delivery failure
- Cache errors

---

## Payment Errors

### Card Declined

**Error Code**: `card_declined`

**Common Causes**:
- Insufficient funds
- Card reported lost/stolen
- Card expired
- Incorrect CVC
- Card issuer declined

**Handling**:
```typescript
// services/paymentService.ts
if (error.code === 'card_declined') {
  // Log for analytics
  await usageTrackingService.trackEvent('payment_failed', {
    reason: 'card_declined',
    decline_code: error.decline_code
  });
  
  // User message
  throw new PaymentError(
    'Your card was declined. Please try a different payment method.',
    'card_declined',
    {
      userMessage: 'Your card was declined',
      action: 'try_different_card',
      declineCode: error.decline_code
    }
  );
}
```

**User Message**:
```
Your card was declined by your bank.

What you can do:
• Check that your card details are correct
• Try a different payment method
• Contact your bank for more information

[Try Another Card]  [Cancel]
```

### Insufficient Funds

**Error Code**: `insufficient_funds`

**Handling**:
```typescript
if (error.code === 'insufficient_funds') {
  throw new PaymentError(
    'Your card has insufficient funds.',
    'insufficient_funds',
    {
      userMessage: 'Insufficient funds on your card',
      action: 'try_different_card',
      recoverable: true
    }
  );
}
```

**User Message**:
```
Your card doesn't have enough funds for this purchase.

Amount needed: $4.99
Please use a different payment method.

[Try Another Card]  [Cancel]
```

### Invalid Card Number

**Error Code**: `invalid_number`

**Handling**:
```typescript
if (error.code === 'invalid_number') {
  // This should be caught client-side before submission
  throw new PaymentError(
    'Invalid card number',
    'invalid_number',
    {
      userMessage: 'Please check your card number',
      field: 'card_number',
      recoverable: true
    }
  );
}
```

**User Message**:
```
The card number you entered is invalid.
Please check and try again.

[OK]
```

### Expired Card

**Error Code**: `expired_card`

**Handling**:
```typescript
if (error.code === 'expired_card') {
  throw new PaymentError(
    'Card has expired',
    'expired_card',
    {
      userMessage: 'Your card has expired',
      action: 'use_different_card',
      recoverable: true
    }
  );
}
```

### Incorrect CVC

**Error Code**: `incorrect_cvc`

**Handling**:
```typescript
if (error.code === 'incorrect_cvc') {
  throw new PaymentError(
    'Incorrect CVC',
    'incorrect_cvc',
    {
      userMessage: 'The security code (CVC) is incorrect',
      field: 'cvc',
      recoverable: true
    }
  );
}
```

### 3D Secure Authentication Required

**Error Code**: `authentication_required`

**Handling**:
```typescript
if (error.code === 'authentication_required') {
  // Stripe SDK handles 3DS automatically
  // If this error occurs, re-attempt authentication
  const { error: authError } = await stripe.handleNextAction(
    paymentIntent.client_secret
  );
  
  if (authError) {
    throw new PaymentError(
      'Authentication failed',
      'authentication_failed',
      {
        userMessage: 'Card authentication failed. Please try again.',
        recoverable: true
      }
    );
  }
}
```

### Payment Processing Timeout

**Error Code**: `processing_timeout`

**Handling**:
```typescript
const PAYMENT_TIMEOUT = 30000; // 30 seconds

const paymentPromise = stripe.confirmPayment(clientSecret);
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('timeout')), PAYMENT_TIMEOUT)
);

try {
  await Promise.race([paymentPromise, timeoutPromise]);
} catch (error) {
  if (error.message === 'timeout') {
    throw new PaymentError(
      'Payment processing timed out',
      'processing_timeout',
      {
        userMessage: 'Payment is taking longer than expected',
        action: 'check_status',
        recoverable: true
      }
    );
  }
}
```

**User Message**:
```
Your payment is taking longer than expected.

We're still processing it. Please check your 
email for a confirmation, or contact support 
if you don't receive one within 10 minutes.

[Check Status]  [Contact Support]
```

### Complete Payment Error Handler

```typescript
// services/paymentService.ts
export class PaymentService {
  async handlePaymentError(error: any): Promise<never> {
    const errorHandlers: Record<string, () => PaymentError> = {
      card_declined: () => new PaymentError(
        'Card declined',
        'card_declined',
        {
          userMessage: 'Your card was declined. Please try a different payment method.',
          action: 'try_different_card',
          recoverable: true
        }
      ),
      
      insufficient_funds: () => new PaymentError(
        'Insufficient funds',
        'insufficient_funds',
        {
          userMessage: 'Your card doesn\'t have enough funds. Please use a different card.',
          action: 'try_different_card',
          recoverable: true
        }
      ),
      
      expired_card: () => new PaymentError(
        'Card expired',
        'expired_card',
        {
          userMessage: 'Your card has expired. Please use a different card.',
          action: 'use_different_card',
          recoverable: true
        }
      ),
      
      incorrect_cvc: () => new PaymentError(
        'Incorrect CVC',
        'incorrect_cvc',
        {
          userMessage: 'The security code is incorrect. Please check and try again.',
          field: 'cvc',
          recoverable: true
        }
      ),
      
      invalid_number: () => new PaymentError(
        'Invalid card number',
        'invalid_number',
        {
          userMessage: 'The card number is invalid. Please check and try again.',
          field: 'card_number',
          recoverable: true
        }
      ),
      
      processing_error: () => new PaymentError(
        'Processing error',
        'processing_error',
        {
          userMessage: 'We couldn\'t process your payment. Please try again.',
          action: 'retry',
          recoverable: true
        }
      )
    };
    
    const handler = errorHandlers[error.code] || errorHandlers.processing_error;
    const paymentError = handler();
    
    // Log error
    console.error('Payment error:', error);
    
    // Track analytics
    await usageTrackingService.trackEvent('payment_failed', {
      errorCode: error.code,
      errorMessage: error.message
    }).catch(() => {}); // Don't fail on tracking error
    
    throw paymentError;
  }
}
```

---

## Database Errors

### Connection Timeout

**Error**: Connection to database timed out

**Handling**:
```typescript
try {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId);
    
  if (error?.code === 'PGRST301') { // Connection timeout
    throw new DatabaseError(
      'Database connection timeout',
      'connection_timeout',
      {
        userMessage: 'We\'re experiencing connectivity issues. Please try again.',
        recoverable: true,
        retryable: true
      }
    );
  }
} catch (error) {
  // Retry with exponential backoff
  await retryWithBackoff(async () => {
    // Retry operation
  });
}
```

### Query Failure

**Error**: Database query failed

**Handling**:
```typescript
const { data, error } = await supabase
  .from('user_subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single();

if (error) {
  console.error('Query failed:', error);
  
  // Provide fallback data
  return {
    tier_id: 'free',
    status: 'active',
    billing_cycle: 'none'
  };
}
```

### RLS Policy Violation

**Error Code**: `42501` (Insufficient privilege)

**Handling**:
```typescript
if (error.code === '42501') {
  console.error('RLS policy violation:', error);
  
  throw new DatabaseError(
    'Access denied',
    'rls_violation',
    {
      userMessage: 'You don\'t have permission to access this resource.',
      action: 'login_again',
      recoverable: false
    }
  );
}
```

### Constraint Violation

**Error Code**: `23505` (Unique violation)

**Handling**:
```typescript
if (error.code === '23505') {
  throw new DatabaseError(
    'Duplicate record',
    'unique_violation',
    {
      userMessage: 'This record already exists.',
      recoverable: false
    }
  );
}
```

### Foreign Key Violation

**Error Code**: `23503`

**Handling**:
```typescript
if (error.code === '23503') {
  throw new DatabaseError(
    'Invalid reference',
    'foreign_key_violation',
    {
      userMessage: 'Invalid data reference. Please refresh and try again.',
      action: 'refresh',
      recoverable: true
    }
  );
}
```

---

## Stripe Integration Errors

### Invalid API Key

**Error Code**: `invalid_api_key`

**Handling**:
```typescript
if (error.type === 'invalid_api_key') {
  console.error('Stripe API key is invalid');
  
  // This is a configuration error - alert developers
  Sentry.captureException(error, {
    level: 'critical',
    tags: { component: 'stripe_config' }
  });
  
  throw new ConfigurationError(
    'Payment system configuration error',
    'invalid_stripe_key',
    {
      userMessage: 'We\'re experiencing technical difficulties. Please try again later.',
      recoverable: false
    }
  );
}
```

### Rate Limit Exceeded

**Error Code**: `rate_limit`

**Handling**:
```typescript
if (error.type === 'rate_limit') {
  const retryAfter = error.headers?.['retry-after'] || 60;
  
  throw new StripeError(
    'Rate limit exceeded',
    'rate_limit',
    {
      userMessage: 'Too many requests. Please wait a moment and try again.',
      action: 'retry_later',
      retryAfter: parseInt(retryAfter)
    }
  );
}
```

### Webhook Signature Verification Failed

**Error**: Webhook signature mismatch

**Handling**:
```typescript
// supabase/functions/stripe-webhook/index.ts
try {
  const signature = req.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    webhookSecret
  );
} catch (error) {
  console.error('Webhook signature verification failed:', error);
  
  return new Response(
    JSON.stringify({ error: 'Invalid signature' }),
    { status: 400 }
  );
}
```

### Customer Not Found

**Error**: No such customer

**Handling**:
```typescript
try {
  const customer = await stripe.customers.retrieve(customerId);
} catch (error) {
  if (error.code === 'resource_missing') {
    // Customer doesn't exist in Stripe
    // Create new customer
    const newCustomer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id }
    });
    
    // Update database
    await supabase
      .from('user_subscriptions')
      .update({ stripe_customer_id: newCustomer.id })
      .eq('user_id', user.id);
  }
}
```

---

## Edge Function Errors

### Function Timeout

**Error**: Edge Function exceeded time limit

**Handling**:
```typescript
// Set appropriate timeout
const FUNCTION_TIMEOUT = 10000; // 10 seconds

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FUNCTION_TIMEOUT);

try {
  const response = await fetch(functionUrl, {
    signal: controller.signal,
    // ... other options
  });
} catch (error) {
  if (error.name === 'AbortError') {
    throw new EdgeFunctionError(
      'Function timeout',
      'timeout',
      {
        userMessage: 'Request timed out. Please try again.',
        recoverable: true
      }
    );
  }
} finally {
  clearTimeout(timeoutId);
}
```

### Memory Limit Exceeded

**Error**: Out of memory

**Prevention**:
```typescript
// Avoid loading large datasets into memory
// Use streaming or pagination instead

// Bad ❌
const allUsers = await supabase.from('users').select('*');

// Good ✅
const PAGE_SIZE = 100;
for (let page = 0; page < totalPages; page++) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  
  // Process batch
  await processBatch(data);
}
```

### CORS Error

**Error**: CORS policy blocked request

**Handling**:
```typescript
// supabase/functions/your-function/index.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS request
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Add CORS headers to all responses
return new Response(
  JSON.stringify(data),
  { 
    headers: { 
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## Network Errors

### Connection Timeout

**Handling**:
```typescript
const fetchWithTimeout = async (url: string, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new NetworkError(
        'Request timeout',
        'timeout',
        {
          userMessage: 'Connection timed out. Please check your internet connection.',
          recoverable: true
        }
      );
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
};
```

### No Internet Connection

**Handling**:
```typescript
import NetInfo from '@react-native-community/netinfo';

const checkConnectivity = async () => {
  const state = await NetInfo.fetch();
  
  if (!state.isConnected) {
    throw new NetworkError(
      'No internet connection',
      'offline',
      {
        userMessage: 'No internet connection. Please check your network settings.',
        recoverable: true,
        action: 'retry_when_online'
      }
    );
  }
};
```

### Server Error (5xx)

**Handling**:
```typescript
if (response.status >= 500) {
  throw new NetworkError(
    'Server error',
    'server_error',
    {
      userMessage: 'Our servers are experiencing issues. Please try again later.',
      statusCode: response.status,
      recoverable: true,
      retryable: true
    }
  );
}
```

---

## Error Response Format

### Standardized Error Object

```typescript
interface ErrorResponse {
  error: {
    code: string;              // Machine-readable error code
    message: string;           // Developer-friendly message
    details?: any;             // Additional error context
    userMessage: string;       // User-friendly message
    action?: string;           // Suggested action
    recoverable: boolean;      // Can user recover from this?
    retryable?: boolean;       // Should operation be retried?
    timestamp: string;         // When error occurred
  };
}
```

### Example Error Responses

**Payment Error**:
```json
{
  "error": {
    "code": "card_declined",
    "message": "Card was declined by issuer",
    "details": {
      "decline_code": "insufficient_funds",
      "payment_intent_id": "pi_abc123"
    },
    "userMessage": "Your card was declined. Please try a different payment method.",
    "action": "try_different_card",
    "recoverable": true,
    "timestamp": "2025-11-16T20:00:00.000Z"
  }
}
```

**Database Error**:
```json
{
  "error": {
    "code": "query_timeout",
    "message": "Database query exceeded timeout limit",
    "details": {
      "query": "SELECT * FROM subscriptions",
      "timeout": 5000
    },
    "userMessage": "We're experiencing technical difficulties. Please try again.",
    "action": "retry",
    "recoverable": true,
    "retryable": true,
    "timestamp": "2025-11-16T20:00:00.000Z"
  }
}
```

---

## User-Facing Error Messages

### Guidelines for Error Messages

1. **Be Clear**: Use plain language, avoid technical jargon
2. **Be Specific**: Tell users what went wrong
3. **Be Helpful**: Provide actionable next steps
4. **Be Empathetic**: Acknowledge the frustration
5. **Be Brief**: Keep messages concise

### Message Templates

**Generic Error**:
```
Something went wrong

We couldn't complete your request. 
Please try again.

[Try Again]  [Cancel]
```

**Payment Error**:
```
Payment Failed

Your card was declined by your bank.
Please try a different payment method 
or contact your bank.

[Try Another Card]  [Contact Support]
```

**Network Error**:
```
Connection Problem

We couldn't connect to our servers.
Please check your internet connection.

[Retry]  [Cancel]
```

**Subscription Limit**:
```
Limit Reached

You've reached your limit of 5 subscriptions.
Upgrade to Premium for unlimited subscriptions.

[Upgrade to Premium]  [Cancel]
```

---

## Error Recovery Strategies

### Retry with Exponential Backoff

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
await retryWithBackoff(async () => {
  return await supabase.from('subscriptions').select('*');
});
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold = 5,
    private timeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

// Usage
const breaker = new CircuitBreaker();

await breaker.execute(async () => {
  return await fetchPaymentIntent();
});
```

### Fallback Pattern

```typescript
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => T
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.error('Primary operation failed, using fallback:', error);
    return fallback();
  }
}

// Usage
const userTier = await withFallback(
  async () => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('tier_id')
      .eq('user_id', userId)
      .single();
    return data.tier_id;
  },
  () => 'free' // Fallback to free tier
);
```

### Graceful Degradation

```typescript
async function getSubscriptionWithDegradation(userId: string) {
  try {
    // Try to get full subscription details
    const subscription = await subscriptionService.getFullDetails(userId);
    return subscription;
  } catch (error) {
    console.error('Failed to get full details:', error);
    
    try {
      // Fallback: Get basic subscription info
      const basicInfo = await subscriptionService.getBasicInfo(userId);
      return basicInfo;
    } catch (error2) {
      console.error('Failed to get basic info:', error2);
      
      // Final fallback: Return default
      return {
        tier_id: 'free',
        status: 'active',
        features: ['basic']
      };
    }
  }
}
```

---

## Error Logging Best Practices

### What to Log

```typescript
// ✅ Good: Structured logging with context
logger.error('Payment failed', {
  userId: user.id,
  errorCode: error.code,
  errorMessage: error.message,
  paymentIntentId: paymentIntent.id,
  amount: 4.99,
  plan: 'monthly',
  timestamp: new Date().toISOString(),
  stack: error.stack
});

// ❌ Bad: Unstructured logging without context
console.log('Error:', error);
```

### What NOT to Log

```typescript
// ❌ Never log sensitive data
logger.error('Payment failed', {
  cardNumber: '4242...',        // Don't log
  cvc: '123',                   // Don't log
  password: 'secret',           // Don't log
  apiKey: 'sk_test_...',        // Don't log
});

// ✅ Good: Log only safe identifiers
logger.error('Payment failed', {
  cardBrand: 'visa',
  last4: '4242',
  paymentIntentId: 'pi_...'
});
```

---

**End of Error Handling Guide**