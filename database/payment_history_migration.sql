-- ============================================================================
-- PAYMENT HISTORY TRACKING MIGRATION
-- ============================================================================
-- Description: Database migration to add payment history tracking for recurring items
-- Version: 1.0.0
-- Date: 2024-12-05
-- 
-- PURPOSE:
-- This migration adds the ability to track payment history for recurring items.
-- When items become past due, users can confirm whether they paid or not,
-- and the system will record this information and update the renewal date.
-- 
-- FEATURES:
-- - Track payment status (paid, skipped, pending)
-- - Record payment date vs due date
-- - Historical cost tracking
-- - User notes for each payment
-- 
-- ============================================================================

-- ============================================================================
-- SECTION 1: CREATE PAYMENT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_item_id UUID NOT NULL REFERENCES public.recurring_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'skipped', 'pending')),
  amount NUMERIC(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add table comments
COMMENT ON TABLE public.payment_history IS 'Tracks payment history for recurring items';
COMMENT ON COLUMN public.payment_history.recurring_item_id IS 'Reference to the recurring item';
COMMENT ON COLUMN public.payment_history.user_id IS 'User who owns this payment record';
COMMENT ON COLUMN public.payment_history.due_date IS 'Original due date (renewal date) when payment was expected';
COMMENT ON COLUMN public.payment_history.payment_date IS 'Actual date when user confirmed payment (can differ from due_date)';
COMMENT ON COLUMN public.payment_history.status IS 'Payment status: paid (confirmed), skipped (not paid), pending (awaiting confirmation)';
COMMENT ON COLUMN public.payment_history.amount IS 'Cost at the time of this payment (historical record)';
COMMENT ON COLUMN public.payment_history.notes IS 'Optional user notes about this payment';

-- ============================================================================
-- SECTION 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS payment_history_recurring_item_id_idx 
  ON public.payment_history(recurring_item_id);

CREATE INDEX IF NOT EXISTS payment_history_user_id_idx 
  ON public.payment_history(user_id);

CREATE INDEX IF NOT EXISTS payment_history_due_date_idx 
  ON public.payment_history(due_date);

CREATE INDEX IF NOT EXISTS payment_history_status_idx 
  ON public.payment_history(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS payment_history_user_status_idx 
  ON public.payment_history(user_id, status);

-- ============================================================================
-- SECTION 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 4: CREATE RLS POLICIES
-- ============================================================================

-- Users can view their own payment history
CREATE POLICY "Users can view own payment history"
  ON public.payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payment history
CREATE POLICY "Users can insert own payment history"
  ON public.payment_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own payment history
CREATE POLICY "Users can update own payment history"
  ON public.payment_history
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own payment history
CREATE POLICY "Users can delete own payment history"
  ON public.payment_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 5: CREATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on payment_history
CREATE TRIGGER update_payment_history_updated_at
  BEFORE UPDATE ON public.payment_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 6: DATABASE FUNCTIONS FOR PAST DUE DETECTION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_past_due_items
-- Purpose: Get all past due recurring items for a user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_past_due_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cost NUMERIC,
  renewal_date DATE,
  repeat_interval TEXT,
  days_past_due INTEGER,
  category TEXT,
  domain TEXT,
  color TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ri.id,
    ri.name,
    ri.cost,
    ri.renewal_date,
    ri.repeat_interval,
    (CURRENT_DATE - ri.renewal_date)::INTEGER AS days_past_due,
    ri.category,
    ri.domain,
    ri.color
  FROM public.recurring_items ri
  WHERE ri.user_id = p_user_id
    AND ri.renewal_date < CURRENT_DATE
    AND ri.status = 'active'
    AND ri.repeat_interval != 'never' -- Exclude one-time items
  ORDER BY ri.renewal_date ASC;
END;
$$;

COMMENT ON FUNCTION public.get_past_due_items IS 'Returns all past due recurring items for a user';

-- ----------------------------------------------------------------------------
-- Function: record_payment_and_update_renewal
-- Purpose: Record payment status and update the renewal date
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment_and_update_renewal(
  p_recurring_item_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_payment_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  new_renewal_date DATE,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_id UUID;
  v_due_date DATE;
  v_amount NUMERIC;
  v_repeat_interval TEXT;
  v_new_renewal_date DATE;
  v_interval_days INTEGER;
BEGIN
  -- Get the current recurring item details
  SELECT renewal_date, cost, repeat_interval
  INTO v_due_date, v_amount, v_repeat_interval
  FROM public.recurring_items
  WHERE id = p_recurring_item_id AND user_id = p_user_id;
  
  -- Check if item exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::DATE, FALSE, 'Recurring item not found';
    RETURN;
  END IF;
  
  -- Calculate new renewal date based on repeat_interval
  v_interval_days := CASE v_repeat_interval
    WHEN 'weekly' THEN 7
    WHEN 'biweekly' THEN 14
    WHEN 'semimonthly' THEN 15
    WHEN 'monthly' THEN 30
    WHEN 'bimonthly' THEN 60
    WHEN 'quarterly' THEN 90
    WHEN 'semiannually' THEN 180
    WHEN 'yearly' THEN 365
    WHEN 'never' THEN 0
    ELSE 30 -- Default to monthly
  END;
  
  -- Calculate next renewal date from the original due date
  v_new_renewal_date := v_due_date + v_interval_days;
  
  -- Insert payment history record
  INSERT INTO public.payment_history (
    recurring_item_id,
    user_id,
    due_date,
    payment_date,
    status,
    amount,
    notes
  ) VALUES (
    p_recurring_item_id,
    p_user_id,
    v_due_date,
    p_payment_date,
    p_status,
    v_amount,
    p_notes
  ) RETURNING id INTO v_payment_id;
  
  -- Update recurring item's renewal date (only if not one-time)
  IF v_repeat_interval != 'never' THEN
    UPDATE public.recurring_items
    SET 
      renewal_date = v_new_renewal_date,
      updated_at = NOW()
    WHERE id = p_recurring_item_id AND user_id = p_user_id;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT v_payment_id, v_new_renewal_date, TRUE, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.record_payment_and_update_renewal IS 'Records payment status and updates the renewal date for a recurring item';

-- ----------------------------------------------------------------------------
-- Function: get_payment_history_for_item
-- Purpose: Get payment history for a specific recurring item
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_history_for_item(
  p_recurring_item_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  due_date DATE,
  payment_date DATE,
  status TEXT,
  amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.id,
    ph.due_date,
    ph.payment_date,
    ph.status,
    ph.amount,
    ph.notes,
    ph.created_at
  FROM public.payment_history ph
  WHERE ph.recurring_item_id = p_recurring_item_id
    AND ph.user_id = p_user_id
  ORDER BY ph.due_date DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_payment_history_for_item IS 'Returns payment history for a specific recurring item';

-- ----------------------------------------------------------------------------
-- Function: get_payment_stats_for_user
-- Purpose: Get payment statistics for a user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_stats_for_user(p_user_id UUID)
RETURNS TABLE (
  total_payments INTEGER,
  paid_count INTEGER,
  skipped_count INTEGER,
  pending_count INTEGER,
  total_amount_paid NUMERIC,
  payment_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
  v_paid INTEGER;
  v_skipped INTEGER;
  v_pending INTEGER;
  v_total_amount NUMERIC;
  v_rate NUMERIC;
BEGIN
  -- Get counts
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'paid'),
    COUNT(*) FILTER (WHERE status = 'skipped'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)
  INTO v_total, v_paid, v_skipped, v_pending, v_total_amount
  FROM public.payment_history
  WHERE user_id = p_user_id;
  
  -- Calculate payment rate (percentage of paid vs total confirmed)
  IF (v_paid + v_skipped) > 0 THEN
    v_rate := (v_paid::NUMERIC / (v_paid + v_skipped)) * 100;
  ELSE
    v_rate := 0;
  END IF;
  
  RETURN QUERY SELECT v_total, v_paid, v_skipped, v_pending, v_total_amount, v_rate;
END;
$$;

COMMENT ON FUNCTION public.get_payment_stats_for_user IS 'Returns payment statistics for a user';

-- ============================================================================
-- SECTION 7: GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions on payment_history table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated;
GRANT SELECT ON public.payment_history TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_past_due_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_and_update_renewal TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_history_for_item TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_stats_for_user TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PAYMENT HISTORY MIGRATION v1.0.0';
  RAISE NOTICE 'COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEW TABLE CREATED:';
  RAISE NOTICE '  ✅ payment_history (tracks payment status for recurring items)';
  RAISE NOTICE '';
  RAISE NOTICE 'DATABASE OBJECTS CREATED:';
  RAISE NOTICE '  • Indexes: 5';
  RAISE NOTICE '  • RLS Policies: 4';
  RAISE NOTICE '  • Functions: 4';
  RAISE NOTICE '  • Triggers: 1';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS CREATED:';
  RAISE NOTICE '  • get_past_due_items() - Find past due recurring items';
  RAISE NOTICE '  • record_payment_and_update_renewal() - Record payment and update renewal date';
  RAISE NOTICE '  • get_payment_history_for_item() - Get payment history for an item';
  RAISE NOTICE '  • get_payment_stats_for_user() - Get payment statistics';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Create PastDueService in the app';
  RAISE NOTICE '  2. Create PastDueModal component';
  RAISE NOTICE '  3. Integrate with HomeScreen';
  RAISE NOTICE '  4. Test with various scenarios';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;