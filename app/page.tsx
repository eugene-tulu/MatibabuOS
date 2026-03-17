'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizePhone, isValidKenyanPhone } from '@/utils/phoneUtils';
import { useClinic } from '@/contexts/ClinicContext';
import { getSupabase } from '@/lib/supabaseClient';

type SearchState = 'idle' | 'typing' | 'loading' | 'found' | 'not_found' | 'error';

type PatientPreview = {
  id: string;
  name: string;
  phone: string;
  balance: number;
  lastVisit: string | null;
};

function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';

  // Kenyan common: 0712 345 678 (4-3-3)
  if (digits.startsWith('0')) {
    const a = digits.slice(0, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 10);
    return [a, b, c].filter(Boolean).join(' ');
  }

  // Generic grouping by 3s to keep it readable while typing
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function HomePage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientPreview | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { activeClinicId, loading: clinicLoading } = useClinic();
  const abortRef = useRef<AbortController | null>(null);

  const digitsOnly = useMemo(() => phoneInput.replace(/\D/g, ''), [phoneInput]);
  const normalizedPhone = useMemo(() => normalizePhone(phoneInput), [phoneInput]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();

      if (!user) {
        router.push('/auth');
        return;
      }

      setAuthChecked(true);
    };

    void checkAuth();
  }, [router]);

  // Redirect if no active clinic is set
  useEffect(() => {
    if (!clinicLoading && authChecked && !activeClinicId) {
      router.push('/create-clinic');
    }
  }, [activeClinicId, clinicLoading, authChecked, router]);

  const runSearch = async () => {
    setError(null);
    setPatient(null);

    if (!navigator.onLine) {
      setSearchState('error');
      setError('Check your connection and try again.');
      return;
    }

    if (!activeClinicId) {
      setSearchState('error');
      setError('No active clinic selected.');
      return;
    }

    if (!isValidKenyanPhone(phoneInput)) {
      setSearchState('typing');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearchState('loading');
    console.time('patient_search');

    try {
      const { data, error: queryError } = await getSupabase()
        .from('patient_balances')
        .select('patient_id, name, phone, balance, last_visit')
        .eq('clinic_id', activeClinicId)
        .eq('phone', normalizedPhone)
        .maybeSingle()
        // @ts-expect-error - abortSignal is supported in supabase-js but types may be outdated
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;

      if (queryError) {
        const message = (queryError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission') || (queryError as any).code === '42501') {
          router.push('/create-clinic');
          return;
        }

        console.error('Search error:', queryError);
        setSearchState('error');
        setError('Try again.');
        return;
      }

      if (!data) {
        setSearchState('not_found');
        return;
      }

      const preview: PatientPreview = {
        id: data.patient_id,
        name: data.name,
        phone: data.phone,
        balance: Number(data.balance ?? 0),
        lastVisit: data.last_visit ?? null,
      };

      setPatient(preview);
      setSearchState('found');
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      console.error('Search error:', err);
      setSearchState('error');
      setError(!navigator.onLine ? 'Check your connection and try again.' : 'Try again.');
    } finally {
      console.timeEnd('patient_search');
    }
  };

  // Debounced search after typing stops.
  useEffect(() => {
    if (!authChecked || clinicLoading) return;

    if (!phoneInput.trim()) {
      abortRef.current?.abort();
      setSearchState('idle');
      setError(null);
      setPatient(null);
      return;
    }

    setSearchState('typing');
    const t = window.setTimeout(() => {
      void runSearch();
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneInput, activeClinicId, authChecked, clinicLoading]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch();
  };

  if (clinicLoading || !authChecked || !activeClinicId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Patient Ledger</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Patient Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={phoneInput}
            onChange={(e) => {
              const formatted = formatPhoneForDisplay(e.target.value);
              setPhoneInput(formatted);
            }}
            placeholder="Enter phone number (e.g., 0712 345 678)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports formats: 0712345678, 712345678, +254712345678
          </p>
          {digitsOnly.length > 0 && digitsOnly.length < 10 && (
            <p className="mt-1 text-xs text-red-600">Phone number must be at least 10 digits.</p>
          )}
        </div>
        
        {error && (
          <div className="text-red-600 text-sm py-2">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={searchState === 'loading'}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            searchState === 'loading'
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {searchState === 'loading' ? 'Searching...' : 'Search Patient'}
        </button>
      </form>

      <div className="mt-6">
        {searchState === 'loading' && (
          <div className="text-sm text-gray-600">Searching…</div>
        )}

        {searchState === 'found' && patient && (
          <div className="bg-white shadow rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">Patient</div>
                <div className="text-lg font-semibold">{patient.name}</div>
                <div className="text-sm text-gray-700">{patient.phone}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Balance</div>
                <div className={`text-lg font-bold ${patient.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  KES {Math.abs(patient.balance).toFixed(2)}
                </div>
              </div>
            </div>
            {patient.lastVisit && (
              <div className="text-xs text-gray-500">
                Last visit: {new Date(patient.lastVisit).toLocaleDateString()}
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push(`/patient/${encodeURIComponent(patient.id)}`)}
              className="w-full mt-2 bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black"
            >
              View Details
            </button>
          </div>
        )}

        {searchState === 'not_found' && (
          <div className="bg-white shadow rounded-lg p-4 space-y-3">
            <div>
              <div className="text-sm text-gray-500">Result</div>
              <div className="text-base font-medium">No patient found</div>
              {normalizedPhone?.startsWith('+') && (
                <div className="text-sm text-gray-700">Phone: {normalizedPhone}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push(`/patient/new?phone=${encodeURIComponent(normalizedPhone)}`)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add New Patient
            </button>
          </div>
        )}

        {!navigator.onLine && (
          <div className="mt-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-md p-3 flex items-center justify-between gap-3">
            <span>Check your connection.</span>
            <button
              type="button"
              className="text-xs font-medium border border-orange-300 bg-white px-3 py-1 rounded-md"
              onClick={() => void runSearch()}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}