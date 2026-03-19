-- 004_ensure_clinic_owner_trigger.sql
-- This migration ensures the clinic creation trigger exists and functions correctly.
-- It recreates the trigger and its function to guarantee they are present.

-- 1. Create or replace the trigger function
CREATE OR REPLACE FUNCTION handle_clinic_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_clinics (user_id, clinic_id, role)
  VALUES (auth.uid(), NEW.id, 'owner');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the clinic creation
    RAISE WARNING 'Failed to create owner relationship for clinic %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_clinic_created ON clinics;

CREATE TRIGGER on_clinic_created
  AFTER INSERT ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION handle_clinic_creation();

-- 3. Grant execute on the function to authenticated users (not strictly needed for trigger but good for manual use)
GRANT EXECUTE ON FUNCTION handle_clinic_creation() TO authenticated;