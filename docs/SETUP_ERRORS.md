# Setup Errors & Troubleshooting Guide

This guide covers common errors you might encounter while setting up and running the Smart Subscription Tracker app, along with their solutions.

## Table of Contents

1. [Database Errors](#database-errors)
2. [Authentication Errors](#authentication-errors)
3. [Configuration Errors](#configuration-errors)
4. [Network Errors](#network-errors)
5. [Build & Runtime Errors](#build--runtime-errors)
6. [Development Tools](#development-tools)

---

## Database Errors

### Error: "relation 'subscriptions' does not exist"

**Cause:** The database tables haven't been created yet.

**Solution:**
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `database/supabase_migration.sql`
4. Paste and run the SQL in the editor
5. Verify tables are created in the Table Editor

**Verification:**
```sql
-- Run this in Supabase SQL Editor to check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Error: "permission denied for table subscriptions"

**Cause:** Row Level Security (RLS) policies aren't properly configured.

**Solution:**
1. Ensure you ran the complete migration SQL (it includes RLS policies)
2. Verify RLS is enabled on tables:
   - Go to Authentication → Policies in Supabase dashboard
   - Check that policies exist for `subscriptions` and `profiles` tables
3. Re-run the migration if policies are missing

### Error: "JWT expired" or "Invalid JWT"

**Cause:** User session has expired or is corrupted.

**Solution:**
1. Sign out and sign in again
2. Clear app data:
   ```bash
   # For iOS Simulator
   xcrun simctl uninstall booted com.yourcompany.subscribely
   
   # For Android
   adb shell pm clear com.yourcompany.subscribely
   ```
3. If issue persists, check Supabase project status

---

## Authentication Errors

### Error: "Invalid login credentials"

**Possible Causes:**
- Wrong email or password
- Email not confirmed
- User doesn't exist

**Solution:**
1. Verify credentials are correct
2. Check email for confirmation link (if required)
3. Try password reset if forgotten
4. Ensure user signed up successfully

### Error: "Email not confirmed"

**Cause:** Email confirmation is required but user hasn't confirmed.

**Solution:**
1. Check email inbox (and spam folder) for confirmation email
2. Resend confirmation email from Supabase dashboard:
   - Go to Authentication → Users
   - Find user and click "Send confirmation email"
3. Or disable email confirmation in Supabase:
   - Go to Authentication → Settings
   - Disable "Enable email confirmations"

### Error: "User already registered"

**Cause:** Attempting to sign up with an email that already exists.

**Solution:**
1. Try signing in instead
2. Use password reset if password forgotten
3. Use different email address

---

## Configuration Errors

### Error: "Supabase URL is not configured"

**Cause:** Environment variables not set up properly.

**Solution:**
1. Ensure `.env` file exists in project root
2. Copy `.env.example` to `.env` if it doesn't exist:
   ```bash
   cp .env.example .env
   ```
3. Add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
4. Restart development server:
   ```bash
   npm start -- --clear
   ```

### Error: "Invalid API key"

**Cause:** Wrong or expired Supabase anon key.

**Solution:**
1. Go to Supabase project settings → API
2. Copy the correct `anon` / `public` key
3. Update `.env` file with correct key
4. Restart development server

### Error: SecureStore warning about value size > 2048 bytes

**Cause:** Supabase session data is large and triggers a warning.

**Status:** This is a known issue with Supabase Auth on React Native.

**Impact:** Warning only - does not affect functionality.

**If you want to suppress it:**
- This is expected behavior from Supabase's session management
- Session data is automatically managed by `@supabase/supabase-js`
- No action needed unless you experience actual authentication issues

---

## Network Errors

### Error: "Network request failed"

**Possible Causes:**
- No internet connection
- Firewall blocking requests
- Supabase service down
- Wrong Supabase URL

**Solution:**
1. Check internet connection
2. Verify Supabase project is active:
   - Login to Supabase dashboard
   - Check project status
3. Test connection:
   ```bash
   # Test if URL is reachable
   curl https://your-project.supabase.co
   ```
4. Check firewall/proxy settings
5. Try from different network

### Error: "CORS error" (web only)

**Cause:** CORS not properly configured for your domain.

**Solution:**
1. Go to Supabase Project Settings → API
2. Add your domain to allowed origins
3. For development, ensure `http://localhost:19006` is allowed

---

## Build & Runtime Errors

### Error: "expo-secure-store not found"

**Cause:** Native dependencies not installed.

**Solution:**
```bash
# Install dependencies
npm install

# For iOS
cd ios && pod install && cd ..

# Rebuild
npm start -- --clear
```

### Error: Metro bundler issues

**Cause:** Cached build artifacts causing issues.

**Solution:**
```bash
# Clear Metro cache
npm start -- --clear

# Or manually
rm -rf node_modules/.cache
rm -rf .expo
npx expo start --clear
```

### Error: "Unable to resolve module"

**Cause:** Missing or incorrectly installed dependencies.

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm start -- --clear
```

### TypeScript errors after update

**Cause:** Type definitions outdated or misconfigured.

**Solution:**
```bash
# Update TypeScript and type definitions
npm install --save-dev @types/react @types/react-native
npx tsc --noEmit  # Check for type errors
```

---

## Development Tools

### Manual Connection Test

You can manually test Supabase connection using the development tool:

```typescript
// In any component or screen (development only)
import { testSupabaseConnection, printTestResults } from './utils/testSupabase';

// In a useEffect
useEffect(() => {
  const runTest = async () => {
    const results = await testSupabaseConnection();
    printTestResults(results);
  };
  runTest();
}, []);
```

### Checking Database Tables

Run in Supabase SQL Editor:

```sql
-- List all tables
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check subscriptions table
SELECT * FROM subscriptions LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename IN ('subscriptions', 'profiles');
```

### Debugging Real-time Subscriptions

1. Check browser/developer console for real-time connection logs
2. Verify WebSocket connection in Network tab
3. Test insert/update/delete operations
4. Check Supabase Realtime logs in dashboard

### Reset Development Environment

If all else fails, start fresh:

```bash
# 1. Clear app data
# iOS Simulator
xcrun simctl uninstall booted com.yourcompany.subscribely

# Android
adb shell pm clear com.yourcompany.subscribely

# 2. Clear caches
rm -rf node_modules .expo .expo-shared
npm install

# 3. Clear Metro cache
npm start -- --clear

# 4. Clear Supabase local data (optional)
# Delete user from Supabase dashboard
# Or clear AsyncStorage in app
```

---

## Getting Help

If you continue to experience issues:

1. **Check the logs:**
   - React Native logs in terminal
   - Browser console (for web)
   - Supabase logs in dashboard

2. **Verify setup:**
   - Review `QUICK_START.md`
   - Review `SUPABASE_SETUP_GUIDE.md`
   - Check all environment variables

3. **Test each component:**
   - Database connection
   - Authentication
   - CRUD operations
   - Real-time sync

4. **Common fixes:**
   - Restart dev server with `--clear`
   - Clear app data and caches
   - Verify Supabase project is active
   - Check internet connection

5. **Still stuck?**
   - Check Supabase status page
   - Review Supabase documentation
   - Search GitHub issues
   - Ask in community forums

---

## Prevention Tips

1. **Always run migrations:** Before starting development, ensure database tables are created
2. **Keep dependencies updated:** Regularly update npm packages
3. **Use environment variables:** Never hardcode credentials
4. **Test incrementally:** Test each feature as you build
5. **Monitor Supabase dashboard:** Check for errors and usage limits
6. **Version control:** Commit working states frequently
7. **Read error messages:** They usually indicate the exact issue
8. **Check documentation:** Both Supabase and React Native docs are comprehensive

---

## Error Reference Quick Links

- [Supabase Error Codes](https://supabase.com/docs/guides/platform/error-codes)
- [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting)
- [Expo Troubleshooting](https://docs.expo.dev/troubleshooting/overview/)
- [Supabase Status](https://status.supabase.com/)

---

**Last Updated:** 2025-11-08
**Version:** 1.0.0