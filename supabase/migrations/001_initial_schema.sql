-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clinics table (simple)
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- Unique constraint to prevent duplicate names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Clinic junction (one user can belong to multiple clinics later)
CREATE TABLE user_clinics (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, clinic_id)
);

-- Patients table
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL, -- Will store normalized phone numbers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on clinic_id and phone for faster lookups
CREATE INDEX idx_patients_clinic_phone ON patients(clinic_id, phone);

-- Transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id),
  amount DECIMAL(10,2) NOT NULL, -- Amount can be positive (dispense) or negative (payment)
  description TEXT,
  created_by uuid REFERENCES auth.users(id), -- For audit trail
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on clinic_id and patient_id for faster lookups
CREATE INDEX idx_transactions_clinic_patient ON transactions(clinic_id, patient_id);

-- Patient Balances View
-- This view calculates the balance for each patient by summing all transactions
CREATE VIEW patient_balances AS
SELECT 
  p.id AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  COALESCE(SUM(t.amount), 0) AS balance
FROM patients p
LEFT JOIN transactions t ON p.id = t.patient_id
GROUP BY p.id, p.clinic_id, p.name, p.phone;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see clinics they belong to
CREATE POLICY "Users see own clinics" ON clinics
  FOR ALL USING (
    id IN (
      SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid()
    )
  );

-- Users can only see user_clinic relationships they belong to
CREATE POLICY "Users see own user_clinic relationships" ON user_clinics
  FOR ALL USING (
    user_id = auth.uid()
  );

-- Patients: Users can only see patients from their clinics
CREATE POLICY "Users see own clinic patients" ON patients
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid()
    )
  );

-- Transactions: Same isolation
CREATE POLICY "Users see own clinic transactions" ON transactions
  FOR ALL USING (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid()
    )
  );

-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to clinics and patients tables
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();