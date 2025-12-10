-- ============================================================================
-- UPDATE get_past_due_items TO INCLUDE ONE-TIME CHARGES
-- ============================================================================
-- This migration updates the past due detection to include one-time charges
-- Previously excluded with: AND ri.repeat_interval != 'never'
-- Now includes all past due items regardless of repeat interval

DROP FUNCTION IF EXISTS public.get_past_due_items(UUID);

CREATE OR REPLACE FUNCTION public.get_past_due_items(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cost NUMERIC,
  renewal_date DATE,
  repeat_interval VARCHAR(20),
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
    -- REMOVED: AND ri.repeat_interval != 'never'
    -- Now includes one-time charges!
  ORDER BY ri.renewal_date ASC;  -- Oldest first for unified queue
END;
$$;

COMMENT ON FUNCTION public.get_past_due_items IS 'Returns all past due items (both recurring and one-time charges) for a user';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_past_due_items TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Function get_past_due_items updated to include one-time charges';
  RAISE NOTICE 'Items with repeat_interval = ''never'' will now appear in past due results';
END $$;