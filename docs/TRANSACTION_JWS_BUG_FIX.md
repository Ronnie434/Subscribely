# Critical Bug Fix: getTransactionJwsIOS Parameter Error

## 🐛 Bug Found

**Location:** `services/appleIAPService.ts`, Line 616

**The Problem:**
```typescript
// ❌ WRONG: Passing transaction ID instead of product ID
receiptData = await getTransactionJwsIOS(purchase.transactionId);
```

**This caused the error:**
```
ERROR [RN-IAP] [getTransactionJwsIOS] Failed: 
PurchaseError(code: OpenIAP.ErrorCode.transactionValidationFailed, 
message: "Can't find transaction for sku 2000001075403500", productId: nil)
```

### Why This is Wrong

**What you were passing:**
- `purchase.transactionId` = `2000001075403500` ← This is a **transaction identifier**

**What the function expects:**
- Product ID (SKU) = `com.ronnie39.renvo.premium.monthly.v1` ← This is the **product/SKU**

### From React Native IAP Documentation

```typescript
getTransactionJwsIOS(productId: string): Promise<string>
```

**Parameter:** `productId` (string) - The product identifier (SKU), **NOT** the transaction ID

---

## ✅ The Fix

```typescript
// ✅ CORRECT: Pass product ID (SKU) instead of transaction ID
receiptData = await getTransactionJwsIOS(purchase.productId);
```

### Full Context (Lines 610-625)

**Before:**
```typescript
if (!receiptData && purchase.transactionId) {  // ❌ Wrong condition
  try {
    if (typeof getTransactionJwsIOS === 'function') {
      receiptData = await getTransactionJwsIOS(purchase.transactionId);  // ❌ Wrong parameter
      if (receiptData) {
        console.log('[AppleIAP] ✅ Retrieved JWS token for validation');
      }
    }
  } catch (jwsError) {
    console.log('[AppleIAP] ℹ️ Could not get JWS token:', (jwsError as Error).message);
  }
}
```

**After:**
```typescript
if (!receiptData && purchase.productId) {  // ✅ Correct condition
  try {
    if (typeof getTransactionJwsIOS === 'function') {
      console.log('[AppleIAP] 🔍 Attempting to get JWS token for product:', purchase.productId);
      receiptData = await getTransactionJwsIOS(purchase.productId);  // ✅ Correct parameter
      if (receiptData) {
        console.log('[AppleIAP] ✅ Retrieved JWS token for validation');
      }
    }
  } catch (jwsError) {
    console.log('[AppleIAP] ℹ️ Could not get JWS token:', (jwsError as Error).message);
  }
}
```

---

## 📊 Impact

### Before Fix

Your logs showed:
```
LOG  [AppleIAP] 📦 Purchase received: 2000001075403500
ERROR [RN-IAP] [getTransactionJwsIOS] Failed: 
  PurchaseError(code: OpenIAP.ErrorCode.transactionValidationFailed, 
  message: "Can't find transaction for sku 2000001075403500", productId: nil)
LOG  [AppleIAP] ℹ️ Could not get JWS token: [error message]
```

**Why it failed:**
1. Function tried to find transaction with SKU `2000001075403500`
2. But `2000001075403500` is NOT a SKU - it's a transaction ID!
3. StoreKit couldn't find any product with that SKU
4. Error: "Can't find transaction for sku 2000001075403500"

### After Fix

Expected logs:
```
LOG  [AppleIAP] 📦 Purchase received: 2000001075403500
LOG  [AppleIAP] 🔍 Attempting to get JWS token for product: com.ronnie39.renvo.premium.monthly.v1
LOG  [AppleIAP] ✅ Retrieved JWS token for validation
```

**Why it will work:**
1. Function looks for product `com.ronnie39.renvo.premium.monthly.v1`
2. StoreKit finds the product correctly
3. Returns JWS token for that product
4. Receipt validation succeeds

---

## 🎯 Why This Matters

### Current Behavior (Without Fix)
1. Purchase completes ✅
2. App tries to get JWS token ❌ (fails with wrong parameter)
3. Falls back to legacy receipt ❌ (not available in simulator)
4. **Relies 100% on webhook validation** (no immediate client-side validation)
5. Works eventually but with errors in logs

