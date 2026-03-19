-- ============================================================================
-- MIGRATION TEMPLATE (Copy-paste for new tables)
-- Replace [table_name], [foreign_key_column], and fields as needed
-- ============================================================================

-- 1. Create table
CREATE TABLE [table_name] (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  -- Add your fields here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- 3. Create policies (copy-paste pattern)
CREATE POLICY "[table_name]_all" ON [table_name]
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

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_[table_name]_clinic ON [table_name](clinic_id);

-- 5. Add to PostgREST reload
NOTIFY pgrst, 'reload config';
