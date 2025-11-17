# Paywall Setup Guide - Smart Subscription Tracker

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2025-11-16
- **Status**: Production Ready

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Stripe Configuration](#stripe-configuration)
4. [Supabase Configuration](#supabase-configuration)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [App Configuration](#app-configuration)
7. [iOS Setup](#ios-setup)
8. [Android Setup](#android-setup)
9. [Testing the Setup](#testing-the-setup)
10. [Production Deployment](#production-deployment)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] Expo CLI installed (`npm install -g expo-cli`)
- [ ] Git installed and configured
- [ ] Code editor (VS Code recommended)
- [ ] Stripe account (free test mode)
- [ ] Supabase account (free tier available)
- [ ] iOS Simulator (Mac only) or Android Studio
- [ ] Basic knowledge of React Native, TypeScript, and SQL

### System Requirements

**macOS**:
- macOS 12.0 or later
- Xcode 14+ (for iOS development)
- CocoaPods installed

**Windows/Linux**:
- Android Studio with SDK
- Java Development Kit (JDK) 11+

---

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd smart-subscription-tracker
```

### 2. Install Dependencies

```bash
# Install npm packages
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..
```

### 3. Create Environment Variables File

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Stripe Configuration (Test Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key-here

# Environment
NODE_ENV=development
```

**Important**: Never commit `.env` to version control. It's already in `.gitignore`.

---

## Stripe Configuration

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Click "Sign up"
3. Complete registration
4. Activate your account

### Step 2: Enable Test Mode

1. In Stripe Dashboard, toggle **Test Mode** (top-right)
2. All setup will be done in Test Mode first

### Step 3: Create Products and Prices

#### Option A: Using Stripe Dashboard (Recommended)

**Create Premium Product**:
1. Navigate to: Products → "+ Add Product"
2. Fill in details:
   - **Name**: Premium Subscription
   - **Description**: Unlimited subscription tracking with advanced features
   - **Pricing Model**: Recurring
   
**Create Monthly Price**:
1. Click "Add another price"
2. Configure:
   - **Price**: $4.99
   - **Billing Period**: Monthly
   - **Currency**: USD
3. Save and copy the **Price ID** (starts with `price_`)

**Create Annual Price**:
1. Click "Add another price"
2. Configure:
   - **Price**: $39.00
   - **Billing Period**: Yearly
   - **Currency**: USD
3. Save and copy the **Price ID**

#### Option B: Using Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Create product
stripe products create \
  --name="Premium Subscription" \
  --description="Unlimited subscription tracking"

# Create monthly price
stripe prices create \
  --product=<PRODUCT_ID> \
  --unit-amount=499 \
  --currency=usd \
  --recurring[interval]=month

# Create annual price
stripe prices create \
  --product=<PRODUCT_ID> \
  --unit-amount=3900 \
  --currency=usd \
  --recurring[interval]=year
```

### Step 4: Get API Keys

1. Navigate to: Developers → API Keys
2. Copy your keys:
   - **Publishable Key**: `pk_test_...` → Add to `.env`
   - **Secret Key**: `sk_test_...` → Keep secure, needed for Edge Functions

### Step 5: Configure Webhook Endpoint

**For Development (Using Stripe CLI)**:
```bash
# Forward webhooks to local Edge Function
stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook

# Copy the webhook signing secret (whsec_...)
# Add to Edge Function environment
```

**For Production**:
1. Navigate to: Developers → Webhooks
2. Click "+ Add endpoint"
3. Configure:
   - **Endpoint URL**: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - **Events to send**: Select these events:
     - `customer.created`
     - `customer.updated`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `charge.refunded`
4. Save and copy the **Signing Secret** (starts with `whsec_`)

### Step 6: Configure Billing Portal (Optional but Recommended)

1. Navigate to: Settings → Billing → Customer Portal
2. Enable the portal
3. Configure:
   - Allow customers to update payment methods
   - Allow customers to view billing history
   - Allow customers to cancel subscriptions
4. Set cancellation behavior:
   - Cancel at end of billing period (recommended)
5. Save configuration

---

## Supabase Configuration

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new project:
   - **Name**: smart-subscription-tracker
   - **Database Password**: (save securely)
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is sufficient for development

### Step 2: Get Project Credentials

1. Navigate to: Settings → API
2. Copy these values:
   - **Project URL**: Add to `.env` as `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public**: Add to `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role**: Keep secure, needed for Edge Functions

### Step 3: Run Database Migration

1. Navigate to: SQL Editor
2. Click "New Query"
3. Copy the entire contents of `database/paywall_migration.sql`
4. Paste into the SQL editor
5. Click "Run"
6. Wait for completion (should see success message)

**Verify Migration**:
```sql
-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'subscription_tiers',
    'user_subscriptions',
    'payment_transactions',
    'refund_requests',
    'stripe_webhooks',
    'usage_tracking_events'
  );

-- Should return 6 rows
```

### Step 4: Verify RLS Policies

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename LIKE '%subscription%';

-- All should have rowsecurity = true
```

### Step 5: Test Database Functions

```sql
-- Test: Get free tier limit
SELECT get_user_subscription_limit(auth.uid());
-- Expected: 5

-- Test: Check if can add subscription
SELECT * FROM can_user_add_subscription(auth.uid());
-- Expected: Returns limit info
```

### Step 6: Configure CORS for Webhooks

1. Navigate to: Settings → API Settings
2. Scroll to "Additional Configurations"
3. Add to CORS allowed origins:
   ```
   https://api.stripe.com
   ```

---

## Edge Functions Deployment

### Step 1: Install Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (using Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or use npm
npm install -g supabase
```

### Step 2: Link to Your Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Find project ref in: Settings → General → Reference ID
```

### Step 3: Set Edge Function Secrets

```bash
# Set Stripe secret key
supabase secrets set STRIPE_SECRET_KEY=sk_test_your-secret-key

# Set Stripe webhook secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Set Supabase service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Verify secrets are set
supabase secrets list
```

### Step 4: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy stripe-webhook
supabase functions deploy create-subscription
supabase functions deploy cancel-subscription
supabase functions deploy request-refund
supabase functions deploy get-billing-portal

# Or deploy all at once
supabase functions deploy
```

### Step 5: Verify Deployment

```bash
# List deployed functions
supabase functions list

# Test a function
curl -i --location --request POST \
  'https://your-project.supabase.co/functions/v1/stripe-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"test": true}'

# Should return 200 or appropriate error
```

### Step 6: Monitor Function Logs

```bash
# View real-time logs
supabase functions logs stripe-webhook --tail

# View logs for specific function
supabase functions logs create-subscription --limit 50
```

---

## App Configuration

### Step 1: Update Stripe Configuration

Edit `config/stripe.ts`:

```typescript
// Update with your actual price IDs from Stripe
export const STRIPE_CONFIG = {
  publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  prices: {
    monthly: 'price_YOUR_MONTHLY_PRICE_ID', // Update this
    annual: 'price_YOUR_ANNUAL_PRICE_ID',   // Update this
  },
};
```

### Step 2: Verify Supabase Configuration

Check `config/supabase.ts`:

```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Should use environment variables correctly
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 3: Initialize Stripe in App

Verify `App.tsx` has Stripe provider:

```typescript
import { StripeProvider } from '@stripe/stripe-react-native';

export default function App() {
  return (
    <StripeProvider publishableKey={STRIPE_CONFIG.publishableKey}>
      {/* Rest of app */}
    </StripeProvider>
  );
}
```

---

## iOS Setup

### Step 1: Install Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 2: Configure Info.plist

Add to `ios/YourApp/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access for card scanning</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need photo library access for receipts</string>
```

### Step 3: Enable Stripe Payment Methods

No additional configuration needed for basic card payments. For Apple Pay (optional):

1. Enable Apple Pay in your Apple Developer account
2. Create merchant identifier
3. Add to Xcode capabilities
4. Configure in Stripe Dashboard

### Step 4: Build and Run

```bash
# Using Expo
npx expo run:ios

# Or using Xcode
# Open ios/YourApp.xcworkspace in Xcode
# Select simulator or device
# Click Run (⌘R)
```

---

## Android Setup

### Step 1: Configure build.gradle

Verify `android/app/build.gradle` has:

```gradle
dependencies {
    // Stripe should already be in package.json
    implementation project(':stripe-react-native')
}
```

### Step 2: Configure AndroidManifest.xml

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### Step 3: Build and Run

```bash
# Using Expo
npx expo run:android

# Or using Android Studio
# Open android folder in Android Studio
# Select emulator or device
# Click Run
```

---

## Testing the Setup

### Quick Verification Test

```bash
# Run the verification script
npm run verify-setup

# Or manually:
npx ts-node scripts/verify-paywall-setup.ts
```

### Manual Testing Steps

1. **Start the App**:
   ```bash
   npm start
   ```

2. **Create Test User**:
   - Email: `test@example.com`
   - Password: `TestPassword123!`

3. **Add 5 Subscriptions**:
   - Should work without issues
   - No paywall shown

4. **Try to Add 6th Subscription**:
   - ✅ Paywall should appear
   - ✅ Shows "5 of 5 subscriptions used"

5. **Test Payment Flow**:
   - Select Premium Monthly
   - Use test card: `4242 4242 4242 4242`
   - Complete payment
   - ✅ Should upgrade to Premium

6. **Verify Database**:
   ```sql
   SELECT * FROM user_subscriptions 
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
   
   -- Should show tier_id = 'premium'
   ```

### Expected Results

| Test | Expected Result | Status |
|------|----------------|--------|
| App starts | No errors, loads home screen | ✅ |
| Create account | User created, free tier assigned | ✅ |
| Add subscriptions | Can add up to 5 | ✅ |
| Hit limit | Paywall appears | ✅ |
| Select plan | Payment sheet opens | ✅ |
| Enter card | Card accepted | ✅ |
| Complete payment | Upgraded to Premium | ✅ |
| Add more subs | Unlimited, no paywall | ✅ |

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migrations run in staging
- [ ] Edge Functions tested in staging
- [ ] Stripe test mode payments work
- [ ] Webhooks processing correctly
- [ ] No console errors or warnings
- [ ] Performance acceptable
- [ ] Security audit completed

### Stripe Production Setup

1. **Switch to Live Mode**:
   - Toggle off "Test Mode" in Stripe Dashboard
   
2. **Recreate Products**:
   - Create same products in Live mode
   - Create same prices
   - Copy new Live mode Price IDs

3. **Update Live API Keys**:
   ```env
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

4. **Configure Live Webhook**:
   - Create new webhook endpoint for production URL
   - Select same events as test mode
   - Copy Live webhook secret
   - Update Edge Function secrets

5. **Enable Radar** (Fraud Prevention):
   - Navigate to: Radar
   - Review rules
   - Enable recommended protections

### Supabase Production Setup

1. **Create Production Project**:
   - Separate project for production
   - Choose production-grade plan if needed
   - Select appropriate region

2. **Run Migrations**:
   - Run `paywall_migration.sql` in production
   - Verify all tables and functions created

3. **Deploy Edge Functions**:
   ```bash
   # Link to production project
   supabase link --project-ref prod-project-ref
   
   # Set production secrets
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...
   
   # Deploy functions
   supabase functions deploy
   ```

4. **Configure Backups**:
   - Enable Point-in-Time Recovery
   - Set backup retention period
   - Test restore procedure

### App Production Build

**iOS**:
```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

**Android**:
```bash
# Build for Google Play
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

### Post-Deployment Verification

1. **Test Live Payment**:
   - Use real credit card (will be charged)
   - Complete full purchase flow
   - Verify in Stripe Dashboard
   - Request refund to test that flow

2. **Monitor Webhooks**:
   - Watch for incoming webhook events
   - Verify all process successfully
   - Check for any failures

3. **Database Health**:
   ```sql
   -- Check for errors
   SELECT * FROM stripe_webhooks 
   WHERE processing_status = 'failed' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

4. **User Flow Testing**:
   - Create real account
   - Test full user journey
   - Verify analytics tracking
   - Test subscription management

---

## Environment Variables Reference

### Development
```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...dev-key

# Stripe (Test Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Edge Functions (Server-side only)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...service-role-key
```

### Staging
```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...staging-key

# Stripe (Test Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Edge Functions
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...service-role-key
```

### Production
```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...prod-key

# Stripe (Live Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Edge Functions
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...service-role-key
```

---

## Troubleshooting Setup Issues

### Issue: "Supabase client not initialized"

**Solution**:
```typescript
// Verify in config/supabase.ts
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('Has Anon Key:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
```

### Issue: "Stripe provider not found"

**Solution**:
```typescript
// Verify App.tsx wraps app with StripeProvider
<StripeProvider publishableKey={STRIPE_CONFIG.publishableKey}>
  <NavigationContainer>
    {/* App content */}
  </NavigationContainer>
</StripeProvider>
```

### Issue: Edge Functions return 401/403

**Solution**:
- Verify secrets are set: `supabase secrets list`
- Check anon key is correct
- Verify RLS policies allow access

### Issue: Webhooks not processing

**Solution**:
1. Check webhook endpoint URL is correct
2. Verify webhook secret matches
3. Check Edge Function logs: `supabase functions logs stripe-webhook`
4. Test webhook signature verification

---

## Next Steps

After setup is complete:

1. ✅ Run integration tests (see [`INTEGRATION_TESTING_GUIDE.md`](INTEGRATION_TESTING_GUIDE.md))
2. ✅ Configure monitoring (see [`MONITORING_SETUP.md`](MONITORING_SETUP.md))
3. ✅ Review security checklist
4. ✅ Set up error tracking (Sentry recommended)
5. ✅ Configure analytics
6. ✅ Plan deployment strategy

---

## Support and Resources

### Documentation
- [Stripe API Docs](https://stripe.com/docs/api)
- [Supabase Docs](https://supabase.com/docs)
- [React Native Stripe SDK](https://stripe.dev/stripe-react-native)
- [Expo Documentation](https://docs.expo.dev)

### Community
- [Stripe Discord](https://discord.gg/stripe)
- [Supabase Discord](https://discord.supabase.com)
- [Expo Discord](https://chat.expo.dev)

### Getting Help
1. Check [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
2. Review [`FAQ.md`](PAYWALL_FAQ.md)
3. Search GitHub issues
4. Ask in community Discord servers
5. Contact support (Stripe/Supabase)

---

**End of Paywall Setup Guide**