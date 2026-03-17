-- Add last_visit to patient_balances view for search preview.
-- last_visit represents the most recent transaction timestamp per patient.

DROP VIEW IF EXISTS patient_balances;

CREATE VIEW patient_balances AS
SELECT
  p.id AS patient_id,
  p.clinic_id,
  p.name,
  p.phone,
  COALESCE(SUM(t.amount), 0) AS balance,
  MAX(t.created_at) AS last_visit
FROM patients p
LEFT JOIN transactions t ON p.id = t.patient_id
GROUP BY p.id, p.clinic_id, p.name, p.phone;

