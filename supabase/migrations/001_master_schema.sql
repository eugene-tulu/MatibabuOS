-- ============================================================================
-- MASTER SCHEMA: Pharmacy Patient Ledger (MVP v3.2)
-- Run this ONCE when creating a new Supabase project
-- Purpose: Multi-tenant patient ledger with RLS, audit trail, and balance views
-- ============================================================================

-- ============================================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. GRANT SCHEMA PERMISSIONS (CRITICAL - Often Missed!)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- 3. CREATE TABLES
-- ============================================================================

-- Clinics: The top-level tenant container
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Clinics Junction: Maps users to clinics with roles
CREATE TABLE user_clinics (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, clinic_id)
);

-- Patients: Belongs to a clinic, identified by phone (optional)
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT, -- Optional for walk-ins
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, phone) -- Prevent duplicate phones per clinic
);

-- Transactions: The financial ledger (signed amounts)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, -- Positive = dispense (owed), Negative = payment
  description TEXT, -- e.g., "Amlodipine 5mg x30"
  service_tag TEXT CHECK (service_tag IS NULL OR service_tag IN (
    'Chronic Care', 'Acute Illness', 'Immunization',
    'ANC', 'General Consult', 'Other'
  )),
  clinical_notes TEXT,
  created_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (amount != 0)
);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- --- CLINICS ---
-- INSERT: Any authenticated user can create a clinic
CREATE POLICY "clinics_insert" ON clinics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users see clinics they created OR belong to
CREATE POLICY "clinics_select" ON clinics
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_clinics
      WHERE user_clinics.clinic_id = clinics.id
      AND user_clinics.user_id = auth.uid()
    )
  );

-- UPDATE/DELETE: Only owners can modify clinics
CREATE POLICY "clinics_owner_mod" ON clinics
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_clinics
      WHERE user_clinics.clinic_id = clinics.id
      AND user_clinics.user_id = auth.uid()
      AND user_clinics.role = 'owner'
    )
  );

-- --- USER_CLINICS ---
-- SELECT: Users see their own memberships
CREATE POLICY "user_clinics_select" ON user_clinics
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- NOTE: INSERT is handled by trigger (no manual inserts)

-- --- PATIENTS ---
-- ALL operations: Users can only access patients in their clinics
CREATE POLICY "patients_all" ON patients
  FOR ALL TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics
      WHERE user_id = auth.uid()
    )
  );

-- --- TRANSACTIONS ---
-- ALL operations: Users can only access transactions in their clinics
CREATE POLICY "transactions_all" ON transactions
  FOR ALL TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM user_clinics
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. CREATE TRIGGERS
-- ============================================================================

-- Trigger: Auto-assign clinic creator as owner + set created_by
-- FAILS HARD to prevent orphaned clinics
CREATE OR REPLACE FUNCTION handle_clinic_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign creator as owner
  INSERT INTO public.user_clinics (user_id, clinic_id, role)
  VALUES (auth.uid(), NEW.id, 'owner');

  -- Set created_by on clinic
  UPDATE clinics SET created_by = auth.uid() WHERE id = NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- CRITICAL: Fail hard to prevent data inconsistency
    RAISE EXCEPTION 'Ownership link failed for clinic %: %', NEW.id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_clinic_created ON clinics;
CREATE TRIGGER on_clinic_created
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION handle_clinic_creation();

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. CREATE VIEWS
-- ============================================================================

-- Patient Balances: Auto-calculated ledger view (NEVER store balance on patient table)
DROP VIEW IF EXISTS patient_balances;
CREATE VIEW patient_balances AS
SELECT
  p.id AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  p.notes AS patient_notes,
  COALESCE(SUM(t.amount), 0) AS balance, -- Signed sum: +dispense, -payment
  MAX(t.created_at) AS last_visit,
  COUNT(t.id) AS transaction_count
FROM patients p
LEFT JOIN transactions t ON p.id = t.patient_id
GROUP BY p.id, p.clinic_id, p.name, p.phone, p.notes;

-- CRITICAL: Grant permissions immediately after view creation
GRANT SELECT ON patient_balances TO authenticated;

-- ============================================================================
-- 8. CREATE SECURE RPC FUNCTIONS
-- ============================================================================

-- Add staff to a clinic (owners only)
CREATE OR REPLACE FUNCTION add_clinic_staff(target_clinic_id uuid, staff_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Only owners can add staff
  IF EXISTS (
    SELECT 1 FROM user_clinics
    WHERE clinic_id = target_clinic_id
    AND user_id = auth.uid()
    AND role = 'owner'
  ) THEN
    INSERT INTO user_clinics (clinic_id, user_id, role)
    VALUES (target_clinic_id, staff_user_id, 'staff')
    ON CONFLICT (user_id, clinic_id) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Only clinic owners can add staff';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_clinic_staff(uuid, uuid) TO authenticated;

-- ============================================================================
-- 9. CREATE INDEXES (Performance)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_transactions_clinic_patient ON transactions(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_transactions_service_tag ON transactions(service_tag);
CREATE INDEX IF NOT EXISTS idx_patients_notes ON patients USING gin (to_tsvector('english', notes));
CREATE INDEX IF NOT EXISTS idx_user_clinics_user ON user_clinics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clinics_clinic ON user_clinics(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinics_created_by ON clinics(created_by);

-- ============================================================================
-- 10. RELOAD POSTGREST CONFIG
-- ============================================================================
NOTIFY pgrst, 'reload config';

-- ============================================================================
-- END OF MASTER SCHEMA
-- ============================================================================
