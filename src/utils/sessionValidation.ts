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
export async function getUserClinics() {
  try {
    const { data: { user }, error: userError } = await getSupabase().auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await getSupabase()
      .from('user_clinics')
      .select(`
        clinic_id,
        role,
        clinics (id, name, created_at)
      `)
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'clinics' });

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to a cleaner format
    return data.map(item => ({
      id: item.clinic_id,
      name: item.clinics?.name || '',
      role: item.role,
      createdAt: item.clinics?.created_at || ''
    }));
  } catch (error) {
    console.error('Error fetching user clinics:', error);
    throw error;
  }
}