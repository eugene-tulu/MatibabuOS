'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';

export default function CreateClinicPage() {
  const [clinicName, setClinicName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();
  const { setActiveClinicId, setUserClinics, userClinics, refreshClinics, switchClinic } = useClinic();

  // Refresh clinics on mount to ensure we have the latest list
  useEffect(() => {
    console.log('Refreshing clinics on mount...');
    refreshClinics();
  }, [refreshClinics]);

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!clinicName.trim()) {
      setError('Please enter a clinic name.');
      return;
    }

    setIsLoading(true);

    try {
      // Refresh clinics list to show existing ones
      await refreshClinics();

      const {
        data: { user },
        error: userError,
      } = await getSupabase().auth.getUser();

      if (userError || !user) {
        setError('You must be signed in to create a clinic.');
        return;
      }

      console.log('Creating clinic with name:', clinicName.trim());
      console.log('User ID:', user.id);
      
      const { data: clinic, error: clinicError } = await getSupabase()
        .from('clinics')
        .insert({ name: clinicName.trim() })
        .select('id, name, created_at')
        .single();

      if (clinicError) {
        console.error('Clinic creation error:', clinicError);
        
        // Safely extract error information
        const errorObj = clinicError as any;
        const errorMessage = errorObj?.message || errorObj?.toString?.() || 'Unknown error';
        const errorCode = errorObj?.code || '';
        const errorDetails = errorObj?.details || '';
        
        console.log('Extracted error info:', { errorMessage, errorCode, errorDetails });
        
        if (errorCode === '23505' || errorMessage.toLowerCase().includes('unique') || errorMessage.toLowerCase().includes('duplicate')) {
          setError('That clinic name is already taken. Please choose another.');
        } else if (errorCode === 'PGRST301' || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('row level security') || errorMessage.toLowerCase().includes('policy')) {
          setError('Permission denied. Please sign in again.');
          router.push('/auth');
        } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setError('You appear to be offline. Please check your internet connection and try again.');
        } else {
          // Show a user-friendly message
          setError('Failed to create clinic. Please try again.');
        }
        return;
      }

      // The database trigger should have created the user_clinics relationship.
      // Refresh the clinics list to include the new clinic
      const clinics = await refreshClinics();

      // If for some reason the trigger didn't create the relationship,
      // we still need to set the active clinic to allow the user to proceed.
      // The relationship will be missing but the user can still use the app
      // until we can fix the database trigger.
      setActiveClinicId(clinic.id);

      router.push('/');
    } catch (err) {
      console.error('Unexpected clinic creation error:', err);
      console.error('Catch error details:', {
        type: typeof err,
        constructor: err?.constructor?.name,
        message: err instanceof Error ? err.message : 'Not an Error instance',
        stack: err instanceof Error ? err.stack : 'No stack',
        stringified: JSON.stringify(err, null, 2)
      });
      
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You appear to be offline. Please check your internet connection and try again.');
      } else if (err instanceof Error) {
        setError(`Failed to create clinic: ${err.message}. Please try again.`);
      } else {
        setError('Failed to create clinic. An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClinicSelect = async (clinicId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await switchClinic(clinicId);
      if (success) {
        router.push('/');
      } else {
        setError('You no longer have access to that clinic. Please contact support if this persists.');
      }
    } catch (err) {
      setError('Failed to switch clinic. Please try again.');
      console.error('Clinic switch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debugging: Log the userClinics state
  useEffect(() => {
    console.log('Updated userClinics:', userClinics);
  }, [userClinics]);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MatibabuOS</h1>
          <p className="text-lg text-gray-600">Select a clinic or create a new one to get started</p>
        </div>

        {/* Debug info */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-gray-700"><strong>Clinic Count:</strong> {userClinics.length}</p>
          <p className="text-sm text-gray-700"><strong>Loading State:</strong> {useClinic().loading ? 'true' : 'false'}</p>
        </div>

        {/* Show existing clinics as clickable cards */}
        {userClinics.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Clinics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userClinics.map((clinic) => (
                <div
                  key={clinic.id}
                  onClick={() => handleClinicSelect(clinic.id)}
                  className="bg-white border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{clinic.name}</h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="capitalize">{clinic.role || 'Member'}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center text-blue-600 font-medium text-sm">
                      <span>Select clinic</span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create new clinic section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {userClinics.length > 0 ? 'Create a New Clinic' : 'Create Your First Clinic'}
          </h2>
          
          <form onSubmit={handleCreateClinic} className="space-y-4">
            <div>
              <label htmlFor="clinicName" className="block text-sm font-medium text-gray-700 mb-1">
                Clinic Name
              </label>
              <input
                type="text"
                id="clinicName"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Enter your clinic name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">Clinic names must be unique across the platform.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm" role="alert">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-colors ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating clinic...
                </span>
              ) : (
                'Create New Clinic'
              )}
            </button>
          </form>
        </div>

        {typeof navigator !== 'undefined' && !navigator.onLine && (
          <div className="mt-6 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>You are currently offline. Actions will fail until your connection is restored.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

