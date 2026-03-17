-- Add service_tag column to transactions table for standardized service categorization
-- This supports the MVP requirement for service tags (Chronic Care, Acute Illness, etc.)

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_tag TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN transactions.service_tag IS 'Service tag for categorizing transactions (e.g., Chronic Care, Acute Illness, Immunization, ANC, General Consult, Other)';

-- Create an index on service_tag for potential filtering/reporting
CREATE INDEX IF NOT EXISTS idx_transactions_service_tag ON transactions(service_tag);