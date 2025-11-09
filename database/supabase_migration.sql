-- ============================================================================
-- Supabase Database Migration for Smart Subscription Tracker
-- ============================================================================
-- This file contains all SQL commands needed to set up your Supabase database
-- Run this entire file in the Supabase SQL Editor to set up your database
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE TABLES
-- ----------------------------------------------------------------------------

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Add table comments
COMMENT ON TABLE public.profiles IS 'User profile information linked to auth.users';
COMMENT ON TABLE public.subscriptions IS 'User subscription tracking data';
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'Either monthly or yearly';
COMMENT ON COLUMN public.subscriptions.renewal_date IS 'Next renewal date for the subscription';

-- ----------------------------------------------------------------------------
-- 2. CREATE INDEXES
-- ----------------------------------------------------------------------------

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_date_idx ON public.subscriptions(renewal_date);
CREATE INDEX IF NOT EXISTS subscriptions_category_idx ON public.subscriptions(category);

-- ----------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. CREATE RLS POLICIES FOR PROFILES
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 5. CREATE RLS POLICIES FOR SUBSCRIPTIONS
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 6. CREATE TRIGGERS AND FUNCTIONS
-- ----------------------------------------------------------------------------

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

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Your database is now set up with:
-- ✅ Tables: profiles, subscriptions
-- ✅ Row Level Security enabled on all tables
-- ✅ RLS policies for data isolation per user
-- ✅ Indexes for optimal query performance
-- ✅ Auto-updating timestamps
-- ✅ Automatic profile creation on user signup
--
-- Next steps:
-- 1. Configure Google OAuth in Supabase Authentication settings
-- 2. Copy your Supabase URL and anon key to .env file
-- 3. Start building the authentication flow in your app
-- ============================================================================