### With Fix
1. Purchase completes ✅
2. App gets JWS token successfully ✅
3. Can validate receipt client-side ✅
4. **Immediate validation** (better UX, faster confirmation)
5. Clean logs, no errors ✅

---

## 🧪 Testing Strategy

### What to Test

#### Test 1: Local Development (Simulator)
- **Expected:** Still won't get JWS token (simulator limitation)
- **Expected:** Falls back to webhook validation (working)
- **Expected:** No more "Can't find transaction for sku" error ✅

#### Test 2: TestFlight (Real Device with Sandbox)
- **Expected:** Successfully retrieves JWS token ✅
- **Expected:** Client-side validation works ✅
- **Expected:** Faster subscription activation ✅

#### Test 3: Production (App Store)
- **Expected:** Full StoreKit 2 support ✅
- **Expected:** JWS token validation ✅
- **Expected:** Optimal performance ✅

---

## 🔍 Additional Context

### React Native IAP Purchase Object

```typescript
interface Purchase {
  productId: string;           // ✅ "com.ronnie39.renvo.premium.monthly.v1"
  transactionId: string;        // ❌ "2000001075403500" (Apple's transaction ID)
  transactionDate: number;
  transactionReceipt?: string;  // Legacy base64 receipt
  purchaseToken?: string;       // Android only
  // ... more fields
}
```

### What Each ID Is

| Field | Example | Purpose |
|-------|---------|---------|
| `productId` | `com.ronnie39.renvo.premium.monthly.v1` | **SKU identifier** - identifies WHICH product |
| `transactionId` | `2000001075403500` | **Transaction identifier** - identifies THIS purchase instance |
| `originalTransactionId` | `2000001075403500` | **Original transaction** - same for all renewals |

---

## ✅ My Assessment

**Your analysis is 100% correct!** This bug causes:

1. ❌ Unnecessary error logs in console
2. ❌ Failed JWS token retrieval attempts
3. ❌ Reliance on fallback validation methods
4. ❌ Slower validation flow
5. ❌ Potential confusion during debugging

**The fix is straightforward:**
- Change `purchase.transactionId` → `purchase.productId`
- Also update condition check for consistency
- Add logging to show which product ID is being used

---

## 🚀 Implementation Status

✅ **Already Fixed!** I've updated the code:

**File:** `services/appleIAPService.ts`
**Line:** 616 (and condition on line 611)

**Changes:**
```typescript
// Changed from:
if (!receiptData && purchase.transactionId) {
  receiptData = await getTransactionJwsIOS(purchase.transactionId);
}

// To:
if (!receiptData && purchase.productId) {
  console.log('[AppleIAP] 🔍 Attempting to get JWS token for product:', purchase.productId);
  receiptData = await getTransactionJwsIOS(purchase.productId);
}
```

---

## 📱 Next Build Required

**Important:** This change is in the **React Native app code**, not the Edge Functions.

You'll need to:
1. ✅ Code is already fixed (just did it)
2. ⏳ Build new version of the app
3. ⏳ Upload to TestFlight (or test in development)
4. ⏳ Test purchase flow

The Edge Function changes can be deployed immediately, but this app code change requires a new build.

---

## 📋 Complete Fix Summary

| Issue | Location | Fix | Deploy Method |
|-------|----------|-----|---------------|
| Webhook schema errors | Edge Functions | ✅ Fixed | `supabase functions deploy` |
| Receipt validation schema | Edge Functions | ✅ Fixed | `supabase functions deploy` |
| Wrong parameter to getTransactionJwsIOS | App code | ✅ Fixed | **New TestFlight build** |

---

## 🎯 Expected Improvements

After rebuilding and deploying:

1. **Cleaner logs** - No more "Can't find transaction for sku" errors
2. **Better validation** - JWS tokens retrieved correctly on real devices
3. **Faster activation** - Client-side validation works properly
4. **Professional experience** - Error-free purchase flow

Excellent debugging! This was a subtle but important bug. 🎉


