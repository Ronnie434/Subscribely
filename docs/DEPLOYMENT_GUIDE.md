# Complete Deployment Guide: Smart Subscription Tracker to Apple App Store

This comprehensive guide will walk you through the entire process of deploying your Expo-based React Native app to the Apple App Store.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Apple Developer Setup](#apple-developer-setup)
3. [EAS Configuration](#eas-configuration)
4. [Production Environment Setup](#production-environment-setup)
5. [App Store Connect Setup](#app-store-connect-setup)
6. [Building for Production](#building-for-production)
7. [TestFlight Beta Testing](#testflight-beta-testing)
8. [App Store Submission](#app-store-submission)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts
- ✅ Apple ID (must be enrolled in Apple Developer Program)
- ✅ Expo Account (free tier is sufficient)
- ✅ GitHub Account (for version control)
- ✅ Supabase Account (for production backend)

### Required Software
- ✅ Node.js 18+ and npm
- ✅ Git
- ✅ macOS (required for iOS development)
- ✅ Xcode (latest version from Mac App Store)

### Estimated Costs
- **Apple Developer Program**: $99/year (required)
- **Expo EAS Build**: Free tier includes limited builds, paid plans available
- **Supabase**: Free tier sufficient for small apps

### Time Estimate
- **First-time setup**: 4-6 hours
- **Subsequent builds**: 30-60 minutes
- **App Review**: 1-3 days (Apple's review process)

---

## Apple Developer Setup

### Step 1: Enroll in Apple Developer Program

1. **Visit Apple Developer**
   - Go to [developer.apple.com/programs](https://developer.apple.com/programs)
   - Click "Enroll"

2. **Choose Account Type**
   - **Individual**: For solo developers
   - **Organization**: For companies (requires D-U-N-S number)

3. **Complete Enrollment**
   - Sign in with your Apple ID
   - Agree to Developer Agreement
   - Pay $99 annual fee
   - Wait for approval (usually 24-48 hours)

### Step 2: Accept Agreements in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Sign in with your Apple ID
3. Accept all required agreements:
   - Apple Developer Program License Agreement
   - Paid Applications Agreement (if selling app or in-app purchases)

### Step 3: Create App-Specific Password (Optional but Recommended)

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in and go to Security
3. Generate an App-Specific Password
4. Save it securely (you'll need it for EAS)

---

## EAS Configuration

### Step 1: Install EAS CLI

```bash
# Install globally
npm install -g eas-cli

# Verify installation
eas --version
```

### Step 2: Login to Expo

```bash
# Login with your Expo account
eas login

# Verify you're logged in
eas whoami
```

### Step 3: Configure EAS Project

```bash
# Initialize EAS in your project
eas build:configure

# This will:
# - Create or update eas.json
# - Link your project to EAS
# - Generate a project ID
```

### Step 4: Update Configuration Files

#### Update `app.json`

The app.json has already been configured with:
- Proper bundle identifier: `com.yourname.smartsubscriptiontracker`
- Build number: `1`
- Privacy permissions
- iOS configuration

**ACTION REQUIRED**: Update these fields in `app.json`:
```json
{
  "expo": {
    "owner": "your-expo-username",
    "ios": {
      "bundleIdentifier": "com.YOURNAME.smartsubscriptiontracker"
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_ID_FROM_EAS"
      }
    }
  }
}
```

#### Update `eas.json`

The eas.json has been created with build profiles. **Update**:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

**Finding Your Apple Team ID**:
```bash
# Method 1: EAS CLI
eas device:create

# Method 2: Apple Developer Portal
# Go to developer.apple.com -> Account -> Membership
```

---

## Production Environment Setup

### Step 1: Create Production Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a **new project** specifically for production
   - Name: "Smart Subscription Tracker - Production"
   - Password: Use a strong, unique password
   - Region: Choose closest to your users

3. Run the database migration:
   - Go to SQL Editor in Supabase
   - Copy contents from `database/supabase_migration.sql`
   - Run the migration

### Step 2: Configure Production Environment Variables

1. **Copy the production template**:
   ```bash
   # The .env.production file already exists
   # Fill it with your PRODUCTION credentials
   ```

2. **Fill in `.env.production`**:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-production-client-id
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-production-ios-client-id
   EXPO_PUBLIC_APP_ENV=production
   ```

3. **Get Supabase credentials**:
   - Project Settings → API
   - Copy Project URL and anon/public key

### Step 3: Configure Google OAuth for Production

If using Google Sign-In:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a **new OAuth client** for iOS production
3. Configure OAuth consent screen for production
4. Add production bundle ID: `com.yourname.smartsubscriptiontracker`
5. Update `.env.production` with production OAuth credentials

---

## App Store Connect Setup

### Step 1: Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"

3. **Fill in App Information**:
   - **Platform**: iOS
   - **Name**: Smart Subscription Tracker
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.yourname.smartsubscriptiontracker`
   - **SKU**: smartsubtracker001 (unique identifier)
   - **User Access**: Full Access

4. Click "Create"

### Step 2: Configure App Information

#### General Information
- **Privacy Policy URL**: `https://yourwebsite.com/privacy` (host PRIVACY_POLICY.md)
- **Category**: 
  - Primary: Finance
  - Secondary: Productivity
- **Content Rights**: Check if contains third-party content

#### Age Rating
Complete questionnaire (likely 4+):
- No violence, drugs, gambling
- No unrestricted web access
- No social features
- No in-app purchases

#### App Store Information (Prepare for Submission)
- App Name: Smart Subscription Tracker
- Subtitle: Track & Manage Expenses (30 chars max)
- Promotional Text: Never miss a recurring payment
- Description: [See APP_STORE_SUBMISSION.md]
- Keywords: recurring,tracker,manager,renewal,budget,bills,finance,expense
- Support URL: Your website or support email
- Marketing URL: (optional)

---

## Building for Production

### Step 1: Pre-Build Checklist

Before building, verify:

```bash
# ✅ All code committed to Git
git status

# ✅ No console errors
npm start

# ✅ All environment variables set
cat .env.production

# ✅ EAS configured
cat eas.json
```

### Step 2: Create iOS Production Build

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# This will:
# 1. Upload your code to EAS
# 2. Install dependencies
# 3. Run the build in the cloud
# 4. Create an .ipa file
# 5. Provide a download link
```

**Expected output**:
```
✔ Build successful
Build URL: https://expo.dev/accounts/[username]/projects/[project]/builds/[id]
```

### Step 3: Monitor Build Progress

1. Visit the build URL provided
2. Watch build logs in real-time
3. Build typically takes 10-20 minutes
4. You'll receive email notification when complete

### Step 4: Download Build (Optional)

```bash
# Download the .ipa file
eas build:list

# Download specific build
eas build:download --id [BUILD_ID]
```

---

## TestFlight Beta Testing

### Step 1: Submit to TestFlight

```bash
# Automatic submission after build
eas submit --platform ios --latest

# Or manually:
eas submit --platform ios --path path/to/app.ipa
```

### Step 2: Configure TestFlight

1. Go to App Store Connect → TestFlight
2. Wait for "Processing" to complete (10-30 minutes)
3. Fill in "Test Information":
   - Beta App Description
   - Feedback Email
   - What to Test notes

### Step 3: Add Beta Testers

#### Internal Testing (Immediate)
1. App Store Connect → TestFlight → Internal Testing
2. Add up to 100 internal testers (must be in your team)
3. Click "Add Internal Testers"
4. They receive invite immediately

#### External Testing (Requires Apple Review)
1. Create external test group
2. Add up to 10,000 external testers
3. Submit for Beta App Review (1-2 days)
4. Once approved, invite testers

### Step 4: Beta Testing Process

1. **Send invites** via email
2. **Testers install** TestFlight app
3. **Testers install** your app via TestFlight
4. **Collect feedback** via:
   - TestFlight's built-in feedback
   - Crash reports
   - Direct communication

5. **Iterate** if needed:
   ```bash
   # Fix issues, then rebuild
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```

**Recommended Beta Period**: 1-2 weeks with 10-20 testers

---

## App Store Submission

### Step 1: Prepare App Store Materials

Before submitting, prepare (see `docs/APP_STORE_SUBMISSION.md`):

1. **Screenshots** (required):
   - 6.7" iPhone 15 Pro Max: 1290 x 2796 px (at least 1)
   - 6.5" iPhone 14 Plus: 1284 x 2778 px (at least 1)
   - Optional: iPad Pro screenshots

2. **App Preview Video** (optional but recommended):
   - 15-30 seconds
   - Shows key features
   - Must show actual app

3. **App Icon**:
   - 1024 x 1024 px
   - PNG format
   - No transparency
   - No rounded corners

### Step 2: Complete App Store Information

1. Go to App Store Connect → Your App → App Store tab

2. **Version Information**:
   - Version: 1.0.0
   - Copyright: © 2025 Your Name
   - What's New: "Initial release"

3. **Upload Screenshots**:
   - Drag and drop into screenshot slots
   - Required for at least one device size

4. **App Review Information**:
   - Contact Information
   - Demo account (if sign-in required):
     - Username: demo@example.com
     - Password: [Create demo account]
   - Notes: Any special instructions for reviewers

5. **Version Release**:
   - Automatic: Released immediately after approval
   - Manual: You control release date
   - **Recommended**: Manual for first release

### Step 3: Submit for Review

1. Click "Add for Review"
2. Fill in Export Compliance:
   - Does your app use encryption? → NO (unless using custom encryption)
3. Choose content rights
4. Choose advertising identifier usage
5. Click "Submit for Review"

### Step 4: App Review Process

**Timeline**: Usually 1-3 days

**Status Progression**:
1. "Waiting for Review" → App is in queue
2. "In Review" → Apple is reviewing
3. "Pending Developer Release" → Approved! (if manual release selected)
4. "Ready for Sale" → Live on App Store

**What Apple Reviews**:
- App functionality (must work perfectly)
- Crashes (none tolerated)
- UI consistency with iOS guidelines
- Privacy policy compliance
- Accurate app description
- Metadata matches app content

---

## Troubleshooting

### Common Build Issues

#### Issue: "Bundle identifier not found"
```bash
# Solution: Update app.json with correct bundle ID
# Then rebuild
eas build --platform ios --profile production --clear-cache
```

#### Issue: "Provisioning profile error"
```bash
# Solution: Clear credentials and regenerate
eas credentials
# Select iOS → Production → Remove all → Rebuild
```

#### Issue: "Build timeout"
```bash
# Solution: Optimize dependencies
npm prune
rm -rf node_modules
npm install
eas build --platform ios --profile production
```

### Common Submission Issues

#### Issue: "Missing Privacy Policy"
**Solution**: Host your PRIVACY_POLICY.md online and add URL to app.json

#### Issue: "App Crashes on Launch"
**Solution**: 
1. Test on physical device first
2. Check environment variables are correct
3. Review crash logs in App Store Connect

#### Issue: "Metadata Rejected"
**Solution**: Common reasons:
- Misleading screenshots
- Inaccurate description
- Missing required privacy disclosures
- App name too generic

#### Issue: "Guideline 4.3 - Design: Spam"
**Solution**: Make your app unique:
- Custom design
- Unique features
- Original content

### Getting Help

- **EAS Issues**: [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- **App Store Guidelines**: [developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines)
- **Expo Forums**: [forums.expo.dev](https://forums.expo.dev)
- **Apple Developer Forums**: [developer.apple.com/forums](https://developer.apple.com/forums)

---

## Quick Reference Commands

```bash
# Login to EAS
eas login

# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest

# Check build status
eas build:list

# View credentials
eas credentials

# Create development build
eas build --platform ios --profile development

# Download build
eas build:download --id [BUILD_ID]

# Cancel running build
eas build:cancel

# View project information
eas project:info

# Configure project
eas build:configure
```

---

## Post-Submission Checklist

After submission:

- ✅ Monitor App Store Connect for status updates
- ✅ Check email for messages from Apple
- ✅ Respond to any review questions within 24 hours
- ✅ Prepare marketing materials for launch
- ✅ Set up crash reporting (Sentry recommended)
- ✅ Plan v1.1 updates based on feedback

---

## Version Updates

For future updates:

1. **Update version in app.json**:
   ```json
   {
     "version": "1.1.0",
     "ios": {
       "buildNumber": "2"
     }
   }
   ```

2. **Build and submit**:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```

3. **Update "What's New"** in App Store Connect

---

## Success Metrics

Track these after launch:
- App Store downloads
- User ratings and reviews
- Crash-free rate (target: >99%)
- TestFlight feedback
- User retention
- App Store ranking in category

---

**Remember**: First submission is always the hardest. After you've done it once, updates are much faster!

**Good luck with your App Store launch! 🚀**