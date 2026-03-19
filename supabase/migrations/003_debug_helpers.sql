-- ============================================================================
-- DEBUG HELPERS (Safe to run anytime - read-only views)
-- ============================================================================

-- View: Show current user's clinic access
CREATE OR REPLACE VIEW debug_user_clinic_access AS
SELECT
  auth.uid() AS current_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) AS current_user_email,
  COUNT(DISTINCT uc.clinic_id) AS clinic_count,
  array_agg(DISTINCT c.name) AS clinic_names
FROM user_clinics uc
JOIN clinics c ON uc.clinic_id = c.id
WHERE uc.user_id = auth.uid()
GROUP BY auth.uid();

GRANT SELECT ON debug_user_clinic_access TO authenticated;

-- View: Show patient access for current user
CREATE OR REPLACE VIEW debug_patient_access AS
SELECT
  auth.uid() AS current_user_id,
  COUNT(DISTINCT p.id) AS patient_count,
  COUNT(DISTINCT t.id) AS transaction_count,
  array_agg(DISTINCT p.clinic_id) AS accessible_clinics
FROM patients p
LEFT JOIN transactions t ON p.id = t.patient_id
WHERE p.clinic_id IN (
  SELECT clinic_id FROM user_clinics WHERE user_id = auth.uid()
)
GROUP BY auth.uid();

GRANT SELECT ON debug_patient_access TO authenticated;

-- Function: Test RLS for a specific clinic
CREATE OR REPLACE FUNCTION test_clinic_access(test_clinic_id uuid)
RETURNS TABLE(can_insert boolean, can_select boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM user_clinics
      WHERE clinic_id = test_clinic_id AND user_id = auth.uid()
    ) AS can_insert,
    EXISTS (
      SELECT 1 FROM user_clinics
      WHERE clinic_id = test_clinic_id AND user_id = auth.uid()
    ) AS can_select;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_clinic_access(uuid) TO authenticated;
