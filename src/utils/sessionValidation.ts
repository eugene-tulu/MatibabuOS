import { getSupabase } from '@/lib/supabaseClient';

/**
 * Validates if the active clinic ID is still valid for the current user
 * Returns true if the user still has access to the clinic, false otherwise
 */
export async function validateActiveClinic(activeClinicId: string): Promise<boolean> {
  if (!activeClinicId) {
    return false;
  }

  try {
    // Get the current user
    const { data: { user }, error: userError } = await getSupabase().auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return false;
    }

    // Check if the user has access to the clinic
    const { data, error } = await getSupabase()
      .from('user_clinics')
      .select('clinic_id')
      .eq('user_id', user.id)
      .eq('clinic_id', activeClinicId)
      .single();

    if (error) {
      console.error('Error checking clinic access:', error);
      return false;
    }

    // If we found a record, the user has access to the clinic
    return !!data;
  } catch (error) {
    console.error('Unexpected error during clinic validation:', error);
    return false;
  }
}

/**
 * Gets all clinics the current user has access to
 */
interface UserClinicWithDetails {
  clinic_id: string;
  role: string;
  clinics: {
    id: string;
    name: string;
    created_at: string;
  } | null;
}

export async function getUserClinics() {
  try {
    const { data: { user }, error: userError } = await getSupabase().auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('Fetching clinics for user:', user.id);

    // Define interfaces for type safety
    interface UserClinicRow {
      clinic_id: string;
      role: string;
    }

    interface ClinicDetail {
      id: string;
      name: string;
      created_at: string;
    }

    // First, get the user_clinics records
    const { data: userClinicsData, error: userClinicsError } = await getSupabase()
      .from('user_clinics')
      .select(`
        clinic_id,
        role
      `)
      .eq('user_id', user.id);

    if (userClinicsError) {
      console.error('Error fetching user_clinics:', userClinicsError);
      throw new Error(userClinicsError.message);
    }

    console.log('Found user_clinics:', userClinicsData);

    // Then, get the clinic details separately to avoid potential RLS issues with joins
    if (userClinicsData.length === 0) {
      return [];
    }

    const clinicIds = userClinicsData.map((uc: UserClinicRow) => uc.clinic_id);
    const { data: clinicsData, error: clinicsError } = await getSupabase()
      .from('clinics')
      .select('id, name, created_at')
      .in('id', clinicIds);

    if (clinicsError) {
      console.error('Error fetching clinics:', clinicsError);
      throw new Error(clinicsError.message);
    }

    console.log('Found clinics:', clinicsData);

    // Combine the data
    const clinics = userClinicsData.map((uc: UserClinicRow) => {
      const clinicDetail = clinicsData.find((c: ClinicDetail) => c.id === uc.clinic_id);
      return {
        id: uc.clinic_id,
        name: clinicDetail?.name || '',
        role: uc.role,
        createdAt: clinicDetail?.created_at || ''
      };
    }).filter((clinic: { name: string }) => clinic.name !== ''); // Filter out any clinics with missing data

    console.log('Final clinics result:', clinics);
    return clinics;
  } catch (error) {
    console.error('Error fetching user clinics:', error);
    throw error;
  }
}