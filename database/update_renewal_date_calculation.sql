-- ============================================================================
-- UPDATE RENEWAL DATE CALCULATION TO USE CALENDAR DATES
-- ============================================================================
-- This updates the record_payment_and_update_renewal function to use
-- calendar months/years instead of fixed-day intervals for monthly/yearly items

-- Drop the old function
DROP FUNCTION IF EXISTS public.record_payment_and_update_renewal(UUID, UUID, TEXT, DATE, TEXT);

-- Recreate with calendar-based date calculation
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
  -- Use calendar months/years for monthly/yearly, fixed days for others
  CASE v_repeat_interval
    WHEN 'weekly' THEN
      v_new_renewal_date := v_due_date + INTERVAL '7 days';
    WHEN 'biweekly' THEN
      v_new_renewal_date := v_due_date + INTERVAL '14 days';
    WHEN 'semimonthly' THEN
      v_new_renewal_date := v_due_date + INTERVAL '15 days';
    WHEN 'monthly' THEN
      -- Use calendar month: same day next month
      v_new_renewal_date := v_due_date + INTERVAL '1 month';
    WHEN 'bimonthly' THEN
      -- Use calendar months: same day in 2 months
      v_new_renewal_date := v_due_date + INTERVAL '2 months';
    WHEN 'quarterly' THEN
      -- Use calendar months: same day in 3 months
      v_new_renewal_date := v_due_date + INTERVAL '3 months';
    WHEN 'semiannually' THEN
      -- Use calendar months: same day in 6 months
      v_new_renewal_date := v_due_date + INTERVAL '6 months';
    WHEN 'yearly' THEN
      -- Use calendar year: same day next year
      v_new_renewal_date := v_due_date + INTERVAL '1 year';
    WHEN 'never' THEN
      v_new_renewal_date := v_due_date; -- One-time, don't update
    ELSE
      -- Fallback to 30 days for unknown intervals
      v_new_renewal_date := v_due_date + INTERVAL '30 days';
  END CASE;
  
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

COMMENT ON FUNCTION public.record_payment_and_update_renewal IS 'Records payment status and updates renewal date using calendar months/years';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.record_payment_and_update_renewal TO authenticated;

-- Test notification
DO $$
BEGIN
  RAISE NOTICE '✅ Updated record_payment_and_update_renewal function';
  RAISE NOTICE '✅ Now uses calendar dates for monthly/yearly intervals';
  RAISE NOTICE '';
  RAISE NOTICE 'Examples:';
  RAISE NOTICE '  - Monthly: Dec 4 → Jan 4 (same day next month)';
  RAISE NOTICE '  - Yearly: Dec 4, 2025 → Dec 4, 2026 (same day next year)';
  RAISE NOTICE '  - Weekly: Still uses 7-day intervals';
  RAISE NOTICE '';
END $$;