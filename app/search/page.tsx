'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizePhone, isValidKenyanPhone } from '@/utils/phoneUtils';
import { useClinic } from '@/contexts/ClinicContext';
import { getSupabase } from '@/lib/supabaseClient';

type SearchState = 'idle' | 'typing' | 'loading' | 'found' | 'not_found' | 'error' | 'name_search';

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

  if (digits.startsWith('0')) {
    const a = digits.slice(0, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 10);
    return [a, b, c].filter(Boolean).join(' ');
  }

  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function SearchPage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientPreview | null>(null);
  const [showNameSearch, setShowNameSearch] = useState(false);
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

  useEffect(() => {
    if (!clinicLoading && authChecked && !activeClinicId) {
      router.push('/create-clinic');
    }
  }, [activeClinicId, clinicLoading, authChecked, router]);

  const runPhoneSearch = async () => {
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

    try {
      const { data, error: queryError } = await getSupabase()
        .from('patient_balances')
        .select('patient_id, name, phone, balance, last_visit')
        .eq('clinic_id', activeClinicId)
        .eq('phone', normalizedPhone)
        .maybeSingle()
        .abortSignal(controller.signal);

    if (controller.signal.aborted) return;

      if (queryError) {
        const message = (queryError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission') || (queryError as any).code === '42501') {
          router.push('/create-clinic');
          return;
        }

        setSearchState('error');
        setError('Try again.');
        return;
      }

      if (!data) {
        setSearchState('not_found');
        setShowNameSearch(true);
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
      setSearchState('error');
      setError(!navigator.onLine ? 'Check your connection and try again.' : 'Try again.');
    } finally {
      // Timing removed for production
    }
  };

  const runNameSearch = async () => {
    if (!nameInput.trim()) return;

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

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearchState('loading');

    try {
      // Simple ILIKE search for name (fuzzy match)
      const { data, error: queryError } = await getSupabase()
        .from('patient_balances')
        .select('patient_id, name, phone, balance, last_visit')
        .eq('clinic_id', activeClinicId)
        .ilike('name', `%${nameInput.trim()}%`)
        .limit(10)
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;

      if (queryError) {
        const message = (queryError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission') || (queryError as any).code === '42501') {
          router.push('/create-clinic');
          return;
        }
        setSearchState('error');
        setError('Try again.');
        return;
      }

      if (!data || data.length === 0) {
        setSearchState('not_found');
        return;
      }

      // For name search, show first match (could be expanded to list later)
      const firstMatch = data[0];
      const preview: PatientPreview = {
        id: firstMatch.patient_id,
        name: firstMatch.name,
        phone: firstMatch.phone,
        balance: Number(firstMatch.balance ?? 0),
        lastVisit: firstMatch.last_visit ?? null,
      };

      setPatient(preview);
      setSearchState('found');
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      setSearchState('error');
      setError(!navigator.onLine ? 'Check your connection and try again.' : 'Try again.');
    } finally {
      // Timing removed for production
    }
  };

  useEffect(() => {
    if (!authChecked || clinicLoading) return;

    if (!phoneInput.trim()) {
      abortRef.current?.abort();
      setSearchState('idle');
      setError(null);
      setPatient(null);
      setShowNameSearch(false);
      return;
    }

    setShowNameSearch(false);
    setSearchState('typing');
    const t = window.setTimeout(() => {
      void runPhoneSearch();
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneInput, activeClinicId, authChecked, clinicLoading]);

  useEffect(() => {
    if (!showNameSearch || !nameInput.trim()) {
      if (searchState === 'not_found' && !showNameSearch) {
        // Already in not_found from phone search, waiting for name input
      }
      return;
    }

    const t = window.setTimeout(() => {
      void runNameSearch();
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput, showNameSearch, activeClinicId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPhoneSearch();
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runNameSearch();
  };

  if (clinicLoading || !authChecked || !activeClinicId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <button
            onClick={() => (router.push as any)('/')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Dashboard
          </button>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Search Patient</h1>
          <p className="mt-2 text-gray-600">
            Find an existing patient by phone or name
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneInput}
                onChange={(e) => {
                  const formatted = formatPhoneForDisplay(e.target.value);
                  setPhoneInput(formatted);
                  setShowNameSearch(false);
                }}
                placeholder="e.g., 0712 345 678"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Supports: 0712345678, +254712345678, 254712345678
              </p>
              {digitsOnly.length > 0 && digitsOnly.length < 10 && (
                <p className="mt-1 text-xs text-red-600">Phone number must be at least 10 digits.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={searchState === 'loading' || !isValidKenyanPhone(phoneInput)}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                searchState === 'loading' || !isValidKenyanPhone(phoneInput)
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {searchState === 'loading' && phoneInput ? 'Searching...' : 'Search by Phone'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>

          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Patient Name
              </label>
              <input
                type="text"
                id="name"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (e.target.value.trim()) {
                    setShowNameSearch(true);
                  }
                }}
                placeholder="e.g., Jane Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={searchState === 'loading' || !nameInput.trim()}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                searchState === 'loading' || !nameInput.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500'
              }`}
            >
              {searchState === 'loading' && nameInput ? 'Searching...' : 'Search by Name'}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {searchState === 'loading' && (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Searching...</p>
          </div>
        )}

        {searchState === 'found' && patient && (
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
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
              className="w-full bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              View Details
            </button>
          </div>
        )}

        {searchState === 'not_found' && (
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">🔍</div>
              <h3 className="text-lg font-medium text-gray-900">No patient found</h3>
              <p className="text-sm text-gray-600 mt-1">
                {normalizedPhone?.startsWith('+') && `Phone: ${normalizedPhone}`}
                {!normalizedPhone?.startsWith('+') && nameInput && `Name: "${nameInput}"`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const phoneParam = normalizedPhone?.startsWith('+') ? normalizedPhone : '';
                router.push(`/patient/new?phone=${encodeURIComponent(phoneParam)}`);
              }}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium"
            >
              Add New Patient
            </button>
          </div>
        )}

        {!navigator.onLine && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-orange-700">You're offline. Some features may be limited.</span>
            <button
              type="button"
              className="text-xs font-medium border border-orange-300 bg-white px-3 py-1 rounded-md"
              onClick={() => {
                if (phoneInput && isValidKenyanPhone(phoneInput)) runPhoneSearch();
                else if (nameInput) runNameSearch();
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}