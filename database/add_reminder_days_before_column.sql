-- Migration: Add reminder_days_before column to recurring_items table
-- Date: 2025-12-05
-- Description: Adds a column to store how many days before renewal users should be notified

-- Add reminder_days_before column with default value of 1 (1 day before renewal)
ALTER TABLE recurring_items 
ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER NOT NULL DEFAULT 1;

-- Add a check constraint to ensure the value is between 1 and 30 days
ALTER TABLE recurring_items
ADD CONSTRAINT reminder_days_before_range 
CHECK (reminder_days_before >= 1 AND reminder_days_before <= 30);

-- Add a comment to the column
COMMENT ON COLUMN recurring_items.reminder_days_before IS 'Number of days before renewal to send notification reminder (1-30 days)';

-- Update any existing rows to have the default value
UPDATE recurring_items 
SET reminder_days_before = 1 
WHERE reminder_days_before IS NULL;