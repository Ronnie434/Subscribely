-- ============================================================================
-- FIX ONE-TIME CHARGE PAID STATUS
-- ============================================================================
-- Description: Updates record_payment_and_update_renewal to mark one-time 
--              charges as 'cancelled' when paid or skipped
-- Version: 1.0.0
-- Date: 2024-12-10
-- 
-- ISSUE:
-- When a one-time charge is marked as paid, the payment is recorded but the
-- item's status remains 'active'. Since get_past_due_items filters for 
-- status='active' AND renewal_date < CURRENT_DATE, the same charge keeps
-- appearing in the past due modal even after being paid.
--
-- SOLUTION:
-- Update the record_payment_and_update_renewal function to set status='cancelled'
-- for one-time charges (repeat_interval='never') when they are paid or skipped.
-- This prevents them from appearing in future past due checks.
-- ============================================================================

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
  
  -- Handle recurring vs one-time items differently
  IF v_repeat_interval != 'never' THEN
    -- RECURRING ITEMS: Update renewal date
    UPDATE public.recurring_items
    SET 
      renewal_date = v_new_renewal_date,
      updated_at = NOW()
    WHERE id = p_recurring_item_id AND user_id = p_user_id;
  ELSE
    -- ONE-TIME CHARGES: Mark as cancelled to prevent reappearance
    -- This ensures they won't show up in get_past_due_items again
    UPDATE public.recurring_items
    SET 
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = p_recurring_item_id AND user_id = p_user_id;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT v_payment_id, v_new_renewal_date, TRUE, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.record_payment_and_update_renewal IS 'Records payment status, updates renewal date for recurring items, and marks one-time charges as cancelled to prevent reappearance';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.record_payment_and_update_renewal TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIX ONE-TIME CHARGE PAID STATUS v1.0.0';
  RAISE NOTICE 'COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNCTION UPDATED:';
  RAISE NOTICE '  ✅ record_payment_and_update_renewal';
  RAISE NOTICE '';
  RAISE NOTICE 'CHANGES:';
  RAISE NOTICE '  • One-time charges (repeat_interval=''never'') are now marked as ''cancelled''';
  RAISE NOTICE '  • This prevents them from reappearing in get_past_due_items';
  RAISE NOTICE '  • Recurring items continue to update renewal_date as before';
  RAISE NOTICE '';
  RAISE NOTICE 'BEHAVIOR:';
  RAISE NOTICE '  • Paid/Skipped recurring items → renewal_date updated';
  RAISE NOTICE '  • Paid/Skipped one-time charges → status set to ''cancelled''';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;