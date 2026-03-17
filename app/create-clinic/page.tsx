'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';

export default function CreateClinicPage() {
  const [clinicName, setClinicName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();
  const { setActiveClinicId, setUserClinics, refreshClinics } = useClinic();

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
      const {
        data: { user },
        error: userError,
      } = await getSupabase().auth.getUser();

      if (userError || !user) {
        setError('You must be signed in to create a clinic.');
        return;
      }

      const { data: clinic, error: clinicError } = await getSupabase()
        .from('clinics')
        .insert({ name: clinicName.trim() })
        .select('id, name, created_at')
        .single();

      if (clinicError) {
        if ((clinicError as any).code === '23505') {
          setError('That clinic name is already taken. Please choose another.');
        } else if ((clinicError as any).code === 'PGRST301') {
          setError('Permission denied. Please complete onboarding again.');
          router.push('/auth');
        } else {
          console.error('Clinic creation error', clinicError);
          if (!navigator.onLine) {
            setError('You appear to be offline. Please check your internet connection and try again.');
          } else {
            setError('Failed to create clinic. Please try again.');
          }
        }
        return;
      }

      const { error: joinError } = await getSupabase().from('user_clinics').insert({
        user_id: user.id,
        clinic_id: clinic.id,
        role: 'owner',
      });

      if (joinError) {
        console.error('Error joining clinic', joinError);
        setInfo('Clinic created, but we could not finalize your membership. Please contact support.');
      }

      const newClinic = {
        id: clinic.id,
        name: clinic.name,
        createdAt: clinic.created_at,
        role: 'owner',
      };

      const clinics = await refreshClinics();
      if (clinics.length === 0) {
        setUserClinics([newClinic]);
      }

      setActiveClinicId(newClinic.id);

      router.push('/');
    } catch (err) {
      console.error('Unexpected clinic creation error', err);
      if (!navigator.onLine) {
        setError('You appear to be offline. Please check your internet connection and try again.');
      } else {
        setError('Failed to create clinic. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 mt-10">
      <h1 className="text-2xl font-bold text-center mb-3">Create your clinic</h1>
      <p className="text-center text-gray-600 mb-6">You need at least one clinic to start using MatibabuOS.</p>

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
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Clinic names must be unique.</p>
        </div>

        {error && <div className="text-red-600 text-sm py-2">{error}</div>}
        {info && <div className="text-blue-600 text-sm py-2">{info}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {isLoading ? 'Creating clinic...' : 'Create Clinic'}
        </button>
      </form>

      {!navigator.onLine && (
        <div className="mt-4 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md p-2">
          You are currently offline. Actions will fail until your connection is restored.
        </div>
      )}
    </div>
  );
}

