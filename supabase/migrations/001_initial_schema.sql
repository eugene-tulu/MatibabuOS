-- 001_core_schema_security.sql

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Tables
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_clinics (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, clinic_id)
);

CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- --- CLINICS ---
-- Allow any authenticated user to CREATE a clinic (Fixes circular dependency)
CREATE POLICY "Enable insert for authenticated users" ON clinics
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to VIEW only clinics they belong to
CREATE POLICY "Enable read access for own clinics" ON clinics
  FOR SELECT USING (
    id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid())
  );

-- Allow owners to UPDATE/DELETE clinics
CREATE POLICY "Enable update/delete for owners" ON clinics
  FOR UPDATE USING (
    id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid() AND role = 'owner')
  );
CREATE POLICY "Enable delete for owners" ON clinics
  FOR DELETE USING (
    id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid() AND role = 'owner')
  );

-- --- USER_CLINICS ---
-- Users can see their own relationships
CREATE POLICY "Users see own relationships" ON user_clinics
  FOR SELECT USING (user_id = auth.uid());

-- NOTE: No INSERT policy here. We use a Trigger to add owners safely.
-- To add staff later, we will use a secure RPC function (see Script 003).

-- --- PATIENTS ---
-- Allow insert/update/delete if the user belongs to the clinic
CREATE POLICY "Enable write for clinic members" ON patients
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid())
  ) WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid())
  );

-- --- TRANSACTIONS ---
-- Allow insert/update/delete if the user belongs to the clinic
CREATE POLICY "Enable write for clinic members" ON transactions
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid())
  ) WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid())
  );

-- 5. Create Ownership Trigger (Auto-adds creator as 'owner')
CREATE OR REPLACE FUNCTION handle_clinic_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_clinics (user_id, clinic_id, role)
  VALUES (auth.uid(), NEW.id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_clinic_created
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION handle_clinic_creation();

-- 6. Grant Schema Permissions (Critical for API access)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;