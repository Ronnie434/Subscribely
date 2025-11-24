# Quick Start Guide - Backend Setup

Get your Smart Subscription Tracker app connected to Supabase in under 10 minutes!

## Prerequisites
✅ Node.js and npm installed
✅ Expo CLI installed (`npm install -g expo-cli`)
✅ A Supabase account (free tier is perfect)

## 🚀 Quick Setup Steps

### 1. Install Dependencies (Already Done!)
The necessary packages have already been installed:
- `@supabase/supabase-js` - Supabase client
- `expo-secure-store` - Secure token storage
- `expo-auth-session` - OAuth authentication
- `expo-web-browser` - In-app browser for OAuth
- `expo-crypto` - Cryptographic functions

### 2. Create Your Supabase Project (5 minutes)
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - Name: `smart-subscription-tracker`
   - Database Password: (create a strong one and save it!)
   - Region: Choose closest to you
4. Click **"Create new project"** and wait ~2 minutes

### 3. Set Up Database (2 minutes)
1. In your Supabase project, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of [`database/supabase_migration.sql`](database/supabase_migration.sql:1)
4. Paste into the SQL Editor
5. Click **"Run"**
6. ✅ You should see "Success. No rows returned"

### 4. Configure Environment Variables (1 minute)
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Get your Supabase credentials:
   - In Supabase dashboard: **Settings** → **API**
   - Copy **Project URL** and **anon/public** key

3. Edit `.env` file:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 5. Set Up Google OAuth (Optional - 5 minutes)
Follow the detailed steps in [`SUPABASE_SETUP_GUIDE.md`](SUPABASE_SETUP_GUIDE.md:1#4-set-up-google-oauth)

**Quick version:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable Google+ API
3. Create OAuth 2.0 credentials (Web Application)
4. Add redirect URI: `https://[your-project].supabase.co/auth/v1/callback`
5. In Supabase: **Authentication** → **Providers** → Enable **Google**
6. Add your Google Client ID and Secret
7. Add Client IDs to your `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

### 6. Test Your Setup
```bash
npm start
```

The app should start successfully. You're now ready for Phase 2: Authentication Implementation! 🎉

## 📚 Next Steps

### Current Status
- ✅ **Phase 1 Complete**: Foundation Setup
- → **Phase 2 Next**: Authentication Implementation
  - Create login/signup screens
  - Implement auth context
  - Add Google OAuth
  - Session management

### Documentation
- 📖 Full setup guide: [`SUPABASE_SETUP_GUIDE.md`](SUPABASE_SETUP_GUIDE.md:1)
- 🔍 Research & recommendations: [`BACKEND_RESEARCH_RECOMMENDATIONS.md`](BACKEND_RESEARCH_RECOMMENDATIONS.md:1)
- 🗄️ Database schema: [`database/supabase_migration.sql`](database/supabase_migration.sql:1)

## 🆘 Troubleshooting

**App won't start after adding .env?**
- Restart the Metro bundler: Press `r` in the terminal or restart `npm start`

**"Supabase configuration is missing" warning?**
- Verify your `.env` file exists and has the correct variable names
- Make sure you're using `EXPO_PUBLIC_` prefix (required for Expo)

**Can't connect to Supabase?**
- Check your Project URL is correct (copy from Supabase dashboard)
- Verify your anon key is the **public** key, not the secret key
- Ensure your internet connection is working

**Need more help?**
- See [`SUPABASE_SETUP_GUIDE.md`](SUPABASE_SETUP_GUIDE.md:1#troubleshooting)
- Check [Supabase Docs](https://supabase.com/docs)
- Join [Supabase Discord](https://discord.supabase.com)

## 🎯 What's Been Set Up

### Files Created
- ✅ [`config/supabase.ts`](config/supabase.ts:1) - Supabase client configuration
- ✅ [`.env.example`](.env.example:1) - Environment variables template
- ✅ [`database/supabase_migration.sql`](database/supabase_migration.sql:1) - Complete database setup
- ✅ [`SUPABASE_SETUP_GUIDE.md`](SUPABASE_SETUP_GUIDE.md:1) - Detailed setup instructions
- ✅ Updated [`types/index.ts`](types/index.ts:1) - Added Supabase types

### Dependencies Installed
- ✅ `@supabase/supabase-js` - Supabase JavaScript client
- ✅ `expo-secure-store` - Secure storage for auth tokens
- ✅ `expo-auth-session` - OAuth authentication helper
- ✅ `expo-web-browser` - In-app browser for OAuth flows
- ✅ `expo-crypto` - Cryptographic utilities

### Database Schema
- ✅ `profiles` table - User profile data
- ✅ `subscriptions` table - Recurring item tracking data
- ✅ Row Level Security (RLS) - Each user can only see their own data
- ✅ Automatic triggers - Profile creation, timestamp updates
- ✅ Indexes - Optimized query performance

You're all set! 🚀