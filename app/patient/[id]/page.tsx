'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { normalizePhone } from '@/utils/phoneUtils';
import { useClinic } from '@/contexts/ClinicContext';
import { getSupabase } from '@/lib/supabaseClient';
import RecordTransactionModal from '../../components/RecordTransactionModal';

const SERVICE_TAGS = [
  'Chronic Care',
  'Acute Illness',
  'Immunization',
  'ANC',
  'General Consult',
  'Other',
] as const;

type ServiceTag = (typeof SERVICE_TAGS)[number];

interface Transaction {
  id: string;
  amount: number;
  description: string;
  serviceTag: ServiceTag | null;
  createdAt: string;
  createdBy: string;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  balance: number;
  createdAt: string;
}

export default function PatientDetailPage() {
  const { id: patientId } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const { activeClinicId, loading: clinicLoading } = useClinic();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const decodedPatientId = typeof patientId === 'string' ? decodeURIComponent(patientId) : '';
  
   const fetchPatientData = useCallback(async (signal: AbortSignal) => {
     if (!decodedPatientId || !activeClinicId) return;

     try {
       // Validate that the user has access to the active clinic before attempting to fetch patient data
       const { data: { user }, error: userError } = await getSupabase().auth.getUser();
       if (userError || !user) {
         setError('Authentication error. Please sign in again.');
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
         setError('You no longer have access to this clinic. Please select another clinic.');
         // Clear the invalid clinic from storage
         if (typeof window !== 'undefined') {
           window.localStorage.removeItem('activeClinicId');
         }
         // Remove the cookie as well
         document.cookie = 'active_clinic_id=; path=/; max-age=0';
         return;
       }

       const { data: patientRow, error: patientError } = await getSupabase()
         .from('patient_balances')
         .select('patient_id, name, phone, balance')
         .eq('clinic_id', activeClinicId)
         .eq('patient_id', decodedPatientId)
         .maybeSingle()
         .abortSignal(signal);

       // If the request was aborted, don't process any errors
       if (signal.aborted) return;

       if (patientError) {
         const errorObj = patientError as any;
         const msg = errorObj.message?.toLowerCase?.() ?? '';
         const code = errorObj.code;

         if (msg.includes('permission') || msg.includes('not authorized') || code === '42501') {
           setError('Access denied. You may not have permission to view this patient.');
           return;
         }
         if (msg.includes('not found') || code === 'PGRST116' || msg.includes('no rows')) {
           setError('Patient not found in this clinic.');
           return;
         }
         if (msg.includes('timeout') || msg.includes('aborted')) {
           setError('Request timed out. Please check your connection and try again.');
           return;
         }
         if (msg.includes('network') || msg.includes('failed to fetch')) {
           setError('Network error. Please check your internet connection.');
           return;
         }
         setError('Failed to load patient data. Please try again.');
         return;
       }

       // Handle case where patient doesn't exist
       if (!patientRow) {
         setError('Patient not found.');
         return;
       }

       const resolvedPatient: Patient = {
         id: patientRow.patient_id,
         name: patientRow.name,
         phone: normalizePhone(patientRow.phone),
         balance: Number(patientRow.balance ?? 0),
         createdAt: new Date().toISOString(),
       };

       const { data: txnRows, error: txnError } = await getSupabase()
         .from('transactions')
         .select('id, amount, description, service_tag, created_at, created_by')
         .eq('clinic_id', activeClinicId)
         .eq('patient_id', decodedPatientId)
         .order('created_at', { ascending: false })
         .limit(50)
         .abortSignal(signal);

       // If the request was aborted, don't process any errors
       if (signal.aborted) return;

       const resolvedTxns: Transaction[] =
         txnRows?.map((t: any) => ({
           id: t.id,
           amount: Number(t.amount ?? 0),
           description: t.description ?? '',
           serviceTag: t.service_tag || null,
           createdAt: t.created_at,
           createdBy: t.created_by ?? '',
         })) ?? [];

       setPatient(resolvedPatient);
       setTransactions(resolvedTxns);
     } catch (err) {
       if (
         (err as any)?.name === 'AbortError' ||
         (err as any)?.message?.includes('aborted') ||
         (err as any)?.message?.includes('The operation was aborted')
       ) {
         // Request was aborted (normal during component unmount/fast refresh)
         return;
       }
       setError('Failed to load patient data. Please try again.');
     }
   }, [decodedPatientId, activeClinicId]);
  
  // Consolidated effect for fetching patient data
  useEffect(() => {
    if (!decodedPatientId) {
      setPatient(null);
      setTransactions([]);
      setError(null);
      return;
    }

    // Wait for clinic to finish loading before attempting to fetch patient data
    if (clinicLoading) {
      setLoading(true);
      return;
    }

    // Only proceed if we have a valid active clinic ID
    if (!activeClinicId) {
      setError('No clinic selected. Please select a clinic first.');
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setLoading(true);
    setError(null);

    void fetchPatientData(abortController.signal).finally(() => {
      // Only set loading to false if this is still the current request
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    });

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [decodedPatientId, activeClinicId, clinicLoading, fetchPatientData]);

  const handleTransactionAdded = (newTransaction: Transaction) => {
    setTransactions((prev) => [newTransaction, ...prev]);
    setPatient((prev) => prev ? { ...prev, balance: prev.balance + newTransaction.amount } : prev);
    setShowTransactionModal(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-32"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse w-48"></div>
              <div className="h-5 bg-gray-200 rounded animate-pulse w-40"></div>
            </div>
            <div className="space-y-3">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-20"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse w-32"></div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 bg-gray-200 rounded animate-pulse flex-1"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse flex-1"></div>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-40 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-red-600">{error}</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white shadow rounded-lg p-6">
          <p>Patient not found</p>
          <Link href="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Back to Search
        </Link>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Patient Details</h2>
            <p className="font-medium text-gray-900 mt-1">{patient.name}</p>
            {patient.phone && <p className="text-gray-600">{patient.phone}</p>}
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Balance</h3>
            <p className={`text-2xl font-bold ${patient.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {Math.abs(patient.balance).toFixed(2)}
              {patient.balance < 0 ? ' Credit' : patient.balance > 0 ? ' Owed' : ''}
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTransactionModal(true)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium"
            >
              + Record Transaction
            </button>
            <button
              onClick={() => {
                alert('Edit functionality coming in a future update.');
              }}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
            >
              Edit Patient
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction History</h3>
        
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No transactions yet.</p>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
            >
              Record your first transaction →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.serviceTag || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.description}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTransactionModal && (
        <RecordTransactionModal
          patientId={patient.id}
          patientName={patient.name}
          clinicId={activeClinicId!}
          onClose={() => setShowTransactionModal(false)}
          onTransactionAdded={handleTransactionAdded}
        />
      )}
    </div>
  );
}