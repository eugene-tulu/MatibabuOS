'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';

const SERVICE_TAGS = [
  'Chronic Care',
  'Acute Illness',
  'Immunization',
  'ANC',
  'General Consult',
  'Other',
] as const;

type ServiceTag = (typeof SERVICE_TAGS)[number];

export default function DashboardPage() {
  const router = useRouter();
  const { activeClinicId, loading: clinicLoading } = useClinic();
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Patient Ledger</h1>
          <p className="mt-2 text-gray-600">
            Search by phone or add a new patient record
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => (router.push as any)('/search')}
            className="w-full flex items-center justify-center px-8 py-6 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <span className="text-2xl mr-3">🔍</span>
            <div className="text-left">
              <div className="font-semibold">Search Existing Patient</div>
              <div className="text-sm text-blue-100">Find by phone number</div>
            </div>
          </button>

          <button
            onClick={() => (router.push as any)('/add')}
            className="w-full flex items-center justify-center px-8 py-6 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <span className="text-2xl mr-3">➕</span>
            <div className="text-left">
              <div className="font-semibold">Add New Patient</div>
              <div className="text-sm text-gray-500">Create a new record</div>
            </div>
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Two workflows, one simple system.</p>
        </div>
      </div>
    </div>
  );
}