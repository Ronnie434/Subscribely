# Apple Receipt Error 21002 - Malformed Receipt Data

## 🐛 Error Found in Logs

**Status Code:** `21002`  
**Meaning:** "The data in the receipt-data property was malformed or the service experienced a temporary issue."

### From Apple Documentation
> Status 21002 indicates that the receipt data sent to Apple's `/verifyReceipt` endpoint is:
> - Not valid base64 encoded data
> - Corrupted or incomplete
> - Empty or contains invalid characters

---

## 🔍 Root Cause Analysis

### Why This Happens

Based on our previous fixes, there are a few possible causes:

#### 1. Empty or Missing Receipt Data
```typescript
// If no receipt found, receiptData could be empty string
receiptData = purchase.transactionReceipt || purchase.receipt || '';  // ← Empty!
```

#### 2. Wrong Receipt Type (Less Likely Now)
After our fix, we prioritize legacy receipt format, but if the purchase object doesn't have `transactionReceipt`, we might get nothing.

#### 3. Simulator/Local Testing
Simulators often don't provide valid receipts, causing this error.

---

## ✅ Fixes Applied

### 1. **Edge Function: Better Error Handling**

**File:** `supabase/functions/validate-apple-receipt/index.ts`

#### Added Receipt Format Validation
```typescript
// Validate receipt format - should be base64 encoded string
console.log('[validate-apple-receipt] 🔍 Validating receipt format...');
console.log('[validate-apple-receipt] 🔍 Receipt first 50 chars:', receiptData.substring(0, 50));

// Check if it looks like a JWS token (starts with "eyJ") instead of base64 receipt
if (receiptData.startsWith('eyJ')) {
  console.error('[validate-apple-receipt] ❌ Receipt appears to be a JWS token, not base64 receipt!');
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Invalid receipt format: JWS tokens are not supported. Please send base64 encoded receipt.',
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Basic base64 validation
const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
if (!base64Regex.test(receiptData)) {
  console.error('[validate-apple-receipt] ❌ Receipt data is not valid base64 format');
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Invalid receipt format: not valid base64 encoded data',
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

#### Added Comprehensive Error Codes
```typescript
const RECEIPT_STATUS = {
  VALID: 0,
  // Client-side errors
  MALFORMED_RECEIPT: 21002,
  RECEIPT_NOT_AUTHENTICATED: 21003,
  SHARED_SECRET_MISMATCH: 21004,
  RECEIPT_SERVER_UNAVAILABLE: 21005,
  SUBSCRIPTION_EXPIRED: 21006,
  // Environment mismatches
  SANDBOX_RECEIPT_IN_PROD: 21007,
  PROD_RECEIPT_IN_SANDBOX: 21008,
  // Other errors
  INTERNAL_ERROR: 21009,
  ACCOUNT_NOT_FOUND: 21010,
};
```

#### Added Detailed Error Messages
```typescript
switch (appleResponse.status) {
  case RECEIPT_STATUS.MALFORMED_RECEIPT:
    errorMessage = 'Receipt data is malformed or corrupted (21002). This usually means the receipt data is not valid base64 or is incomplete.';
    console.error('[validate-apple-receipt] 💡 Suggestion: Check if receipt data is valid base64 encoded string');
    console.error('[validate-apple-receipt] 💡 Receipt sample:', receiptData.substring(0, 100));
    break;
  // ... other cases
}
```

### 2. **Client: Better Diagnostic Logging**

**File:** `services/appleIAPService.ts`

```typescript
private async validateReceiptServer(receiptData: string, userId: string): Promise<boolean> {
  try {
    console.log('[AppleIAP] 🔍 Validating receipt with server...');
    console.log('[AppleIAP] 🔍 Receipt data length:', receiptData.length);
    console.log('[AppleIAP] 🔍 Receipt first 50 chars:', receiptData.substring(0, 50));
    console.log('[AppleIAP] 🔍 Receipt type:', receiptData.startsWith('eyJ') ? 'JWS token' : 'base64 receipt');
    
    // ... rest of validation
    
    if (!data?.success) {
      console.error('[AppleIAP] ❌ Validation failed:', data?.error || 'Unknown error');
      if (data?.status) {
        console.error('[AppleIAP] ❌ Apple status code:', data.status);
      }
      return false;
    }
    
    console.log('[AppleIAP] ✅ Receipt validation successful');
    return true;
  } catch (error) {
    console.error('[AppleIAP] ❌ Validation exception:', error);
    return false;
  }
}
```

---

## 🧪 What To Check Next

### When You See This Error Again

The new logs will show:

**Client-side:**
```
LOG  [AppleIAP] 🔍 Validating receipt with server...
LOG  [AppleIAP] 🔍 Receipt data length: 0  ← Empty receipt!
LOG  [AppleIAP] 🔍 Receipt first 50 chars: 
LOG  [AppleIAP] 🔍 Receipt type: base64 receipt
ERROR [AppleIAP] ❌ Validation failed: Receipt data is malformed or corrupted (21002)
ERROR [AppleIAP] ❌ Apple status code: 21002
```

**Edge Function:**
```
LOG  [validate-apple-receipt] 🔍 Validating receipt format...
LOG  [validate-apple-receipt] 🔍 Receipt first 50 chars: [empty or invalid]
ERROR [validate-apple-receipt] ❌ Receipt data is not valid base64 format
```

### Possible Scenarios

#### Scenario 1: Empty Receipt (Most Likely)
```
Receipt data length: 0
```
**Cause:** `purchase.transactionReceipt` is undefined/empty, and `getReceiptDataIOS()` also returns nothing (common in simulator)  
**Solution:** This is expected in simulator - validation will fail gracefully and webhook will handle it

#### Scenario 2: Invalid Characters
```
Receipt data length: 150
Receipt first 50 chars: MIITx@#$%^&*()
```
**Cause:** Receipt data got corrupted somehow  
**Solution:** Should be caught by base64 validation now

#### Scenario 3: JWS Token Being Sent
```
Receipt type: JWS token
Receipt first 50 chars: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Cause:** Despite our fix, somehow JWS token is being sent  
**Solution:** Edge function will reject it with clear error message

