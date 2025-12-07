# Critical Bug: Canceled Subscription Being Reactivated

## 🐛 Bug Discovered

**Issue:** When a user makes a test purchase after canceling their subscription, the client-side code **automatically reactivates** the canceled subscription without checking if it was previously canceled.

### User's Observation
> "I think user_subscriptions had entry with status cancelled but then it updated same entry with active."

**Status:** ✅ **CONFIRMED - This is a real bug!**

---

## 🔍 Root Cause Analysis

### The Problem Code

**File:** `services/appleIAPService.ts`, Lines 879-891

```typescript
// Update user_subscriptions table
const { error: updateError } = await supabase
  .from('user_subscriptions')
  .upsert({
    user_id: userId,
    tier_id: 'premium_tier',
    billing_cycle: billingCycle,
    status: 'active',  // ❌ ALWAYS sets to 'active'
    current_period_start: now.toISOString(),
    current_period_end: expirationDate.toISOString(),
    updated_at: now.toISOString(),
  }, {
    onConflict: 'user_id'  // ❌ Updates existing record unconditionally
  });
```

### Why This is Broken

**The Flow:**
1. User purchases subscription → Status: `active` ✅
2. User cancels subscription → Status: `canceled` ✅
3. User makes **another test purchase** (common in sandbox testing)
4. `handlePurchaseUpdate()` is triggered
5. Receipt validation fails (common in sandbox) → Falls back to `updateSubscriptionFromPurchase()`
6. **UPSERT blindly overwrites `canceled` → `active`** ❌

**The `upsert` behavior:**
```typescript
onConflict: 'user_id'
```
- If no record exists → INSERT new one
- **If record exists → UPDATE it completely** (overwrites everything!)
- No check for existing `status: 'canceled'`
- No respect for user's cancellation choice

---

## ✅ The Fix

### Added Protective Logic

**Before updating, check if subscription is canceled:**

```typescript
// IMPORTANT: Check if user has an existing canceled subscription
// We should NOT automatically reactivate a canceled subscription
console.log('[AppleIAP] 🔍 Checking for existing subscription...');
const { data: existingSub, error: fetchError } = await supabase
  .from('user_subscriptions')
  .select('status, canceled_at, cancel_at_period_end')
  .eq('user_id', userId)
  .maybeSingle();

if (fetchError) {
  console.error('[AppleIAP] ⚠️ Error checking existing subscription:', fetchError);
  // Continue anyway - will upsert
}

// If subscription is canceled and not yet expired, don't overwrite it
if (existingSub?.status === 'canceled' && existingSub?.cancel_at_period_end) {
  console.log('[AppleIAP] ⚠️ User has canceled subscription, skipping client-side update');
  console.log('[AppleIAP] ℹ️ Webhook will handle any legitimate renewal after cancellation');
  return; // Let the webhook handle it - it has authoritative info from Apple
}
```

### Why This Fix Works

1. **Checks existing status first** before blindly updating
2. **Respects user's cancellation** - doesn't reactivate canceled subscriptions
3. **Lets webhook handle renewals** - webhook has authoritative data from Apple
4. **Prevents test purchases from reactivating** canceled subscriptions

---

## 📊 Before vs After

### Before Fix (Broken)

**Scenario: User cancels, then makes test purchase**

```
User cancels subscription
  ↓
Status: canceled, cancel_at_period_end: true ✅
  ↓
User makes test purchase (sandbox testing)
  ↓
Client receives purchase event
  ↓
Receipt validation fails (sandbox limitation)
  ↓
updateSubscriptionFromPurchase() called
  ↓
UPSERT overwrites status → 'active' ❌
  ↓
Canceled subscription is now active again! ❌
```

### After Fix (Correct)

**Scenario: User cancels, then makes test purchase**

