'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { normalizePhone } from '@/utils/phoneUtils';
import { useClinic } from '@/contexts/ClinicContext';
import { getSupabase } from '@/lib/supabaseClient';

interface Transaction {
  id: string;
  amount: number;
  description: string;
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
  const { activeClinicId } = useClinic();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Decode the patient ID if it's encoded
  const decodedPatientId = typeof patientId === 'string' ? decodeURIComponent(patientId) : '';

  useEffect(() => {
    // Abort any in-flight request when dependencies change
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchPatientData = async () => {
      try {
        // Only set loading if this is the most recent request
        if (abortControllerRef.current !== abortController) {
          return;
        }
        setLoading(true);

        if (!navigator.onLine) {
          if (abortControllerRef.current === abortController) {
            setError('You appear to be offline. Please connect and try again.');
          }
          return;
        }

        if (!activeClinicId) {
          if (abortControllerRef.current === abortController) {
            setError('No active clinic selected.');
          }
          return;
        }

        const { data: patientRow, error: patientError } = await getSupabase()
          .from('patient_balances')
          .select('patient_id, name, phone, balance')
          .eq('clinic_id', activeClinicId)
          .eq('patient_id', decodedPatientId)
          .single()
          .abortSignal(abortController.signal);

        if (patientError) {
          const msg = (patientError as any).message?.toLowerCase?.() ?? '';
          if (msg.includes('permission')) {
            setError('Access denied.');
            return;
          }
          console.error('Patient detail error:', patientError);
          setError('Failed to load patient data. Please try again.');
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
          .select('id, amount, description, created_at, created_by')
          .eq('clinic_id', activeClinicId)
          .eq('patient_id', decodedPatientId)
          .order('created_at', { ascending: false })
          .limit(50)
          // @ts-expect-error - abortSignal is supported in supabase-js but types may be outdated
          .abortSignal(abortController.signal);

        if (txnError) {
          console.error('Transaction fetch error:', txnError);
        }

        const resolvedTxns: Transaction[] =
          txnRows?.map((t: any) => ({
            id: t.id,
            amount: Number(t.amount ?? 0),
            description: t.description ?? '',
            createdAt: t.created_at,
            createdBy: t.created_by ?? '',
          })) ?? [];

        setPatient(resolvedPatient);
        setTransactions(resolvedTxns);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          return; // Silently ignore abort errors
        }
        if (abortControllerRef.current === abortController) {
          setError('Failed to load patient data. Please try again.');
          console.error('Patient detail error:', err);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          setLoading(false);
        }
      }
    };

    if (decodedPatientId) {
      fetchPatientData();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [decodedPatientId, activeClinicId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white shadow rounded-lg p-6">
          <p>Loading patient details...</p>
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
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← Back to Search
        </Link>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h2 className="text-xl font-semibold">Patient Details</h2>
            <p className="font-medium">{patient.name}</p>
            <p>{patient.phone}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Balance</h3>
            <p className={`text-2xl font-bold ${patient.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              KES {Math.abs(patient.balance).toFixed(2)}
              {patient.balance < 0 ? ' Credit' : patient.balance > 0 ? ' Owed' : ''}
            </p>
          </div>
          
          <div className="flex space-x-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Add Dispense
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
              Record Payment
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Transaction History</h3>
        
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
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
                      {transaction.description}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                      transaction.amount >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.amount >= 0 ? 'Dispense' : 'Payment'}
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
    </div>
  );
}