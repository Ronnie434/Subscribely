# Billing History Feature - Deployment & Testing Guide

## Overview
This guide covers deploying the fixed billing history feature and the new invoice download Edge Function.

---

## ✅ Changes Implemented

### 1. **BillingHistoryList Component** (`components/BillingHistoryList.tsx`)
- ✅ Fixed import: Changed `formatDate` to `dateHelpers.formatDate`
- ✅ Removed division by 100 (amount already in dollars)
- ✅ Added `paymentService` import
- ✅ Switched to use `paymentService.getPaymentHistory()` instead of direct query
- ✅ Added early return when user is undefined
- ✅ Implemented comprehensive error handling
- ✅ Added per-invoice loading state tracking
- ✅ Updated invoice download with retry logic

### 2. **PaymentService** (`services/paymentService.ts`)
- ✅ Fixed `getPaymentHistory()` query with `!inner` JOIN syntax
- ✅ Added proper user filtering via `user_subscriptions` JOIN
- ✅ Added data transformation to match UI interface
- ✅ Created new `getInvoiceUrl()` method for invoice downloads
- ✅ Improved error messages

### 3. **New Edge Function** (`supabase/functions/get-invoice-url/index.ts`)
- ✅ Created new Supabase Edge Function
- ✅ Fetches invoice URLs from Stripe API on-demand
- ✅ Proper CORS handling
- ✅ Comprehensive error handling

---

## 📦 Deployment Steps

### Step 1: Deploy the Edge Function

```bash
# Navigate to project root
cd /Users/ronakpatel/Documents/Personal_Projects/smart-subscription-tracker

# Login to Supabase CLI (if not already logged in)
supabase login

# Link your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the new Edge Function
supabase functions deploy get-invoice-url

# Verify deployment
supabase functions list
```

### Step 2: Set Environment Variables

Ensure your Supabase project has the Stripe secret key set:

```bash
# Set the Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_live_...

# Verify secrets are set
supabase secrets list
```

### Step 3: Verify RLS Policies

The RLS policies are already correct in the database. Verify they're active:

```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'payment_transactions';

-- Expected result: rowsecurity = true
```

---

## 🧪 Testing Checklist

### Manual Testing

#### Test 1: View Billing History (No Transactions)
1. Sign in as a user with no payment history
2. Navigate to Subscription Management
3. Tap "View Billing History"
4. **Expected**: See "No billing history yet" message

#### Test 2: View Billing History (With Transactions)
1. Sign in as a premium user with payment history
2. Navigate to Subscription Management
3. Tap "View Billing History"
4. **Expected**: 
   - List of transactions loads
   - Amounts display correctly (no division by 100)
   - Dates format correctly
   - Status badges show appropriate colors

#### Test 3: Pull to Refresh
1. While viewing billing history
2. Pull down to refresh
3. **Expected**: Loading indicator, then updated list

#### Test 4: Invoice Download (Success)
1. Find a transaction with "Download Invoice" button
2. Tap the button
3. **Expected**:
   - Loading spinner appears
   - Browser opens with invoice
   - Loading spinner disappears

#### Test 5: Invoice Download (No Invoice)
1. Find a transaction without invoice_id
2. **Expected**: No download button visible

#### Test 6: Invoice Download (Error)
1. Temporarily disconnect internet
2. Try to download invoice
3. **Expected**: Error alert with retry option

#### Test 7: User Security
1. Sign in as User A
2. Note transaction IDs
3. Sign out, sign in as User B
4. **Expected**: User B cannot see User A's transactions

---

## 🔍 Verification Queries

### Check Transaction Data Structure
```sql
SELECT 
  id,
  amount,
  currency,
  status,
  stripe_invoice_id,
  created_at
FROM payment_transactions
LIMIT 5;
```

### Verify User Filtering Works
```sql
-- Run as authenticated user in Supabase Dashboard
SELECT pt.*, us.user_id
FROM payment_transactions pt
INNER JOIN user_subscriptions us ON pt.user_subscription_id = us.id
WHERE us.user_id = auth.uid()
ORDER BY pt.created_at DESC
LIMIT 20;
```

### Check for Data Type Issues
```sql
-- Verify amount is stored as NUMERIC (dollars)
SELECT 
  id,
  amount,
  pg_typeof(amount) as amount_type
FROM payment_transactions
LIMIT 3;
```

---

## 🐛 Troubleshooting

### Issue: "Invoice not found" error
**Cause**: Invoice ID doesn't exist in Stripe
**Solution**: Check if `stripe_invoice_id` is valid in database

### Issue: CORS errors when downloading invoice
**Cause**: Edge Function CORS not configured
**Solution**: Verify CORS headers in Edge Function response

### Issue: No transactions show up
**Cause**: RLS policy filtering out data
**Solution**: 
1. Verify user is authenticated
2. Check `user_subscriptions` table has correct user_id
3. Verify JOIN query syntax

### Issue: Amount shows as $0.05 instead of $4.99
**Cause**: Still dividing by 100
**Solution**: Verify BillingHistoryList line 148 removed division

### Issue: Edge Function timeout
**Cause**: Stripe API slow response
**Solution**: 
1. Check Stripe API status
2. Add timeout handling in Edge Function
3. Implement retry logic

---

## 📊 Monitoring

### Key Metrics to Track

1. **Invoice Download Success Rate**
   - Target: >95%
   - Monitor Edge Function logs

2. **Query Performance**
   - Target: <100ms
   - Monitor Supabase logs for slow queries

3. **Error Rate**
   - Target: <5%
   - Track Alert.alert calls in logs

### Logging

Check Edge Function logs:
```bash
supabase functions logs get-invoice-url
```

Monitor component errors:
```bash
# In your React Native app
console.log('[BillingHistory] metrics');
```

---

## 🚀 Next Steps (Future Enhancements)

1. **Real-Time Updates** (V2)
   - Add Supabase real-time subscription
   - Auto-update when new payments arrive

2. **Pagination** (V2)
   - Implement cursor-based pagination
   - Add "Load More" button

3. **Filtering** (V2)
   - Filter by status
   - Filter by date range
   - Search by amount

4. **Export** (V2)
   - Bulk invoice download
   - Export to CSV
   - Email invoices

---

## 📝 Rollback Plan

If issues occur:

1. **Revert Component Changes**
```bash
git revert <commit-hash>
```

2. **Keep Edge Function but Disable**
```bash
supabase functions delete get-invoice-url
```

3. **Revert to Placeholder Message**
- Component will fallback to showing "Invoice download coming soon"

---

## ✅ Sign-Off Checklist

Before deploying to production:

- [ ] Edge Function deployed successfully
- [ ] Environment variables configured
- [ ] RLS policies verified
- [ ] All manual tests passed
- [ ] No console errors in app
- [ ] Invoice download works
- [ ] User filtering works (security check)
- [ ] Pull-to-refresh works
- [ ] Error handling works
- [ ] Documentation updated

---

## 📞 Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Review React Native console logs
3. Verify database schema matches expectations
4. Check Stripe API status page

**Common Fixes:**
- Clear app cache and restart
- Re-deploy Edge Function
- Verify Stripe credentials
- Check network connectivity