---

## 📊 Expected Behavior After Fix

### On Real Device (TestFlight)
```
✅ Receipt data found in purchase object
✅ Base64 validation passes
✅ Apple validates successfully
✅ Subscription activated
```

### On Simulator (Development)
```
⚠️ No receipt data available (expected)
⚠️ Validation skipped (gracefully)
✅ Webhook handles activation
✅ User still gets access
```

### On Invalid Receipt
```
❌ Receipt validation fails with detailed error
❌ Clear diagnostic logs
❌ Specific error code (21002, 21003, etc.)
💡 Actionable suggestions in logs
```

---

## 🎯 Summary of Improvements

| Improvement | Before | After |
|-------------|--------|-------|
| **Error Detection** | Generic "status 400" | Specific Apple error codes |
| **Format Validation** | None | JWS vs base64 detection |
| **Diagnostic Logs** | Minimal | Detailed (length, type, sample) |
| **Error Messages** | Vague | Specific with suggestions |
| **Base64 Check** | None | Regex validation |

---

## 🚀 Deployment

### Deploy Edge Function
```bash
supabase functions deploy validate-apple-receipt
```

### Build New App
The client-side logging improvements require a new build.

---

## 🔍 Next Time You See 21002

**Check these new logs:**
1. **Receipt data length** - Is it 0 or very small?
2. **Receipt first 50 chars** - Does it look like base64?
3. **Receipt type** - Is it JWS token or base64?
4. **Environment** - Simulator or real device?

**Most likely cause:** Empty receipt in simulator (expected and handled gracefully)

**Unexpected cause:** Will now be clearly identified in logs with actionable suggestions!

---

## ✅ Result

Your receipt validation is now much more robust:
- ✅ Detects format issues before sending to Apple
- ✅ Provides detailed diagnostic information
- ✅ Clear error messages for each Apple status code
- ✅ Graceful handling of simulator limitations
- ✅ Better debugging experience

The 21002 error will still occur in simulators (expected), but now you'll know exactly why and have confirmation it's working correctly! 🎉

