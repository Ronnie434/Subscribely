-- ============================================================================
-- FIX get_past_due_items FUNCTION
-- ============================================================================
-- Fixes type mismatch between function return type and actual column types

-- Drop the old function
DROP FUNCTION IF EXISTS public.get_past_due_items(UUID);

-- Recreate with correct return types matching actual table schema
CREATE OR REPLACE FUNCTION public.get_past_due_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cost NUMERIC,
  renewal_date DATE,
  repeat_interval VARCHAR(20),  -- Changed from TEXT to match actual column type
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
    AND ri.repeat_interval != 'never'
  ORDER BY ri.renewal_date ASC;
END;
$$;

COMMENT ON FUNCTION public.get_past_due_items IS 'Returns all past due recurring items for a user';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_past_due_items TO authenticated;

-- Test the function
DO $$
BEGIN
  RAISE NOTICE '✅ Function get_past_due_items recreated with correct types';
  RAISE NOTICE 'You can now test it with: SELECT * FROM get_past_due_items(''<your_user_id>'');';
END $$;