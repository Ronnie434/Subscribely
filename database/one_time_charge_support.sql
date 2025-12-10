-- ============================================================================
-- ONE-TIME CHARGE SUPPORT MIGRATION
-- ============================================================================
-- Description: Adds support for one-time charges in past due system
-- Version: 1.0.0
-- Date: 2024-12-09
-- 
-- PURPOSE:
-- 1. Update record_payment_and_update_renewal to skip renewal for one-time items
-- 2. Create dismiss_one_time_charge function for "Dismiss Forever" functionality
-- 
-- ============================================================================

-- ============================================================================
-- SECTION 1: UPDATE record_payment_and_update_renewal FUNCTION
-- ============================================================================
-- The function already handles one-time charges correctly (lines 236-242 in payment_history_migration.sql)
-- But we'll recreate it here for clarity and to ensure it's up to date

DROP FUNCTION IF EXISTS public.record_payment_and_update_renewal(UUID, UUID, TEXT, DATE, TEXT);

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
  -- Only relevant for recurring items (not one-time charges)
  IF v_repeat_interval != 'never' THEN
    v_interval_days := CASE v_repeat_interval
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'semimonthly' THEN 15
      WHEN 'monthly' THEN 30
      WHEN 'bimonthly' THEN 60
      WHEN 'quarterly' THEN 90
      WHEN 'semiannually' THEN 180
      WHEN 'yearly' THEN 365
      ELSE 30 -- Default to monthly
    END;
    
    -- Calculate next renewal date from the original due date
    v_new_renewal_date := v_due_date + v_interval_days;
  END IF;
  
  -- Insert payment history record (for ALL items, including one-time)
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
  
  -- Update recurring item's renewal date (ONLY if not one-time)
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

COMMENT ON FUNCTION public.record_payment_and_update_renewal IS 'Records payment status and updates renewal date for recurring items (skips renewal update for one-time charges)';

-- ============================================================================
-- SECTION 2: CREATE dismiss_one_time_charge FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dismiss_one_time_charge(
  p_recurring_item_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_repeat_interval TEXT;
  v_cost NUMERIC;
  v_renewal_date DATE;
BEGIN
  -- Get item details and verify it's a one-time charge
  SELECT repeat_interval, cost, renewal_date
  INTO v_repeat_interval, v_cost, v_renewal_date
  FROM public.recurring_items
  WHERE id = p_recurring_item_id AND user_id = p_user_id;
  
  -- Check if item exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring item not found';
  END IF;
  
  -- Verify it's a one-time charge
  IF v_repeat_interval != 'never' THEN
    RAISE EXCEPTION 'Can only dismiss one-time charges (repeat_interval must be ''never'')';
  END IF;
  
  -- Mark as cancelled
  UPDATE public.recurring_items
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_recurring_item_id AND user_id = p_user_id;
  
  -- Record in payment history as cancelled
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
    v_renewal_date,
    CURRENT_DATE,
    'cancelled',
    v_cost,
    'Dismissed by user'
  );
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.dismiss_one_time_charge IS 'Dismisses a one-time charge permanently by marking it as cancelled';

-- ============================================================================
-- SECTION 3: UPDATE payment_history TABLE TO SUPPORT 'cancelled' STATUS
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.payment_history DROP CONSTRAINT IF EXISTS payment_history_status_check;

-- Add new constraint with 'cancelled' status
ALTER TABLE public.payment_history 
ADD CONSTRAINT payment_history_status_check 
CHECK (status IN ('paid', 'skipped', 'pending', 'cancelled'));

-- ============================================================================
-- SECTION 4: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.record_payment_and_update_renewal TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_one_time_charge TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ONE-TIME CHARGE SUPPORT v1.0.0';
  RAISE NOTICE 'COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTIONS UPDATED/CREATED:';
  RAISE NOTICE '  ✅ record_payment_and_update_renewal - Now skips renewal for one-time charges';
  RAISE NOTICE '  ✅ dismiss_one_time_charge - New function for dismissing one-time charges';
  RAISE NOTICE '';
  RAISE NOTICE 'DATABASE CHANGES:';
  RAISE NOTICE '  ✅ payment_history table now supports ''cancelled'' status';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Create OneTimeChargeModal component';
  RAISE NOTICE '  2. Add dismissOneTimeCharge to pastDueService';
  RAISE NOTICE '  3. Update HomeScreen to route to appropriate modal';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;