# External Configuration Checklist - Subscribely → Renvo Rename

## 📋 Overview

This checklist covers all external services and configurations that need to be updated following the app rename from "Subscribely" to "Renvo". All code changes within the repository have been completed in Phases 1-6. This document focuses exclusively on external configurations.

**Project Status:** Pre-launch (TestFlight/Internal Testing)  
**Stripe Status:** Testing environment  
**Production Users:** None  
**Risk Level:** Low (pre-production rename)

---

## 📊 Summary

| Priority | Count | Estimated Time |
|----------|-------|----------------|
| 🔴 Critical | 3 items | 2-4 hours |
| 🟡 Important | 5 items | 3-5 hours |
| 🟢 Optional | 6 items | 2-3 hours |
| **Total** | **14 items** | **7-12 hours** |

---

## 🔴 CRITICAL - Must Complete Before Production Launch

These configurations are directly impacted by code changes and must be updated before the app goes live to production users.

### 1. Supabase Auth - Deep Link Redirect URLs

**Priority:** 🔴 Critical  
**Time Estimate:** 30-45 minutes  
**Impact:** Password reset and email verification flows will break without this update

#### What Changed
- Code change in [`contexts/AuthContext.tsx:765`](contexts/AuthContext.tsx:765)
- Old: `subscribely://reset-password`
- New: `renvo://reset-password`

#### Action Required
- [ ] **Update Supabase Auth Redirect URLs**

#### Step-by-Step Instructions