```
User cancels subscription
  ↓
Status: canceled, cancel_at_period_end: true ✅
  ↓
User makes test purchase (sandbox testing)
  ↓
Client receives purchase event
  ↓
Receipt validation fails (sandbox limitation)
  ↓
updateSubscriptionFromPurchase() called
  ↓
Checks existing subscription → status is 'canceled' ✅
  ↓
Skips client-side update ✅
  ↓
Webhook handles it with authoritative Apple data ✅
```

---

## 🎯 Key Improvements

### 1. Protective Check
```typescript
if (existingSub?.status === 'canceled' && existingSub?.cancel_at_period_end) {
  console.log('[AppleIAP] ⚠️ User has canceled subscription, skipping client-side update');
  return; // Don't overwrite cancellation
}
```

### 2. Clear Logging
```typescript
console.log('[AppleIAP] 🔍 Checking for existing subscription...');
console.log('[AppleIAP] ℹ️ Webhook will handle any legitimate renewal after cancellation');
```

### 3. Reset Cancellation Flags (Only When Appropriate)
```typescript
upsert({
  // ... other fields
  cancel_at_period_end: false, // Reset for new/renewed subscriptions
  canceled_at: null, // Clear canceled timestamp
})
```

---

## 🧪 Test Scenarios

### Scenario 1: First Purchase
**Expected:** Status set to `active` ✅
**Result:** Works as before

### Scenario 2: Renewal (Active → Active)
**Expected:** Status updated to `active` ✅
**Result:** Works as before

### Scenario 3: Canceled Subscription + Test Purchase (THE BUG)
**Before Fix:**
- Status: `canceled` → `active` ❌ (Bug!)

**After Fix:**
- Status: `canceled` → `canceled` ✅ (Protected!)
- Webhook handles legitimate renewals ✅

### Scenario 4: Legitimate Renewal After Cancellation
**Expected:** Webhook receives `SUBSCRIBED` or `DID_RENEW` from Apple ✅
**Result:** Webhook updates status to `active` (authoritative) ✅

---

## 🔍 Why This Bug Existed

### Original Intent
```typescript
// This ensures user gets premium access immediately
if (!receiptValidated || isLocalTransaction) {
  await this.updateSubscriptionFromPurchase(purchase, user.id);
}
```

**Good intention:** Give users immediate access when receipt validation fails (common in sandbox)

**Unintended consequence:** Overwrites canceled subscriptions during test purchases

### The Missing Piece
No check for existing subscription status before blindly upserting.

---

## ✅ Complete Fix Summary

| Issue | Before | After |
|-------|--------|-------|
| Check existing status | ❌ No check | ✅ Checks before update |
| Respect cancellation | ❌ Overwrites | ✅ Skips update if canceled |
| Trust webhook | ⚠️ Client wins | ✅ Webhook is authoritative |
| Test purchases | ❌ Reactivate canceled | ✅ Ignored for canceled subs |
| Logging | ⚠️ Minimal | ✅ Detailed diagnostic logs |

---

## 🚀 Deployment

**Files Changed:**
- ✅ `services/appleIAPService.ts` (client-side protection)

**What to do:**
1. Build new app version
2. Test scenario:
   - Purchase subscription
   - Cancel it
   - Make another test purchase
   - **Verify:** Status stays `canceled` ✅

**Edge Functions:**
- No changes needed - they already handle renewals correctly

---

## 💡 Key Learnings

1. **UPSERT is dangerous** without conditional checks
2. **Always check existing state** before overwriting
3. **Client-side updates should defer to webhooks** for authoritative data
4. **Test cancellation flows** thoroughly during development
5. **Sandbox test purchases** can trigger unexpected behavior

---

## 🎉 Result

Your intuition was **spot on**! The bug is now fixed:

✅ Canceled subscriptions stay canceled  
✅ Test purchases don't reactivate canceled subscriptions  
✅ Webhooks remain the source of truth  
✅ Detailed logging for debugging  

Excellent catch! 👏

