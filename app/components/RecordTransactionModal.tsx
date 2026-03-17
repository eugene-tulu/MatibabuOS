'use client';

import { useState, useEffect, useRef } from 'react';
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

type TransactionType = 'dispense' | 'payment';

interface RecordTransactionModalProps {
  patientId: string;
  patientName: string;
  clinicId: string;
  onClose: () => void;
  onTransactionAdded: (transaction: {
    id: string;
    amount: number;
    description: string;
    serviceTag: ServiceTag | null;
    createdAt: string;
    createdBy: string;
  }) => void;
}

export default function RecordTransactionModal({
  patientId,
  patientName,
  clinicId,
  onClose,
  onTransactionAdded,
}: RecordTransactionModalProps) {
  const { activeClinicId } = useClinic();
  const [type, setType] = useState<TransactionType>('dispense');
  const [serviceTag, setServiceTag] = useState<ServiceTag>('General Consult');
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeClinicId) {
      setError('No active clinic selected.');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const signedAmount = type === 'dispense' ? amountValue : -amountValue;
    const description = details.trim() || `${type === 'dispense' ? 'Dispense' : 'Payment'}`;

    setIsSubmitting(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();

      if (!user) {
        setError('Session expired. Please log in again.');
        onClose();
        return;
      }

      const { data: newTxn, error: insertError } = await getSupabase()
        .from('transactions')
        .insert({
          patient_id: patientId,
          clinic_id: activeClinicId,
          amount: signedAmount,
          description,
          service_tag: serviceTag,
          created_by: user.id,
        })
        .select('id, amount, description, service_tag, created_at, created_by')
        .single()
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;

      if (insertError) {
        const message = (insertError as any).message?.toLowerCase?.() ?? '';
        if (message.includes('permission')) {
          setError('Permission denied. Please check your clinic access.');
          return;
        }
        console.error('Create transaction error:', insertError);
        setError('Failed to record transaction. Please try again.');
        return;
      }

      const resolvedTxn = {
        id: newTxn.id,
        amount: Number(newTxn.amount),
        description: newTxn.description ?? '',
        serviceTag: newTxn.service_tag || null,
        createdAt: newTxn.created_at,
        createdBy: newTxn.created_by ?? '',
      };

      onTransactionAdded(resolvedTxn);
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return;
      console.error('Create transaction error:', err);
      setError('Failed to record transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Record Transaction for {patientName}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="dispense"
                  checked={type === 'dispense'}
                  onChange={() => setType('dispense')}
                  className="mr-2"
                  disabled={isSubmitting}
                />
                <span className={type === 'dispense' ? 'font-medium text-red-600' : 'text-gray-700'}>
                  Dispense (+)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="payment"
                  checked={type === 'payment'}
                  onChange={() => setType('payment')}
                  className="mr-2"
                  disabled={isSubmitting}
                />
                <span className={type === 'payment' ? 'font-medium text-green-600' : 'text-gray-700'}>
                  Payment (-)
                </span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="serviceTag" className="block text-sm font-medium text-gray-700 mb-1">
              Service Tag
            </label>
            <select
              id="serviceTag"
              value={serviceTag}
              onChange={(e) => setServiceTag(e.target.value as ServiceTag)}
              disabled={isSubmitting}
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
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 500"
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">
              Medication/Details
            </label>
            <input
              id="details"
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g., Amlodipine 5mg x30"
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional context..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className={`flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${
                isSubmitting || !amount
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? 'Recording...' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}