1. **Access Supabase Dashboard**
   - Go to [https://app.supabase.com](https://app.supabase.com)
   - Select your project

2. **Navigate to Auth Settings**
   - Click **Authentication** in the left sidebar
   - Click **URL Configuration**

3. **Update Redirect URLs**
   - Locate the **Redirect URLs** section
   - **Add new URL:** `renvo://reset-password`
   - **Keep old URL temporarily:** `subscribely://reset-password` (for transition period)
   - Click **Save**

4. **Update Site URL (if applicable)**
   - If you have a Site URL set to `subscribely://`, update it to `renvo://`
   - This affects email templates and OAuth redirects

5. **Update Additional Redirect URLs**
   - If you have other deep links (e.g., email verification), update them:
     - `subscribely://verify-email` → `renvo://verify-email`
     - `subscribely://login` → `renvo://login` (if used)

#### Verification
- [ ] Test password reset flow: Request password reset and verify email link works
- [ ] Test email verification: Sign up with new account and verify email link works
- [ ] Confirm old URL still works (for transition period)

#### Resources
- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Deep Linking in React Native](https://reactnative.dev/docs/linking)

---

### 2. Email Service - Support Email Configuration

**Priority:** 🔴 Critical  
**Time Estimate:** 45-60 minutes  
**Impact:** Users cannot contact support without this

#### What Changed
- Code changes in website files (30+ occurrences)
- Old: `support@subscribely.app`
- New: `support@renvo.app`

#### Action Required
- [ ] **Set up new support email address**
- [ ] **Configure email forwarding (optional transition)**

#### Step-by-Step Instructions

1. **Register Domain Email**
   - Option A: Use your domain registrar's email service (GoDaddy, Namecheap, etc.)
   - Option B: Use Google Workspace (professional, $6/user/month)
   - Option C: Use Zoho Mail (free tier available)
   - Option D: Use email forwarding to personal email

2. **Create `support@renvo.app` Email**
   - Follow your chosen provider's setup wizard
   - Configure SMTP/IMAP settings if needed
   - Set up auto-responder (optional)

3. **Configure Email Forwarding (Transition Period)**
   - If you already have `support@subscribely.app` active:
     - Set up forwarding: `support@subscribely.app` → `support@renvo.app`
     - Keep this active for 6-12 months
   - If not yet configured: Skip this step

4. **Update Email Templates**
   - Update signature to use new email
   - Update any automated response templates

5. **Test Email Delivery**
   - Send test email TO: `support@renvo.app`
   - Send test email FROM: `support@renvo.app`
   - Verify delivery in both directions

#### Verification
- [ ] Can receive emails at `support@renvo.app`
- [ ] Can send emails from `support@renvo.app`
- [ ] Auto-responder works (if configured)
- [ ] Forwarding from old address works (if applicable)

#### Resources
- [Google Workspace Setup](https://workspace.google.com)
- [Zoho Mail Free Tier](https://www.zoho.com/mail/zohomail-pricing.html)
- Email forwarding guides vary by domain registrar

---

### 3. Domain/DNS Configuration

**Priority:** 🔴 Critical  
**Time Estimate:** 1-2 hours (includes DNS propagation wait time)  
**Impact:** Website and email services depend on correct DNS

#### What Changed
- Domain references in documentation and planned features
- Old: `subscribely.app`, `subscribely.ai`
- New: `renvo.app`, `renvo.ai`

#### Action Required
- [ ] **Register new domains**
- [ ] **Configure DNS records**
- [ ] **Set up SSL certificates**

#### Step-by-Step Instructions

1. **Register Domains**
   - [ ] Register `renvo.app` (if not already owned)
   - [ ] Register `renvo.ai` (if not already owned)
   - Recommended registrars: Namecheap, Google Domains, Cloudflare

2. **Configure DNS for Website (`renvo.app`)**
   - If hosting on Vercel/Netlify/similar:
     - Add custom domain in hosting provider dashboard
     - Copy provided DNS records (A, CNAME)
     - Add records to domain registrar's DNS settings
   - If self-hosted:
     - Create A record: `@` → Your server IP
     - Create A record: `www` → Your server IP

3. **Configure DNS for Email (`renvo.app`)**
   - Add MX records for your email provider
   - Add SPF record (TXT): `v=spf1 include:_spf.google.com ~all` (adjust for your provider)
   - Add DKIM record (TXT): Provided by email provider
   - Add DMARC record (TXT): `v=DMARC1; p=none; rua=mailto:support@renvo.app`

4. **Configure DNS for `renvo.ai` (if planning email forwarding feature)**
   - Based on [`subtrack_email_forwarding_feature.md`](subtrack_email_forwarding_feature.md)
   - This feature is planned but not yet deployed
   - Set up subdomain: `subs.renvo.ai`
   - Configure A record pointing to your API server
   - Configure MX records for `@renvo.ai` domain

5. **Set up SSL Certificates**
   - If using hosting provider: Usually automatic
   - If self-hosted: Use Let's Encrypt (free)
   - Ensure both `renvo.app` and `www.renvo.app` have SSL

6. **Wait for DNS Propagation**
   - DNS changes can take 24-48 hours to propagate globally
   - Use [DNS Checker](https://dnschecker.org) to verify propagation

#### Verification
- [ ] `renvo.app` resolves correctly (ping test)
- [ ] `www.renvo.app` resolves correctly
- [ ] Website loads at `https://renvo.app`
- [ ] SSL certificate is valid (green padlock)
- [ ] MX records verified (use [MXToolbox](https://mxtoolbox.com))
- [ ] SPF/DKIM/DMARC records verified
- [ ] Email delivery works to `support@renvo.app`

#### Resources
- [DNS Basics](https://www.cloudflare.com/learning/dns/what-is-dns/)
- [Email DNS Records Explained](https://www.cloudflare.com/learning/dns/dns-records/)
- [Let's Encrypt SSL Setup](https://letsencrypt.org/getting-started/)
- [DNS Checker Tool](https://dnschecker.org)
- [MX Toolbox](https://mxtoolbox.com)

---

## 🟡 IMPORTANT - Complete Before App Store Submission

These configurations should be updated before submitting to the App Store and Play Store for public release.

### 4. Apple App Store Connect - TestFlight & App Listing

**Priority:** 🟡 Important  
**Time Estimate:** 45-60 minutes  
**Impact:** App Store listing metadata and TestFlight builds

#### What Changed
- App display name: "Subscribely" → "Renvo" ([`app.json:3`](app.json:3))
- All marketing copy and screenshots

#### Current Status
- App is in TestFlight/Internal Testing
- App Store Connect ID: `6755662169` ([`eas.json:52`](eas.json:52))

#### Action Required
- [ ] **Update TestFlight build metadata**
- [ ] **Update App Store listing (prepare for submission)**

#### Step-by-Step Instructions

1. **Access App Store Connect**
   - Go to [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Sign in with Apple ID: `p.ronak00000@gmail.com` ([`eas.json:51`](eas.json:51))

2. **Update TestFlight Metadata**
   - Select your app
   - Go to **TestFlight** tab
   - Under **Build Information**, update:
     - [ ] Build name/description (if it references "Subscribely")
     - [ ] What to Test notes (update any references)

3. **Update App Store Listing (Preparation)**
   - Go to **App Store** tab
   - Under **App Information**:
     - [ ] **App Name:** Change to "Renvo"
     - [ ] **Subtitle:** Update if it references old name
     - [ ] **Promotional Text:** Update references
   - Under **Version Information**:
     - [ ] **Description:** Update all references to "Subscribely"
     - [ ] **Keywords:** Add "renvo" and remove "subscribely"
     - [ ] **What's New:** Update changelog
     - [ ] **Support URL:** Update if needed (to renvo.app)
     - [ ] **Marketing URL:** Update if needed (to renvo.app)

4. **Update App Privacy Details**
   - Review privacy questions
   - Update any text that references "Subscribely"

5. **Prepare New Screenshots**
   - Take new app screenshots showing "Renvo" branding
   - Update all 5.5" and 6.5" display sizes
   - Update iPad screenshots if applicable

6. **Update App Icon (if needed)**
   - If icon had "Subscribely" text: Upload new icon with "Renvo"
   - Current icon: [`assets/Composed_Icon Exports/Composed_Icon-iOS-Default-1024x1024@1x.png`](assets/Composed_Icon Exports/Composed_Icon-iOS-Default-1024x1024@1x.png)

#### Verification
- [ ] App name shows as "Renvo" in App Store Connect
- [ ] All descriptions updated
- [ ] Screenshots show new branding
- [ ] Support/Marketing URLs updated
- [ ] Keywords include "renvo"

#### Resources
- [App Store Connect Guide](https://developer.apple.com/app-store-connect/)
- [App Store Metadata Best Practices](https://developer.apple.com/app-store/product-page/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)

---

### 5. Google Play Console - Internal Testing & App Listing

**Priority:** 🟡 Important  
**Time Estimate:** 45-60 minutes  
**Impact:** Play Store listing metadata and internal test builds

#### What Changed
- App display name: "Subscribely" → "Renvo"
- All marketing copy and screenshots

#### Current Status
- App is in Internal Testing phase
- Package name: `com.yourname.smartsubscriptiontracker` ([`app.json:51`](app.json:51))

#### Action Required
- [ ] **Update internal test track metadata**
- [ ] **Update Store listing (prepare for submission)**

#### Step-by-Step Instructions

1. **Access Google Play Console**
   - Go to [https://play.google.com/console](https://play.google.com/console)
   - Select your app

2. **Update Internal Test Track**
   - Go to **Testing** → **Internal testing**
   - Under **Release details**, update:
     - [ ] Release name (if it references "Subscribely")
     - [ ] Release notes (update any references)

3. **Update Store Listing**
   - Go to **Store presence** → **Main store listing**
   - Update the following:
     - [ ] **App name:** Change to "Renvo"
     - [ ] **Short description:** Update references (80 characters max)
     - [ ] **Full description:** Update all references (4000 characters max)
     - [ ] **Contact details:**
       - Email: `support@renvo.app`
       - Website: `https://renvo.app` (when ready)
     - [ ] **Privacy Policy URL:** Update if needed

4. **Update Graphics**
   - [ ] **App icon:** Upload new icon if it had "Subscribely" text
   - [ ] **Feature graphic:** Update (1024x500)
   - [ ] **Phone screenshots:** Take new screenshots with "Renvo" branding (2-8 images)
   - [ ] **Tablet screenshots:** Update if applicable
   - [ ] **TV/Wear screenshots:** Update if applicable

5. **Update Store Settings**
   - Go to **Store presence** → **Store settings**
   - [ ] **App category:** Verify correct category
   - [ ] **Tags:** Add "subscription tracker" if not present

6. **Review Content Rating**
   - Go to **Store presence** → **Content rating**
   - [ ] Verify rating questionnaire answers (update if app behavior changed)

#### Verification
- [ ] App name shows as "Renvo" in Play Console
- [ ] All descriptions updated
- [ ] Contact email updated to `support@renvo.app`
- [ ] Screenshots show new branding
- [ ] Feature graphic updated

#### Resources
- [Google Play Console Guide](https://support.google.com/googleplay/android-developer)
- [Store Listing Best Practices](https://developer.android.com/distribute/best-practices/launch/store-listing)
- [Graphic Asset Specifications](https://support.google.com/googleplay/android-developer/answer/9866151)

---

### 6. Expo Account & EAS Build Configuration

**Priority:** 🟡 Important  
**Time Estimate:** 20-30 minutes  
**Impact:** Build configuration and project metadata

#### What Changed
- App display name: "Subscribely" → "Renvo"
- Project references in build system

#### Current Status
- EAS Project ID: `6ba49749-39ac-4332-b0a9-1f6a9f00ee3c` ([`app.json:71`](app.json:71))
- Owner: `ronnie39` ([`app.json:74`](app.json:74))
- Project slug: `smart-subscription-tracker` ([`app.json:5`](app.json:5))

#### Action Required
- [ ] **Update Expo project metadata**
- [ ] **Review EAS Build configuration**

#### Step-by-Step Instructions

1. **Access Expo Dashboard**
   - Go to [https://expo.dev](https://expo.dev)
   - Sign in with your account (`ronnie39`)

2. **Update Project Settings**
   - Navigate to your project: `smart-subscription-tracker`
   - Go to **Settings**
   - Update the following if they reference "Subscribely":
     - [ ] **Project name/display name** (if shown)
     - [ ] **Project description**
     - [ ] **Project README** (if any)

3. **Review EAS Build Configuration**
   - Check [`eas.json`](eas.json) - Already reviewed in Phase 6
   - No changes needed for build configuration itself
   - [ ] Verify project ID matches: `6ba49749-39ac-4332-b0a9-1f6a9f00ee3c`

4. **Update Build Profiles (if needed)**
   - If you have custom build profile names with "subscribely", update them
   - Review environment variables for any name references

5. **Clear Build Cache (Recommended)**
   - Run: `eas build --clear-cache --platform all`
   - This ensures fresh builds with new branding

#### Verification
- [ ] Expo dashboard shows correct project name
- [ ] Can run successful builds: `eas build --platform ios --profile preview`
- [ ] Build artifacts show "Renvo" as app name
- [ ] Environment variables are correct

#### Resources
- [Expo Dashboard](https://expo.dev)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Configuration](https://docs.expo.dev/build/eas-json/)

---

### 7. Stripe Dashboard - Product & Subscription Names

**Priority:** 🟡 Important  
**Time Estimate:** 30-45 minutes  
**Impact:** Payment product metadata and customer-facing names

#### What Changed
- Product branding: "Subscribely" → "Renvo"
- User-facing product names

#### Current Status
- Stripe is in testing mode
- No live customers yet
- Product configured: Monthly ($4.99) and Yearly ($39.00)
- Price IDs in [`config/stripe.ts`](config/stripe.ts)

#### Action Required
- [ ] **Update product names in Stripe Dashboard**
- [ ] **Update product descriptions**
- [ ] **Verify webhook endpoints**

#### Step-by-Step Instructions

1. **Access Stripe Dashboard**
   - Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
   - Ensure you're in **Test Mode** (toggle in top-right)

2. **Update Product Names**
   - Go to **Products** in the left sidebar
   - For each product (Monthly, Yearly):
     - Click on the product
     - [ ] Update **Name:** "Subscribely Premium" → "Renvo Premium"
     - [ ] Update **Description:** Remove "Subscribely" references, add "Renvo"
     - [ ] Update **Statement descriptor:** "SUBSCRIBELY" → "RENVO" (11 chars max)
     - Click **Save**

3. **Update Product Metadata (Optional)**
   - Under **Metadata** section for each product:
     - [ ] Update any custom fields that reference "Subscribely"
     - [ ] Add metadata like `app_name: Renvo`

4. **Review Subscription Plans**
   - Verify price points are correct:
     - [ ] Monthly: $4.99/month (Price ID from [`config/stripe.ts:23`](config/stripe.ts:23))
     - [ ] Yearly: $39.00/year (Price ID from [`config/stripe.ts:37`](config/stripe.ts:37))

5. **Update Email Receipts**
   - Go to **Settings** → **Emails**
   - [ ] Update email templates if they reference "Subscribely"
   - [ ] Verify "From" address (will show Stripe until you verify custom domain)

6. **Verify Webhook Endpoints**
   - Go to **Developers** → **Webhooks**
   - [ ] Verify endpoint URL is correct (Supabase Edge Function)
   - [ ] Update description if it references "Subscribely"

7. **Update Business Information**
   - Go to **Settings** → **Business settings**
   - [ ] **Business name:** Update to "Renvo"
   - [ ] **Support email:** Update to `support@renvo.app`
   - [ ] **Website:** Update to `https://renvo.app` (when ready)

#### When Moving to Production
- [ ] Switch to **Live Mode** in Stripe Dashboard
- [ ] Repeat all updates above in Live Mode
- [ ] Verify live price IDs match code configuration
- [ ] Test live payment flow

#### Verification
- [ ] Product names show "Renvo" in test mode
- [ ] Statement descriptor shows "RENVO"
- [ ] Support email updated
- [ ] Webhook endpoints verified

#### Resources
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Product Settings](https://stripe.com/docs/products-prices/overview)
- [Statement Descriptors](https://stripe.com/docs/statement-descriptors)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

---

### 8. GitHub Repository

**Priority:** 🟡 Important  
**Time Estimate:** 15-20 minutes  
**Impact:** Repository name and documentation visibility

#### What Changed
- Repository name references in documentation
- Currently: `Ronnie434/Subscribely` (from [`.git/FETCH_HEAD`](.git/FETCH_HEAD))

#### Action Required
- [ ] **Rename GitHub repository**
- [ ] **Update remote URLs**

#### Step-by-Step Instructions

1. **Rename Repository on GitHub**
   - Go to your repository: `https://github.com/Ronnie434/Subscribely`
   - Click **Settings** tab
   - Under **Repository name**, change to: `Renvo` or `renvo-app`
   - Click **Rename**
   - GitHub will automatically set up redirects from old URL

2. **Update Local Git Remote**
   ```bash
   # Verify current remote
   git remote -v
   
   # Update origin URL (if needed - GitHub usually handles this automatically)
   git remote set-url origin https://github.com/Ronnie434/renvo-app.git
   
   # Verify update
   git remote -v
   ```

3. **Update Repository Description**
   - [ ] Update description: "Renvo - Smart Subscription Tracker for iOS and Android"
   - [ ] Update topics/tags: Add "renvo", "subscription-tracker"

4. **Update README.md (if needed)**
   - [ ] Verify all references to "Subscribely" are updated
   - [ ] Update repository links
   - [ ] Update badges (if any)

5. **Update GitHub Pages (if applicable)**
   - If you have GitHub Pages enabled, update content

#### Verification
- [ ] Repository accessible at new URL
- [ ] Old URL redirects to new URL
- [ ] Local git remote updated
- [ ] Can push/pull successfully
- [ ] README shows "Renvo"

#### Resources
- [GitHub Repository Renaming](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)
- [Changing Remote URLs](https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories)

---

## 🟢 OPTIONAL - Nice to Have

These configurations can be updated at any time and are not critical for launch.

### 9. Social Media Profiles

**Priority:** 🟢 Optional  
**Time Estimate:** 30-45 minutes  
**Impact:** Brand consistency across platforms

#### Action Required
- [ ] **Create or update social media profiles**

#### Platforms to Consider
- [ ] **Twitter/X:** Create `@RenvoApp` handle
- [ ] **Instagram:** Create `@renvoapp` handle
- [ ] **Facebook:** Create Renvo page
- [ ] **LinkedIn:** Create Renvo company page
- [ ] **Product Hunt:** Prepare for launch
- [ ] **Reddit:** Create r/Renvo community (optional)

#### Best Practices
- Use consistent branding across all platforms
- Use the same app icon as profile picture
- Use consistent bio/description
- Link back to `https://renvo.app`
- Add support email in profile where possible

---

### 10. Support Documentation & Knowledge Base

**Priority:** 🟢 Optional  
**Time Estimate:** 1-2 hours  
**Impact:** User self-service and support efficiency

#### Action Required
- [ ] **Create help center/FAQ**
- [ ] **Update existing documentation**

#### Documentation to Create/Update
- [ ] Getting Started guide
- [ ] How-to articles (adding subscriptions, setting reminders, etc.)
- [ ] Troubleshooting guides
- [ ] Privacy & Security information
- [ ] Billing & Subscription FAQ
- [ ] Contact support page

#### Platforms to Consider
- Notion (free, easy to use)
- Intercom (powerful but paid)
- Help Scout (mid-tier pricing)
- Simple website pages (free)

#### Content Updates
- [ ] Update all references from "Subscribely" to "Renvo"
- [ ] Update screenshots with new branding
- [ ] Update email address to `support@renvo.app`
- [ ] Update links to point to `renvo.app`

---

### 11. Terms of Service & Privacy Policy URLs

**Priority:** 🟢 Optional  
**Time Estimate:** 15-20 minutes  
**Impact:** Legal compliance and user trust

#### Current Status
- Website includes privacy and terms pages
- Need to deploy to `renvo.app` domain

#### Action Required
- [ ] **Publish legal pages at canonical URLs**

#### Step-by-Step Instructions
1. Deploy website to `https://renvo.app`
2. Ensure these pages are accessible:
   - [ ] `https://renvo.app/privacy.html` → [`website/privacy.html`](website/privacy.html)
   - [ ] `https://renvo.app/terms.html` → [`website/terms.html`](website/terms.html)

3. Update app configurations to point to these URLs:
   - Already updated in code (Phases 1-6)
   - Verify in App Store Connect
   - Verify in Google Play Console

---

### 12. Analytics & Tracking (If/When Configured)

**Priority:** 🟢 Optional  
**Time Estimate:** 20-30 minutes  
**Impact:** Data consistency and reporting

#### Current Status
- No analytics services currently configured

#### When You Add Analytics
- [ ] **Google Analytics:** Update property name to "Renvo"
- [ ] **Mixpanel:** Update project name to "Renvo"
- [ ] **Amplitude:** Update project name to "Renvo"
- [ ] **Firebase:** Update project name to "Renvo"

#### Best Practices
- Use consistent naming across all analytics platforms
- Update custom event names that reference "Subscribely"
- Update user properties/traits
- Archive old analytics data or label it clearly

---

### 13. Customer Communication Templates

**Priority:** 🟢 Optional  
**Time Estimate:** 30-45 minutes  
**Impact:** Professional communication consistency

#### Action Required
- [ ] **Create email templates**
- [ ] **Update automated messages**

#### Templates to Create
- [ ] Welcome email for new users
- [ ] Password reset confirmation
- [ ] Subscription upgrade confirmation
- [ ] Subscription cancellation confirmation
- [ ] Support response template
- [ ] Feature announcement template
- [ ] Renewal reminder template

#### Key Updates in Templates
- Replace "Subscribely" with "Renvo"
- Use `support@renvo.app` as sender
- Link to `https://renvo.app`
- Use new branding/logo
- Update signature

---

### 14. Marketing Materials & Assets

**Priority:** 🟢 Optional  
**Time Estimate:** 1-2 hours  
**Impact:** Marketing campaign consistency

#### Action Required
- [ ] **Update marketing assets**
- [ ] **Create new promotional materials**

#### Assets to Create/Update
- [ ] App Store preview video
- [ ] Play Store feature graphic
- [ ] Social media graphics
- [ ] Press kit
- [ ] Promotional banners
- [ ] Email signatures
- [ ] Business cards (if applicable)
- [ ] Presentation slides

#### Design Considerations
- Use consistent color scheme
- Use official app icon
- Include tagline (if you have one)
- Ensure "Renvo" is clearly visible
- Include website URL and support email

---

## ✅ Verification & Testing Checklist

After completing the configurations, verify everything works:

### Critical Functionality
- [ ] Password reset flow works end-to-end
- [ ] Email verification flow works end-to-end
- [ ] Deep links open the app correctly (`renvo://`)
- [ ] Support email receives messages
- [ ] Website loads at `renvo.app`
- [ ] SSL certificate is valid
- [ ] Stripe test payment completes successfully

### App Store Preparation
- [ ] TestFlight build installs correctly
- [ ] App name shows as "Renvo" on device
- [ ] App Store listing preview looks correct
- [ ] Play Store listing preview looks correct

### Communication
- [ ] Can send/receive from `support@renvo.app`
- [ ] Email templates load correctly
- [ ] Auto-responder works (if configured)

### Branding
- [ ] All public-facing text says "Renvo"
- [ ] No "Subscribely" references in user-visible areas
- [ ] Social media profiles consistent
- [ ] Documentation updated

---

## 📝 Notes & Recommendations

### Transition Strategy
Since you're in pre-launch phase:
- ✅ **No user migration needed** - You can update everything directly
- ✅ **No data migration needed** - No production users yet
- ✅ **Lower risk** - Can test thoroughly before public launch
- ⚠️ **Update TestFlight testers** - Notify them of the name change

### Timeline Recommendation
1. **Week 1:** Complete all 🔴 Critical items
2. **Week 2:** Complete all 🟡 Important items
3. **Week 3:** Complete 🟢 Optional items
4. **Week 4:** Final testing and verification

### Maintenance
- Keep old domain forwarding for 12+ months (when you get one)
- Keep old email forwarding for 12+ months (when you get one)
- Monitor support channels for name confusion
- Update this checklist as you discover additional items

---

## 🎯 Quick Start Priorities

If you need to launch quickly, focus on these minimum requirements:

**Must Have Before Launch:**
1. ✅ Supabase Auth redirect URLs
2. ✅ Support email configured
3. ✅ Domain DNS configured
4. ✅ App Store/Play Store listings updated
5. ✅ Stripe product names updated

**Everything else can be done after launch or as needed.**

---

## 📞 Support & Resources

### Key Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [Expo Documentation](https://docs.expo.dev)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [Stripe Documentation](https://stripe.com/docs)
- [App Store Connect Help](https://developer.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)

### Tools
- [DNS Checker](https://dnschecker.org) - Verify DNS propagation
- [MXToolbox](https://mxtoolbox.com) - Test email DNS records
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html) - Verify SSL certificates
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Test website performance

### Getting Help
- Supabase: [Discord Community](https://discord.supabase.com)
- Expo: [Forums](https://forums.expo.dev)
- Stripe: [Support Portal](https://support.stripe.com)

---

**Document Version:** 1.0  
**Last Updated:** November 23, 2025  
**Status:** Ready for Implementation  
**Next Review:** After Critical items completed