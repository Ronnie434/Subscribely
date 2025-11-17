# Paywall System - Frequently Asked Questions

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [For Developers](#for-developers)
2. [For Users](#for-users)
3. [Business & Pricing](#business--pricing)
4. [Technical Questions](#technical-questions)

---

## For Developers

### Setup and Configuration

**Q: How do I set up the paywall system in a new environment?**

A: Follow these steps:
1. Read [`PAYWALL_SETUP_GUIDE.md`](PAYWALL_SETUP_GUIDE.md)
2. Configure Stripe (test mode first)
3. Run database migration: `database/paywall_migration.sql`
4. Deploy Edge Functions
5. Set environment variables
6. Test with verification script: `npm run verify-setup`

---

**Q: How do I test payments locally?**

A: Use Stripe test mode:
```bash
# 1. Set test publishable key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# 2. Use Stripe CLI to forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# 3. Use test cards
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

---

**Q: How do I trigger webhooks in development?**

A: Three options:

1. **Stripe CLI (Recommended)**:
   ```bash
   stripe trigger payment_intent.succeeded
   stripe trigger customer.subscription.created
   ```

2. **Stripe Dashboard**:
   - Go to event in Dashboard
   - Click "Send test webhook"
   - Select your endpoint

3. **Make actual payment**:
   - Use test card in app
   - Real webhooks will be sent

---

**Q: How do I reset a user's subscription for testing?**

A: Use SQL or the test helper:
```sql
-- Reset to free tier
UPDATE user_subscriptions
SET 
  tier_id = 'free',
  status = 'active',
  billing_cycle = 'none',
  stripe_subscription_id = NULL
WHERE user_id = 'USER_ID';

-- Delete all subscriptions
DELETE FROM subscriptions WHERE user_id = 'USER_ID';
```

Or use the helper:
```typescript
import { paywallTestHelpers } from '../utils/paywallTestHelpers';

await paywallTestHelpers.resetUserToFree(userId);
await paywallTestHelpers.deleteAllSubscriptions(userId);
```

---

**Q: How do I add a new subscription tier?**

A: Add to database and Stripe:

1. **Database**:
   ```sql
   INSERT INTO subscription_tiers (
     tier_id, 
     name, 
     monthly_price, 
     annual_price, 
     subscription_limit,
     features
   ) VALUES (
     'pro',
     'Professional',
     9.99,
     99.00,
     -1,
     '["all_premium_features", "priority_support", "advanced_reporting"]'::jsonb
   );
   ```

2. **Stripe**:
   - Create new product
   - Create prices
   - Add price IDs to `config/stripe.ts`

3. **Update UI**:
   - Add to plan selection screen
   - Update tier badge component

---

**Q: How do I debug webhook issues?**

A: Check these in order:

1. **Edge Function logs**:
   ```bash
   supabase functions logs stripe-webhook --tail
   ```

2. **Database webhook table**:
   ```sql
   SELECT * FROM stripe_webhooks 
   WHERE processing_status = 'failed' 
   ORDER BY created_at DESC;
   ```

3. **Stripe Dashboard**:
   - Developers → Webhooks → [Endpoint]
   - Check recent deliveries
   - Look for error messages

4. **Test webhook manually**:
   ```bash
   curl -X POST \
     https://your-project.supabase.co/functions/v1/stripe-webhook \
     -H "stripe-signature: test" \
     -d @webhook_payload.json
   ```

---

**Q: Can I use this system with a different payment provider?**

A: Yes, but requires significant changes:
- Replace all Stripe SDK calls
- Rewrite Edge Functions for new provider's API
- Update webhook handlers
- Modify payment UI components

The architecture is designed around Stripe, so switching providers would require refactoring most payment-related code.

---

### Database and Backend

**Q: What happens if a webhook is delivered multiple times?**

A: The system handles this with idempotency:
```typescript
// Each webhook event has unique event_id
// Database ensures it's only processed once
const { data: existing } = await supabase
  .from('stripe_webhooks')
  .select('id')
  .eq('event_id', event.id)
  .single();

if (existing) {
  return { status: 'already_processed' };
}
```

Duplicate webhooks are logged but ignored.

---

**Q: How do I handle database migrations in production?**

A: Follow these steps:
1. Test migration in staging first
2. Create database backup
3. Run migration during low-traffic window
4. Verify with test queries
5. Monitor for errors
6. Have rollback plan ready

See [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) for details.

---

**Q: How is data consistency maintained between Stripe and the database?**

A: Multiple mechanisms:
1. **Webhooks**: Primary sync mechanism
2. **Idempotency**: Prevents duplicate processing
3. **Daily reconciliation**: Catches missed webhooks
4. **Stripe as source of truth**: Database updates to match Stripe

---

**Q: What's the refund policy implementation?**

A: 7-day window from payment:
```typescript
const hoursSincePayment = 
  (Date.now() - paymentDate) / (1000 * 60 * 60);

const eligible = hoursSincePayment <= (7 * 24);
```

Refunds processed automatically if eligible:
- Full refund within 7 days
- No partial refunds
- User downgraded to free tier
- All data preserved

---

### Testing

**Q: How do I run integration tests?**

A: Follow the integration testing guide:
```bash
# 1. Set up test environment
npm run setup:test

# 2. Run tests
npm test

# 3. Run specific test suite
npm test -- payment-flow

# 4. Clean up
npm run cleanup:test
```

See [`INTEGRATION_TESTING_GUIDE.md`](INTEGRATION_TESTING_GUIDE.md).

---

**Q: What test cards should I use?**

A: Common Stripe test cards:
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
Expired: 4000 0000 0000 0069
Incorrect CVC: 4000 0000 0000 0127
3D Secure: 4000 0027 6000 3184
```

For all test cards: https://stripe.com/docs/testing

---

**Q: How do I test the complete user journey?**

A: Use this checklist:
1. Create new test user
2. Add 5 subscriptions (at limit)
3. Try to add 6th (paywall appears)
4. Select premium plan
5. Complete payment
6. Verify upgrade
7. Add more subscriptions
8. Test cancellation
9. Request refund

---

## For Users

### Getting Started

**Q: How do I upgrade to Premium?**

A: Three ways to upgrade:
1. **When you hit the limit**: Tap "Upgrade" when paywall appears
2. **From Settings**: Settings → Subscription → Upgrade to Premium
3. **From any screen**: Tap the tier badge → Upgrade

Steps:
1. Select Monthly ($4.99) or Annual ($39.00)
2. Enter payment details
3. Confirm purchase
4. Enjoy unlimited subscriptions!

---

**Q: What payment methods do you accept?**

A: We accept:
- ✅ Credit cards (Visa, Mastercard, American Express, Discover)
- ✅ Debit cards
- ✅ Apple Pay (on iOS)
- ✅ Google Pay (on Android)

We use Stripe for secure payment processing. Your card details are never stored on our servers.

---

**Q: Is my payment information secure?**

A: Yes! We use Stripe, a PCI-DSS Level 1 certified payment processor trusted by millions of businesses worldwide. Your card information:
- Never touches our servers
- Is encrypted in transit and at rest
- Complies with industry security standards
- Is protected by Stripe's advanced fraud detection

---

### Subscription Management

**Q: How do I cancel my Premium subscription?**

A: Easy cancellation:
1. Go to Settings → Subscription
2. Tap "Cancel Subscription"
3. Choose cancellation time:
   - End of current period (recommended)
   - Immediately
4. Confirm cancellation

You'll keep Premium access until your billing period ends.

---

**Q: What happens to my data if I cancel?**

A: Your data is safe:
- ✅ All subscriptions remain visible
- ✅ No data is deleted
- ✅ You can view and edit existing subscriptions
- ✅ Full export available anytime

However, free tier limits apply:
- Can't add new subscriptions if you have >5
- Must delete some to add new ones

---

**Q: Can I get a refund?**

A: Yes, within 7 days:
- **Within 7 days**: Full refund, no questions asked
- **After 7 days**: No refunds (standard policy)

To request a refund:
1. Settings → Subscription → Billing History
2. Select the payment
3. Tap "Request Refund"
4. Provide reason (optional)
5. Submit

Refunds process in 5-7 business days.

---

**Q: Can I switch between Monthly and Annual?**

A: Yes! You can switch anytime:
1. Settings → Subscription
2. Tap "Change Plan"
3. Select new plan
4. Confirm

You'll be charged the prorated difference immediately.

---

**Q: How do I update my payment method?**

A: Update anytime:
1. Settings → Subscription
2. Tap "Update Payment Method"
3. Enter new card details
4. Save

Your next billing will use the new card.

---

**Q: Where can I see my billing history?**

A: View all transactions:
1. Settings → Subscription
2. Tap "Billing History"

You'll see:
- All past payments
- Dates and amounts
- Payment methods used
- Receipts (tap to view/download)

---

### Features and Limits

**Q: What's included in the Free tier?**

A: Free tier includes:
- ✅ Track up to 5 subscriptions
- ✅ Cloud sync across devices
- ✅ Renewal reminders
- ✅ Basic statistics
- ✅ Manual tracking
- ✅ Category organization

---

**Q: What extra features does Premium offer?**

A: Premium adds:
- ✅ **Unlimited subscriptions**
- ✅ All Free features
- ✅ Priority support (coming soon)
- ✅ Advanced analytics (coming soon)
- ✅ No ads (future)
- ✅ Early access to new features

---

**Q: What happens when I reach the 5-subscription limit?**

A: You'll see an upgrade prompt:
- You can still view and manage existing subscriptions
- You cannot add new subscriptions
- A paywall appears with upgrade options
- Your existing data is safe

---

**Q: Can I have more than 5 subscriptions on the free tier?**

A: Not directly, but:
- If you had Premium and downgraded with >5 subscriptions, you keep them all
- You can view, edit, and delete them
- You must get down to 4 or fewer to add new ones
- Or upgrade to Premium for unlimited

---

### Billing and Payments

**Q: When will I be charged?**

A: Billing timing:
- **First charge**: Immediately when you upgrade
- **Monthly**: Same day each month
- **Annual**: Same day each year
- **Cancellation**: No charge after current period ends

---

**Q: Will I get a receipt?**

A: Yes! Receipts are:
- ✅ Emailed immediately after each payment
- ✅ Available in Billing History
- ✅ Downloadable as PDF
- ✅ Include all transaction details

---

**Q: What if my payment fails?**

A: We'll notify you:
1. Email notification of failure
2. 3-day grace period to update payment
3. Reminders on days 1, 2, and 3
4. After 3 days: Downgrade to Free

Your data is never deleted.

---

**Q: Can I get an invoice for my company?**

A: Yes! For business use:
1. Settings → Subscription → Billing History
2. Tap any payment
3. Tap "Download Invoice"

Invoices include:
- Transaction ID
- Date and amount
- Tax information (if applicable)
- Company details (if provided)

---

**Q: Do you offer discounts?**

A: Currently:
- Annual plan saves $19.88/year (33% off)
- No promotional codes yet
- Student/nonprofit discounts coming soon
- Volume discounts for teams (future)

---

### Troubleshooting

**Q: I paid but I'm still on Free tier. What do I do?**

A: Try these steps:
1. Force close and reopen the app
2. Check Settings → Subscription for status
3. Look for confirmation email
4. Wait 5 minutes for processing
5. If still an issue, contact support with:
   - Your email
   - Payment confirmation/receipt
   - Screenshot of tier status

---

**Q: My payment failed but I was charged. Help!**

A: Don't worry:
1. Check your bank statement (might be pending)
2. Failed payments are automatically refunded by Stripe
3. Refunds take 5-7 business days
4. If charge doesn't reverse, contact support

---

**Q: I can't cancel my subscription. What's wrong?**

A: Common issues:
1. Check internet connection
2. Update app to latest version
3. Try logging out and back in
4. Contact support if persists

Alternative: Use Stripe billing portal:
- Settings → Subscription → "Manage in Stripe"

---

**Q: How do I contact support?**

A: Multiple ways:
- **In-app**: Settings → Help & Support
- **Email**: support@yourapp.com
- **Twitter**: @yourapp
- **Response time**: Within 24 hours (Premium: faster)

---

## Business & Pricing

**Q: Why $4.99/month?**

A: Our pricing strategy:
- Covers server costs
- Funds development
- Competitive with similar apps
- Affordable for most users
- Annual option saves 33%

---

**Q: Will prices increase?**

A: Price protection:
- Your rate is locked in when you subscribe
- Existing subscribers grandfathered at current price
- New subscribers may see different pricing
- We'll notify 30 days before any changes

---

**Q: Do you offer a free trial?**

A: Not currently, but:
- Free tier is generous (5 subscriptions)
- 7-day refund policy = risk-free trial
- Can test all core features free
- Premium trial may come in future

---

**Q: Is there a lifetime license option?**

A: Not yet:
- Subscription model supports ongoing development
- Ensures regular updates and improvements
- Keeps app servers running
- May offer lifetime option in future

---

**Q: Do you offer family/team plans?**

A: Coming soon:
- Each account currently independent
- Family sharing being developed
- Business plans in roadmap
- Stay tuned for announcements

---

## Technical Questions

**Q: Is my data synced across devices?**

A: Yes! Features:
- ✅ Real-time cloud sync
- ✅ Works on all your devices
- ✅ Automatic backup
- ✅ Conflict resolution
- ✅ Offline mode (syncs when online)

---

**Q: What happens if I'm offline?**

A: Offline mode:
- ✅ View all subscriptions
- ✅ Edit existing subscriptions
- ✅ Changes sync when back online
- ❌ Cannot upgrade/downgrade
- ❌ Cannot process payments

---

**Q: Can I export my data?**

A: Yes! Export options:
1. Settings → Data → Export
2. Choose format:
   - CSV (Excel/Sheets)
   - JSON (raw data)
   - PDF (report)
3. Download to device
4. Share via email/cloud

---

**Q: Is there an API?**

A: Not yet:
- Public API in development
- Will allow integrations
- Webhook notifications
- Beta coming 2025

---

**Q: Which platforms do you support?**

A: Currently:
- ✅ iOS (iPhone/iPad)
- ✅ Android (phone/tablet)
- 🔜 Web app (coming soon)
- 🔜 macOS/Windows (future)

---

**Q: What permissions does the app need?**

A: Required:
- Internet: For sync and payments
- Notifications: For renewal reminders

Optional:
- Camera: For card scanning
- Contacts: Never requested

We respect your privacy. See Privacy Policy for details.

---

## Still Have Questions?

Can't find your answer? Contact us:

- **Email**: support@yourapp.com
- **In-App**: Settings → Help & Support
- **Twitter**: @yourapp
- **Website**: https://yourapp.com/help

We typically respond within 24 hours.

---

**End of FAQ**