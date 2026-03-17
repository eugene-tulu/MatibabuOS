'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';
import { normalizePhone } from '@/utils/phoneUtils';

export default function NewPatientPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { activeClinicId } = useClinic();

  const phoneParam = params.get('phone') ?? '';
  const normalizedPhone = useMemo(() => normalizePhone(phoneParam), [phoneParam]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(normalizedPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhone(normalizedPhone);
  }, [normalizedPhone]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!navigator.onLine) {
      setError('You appear to be offline. Please connect and try again.');
      return;
    }

    if (!activeClinicId) {
      router.push('/create-clinic');
      return;
    }

    const finalPhone = normalizePhone(phone);
    if (!finalPhone || !finalPhone.startsWith('+')) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter the patient name.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: insertError } = await getSupabase()
        .from('patients')
        .insert({
          clinic_id: activeClinicId,
          name: name.trim(),
          phone: finalPhone,
        })
        .select('id')
        .single();

      if (insertError) {
        const message = (insertError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission')) {
          router.push('/create-clinic');
          return;
        }
        if (message.includes('unique') || message.includes('duplicate') || (insertError as any).code === '23505') {
          setError('A patient with this phone number already exists in your clinic.');
          return;
        }
        console.error('Create patient error', insertError);
        setError('Failed to create patient. Please try again.');
        return;
      }

      router.push(`/patient/${encodeURIComponent(data.id)}`);
    } catch (err) {
      console.error('Create patient error', err);
      setError('Failed to create patient. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 mt-8">
      <h1 className="text-2xl font-bold mb-2">Add New Patient</h1>
      <p className="text-sm text-gray-600 mb-6">Create a patient record for this phone number.</p>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Jane Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {isLoading ? 'Creating...' : 'Create Patient'}
        </button>
      </form>
    </div>
  );
}

