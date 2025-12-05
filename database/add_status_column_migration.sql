-- ============================================================================
-- ADD STATUS COLUMN TO RECURRING_ITEMS
-- ============================================================================
-- This migration adds the status column that was missing from the original schema
-- Required for past due detection to work properly

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' 
    AND column_name = 'status'
  ) THEN
    -- Add the status column
    ALTER TABLE public.recurring_items 
    ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled'));
    
    -- Set all existing items to 'active'
    UPDATE public.recurring_items SET status = 'active';
    
    RAISE NOTICE 'Added status column to recurring_items table';
  ELSE
    RAISE NOTICE 'Status column already exists - skipping';
  END IF;
END $$;

-- Add notes column if it doesn't exist (also commonly missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.recurring_items 
    ADD COLUMN notes TEXT;
    
    RAISE NOTICE 'Added notes column to recurring_items table';
  ELSE
    RAISE NOTICE 'Notes column already exists - skipping';
  END IF;
END $$;

-- Add reminder_days_before column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' 
    AND column_name = 'reminder_days_before'
  ) THEN
    ALTER TABLE public.recurring_items 
    ADD COLUMN reminder_days_before INTEGER DEFAULT 1;
    
    RAISE NOTICE 'Added reminder_days_before column to recurring_items table';
  ELSE
    RAISE NOTICE 'Reminder_days_before column already exists - skipping';
  END IF;
END $$;

-- Verify columns were added
DO $$
DECLARE
  v_has_status BOOLEAN;
  v_has_notes BOOLEAN;
  v_has_reminder_days BOOLEAN;
BEGIN
  -- Check status column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' AND column_name = 'status'
  ) INTO v_has_status;
  
  -- Check notes column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' AND column_name = 'notes'
  ) INTO v_has_notes;
  
  -- Check reminder_days_before column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recurring_items' AND column_name = 'reminder_days_before'
  ) INTO v_has_reminder_days;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COLUMN VERIFICATION';
  RAISE NOTICE '========================================';
  
  IF v_has_status THEN
    RAISE NOTICE 'status column: ✅ EXISTS';
  ELSE
    RAISE NOTICE 'status column: ❌ MISSING';
  END IF;
  
  IF v_has_notes THEN
    RAISE NOTICE 'notes column: ✅ EXISTS';
  ELSE
    RAISE NOTICE 'notes column: ❌ MISSING';
  END IF;
  
  IF v_has_reminder_days THEN
    RAISE NOTICE 'reminder_days_before column: ✅ EXISTS';
  ELSE
    RAISE NOTICE 'reminder_days_before column: ❌ MISSING';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;