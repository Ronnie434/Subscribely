# Supabase Setup Guide for Smart Subscription Tracker

This guide will walk you through setting up Supabase as the backend for your Smart Subscription Tracker app, including authentication with Google OAuth and database configuration.

## Table of Contents
1. [Create Supabase Project](#1-create-supabase-project)
2. [Set Up Database Schema](#2-set-up-database-schema)
3. [Configure Row Level Security](#3-configure-row-level-security)
4. [Set Up Google OAuth](#4-set-up-google-oauth)
5. [Configure Environment Variables](#5-configure-environment-variables)
6. [Test Your Setup](#6-test-your-setup)

---

## 1. Create Supabase Project

### Step 1.1: Sign Up for Supabase
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign In"
3. Sign up using GitHub, GitLab, or email

### Step 1.2: Create a New Project
1. Click "New Project" in your dashboard
2. Fill in the project details:
   - **Name**: `smart-subscription-tracker` (or your preferred name)
   - **Database Password**: Create a strong password (save this securely!)
   - **Region**: Choose the region closest to your users
   - **Pricing Plan**: Start with the Free tier
3. Click "Create new project"
4. Wait 2-3 minutes for the project to be provisioned

### Step 1.3: Get Your Project Credentials
1. Once the project is ready, go to **Settings** → **API**
2. Copy the following values (you'll need these later):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public** API key (the long string under "Project API keys")

---

## 2. Set Up Database Schema

### Step 2.1: Create the Profiles Table
1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the following SQL:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Add comment to table
COMMENT ON TABLE public.profiles IS 'User profile information linked to auth.users';
```

4. Click "Run" to execute the query

### Step 2.2: Create the Subscriptions Table
1. Create another new query in SQL Editor
2. Copy and paste the following SQL:

```sql
-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cost NUMERIC(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  renewal_date DATE NOT NULL,
  is_custom_renewal_date BOOLEAN DEFAULT FALSE,
  notification_id TEXT,
  category TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  domain TEXT,
  reminders BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_date_idx ON public.subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS subscriptions_category_idx ON public.subscriptions(category);

-- Add comments
COMMENT ON TABLE public.subscriptions IS 'User subscription tracking data';
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'Either monthly or yearly';
COMMENT ON COLUMN public.subscriptions.renewal_date IS 'Next renewal date for the subscription';
```

3. Click "Run" to execute the query

### Step 2.3: Create Updated_At Trigger
1. Create another new query
2. Copy and paste the following SQL:

```sql
-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for subscriptions table
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

3. Click "Run" to execute the query

---

## 3. Configure Row Level Security

Row Level Security (RLS) ensures users can only access their own data.

### Step 3.1: Create RLS Policies for Profiles
1. In SQL Editor, create a new query
2. Copy and paste the following SQL:

```sql
-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Profiles: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

3. Click "Run"

### Step 3.2: Create RLS Policies for Subscriptions
1. Create another new query
2. Copy and paste the following SQL:

```sql
-- Subscriptions: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Subscriptions: Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Subscriptions: Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Subscriptions: Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON public.subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);
```

3. Click "Run"

### Step 3.3: Create Profile Auto-Creation Trigger
This automatically creates a profile when a user signs up:

```sql
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

Click "Run" to execute.

---

## 4. Set Up Google OAuth

### Step 4.1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

### Step 4.2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Configure the OAuth consent screen if prompted:
   - User Type: External
   - App name: "Smart Subscription Tracker"
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes: `email`, `profile`
   - Save and continue

4. Create credentials for each platform:

#### **Web Application** (for Expo Web)
- Application type: Web application
- Name: "Subscription Tracker Web"
- Authorized redirect URIs:
  ```
  https://[your-project-ref].supabase.co/auth/v1/callback
  ```
  (Replace `[your-project-ref]` with your Supabase project reference from the URL)
- Copy the **Client ID**

#### **iOS** (if deploying to iOS)
- Application type: iOS
- Name: "Subscription Tracker iOS"
- Bundle ID: Your app's bundle ID from [`app.json`](app.json:1)
- Copy the **Client ID**

#### **Android** (if deploying to Android)
- Application type: Android
- Name: "Subscription Tracker Android"
- Package name: Your app's package name from [`app.json`](app.json:1)
- SHA-1 certificate fingerprint: Get this by running:
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
- Copy the **Client ID**

### Step 4.3: Configure Supabase with Google OAuth
1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list and click to expand
3. Toggle "Enable Sign in with Google"
4. Enter your **Web Application Client ID**
5. Enter your **Web Application Client Secret**
6. Click "Save"

---

## 5. Configure Environment Variables

### Step 5.1: Create .env File
1. In your project root, copy [`.env.example`](.env.example:1) to create `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.apps.googleusercontent.com
```

### Step 5.2: Update app.json (for Expo)
Add your iOS and Android schemes to [`app.json`](app.json:1):

```json
{
  "expo": {
    "scheme": "subscriptiontracker",
    "ios": {
      "bundleIdentifier": "com.yourcompany.subscriptiontracker"
    },
    "android": {
      "package": "com.yourcompany.subscriptiontracker"
    }
  }
}
```

---

## 6. Test Your Setup

### Step 6.1: Verify Database Connection
Test that your Supabase client can connect:

```typescript
import { supabase, isSupabaseConfigured } from './config/supabase';

// Check if configured
console.log('Supabase configured:', isSupabaseConfigured());

// Test connection
const { data, error } = await supabase.from('profiles').select('count');
console.log('Connection test:', { data, error });
```

### Step 6.2: Test in Supabase Dashboard
1. Go to **Table Editor** in your Supabase dashboard
2. You should see `profiles` and `subscriptions` tables
3. Try manually inserting a test row (you can delete it later)

### Step 6.3: Test Authentication
Once you implement the auth screens, test:
- Email/password signup
- Email/password login
- Google OAuth login
- Session persistence (close and reopen app)

---

## Troubleshooting

### Common Issues

**"Failed to fetch" or connection errors:**
- Verify your `EXPO_PUBLIC_SUPABASE_URL` is correct
- Check that your anon key is correct
- Ensure your internet connection is working

**RLS Policy errors:**
- Make sure RLS is enabled on both tables
- Verify policies are created correctly
- Check that `auth.uid()` matches the user_id in the data

**Google OAuth not working:**
- Verify redirect URIs match exactly
- Check that Google+ API is enabled
- Ensure OAuth consent screen is configured
- Make sure client IDs are correct for each platform

**Profile not created automatically:**
- Check if the trigger exists: `on_auth_user_created`
- Verify the function `handle_new_user` is created
- Check Supabase logs for any errors

### Getting Help
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [Expo Documentation](https://docs.expo.dev)

---

## Next Steps

Once your Supabase setup is complete:
1. ✅ Phase 1 Complete: Foundation Setup
2. → Phase 2: Implement Authentication (auth screens, context, flows)
3. → Phase 3: Data Migration (sync local data to Supabase)
4. → Phase 4: Real-time Sync (live updates, conflict resolution)
5. → Phase 5: Testing & Polish

Your backend is now ready for development! 🎉