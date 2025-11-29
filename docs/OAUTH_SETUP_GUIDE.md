# OAuth Authentication Setup Guide for Renvo

This guide walks you through setting up Google and Apple OAuth authentication for the Renvo app using Supabase's native OAuth providers.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Google Cloud Console Setup](#google-cloud-console-setup)
3. [Apple Developer Setup](#apple-developer-setup)
4. [Supabase Dashboard Configuration](#supabase-dashboard-configuration)
5. [Environment Variables](#environment-variables)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Supabase project: `https://gtgzrykzddokjcndxmxh.supabase.co`
- Apple Developer account (you have this ✓)
- Google account (for Cloud Console - free tier available)
- App bundle identifier: `com.ronnie39.renvo`
- App URL scheme: `renvo://`

---

## Google Cloud Console Setup

### 1. Create New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Enter project name: **"Renvo"**
5. Click **"Create"**
6. Wait for project creation, then select it

### 2. Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** > **OAuth consent screen**
2. Select **"External"** user type
3. Click **"Create"**

**App Information:**
- App name: `Renvo`
- User support email: `your-email@example.com`
- App logo: (Optional - upload your app icon)

**App Domain (Optional but recommended):**
- Application home page: `https://renvo.app` (or your domain)
- Application privacy policy: `https://renvo.app/privacy`
- Application terms of service: `https://renvo.app/terms`

**Authorized Domains:**
- Add: `supabase.co`
- Add your custom domain if you have one

**Developer Contact Information:**
- Email addresses: `your-email@example.com`

4. Click **"Save and Continue"**

**Scopes:**
- Click **"Add or Remove Scopes"**
- Select:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
- Click **"Update"**
- Click **"Save and Continue"**

**Test Users (Optional for development):**
- Add your test email addresses
- Click **"Save and Continue"**

5. Review summary and click **"Back to Dashboard"**

### 3. Create OAuth 2.0 Client IDs

#### A. Web Client ID (Required for Supabase)

1. Go to **APIs & Services** > **Credentials**
2. Click **"+ Create Credentials"** > **"OAuth client ID"**
3. Select **"Web application"**
4. Name: `Renvo Web Client`

**Authorized JavaScript origins:**
- `https://gtgzrykzddokjcndxmxh.supabase.co`

**Authorized redirect URIs:**
- `https://gtgzrykzddokjcndxmxh.supabase.co/auth/v1/callback`

5. Click **"Create"**
6. **IMPORTANT:** Copy the **Client ID** and **Client Secret** - you'll need these for Supabase

#### B. iOS Client ID

1. Click **"+ Create Credentials"** > **"OAuth client ID"**
2. Select **"iOS"**
3. Name: `Renvo iOS Client`
4. Bundle ID: `com.ronnie39.renvo`
5. Click **"Create"**
6. Copy the **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

#### C. Android Client ID

1. Click **"+ Create Credentials"** > **"OAuth client ID"**
2. Select **"Android"**
3. Name: `Renvo Android Client`
4. Package name: `com.ronnie39.renvo`

**Get SHA-1 Fingerprint:**

For **Debug** keystore:
```bash
cd android
./gradlew signingReport
```
Look for `SHA1` under `Variant: debug`

For **Release** keystore:
```bash
keytool -list -v -keystore /path/to/your/keystore.jks -alias your-key-alias
```

5. Enter SHA-1 certificate fingerprint
6. Click **"Create"**
7. Copy the **Client ID**

### 4. Enable Required APIs

1. Go to **APIs & Services** > **Library**
2. Search for and enable:
   - **Google+ API** (or People API)
   - **Google Identity Toolkit API**

### 5. Collect Your Credentials

You should now have:
- ✓ Web Client ID
- ✓ Web Client Secret
- ✓ iOS Client ID
- ✓ Android Client ID

---

## Apple Developer Setup

### 1. Configure App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/)
2. Select **Identifiers** from sidebar
3. Find your App ID: `com.ronnie39.renvo`
4. Click on it to edit
5. Scroll to **Capabilities**
6. Check **"Sign in with Apple"**
7. Click **"Save"**

### 2. Create Services ID

1. In **Identifiers**, click **"+"** button
2. Select **"Services IDs"**
3. Click **"Continue"**

**Register a Services ID:**
- Description: `Renvo Sign in with Apple`
- Identifier: `com.ronnie39.renvo.service`
- Click **"Continue"** then **"Register"**

**Configure the Services ID:**
1. Check **"Sign in with Apple"**
2. Click **"Configure"**

**Domains and Subdomains:**
- Add: `gtgzrykzddokjcndxmxh.supabase.co`

**Return URLs:**
- Add: `https://gtgzrykzddokjcndxmxh.supabase.co/auth/v1/callback`

3. Click **"Save"**
4. Click **"Continue"** then **"Register"**

### 3. Create Sign in with Apple Key

1. In the sidebar, go to **Keys**
2. Click **"+"** button
3. Key Name: `Renvo Sign in with Apple Key`
4. Check **"Sign in with Apple"**
5. Click **"Configure"** next to it
6. Select your Primary App ID: `com.ronnie39.renvo`
7. Click **"Save"**
8. Click **"Continue"**
9. Click **"Register"**

**Download the Key:**
1. **IMPORTANT:** Click **"Download"**
2. Save the `.p8` file securely (you can only download it once!)
3. Note your **Key ID** (10 characters, e.g., `ABC123DEFG`)

### 4. Find Your Team ID

1. Go to **Membership** in the sidebar
2. Your **Team ID** is displayed at the top (10 characters)

### 5. Collect Your Credentials

You should now have:
- ✓ Services ID: `com.ronnie39.renvo.service`
- ✓ Team ID: (10 characters)
- ✓ Key ID: (10 characters)
- ✓ Private Key: `.p8` file contents

---

## Supabase Dashboard Configuration

### 1. Configure Google OAuth Provider

1. Go to your Supabase project: `https://app.supabase.com/project/gtgzrykzddokjcndxmxh`
2. Navigate to **Authentication** > **Providers**
3. Find **Google** in the list
4. Toggle **"Enable Sign in with Google"**

**Configuration:**
- **Client ID**: Paste your Google Web Client ID
- **Client Secret**: Paste your Google Web Client Secret
- **Authorized Client IDs**: Add all three Client IDs (Web, iOS, Android), comma-separated:
  ```
  xxxxx-web.apps.googleusercontent.com,
  xxxxx-ios.apps.googleusercontent.com,
  xxxxx-android.apps.googleusercontent.com
  ```
- **Skip nonce check**: Leave unchecked

5. Click **"Save"**

### 2. Configure Apple OAuth Provider

1. In **Authentication** > **Providers**
2. Find **Apple** in the list
3. Toggle **"Enable Sign in with Apple"**

**Configuration:**
- **Services ID**: `com.ronnie39.renvo.service`
- **Team ID**: Your 10-character Team ID
- **Key ID**: Your 10-character Key ID
- **Private Key**: Open your `.p8` file and paste the entire contents, including:
  ```
  -----BEGIN PRIVATE KEY-----
  [key content]
  -----END PRIVATE KEY-----
  ```

4. Click **"Save"**

### 3. Configure Redirect URLs

1. Go to **Authentication** > **URL Configuration**
2. In **Redirect URLs**, add:
   ```
   renvo://oauth-callback
   exp://localhost:8081/--/oauth-callback
   ```
3. Click **"Save"**

**Note:** The `exp://` URL is for Expo development. For production, only `renvo://` is needed.

---

## Environment Variables

Update your `.env` file with the following:

```bash
# Existing Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://gtgzrykzddokjcndxmxh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxx-web.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx-ios.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx-android.apps.googleusercontent.com

# Apple OAuth Configuration (optional - mainly for reference)
EXPO_PUBLIC_APPLE_CLIENT_ID=com.ronnie39.renvo.service
```

**Important Notes:**
- All Expo frontend environment variables **must** start with `EXPO_PUBLIC_`
- Never commit the actual `.env` file to git
- Update `.env.example` with placeholder values
- Restart your development server after changing environment variables

---

## Testing

### Google OAuth Testing

**iOS Simulator:**
```bash
npx expo run:ios
```
1. Launch app in simulator
2. Tap "Sign in with Google"
3. Browser opens with Google consent screen
4. Sign in with your Google account
5. Approve permissions
6. App should redirect back and log you in

**Android Emulator:**
```bash
npx expo run:android
```
1. Ensure Google Play Services is installed on emulator
2. Follow same steps as iOS

**Troubleshooting Google OAuth:**
- Ensure SHA-1 fingerprint matches your keystore
- Check that all Client IDs are added to Supabase
- Verify redirect URLs are correct

### Apple OAuth Testing

**iOS Device (Required):**
Apple Sign In doesn't work properly in simulator for production testing.

```bash
npx expo run:ios --device
```
1. Connect physical iOS device (iOS 13+)
2. Launch app on device
3. Tap "Sign in with Apple"
4. Native Apple Sign In UI appears
5. Sign in with your Apple ID
6. Choose to share or hide email
7. Approve and authenticate (Face ID/Touch ID)
8. App should log you in

**Troubleshooting Apple OAuth:**
- Must test on physical iOS device
- Ensure device is signed into iCloud
- Check that Services ID return URLs are correct
- Verify App ID has Sign in with Apple enabled

### Web Testing

```bash
npx expo start --web
```
Both Google and Apple OAuth should work in browser with popup windows.

---

## Troubleshooting

### Common Issues

#### "Invalid Client" Error
**Cause:** Client ID or Secret mismatch
**Solution:** 
- Verify credentials in Supabase Dashboard
- Ensure you copied the correct Web Client ID and Secret
- Check for extra spaces or missing characters

#### "Redirect URI Mismatch" Error
**Cause:** Redirect URL not configured
**Solution:**
- Add `https://gtgzrykzddokjcndxmxh.supabase.co/auth/v1/callback` to:
  - Google Cloud Console > Credentials > Web Client > Authorized redirect URIs
  - Apple Developer > Services ID > Return URLs
- Add `renvo://oauth-callback` to Supabase Dashboard > URL Configuration

#### "The operation couldn't be completed" (iOS)
**Cause:** App ID not configured or Services ID issue
**Solution:**
- Verify App ID has Sign in with Apple enabled
- Check Services ID is correctly configured
- Ensure Private Key is valid and matches Key ID

#### Android SHA-1 Fingerprint Error
**Cause:** SHA-1 fingerprint doesn't match
**Solution:**
```bash
# Get debug fingerprint
cd android
./gradlew signingReport

# Get release fingerprint (if using release keystore)
keytool -list -v -keystore /path/to/your/keystore.jks
```
Add both debug and release fingerprints to Google Cloud Console

#### Browser Doesn't Redirect Back to App
**Cause:** URL scheme not configured
**Solution:**
- Verify `app.json` has `"scheme": "renvo"`
- Rebuild the app: `npx expo prebuild --clean`
- For development, ensure `exp://` URL is in Supabase redirect URLs

#### "Unable to Open URL" in Expo Go
**Cause:** Expo Go doesn't support custom URL schemes for OAuth
**Solution:**
- Use development build: `npx expo run:ios` or `npx expo run:android`
- Don't use Expo Go for OAuth testing

### Debug Logging

Enable debug logging in your OAuth functions:

```typescript
if (__DEV__) {
  console.log('[OAuth] Provider:', provider);
  console.log('[OAuth] Redirect URL:', redirectTo);
  console.log('[OAuth] OAuth URL:', data?.url);
  console.log('[OAuth] Result:', result);
}
```

### Testing Checklist

- [ ] Google OAuth works on iOS simulator
- [ ] Google OAuth works on Android emulator
- [ ] Apple OAuth works on iOS device
- [ ] User can cancel OAuth without app crash
- [ ] Session persists after app restart
- [ ] Existing email/password users can sign in with OAuth
- [ ] Local data migrates after first OAuth sign-in
- [ ] Sign out clears OAuth session
- [ ] Multiple OAuth providers work for same email

---

## Security Best Practices

1. **Never commit** `.env` file or credentials to git
2. **Use separate** Google projects for development and production
3. **Rotate keys** periodically (especially if compromised)
4. **Limit scopes** to only what you need (email, profile)
5. **Monitor** OAuth usage in Supabase Dashboard
6. **Test** on multiple devices and OS versions
7. **Keep dependencies** updated (especially `@supabase/supabase-js`)

---

## Next Steps

After completing setup:
1. Test OAuth on all platforms
2. Monitor Supabase Auth logs for errors
3. Set up error tracking (Sentry, etc.)
4. Add analytics for OAuth sign-in success/failure
5. Create support documentation for users
6. Plan for OAuth provider account recovery flow

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Expo Web Browser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)

---

## Support

If you encounter issues:
1. Check Supabase Auth logs
2. Review Google Cloud Console logs
3. Check Apple Developer portal for configuration
4. Test with different accounts
5. Verify all credentials are correct
6. Ensure all URLs match exactly (no trailing slashes)