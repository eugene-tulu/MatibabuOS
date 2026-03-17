'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizePhone } from '@/utils/phoneUtils';
import { useClinic } from '@/contexts/ClinicContext';
import { supabase } from '@/lib/supabaseClient';

export default function HomePage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { activeClinicId, loading: clinicLoading } = useClinic();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!phoneInput.trim()) {
      setError('Please enter a phone number');
      return;
    }

    const normalizedPhone = normalizePhone(phoneInput);
    
    if (!normalizedPhone || normalizedPhone.startsWith('+') === false) {
      setError('Invalid phone number format');
      return;
    }

    setIsLoading(true);
    
    try {
      // In a real implementation, this would call the API to search for the patient
      // For now, we'll simulate the search
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to patient page (this would be dynamic based on search results)
      router.push(`/patient/${encodeURIComponent(normalizedPhone)}`);
    } catch (err) {
      setError('Failed to search for patient. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
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
      
      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Patient Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Enter phone number (e.g., 0712345678)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports formats: 0712345678, 712345678, +254712345678
          </p>
        </div>
        
        {error && (
          <div className="text-red-600 text-sm py-2">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {isLoading ? 'Searching...' : 'Search Patient'}
        </button>
      </form>
    </div>
  );
}