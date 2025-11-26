-- Migration: Add charge_type column to recurring_items table
-- This allows tracking both recurring and one-time charges

-- Add charge_type column with default value 'recurring' for backward compatibility
ALTER TABLE recurring_items 
ADD COLUMN IF NOT EXISTS charge_type TEXT DEFAULT 'recurring' 
CHECK (charge_type IN ('recurring', 'one_time'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_recurring_items_charge_type ON recurring_items(charge_type);

-- Update the subscriptions view to include charge_type (backward compatibility view)
CREATE OR REPLACE VIEW subscriptions AS
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
  charge_type,
  created_at,
  updated_at
FROM recurring_items;

-- Add comment to document the column
COMMENT ON COLUMN recurring_items.charge_type IS 'Type of charge: recurring (subscription) or one_time (single purchase)';