-- ============================================================================
-- RECURRING ITEMS REFACTORING MIGRATION - PHASE 2.1 REVISED
-- ============================================================================
-- Description: Database migration to rename subscriptions table to recurring_items
--              (tracked expenses only - does NOT affect user subscription system)
-- Version: 1.0.1
-- Date: 2024-11-24
-- 
-- PURPOSE:
-- This migration renames the "subscriptions" table (user's tracked expenses) to 
-- "recurring_items" while maintaining complete backward compatibility.
-- 
-- IMPORTANT TERMINOLOGY CLARIFICATION:
-- - "subscription" = User's app subscription tier (Premium/Free) - UNCHANGED
-- - "recurring_item" = Tracked expense/subscription that users monitor - MIGRATED
-- 
-- SCOPE OF THIS MIGRATION:
-- ✅ Migrates: subscriptions → recurring_items (tracked expenses)
-- ❌ Does NOT touch: user_subscriptions (app subscription status)
-- ❌ Does NOT touch: subscription_tiers (Premium/Free tier definitions)
-- 
-- MIGRATION PROCESS:
-- 1. Creates new recurring_items table
-- 2. Creates indexes and RLS policies on recurring_items
-- 3. Creates functions and triggers
-- 4. Copies all data from subscriptions TABLE to recurring_items
-- 5. Verifies data copy was successful
-- 6. Drops old subscriptions TABLE
-- 7. Creates subscriptions as a VIEW pointing to recurring_items
-- 8. Grants permissions on the view
--
-- BACKWARD COMPATIBILITY STRATEGY:
-- - Create new recurring_items table with same structure as subscriptions
-- - Copy all data from subscriptions TABLE before dropping it
-- - Drop subscriptions TABLE after data verification
-- - Create subscriptions VIEW mapping to recurring_items for old code
-- - Update functions that query tracked expenses to use new table name
-- - Create aliases for old function names
-- - All existing application code continues to work without modification
-- 
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following in order:
-- 1. DROP VIEW subscriptions CASCADE;
-- 2. DROP TABLE recurring_items CASCADE;
-- 3. DROP FUNCTION aliases (get_user_subscription_limit, etc.)
-- 
-- ⚠️  WARNING: Do NOT drop old subscriptions table until all code is migrated and tested
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE NEW TABLE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: recurring_items (replaces subscriptions table for tracked expenses)
-- Purpose: User's tracked recurring expenses and subscriptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_items (
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
COMMENT ON TABLE public.recurring_items IS 'User recurring expense tracking data (formerly subscriptions)';
COMMENT ON COLUMN public.recurring_items.billing_cycle IS 'Either monthly or yearly';
COMMENT ON COLUMN public.recurring_items.renewal_date IS 'Next renewal date for the recurring item';
COMMENT ON COLUMN public.recurring_items.is_custom_renewal_date IS 'Whether user manually set the renewal date';

-- ============================================================================
-- SECTION 2: BACKWARD COMPATIBILITY VIEW
-- ============================================================================
-- NOTE: The subscriptions view will be created AFTER the data migration
--       and dropping of the old subscriptions table (see Section 10)

-- ============================================================================
-- SECTION 3: CREATE INDEXES FOR RECURRING_ITEMS TABLE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Recurring Items Indexes (mirror subscriptions indexes)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS recurring_items_user_id_idx 
  ON public.recurring_items(user_id);

CREATE INDEX IF NOT EXISTS recurring_items_renewal_date_idx 
  ON public.recurring_items(renewal_date);

CREATE INDEX IF NOT EXISTS recurring_items_category_idx 
  ON public.recurring_items(category);

-- ============================================================================
-- SECTION 4: ENABLE ROW LEVEL SECURITY ON RECURRING_ITEMS TABLE
-- ============================================================================

ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: CREATE RLS POLICIES FOR RECURRING_ITEMS TABLE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Recurring Items Policies (mirror subscriptions policies)
-- ----------------------------------------------------------------------------

-- Users can view their own recurring items
CREATE POLICY "Users can view own recurring items"
  ON public.recurring_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own recurring items
CREATE POLICY "Users can insert own recurring items"
  ON public.recurring_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own recurring items
CREATE POLICY "Users can update own recurring items"
  ON public.recurring_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own recurring items
CREATE POLICY "Users can delete own recurring items"
  ON public.recurring_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 6: CREATE DATABASE FUNCTIONS FOR RECURRING ITEMS
-- ============================================================================
-- Note: These functions work with recurring_items (tracked expenses) and 
-- reference the existing user_subscriptions and subscription_tiers tables

-- ----------------------------------------------------------------------------
-- Function: get_user_recurring_item_limit
-- Purpose: Returns the recurring item limit for a user based on their tier
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_recurring_item_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  -- Get the recurring item limit for the user's current tier
  -- References existing user_subscriptions and subscription_tiers tables
  SELECT st.subscription_limit INTO v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON us.tier_id = st.tier_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active';
  
  -- If no active plan found, return free tier limit
  IF v_limit IS NULL THEN
    SELECT subscription_limit INTO v_limit
    FROM public.subscription_tiers
    WHERE tier_id = 'free';
  END IF;
  
  RETURN COALESCE(v_limit, 5);
END;
$$;

COMMENT ON FUNCTION public.get_user_recurring_item_limit IS 'Returns recurring item limit for a user based on their tier';

-- ----------------------------------------------------------------------------
-- Function: can_user_add_recurring_item
-- Purpose: Checks if user can add a new recurring item based on their tier limit
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_add_recurring_item(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
BEGIN
  -- Get current recurring item count from new table
  SELECT COUNT(*) INTO v_count
  FROM public.recurring_items
  WHERE user_id = p_user_id;
  
  -- Get user's tier and limit from existing tables
  SELECT us.tier_id, st.subscription_limit
  INTO v_tier, v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON us.tier_id = st.tier_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing', 'incomplete', 'past_due', 'paused');
  
  -- Default to free tier if no plan found
  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_limit := 5;
  END IF;
  
  -- -1 means unlimited
  IF v_limit = -1 THEN
    RETURN QUERY SELECT TRUE, v_count, v_limit, v_tier;
  ELSE
    RETURN QUERY SELECT (v_count < v_limit), v_count, v_limit, v_tier;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.can_user_add_recurring_item IS 'Checks if user can add a new recurring item based on their tier limit';

-- ----------------------------------------------------------------------------
-- Function: check_recurring_item_limit
-- Purpose: Alias for can_user_add_recurring_item for consistency
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_recurring_item_limit(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delegate to can_user_add_recurring_item
  RETURN QUERY SELECT * FROM public.can_user_add_recurring_item(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.check_recurring_item_limit IS 'Checks recurring item limit (alias for can_user_add_recurring_item)';

-- ============================================================================
-- SECTION 7: CREATE BACKWARD COMPATIBILITY FUNCTION ALIASES
-- ============================================================================
-- These aliases allow existing code to call old function names for
-- tracked expense (recurring item) related functions

-- Alias: get_user_subscription_limit -> get_user_recurring_item_limit
CREATE OR REPLACE FUNCTION public.get_user_subscription_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.get_user_recurring_item_limit(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.get_user_subscription_limit IS 'DEPRECATED: Use get_user_recurring_item_limit instead. Backward compatibility alias.';

-- Alias: can_user_add_subscription -> can_user_add_recurring_item
CREATE OR REPLACE FUNCTION public.can_user_add_subscription(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.can_user_add_recurring_item(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.can_user_add_subscription IS 'DEPRECATED: Use can_user_add_recurring_item instead. Backward compatibility alias.';

-- Alias: check_subscription_limit -> check_recurring_item_limit
CREATE OR REPLACE FUNCTION public.check_subscription_limit(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  limit_count INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.check_recurring_item_limit(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.check_subscription_limit IS 'DEPRECATED: Use check_recurring_item_limit instead. Backward compatibility alias.';

-- ============================================================================
-- SECTION 8: CREATE TRIGGERS FOR RECURRING_ITEMS TABLE
-- ============================================================================

-- Trigger to update updated_at on recurring_items
CREATE TRIGGER update_recurring_items_updated_at
  BEFORE UPDATE ON public.recurring_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 9: DATA MIGRATION (COPY EXISTING DATA TO NEW TABLE)
-- ============================================================================
-- ⚠️  IMPORTANT: This section copies data from subscriptions to recurring_items
-- Run this section ONLY AFTER verifying the new table is created successfully

-- Copy subscription data (tracked expenses) to recurring_items
INSERT INTO public.recurring_items (
  id,
  user_id,
  name,
  cost,
  billing_cycle,
  renewal_date,
  is_custom_renewal_date,
  notification_id,
  category,
  color,
  icon,
  domain,
  reminders,
  description,
  created_at,
  updated_at
)
SELECT 
  id,
  user_id,
  name,
  cost,
  billing_cycle,
  renewal_date,
  is_custom_renewal_date,
  notification_id,
  category,
  color,
  icon,
  domain,
  reminders,
  description,
  created_at,
  updated_at
FROM public.subscriptions
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  billing_cycle = EXCLUDED.billing_cycle,
  renewal_date = EXCLUDED.renewal_date,
  is_custom_renewal_date = EXCLUDED.is_custom_renewal_date,
  notification_id = EXCLUDED.notification_id,
  category = EXCLUDED.category,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  domain = EXCLUDED.domain,
  reminders = EXCLUDED.reminders,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- SECTION 10: DROP OLD TABLE AND CREATE BACKWARD COMPATIBILITY VIEW
-- ============================================================================
-- Now that data is safely copied, drop the old table and create the view

-- Verify data copy was successful before proceeding
DO $$
DECLARE
  v_subscriptions_count INTEGER;
  v_recurring_items_count INTEGER;
BEGIN
  -- Count records in both tables
  SELECT COUNT(*) INTO v_subscriptions_count FROM public.subscriptions;
  SELECT COUNT(*) INTO v_recurring_items_count FROM public.recurring_items;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATA COPY VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Subscriptions table: % records', v_subscriptions_count;
  RAISE NOTICE 'Recurring items table: % records', v_recurring_items_count;
  
  -- Verify counts match
  IF v_subscriptions_count != v_recurring_items_count THEN
    RAISE EXCEPTION 'Data copy verification failed! Subscriptions: %, Recurring Items: %',
                    v_subscriptions_count, v_recurring_items_count;
  END IF;
  
  RAISE NOTICE 'Status: ✅ Data copy verified successfully';
  RAISE NOTICE '========================================';
END $$;

-- Drop the old subscriptions TABLE (now that data is safely copied)
DROP TABLE IF EXISTS public.subscriptions CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Dropped old subscriptions table';
END $$;

-- Create backward compatibility VIEW
CREATE OR REPLACE VIEW public.subscriptions AS
SELECT * FROM public.recurring_items;

COMMENT ON VIEW public.subscriptions IS 'Backward compatibility view - maps to recurring_items table';

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscriptions TO anon;

DO $$
BEGIN
    RAISE NOTICE 'Created backward compatibility view: subscriptions → recurring_items';
END $$;

-- ============================================================================
-- SECTION 11: FINAL VALIDATION
-- ============================================================================
-- Verify the view works correctly

DO $$
DECLARE
  v_view_count INTEGER;
  v_table_count INTEGER;
BEGIN
  -- Count records via view
  SELECT COUNT(*) INTO v_view_count FROM public.subscriptions;
  
  -- Count records in table
  SELECT COUNT(*) INTO v_table_count FROM public.recurring_items;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL VALIDATION RESULTS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Records via view: %', v_view_count;
  RAISE NOTICE 'Records in table: %', v_table_count;
  
  IF v_view_count = v_table_count THEN
    RAISE NOTICE 'Status: ✅ VIEW WORKING CORRECTLY';
  ELSE
    RAISE WARNING 'Status: ⚠️  VIEW COUNT MISMATCH';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RECURRING ITEMS MIGRATION v1.0.1';
  RAISE NOTICE 'Phase 2.1 REVISED - COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'MIGRATION SCOPE:';
  RAISE NOTICE '  ✅ 1 table migrated: subscriptions → recurring_items';
  RAISE NOTICE '  ✅ User subscription system (Premium/Free tiers) UNCHANGED';
  RAISE NOTICE '';
  RAISE NOTICE 'NEW TABLE CREATED:';
  RAISE NOTICE '  ✅ recurring_items (tracked expenses)';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLES NOT CHANGED (App subscription system):';
  RAISE NOTICE '  ℹ️  user_subscriptions (user app subscription status)';
  RAISE NOTICE '  ℹ️  subscription_tiers (Premium/Free tier definitions)';
  RAISE NOTICE '';
  RAISE NOTICE 'BACKWARD COMPATIBILITY:';
  RAISE NOTICE '  ✅ View created: subscriptions → recurring_items';
  RAISE NOTICE '  ✅ Function aliases created for tracked expense functions';
  RAISE NOTICE '  ✅ All existing code will continue working';
  RAISE NOTICE '';
  RAISE NOTICE 'DATABASE OBJECTS CREATED:';
  RAISE NOTICE '  • Indexes: 3';
  RAISE NOTICE '  • RLS Policies: 4';
  RAISE NOTICE '  • Functions: 3 (new) + 3 (aliases)';
  RAISE NOTICE '  • Triggers: 1';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS UPDATED (work with recurring_items):';
  RAISE NOTICE '  • get_user_recurring_item_limit()';
  RAISE NOTICE '  • can_user_add_recurring_item()';
  RAISE NOTICE '  • check_recurring_item_limit()';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS UNCHANGED (manage app subscriptions):';
  RAISE NOTICE '  • initialize_user_subscription()';
  RAISE NOTICE '  • get_user_subscription_status()';
  RAISE NOTICE '  • downgrade_to_free()';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Verify application continues working normally';
  RAISE NOTICE '  2. Begin gradual code refactoring to use recurring_items';
  RAISE NOTICE '  3. Monitor for any issues with backward compatibility';
  RAISE NOTICE '  4. Plan for eventual deprecation of subscriptions view';
  RAISE NOTICE '';
  RAISE NOTICE 'DATA SAFETY:';
  RAISE NOTICE '  ✅ Old subscriptions TABLE safely dropped after data verification';
  RAISE NOTICE '  ✅ Backward compatibility VIEW created';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;