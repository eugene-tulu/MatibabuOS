'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';
import { normalizePhone } from '@/utils/phoneUtils';

const SERVICE_TAGS = [
  'Chronic Care',
  'Acute Illness',
  'Immunization',
  'ANC',
  'General Consult',
  'Other',
] as const;

type ServiceTag = (typeof SERVICE_TAGS)[number];

function NewPatientForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { activeClinicId } = useClinic();

  const phoneParam = params.get('phone') ?? '';
  const normalizedPhone = useMemo(() => normalizePhone(phoneParam), [phoneParam]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(normalizedPhone);
  const [serviceTag, setServiceTag] = useState<ServiceTag>('General Consult');
  const [initialAmount, setInitialAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; phone: string } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  useEffect(() => {
    setPhone(normalizedPhone);
  }, [normalizedPhone]);

  // Check for duplicates when name or phone changes
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!activeClinicId || (!name.trim() && !phone.trim())) {
        setDuplicateWarning(null);
        return;
      }

      setIsCheckingDuplicate(true);
      try {
        let query = getSupabase()
          .from('patients')
          .select('id, name, phone')
          .eq('clinic_id', activeClinicId);

        if (phone.trim()) {
          const finalPhone = normalizePhone(phone);
          if (finalPhone.startsWith('+')) {
            const { data } = await query.eq('phone', finalPhone).limit(1);
            if (data && data.length > 0) {
              setDuplicateWarning({ name: data[0].name, phone: data[0].phone });
              return;
            }
          }
        }

        if (name.trim()) {
          const { data } = await query.ilike('name', name.trim()).limit(1);
          if (data && data.length > 0) {
            setDuplicateWarning({ name: data[0].name, phone: data[0].phone });
            return;
          }
        }

        setDuplicateWarning(null);
      } catch (err) {
        console.error('Duplicate check error:', err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    };

    const debounce = setTimeout(() => {
      void checkDuplicate();
    }, 500);

    return () => clearTimeout(debounce);
  }, [name, phone, activeClinicId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
  
    if (!activeClinicId) {
      router.push('/create-clinic');
      return;
    }
  
    // Validate that the user still has access to the active clinic
    try {
      const { data: { user }, error: userError } = await getSupabase().auth.getUser();
      if (userError || !user) {
        router.push('/auth');
        return;
      }
  
      // Check if user has access to the active clinic
      const { data: clinicAccess, error: accessError } = await getSupabase()
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', user.id)
        .eq('clinic_id', activeClinicId)
        .maybeSingle();
  
      if (accessError || !clinicAccess) {
        // User no longer has access to this clinic
        setError('You no longer have access to the selected clinic. Please select another clinic.');
        // Clear the invalid clinic from storage
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('activeClinicId');
        }
        // Remove the cookie as well
        document.cookie = 'active_clinic_id=; path=/; max-age=0';
        router.push('/create-clinic');
        return;
      }
    } catch (validationError) {
      console.error('Clinic access validation error:', validationError);
      setError('Unable to validate clinic access. Please try again.');
      return;
    }
  
    if (!name.trim()) {
      setError('Please enter the patient name.');
      return;
    }
  
    if (duplicateWarning) {
      setError('A similar patient already exists. Please check the records or use a different name/phone.');
      return;
    }
  
    let finalPhone: string | null = null;
    if (phone.trim()) {
      finalPhone = normalizePhone(phone);
      if (!finalPhone.startsWith('+')) {
        setError('Please enter a valid phone number.');
        return;
      }
    }
  
    const amountValue = parseFloat(initialAmount);
    const hasInitialAmount = !isNaN(amountValue) && initialAmount.trim() !== '';
  
    setIsLoading(true);
    try {
      const { data: patientData, error: patientError } = await getSupabase()
        .from('patients')
        .insert({
          clinic_id: activeClinicId,
          name: name.trim(),
          phone: finalPhone,
        })
        .select('id')
        .single();
  
      if (patientError) {
        const message = (patientError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission')) {
          router.push('/create-clinic');
          return;
        }
        if (message.includes('unique') || message.includes('duplicate') || (patientError as any).code === '23505') {
          setError('A patient with this phone number already exists.');
          return;
        }
        console.error('Create patient error', patientError);
        setError('Failed to create patient. Please try again.');
        return;
      }
  
      if (hasInitialAmount) {
        const { error: txnError } = await getSupabase()
          .from('transactions')
          .insert({
            patient_id: patientData.id,
            clinic_id: activeClinicId,
            amount: amountValue,
            description: `Initial ${amountValue >= 0 ? 'dispense' : 'payment'}`,
          });
  
        if (txnError) {
          console.error('Create initial transaction error', txnError);
        }
      }
  
      router.push(`/patient/${encodeURIComponent(patientData.id)}`);
    } catch (err) {
      console.error('Create patient error', err);
      setError('Failed to create patient. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <button
            onClick={() => (router.push as any)('/')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Add New Patient</h1>
          <p className="text-sm text-gray-600">Create a new patient record</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jane Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone (optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 0712 345 678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {!phone.trim() && (
              <p className="mt-1 text-xs text-amber-600 flex items-center">
                ⚠️ Patient will be harder to find later without a phone number
              </p>
            )}
            {isCheckingDuplicate && (
              <p className="mt-1 text-xs text-gray-500">Checking for duplicates...</p>
            )}
            {duplicateWarning && (
              <p className="mt-1 text-xs text-red-600 flex items-center">
                ⚠️ Similar patient found: {duplicateWarning.name} ({duplicateWarning.phone})
              </p>
            )}
          </div>

          <div>
            <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-1">
              Service Tag
            </label>
            <select
              id="service"
              value={serviceTag}
              onChange={(e) => setServiceTag(e.target.value as ServiceTag)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {SERVICE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="initialAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Initial Amount (optional)
            </label>
            <input
              id="initialAmount"
              type="number"
              step="0.01"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              placeholder="e.g., 500 or -200 for payment"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Positive = dispense, Negative = payment
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !!duplicateWarning}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isLoading || duplicateWarning
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? 'Creating...' : 'Create Patient'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Wrap in Suspense to handle useSearchParams()
export default function NewPatientPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>}>
      <NewPatientForm />
    </Suspense>
  );
}

