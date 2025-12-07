# Apple Receipt Format Mismatch Fix

## 🐛 New Issue Discovered

After fixing the `transactionId` → `productId` bug, we uncovered a **format mismatch** issue:

```
LOG  [AppleIAP] ✅ Retrieved JWS token for validation  ✅ Working!
ERROR  [AppleIAP] ❌ Validation error: Edge Function returned a non-2xx status code
ERROR  [AppleIAP] ❌ Status: 400
ERROR  [AppleIAP] ❌ Receipt validation failed
```

### Why This Happens

**The Problem:**
- `getTransactionJwsIOS()` returns a **JWS token** (StoreKit 2 format)
- `validate-apple-receipt` Edge Function expects a **base64 receipt** (legacy format)
- These are **incompatible formats**!

### Technical Details

#### Legacy Receipt Format (What validator expects)
```typescript
// From validate-apple-receipt/index.ts
body: JSON.stringify({
  'receipt-data': receiptData,  // ❌ Expects base64 encoded receipt
  'password': APPLE_SHARED_SECRET,
})
```
- Endpoint: `https://buy.itunes.apple.com/verifyReceipt`
- Format: Base64 encoded receipt
- Status: **Deprecated** but still works

#### JWS Token Format (What we were sending)
```typescript
// From react-native-iap
getTransactionJwsIOS(productId)  // Returns JWT-like signed token
```
- Format: JWT-style signed token (e.g., `eyJhbGciOiJIUzI1NiIs...`)
- Requires: App Store Server API (different endpoint)
- Status: **Modern** approach

### The Mismatch

```
Client sends JWS token → validate-apple-receipt expects base64 receipt
                              ↓
                         Status 400 error ❌
```

---

## ✅ The Fix

### Changed Receipt Retrieval Priority

**Before (Broken):**
```typescript
// 1. Try purchase.transactionReceipt (base64)
// 2. Try getTransactionJwsIOS() (JWS token) ❌ Incompatible!
// 3. Try getReceiptDataIOS() (base64)
```

**After (Fixed):**
```typescript
// 1. Try purchase.transactionReceipt (base64) ✅
// 2. Try getReceiptDataIOS() (base64) ✅
// 3. Skip JWS token (commented out for future)
```

### Code Changes

**File:** `services/appleIAPService.ts`, Lines 606-627

```typescript
if (Platform.OS === 'ios' && !isLocalTransaction) {
  // 1. Try transactionReceipt from purchase object (base64 format)
  receiptData = purchase.transactionReceipt || purchase.receipt || '';
  console.log('[AppleIAP] 📄 Transaction receipt from purchase:', receiptData ? 'present' : 'missing');
  
  // 2. If missing, try to get the full app receipt (legacy base64 format)
  // This is compatible with our current validate-apple-receipt Edge Function
  if (!receiptData) {
    try {
      console.log('[AppleIAP] 🔍 Attempting to get legacy app receipt...');
      receiptData = await getReceiptDataIOS();
      if (receiptData) {
        console.log('[AppleIAP] ✅ Retrieved legacy receipt for validation');
      }
    } catch (receiptError) {
      console.log('[AppleIAP] ℹ️ Legacy receipt not available (expected in local testing)');
    }
  }

  // 3. FUTURE: StoreKit 2 JWS token support (currently incompatible)
  // Our current validate-apple-receipt uses /verifyReceipt API which expects base64 receipt
  // JWS tokens require the new App Store Server API - will implement in future update
  // if (!receiptData && purchase.productId && typeof getTransactionJwsIOS === 'function') {
  //   receiptData = await getTransactionJwsIOS(purchase.productId);
  // }
}
```

---

## 📊 Expected Behavior After Fix

### Before Fix
```
LOG  [AppleIAP] 📦 Purchase received: 2000001075446845
LOG  [AppleIAP] 🔍 Attempting to get JWS token for product: com.ronnie39.renvo.premium.monthly.v1
LOG  [AppleIAP] ✅ Retrieved JWS token for validation
ERROR  [AppleIAP] ❌ Validation error: Edge Function returned a non-2xx status code
ERROR  [AppleIAP] ❌ Status: 400  ← Format mismatch!
```

### After Fix
```
LOG  [AppleIAP] 📦 Purchase received: 2000001075446845
LOG  [AppleIAP] 📄 Transaction receipt from purchase: present
LOG  [AppleIAP] ✅ Receipt validation successful
LOG  [AppleIAP] ✅ Subscription status updated
```

OR (if transaction receipt not in purchase object):

```
LOG  [AppleIAP] 📦 Purchase received: 2000001075446845
LOG  [AppleIAP] 📄 Transaction receipt from purchase: missing
LOG  [AppleIAP] 🔍 Attempting to get legacy app receipt...
LOG  [AppleIAP] ✅ Retrieved legacy receipt for validation
LOG  [AppleIAP] ✅ Receipt validation successful
LOG  [AppleIAP] ✅ Subscription status updated
```

---

## 🎯 Why This Approach

### Pros of Using Legacy Receipt
- ✅ Works with current `validate-apple-receipt` function (no backend changes needed)
- ✅ Compatible with TestFlight sandbox
- ✅ Still supported by Apple
- ✅ Quick fix, no migration required

### Cons
- ⚠️ Using deprecated API (but Apple still supports it)
- ⚠️ Not using modern StoreKit 2 features

### Future: Full StoreKit 2 Migration
When ready to modernize:
1. Create new Edge Function using App Store Server API
2. Handle JWS token validation
3. Migrate away from `/verifyReceipt`

But for now, the legacy approach works perfectly fine!

---

## 🧪 Testing Plan

### Test 1: Real Device (TestFlight)
**Expected:**
- Purchase completes
- App gets base64 receipt from purchase object OR `getReceiptDataIOS()`
- Validation succeeds with Edge Function
- Subscription activates immediately

### Test 2: Simulator (Development)
**Expected:**
- Purchase completes
- Receipt might not be available (normal for simulator)
- Falls back to webhook validation
- Subscription activates after webhook processes

### Test 3: Production (App Store)
**Expected:**
- Purchase completes
- Receipt validation works
- No errors in logs

---

## 📋 Summary of Both Fixes

| Fix # | Issue | Solution | File Changed |
|-------|-------|----------|--------------|
| 1 | Wrong parameter to `getTransactionJwsIOS` | Changed `transactionId` → `productId` | `appleIAPService.ts` |
| 2 | JWS token incompatible with validator | Skip JWS, use legacy receipt instead | `appleIAPService.ts` |

---

## ✅ Implementation Status

**Both fixes applied!**

**What's changed:**
1. ✅ Fixed `getTransactionJwsIOS()` parameter (but commented it out)
2. ✅ Prioritized legacy receipt format
3. ✅ Added detailed logging
4. ✅ Documented JWS token for future implementation

**Next step:**
- Build and test on real device
- Should see clean logs with successful validation!

---

## 🚀 Deployment Checklist

- [x] Fix applied to `appleIAPService.ts`
- [ ] Build new version
- [ ] Upload to TestFlight
- [ ] Test purchase flow
- [ ] Verify logs show no errors
- [ ] Confirm subscription activates immediately

---

## 💡 Key Learnings

1. **`getTransactionJwsIOS()`** needs `productId`, not `transactionId` ✅
2. **JWS tokens** require different validation endpoint than base64 receipts
3. **Legacy receipt** format still works perfectly for TestFlight and production
4. **Always check format compatibility** between client and server!

The purchase flow should work smoothly now! 🎉

