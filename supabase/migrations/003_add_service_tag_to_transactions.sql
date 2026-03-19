-- 003_views_and_utilities.sql

-- 1. Create Patient Balances View
-- Includes patient notes for quick preview in the dashboard
DROP VIEW IF EXISTS patient_balances;

CREATE VIEW patient_balances AS
SELECT
  p.id AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  p.notes AS patient_notes,
  COALESCE(SUM(t.amount), 0) AS balance,
  MAX(t.created_at) AS last_visit
FROM patients p
LEFT JOIN transactions t ON p.id = t.patient_id
GROUP BY p.id, p.clinic_id, p.name, p.phone, p.notes;

-- GRANT PERMISSIONS (Critical: Views lose permissions on recreate)
GRANT SELECT ON patient_balances TO authenticated;

-- 2. Create Secure RPC to Add Staff (Only Owners can do this)
CREATE OR REPLACE FUNCTION add_clinic_staff(target_clinic_id uuid, staff_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if the caller is an owner of the clinic
  IF EXISTS (
    SELECT 1 FROM user_clinics 
    WHERE clinic_id = target_clinic_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  ) THEN
    -- If yes, add the staff member
    INSERT INTO user_clinics (clinic_id, user_id, role)
    VALUES (target_clinic_id, staff_user_id, 'staff');
  ELSE
    RAISE EXCEPTION 'You are not an owner of this clinic';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_clinic_staff(uuid, uuid) TO authenticated;

-- 3. Create Debug Function (Optional: Remove in Production)
DROP FUNCTION IF EXISTS debug_auth();

CREATE OR REPLACE FUNCTION debug_auth()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'uid', auth.uid(),
    'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
    'is_anonymous', auth.uid() IS NULL,
    'current_role', current_role
  );
$$;

GRANT EXECUTE ON FUNCTION debug_auth() TO authenticated;