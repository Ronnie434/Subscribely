# Sandbox Account Setup for TestFlight IAP Testing

## Modern iOS (iOS 12+) - NO Need to Sign Out

**Good News:** You do NOT need to sign out of your primary Apple ID to test in-app purchases!

---

## Setup Process

### Step 1: Create Sandbox Test Account

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Click **Users and Access** (top navigation)
3. Click **Sandbox** tab (below "Testers")
4. Click the **+** button
5. Fill in:
   ```
   First Name: Test
   Last Name: User
   Email: Use a unique email that's NOT a real Apple ID
          Example: test.renvo@example.com
          Or use Gmail alias: youremail+renvotest@gmail.com
   Password: Create a password
   Country/Region: United States (or your region)
   ```
6. Click **Invite**

**Important:** 
- Do NOT use an email that's already an Apple ID
- Gmail aliases work: `youremail+test1@gmail.com`, `youremail+test2@gmail.com`
- You don't need to verify the email

---

## Setup on Device (Two Methods)

### Method 1: Developer Mode (iOS 15+, Recommended)

**For iOS 15 and later with Developer Mode:**

1. **Enable Developer Mode** (if not already enabled):
   - Settings → Privacy & Security
   - Scroll down → **Developer Mode** → Enable
   - Restart device when prompted

2. **Sign in to Sandbox Account**:
   - Settings → scroll down → **Developer**
   - Scroll to bottom → **Sandbox** section
   - Tap **Sandbox Apple Account**
   - Sign in with your test account from Step 1

3. **Test**:
   - Open your TestFlight app
   - Try to purchase
   - Should work with Sandbox account

### Method 2: Automatic Prompt (All iOS Versions)

**Easiest method - works on all iOS versions:**

1. **Do NOT sign in to Sandbox beforehand**
2. Keep your regular Apple ID signed in (this is fine!)
3. Open your TestFlight app
4. Try to make a purchase
5. **Apple will automatically detect** it's a TestFlight app
6. A dialog will appear asking for Sandbox account login
7. Enter your sandbox test account credentials
8. Purchase proceeds in Sandbox mode

**After first purchase:**
- Settings → App Store → **Sandbox Account** section will appear
- You'll see your sandbox account email there
- You can sign out or change sandbox accounts from there

---

## Why You DON'T Need to Sign Out

**Old Way (iOS 11 and earlier):**
- Required signing out of primary Apple ID
- Inconvenient and risky

**New Way (iOS 12+):**
- Apple separates production and sandbox environments
- Your primary Apple ID is for: iCloud, App Store downloads, etc.
- Sandbox account is ONLY for: Testing IAP in development/TestFlight apps
- They don't conflict!

**Benefits:**
- Keep your iCloud, iMessage, FaceTime active
- Keep your production App Store access
- Test IAP without disruption
- Switch sandbox accounts easily

---

## Sandbox Account in Settings

### Where to Find It:

**iOS 14+:**
```
Settings → App Store → [Scroll to bottom] → SANDBOX ACCOUNT
```

**iOS 15+ with Developer Mode:**
```
Settings → Developer → [Scroll to bottom] → Sandbox Apple Account
```

**Note:** The "Sandbox Account" section only appears AFTER:
1. You've made your first sandbox purchase attempt, OR
2. You've manually signed in via Developer settings

---

## Testing in TestFlight - Step by Step

### 1. First Time Setup:

```bash
# On Computer:
1. Create sandbox tester in App Store Connect
2. Build app and upload to TestFlight
3. Verify products exist in App Store Connect

# On Device:
1. Install app from TestFlight
2. Open app
3. Try to make a purchase
4. When prompted, sign in with sandbox account
```

### 2. Subsequent Tests:

```bash
# Stay signed in with sandbox account
1. Open TestFlight app
2. Make purchase
3. Should work immediately with sandbox account
```

### 3. Switch Sandbox Accounts:

```bash
Settings → App Store → Sandbox Account → Sign Out
Then make a purchase and sign in with different sandbox account
```

---

## Common Issues

### Issue 1: "Cannot connect to iTunes Store"
**Cause:** Not signed in with sandbox account
**Fix:** Make a purchase, sign in when prompted

### Issue 2: Products not loading
**Cause:** Products not in App Store Connect or wrong status
**Fix:** 
1. Check App Store Connect → Features → In-App Purchases
2. Verify products exist and are "Ready to Submit"
3. Verify Bundle ID matches product IDs

### Issue 3: "This Apple ID has not been set up for sandbox testing"
**Cause:** Trying to use real Apple ID instead of sandbox
**Fix:** Sign out from sandbox section, make purchase, use correct sandbox email

### Issue 4: Sandbox account keeps asking for password
**Cause:** Normal Apple behavior for security
**Fix:** Enter password each time (this is expected)

---

## Your App Configuration

**Bundle ID:** `com.ronnie39.renvo`

**Required Products in App Store Connect:**
1. `com.ronnie39.renvo.premium.monthly.v1` - $4.99/month
2. `com.ronnie39.renvo.premium.yearly.v1` - $39.99/year

**Subscription Group:** `premium_subscriptions`

---

## Testing Checklist

Before testing in TestFlight:

- [ ] Sandbox test account created in App Store Connect
- [ ] Products created in App Store Connect with correct IDs
- [ ] Products are "Ready to Submit" status
- [ ] Paid Applications Agreement signed
- [ ] Banking/Tax info completed
- [ ] TestFlight build uploaded and ready
- [ ] Device has internet connection
- [ ] (Optional) Signed in to Sandbox account in Settings

During testing:
- [ ] Open TestFlight app
- [ ] Navigate to purchase screen
- [ ] Products should load (show prices)
- [ ] Click purchase button
- [ ] Apple dialog appears with [Sandbox] label
- [ ] Sign in with sandbox account when prompted
- [ ] Complete "purchase" (no real charge)
- [ ] Verify UI updates to show premium status

---

## Why TestFlight Uses Sandbox

**TestFlight apps ALWAYS use Sandbox environment automatically:**
- No real money is charged
- No real subscriptions are created
- Apple automatically routes to sandbox servers
- You see "[Sandbox]" label in purchase dialogs

**Production apps use Production environment:**
- Real money is charged
- Real subscriptions are created
- Only after App Store approval and public release

This is why sandbox test accounts are required for TestFlight - the system won't accept real Apple IDs for test purchases.

---

## Still Having Issues?

1. **Restart device** after signing in to sandbox account
2. **Delete and reinstall** TestFlight app
3. **Check App Store Connect** status page for outages
4. **Wait 1-2 hours** after creating products (Apple propagation delay)
5. **Try different sandbox account** if one doesn't work

The new diagnostics in the app will show you exactly what's wrong via toast messages!

