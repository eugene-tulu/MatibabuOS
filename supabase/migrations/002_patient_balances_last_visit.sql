-- 002_column_enhancements.sql

-- 1. Add Notes to Patients (General History/Allergies)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN patients.notes IS 'General patient history, allergies, or chronic conditions.';

-- 2. Add Service Tag to Transactions (Categorization)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_tag TEXT;
COMMENT ON COLUMN transactions.service_tag IS 'Service category (e.g., Chronic Care, Acute Illness).';

-- Enforce valid tags to prevent data pollution
ALTER TABLE transactions ADD CONSTRAINT check_service_tag_values 
CHECK (service_tag IS NULL OR service_tag IN (
  'Chronic Care', 
  'Acute Illness', 
  'Immunization', 
  'ANC', 
  'General Consult', 
  'Other'
));

-- 3. Add Clinical Notes to Transactions (Visit Specific Prescriptions)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS clinical_notes TEXT;
COMMENT ON COLUMN transactions.clinical_notes IS 'Specific details for this visit: drugs prescribed, services offered.';

-- 4. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_transactions_clinic_patient ON transactions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_service_tag ON transactions(service_tag);
CREATE INDEX IF NOT EXISTS idx_patients_notes ON patients USING gin (to_tsvector('english', notes));