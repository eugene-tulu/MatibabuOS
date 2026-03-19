-- ============================================================================
-- TEST DATA SCRIPT (Run after master schema for local dev)
-- WARNING: Do NOT run on production with real clinic data
-- ============================================================================

-- Create test clinics
INSERT INTO clinics (name) VALUES
  ('Test Clinic A'),
  ('Test Clinic B')
RETURNING id;

-- NOTE: Replace 'CLINIC_ID_HERE' with actual UUIDs from the above insert
-- Create test patients
-- INSERT INTO patients (name, phone, clinic_id) VALUES
--   ('John Doe', '+254712345678', 'CLINIC_ID_HERE'),
--   ('Jane Smith', '+254722345678', 'CLINIC_ID_HERE');

-- Create test transactions
-- INSERT INTO transactions (patient_id, clinic_id, amount, description, service_tag) VALUES
--   ('PATIENT_ID_HERE', 'CLINIC_ID_HERE', 800.00, 'Amlodipine 5mg x30', 'Chronic Care'),
--   ('PATIENT_ID_HERE', 'CLINIC_ID_HERE', -550.00, 'M-Pesa Payment', NULL);

-- Verify balance view works
-- SELECT * FROM patient_balances LIMIT 5;
