'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClinic } from '@/contexts/ClinicContext';

export default function OnboardingPage() {
  const [clinicName, setClinicName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setActiveClinicId, setUserClinics } = useClinic();

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!clinicName.trim()) {
      setError('Please enter a clinic name');
      return;
    }

    setIsLoading(true);
    
    try {
      // In a real implementation, this would call the API to create a clinic
      // For now, we'll simulate the creation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Simulate a new clinic being created
      const newClinic = {
        id: 'clinic-' + Date.now(), // In reality, this would come from the backend
        name: clinicName,
        createdAt: new Date().toISOString(),
      };
      
      // Update context with the new clinic
      setUserClinics([newClinic]);
      setActiveClinicId(newClinic.id);
      
      // Redirect to the main app
      router.push('/');
    } catch (err) {
      setError('Failed to create clinic. Please try again.');
      console.error('Clinic creation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 mt-10">
      <h1 className="text-2xl font-bold text-center mb-6">Welcome to MatibabuOS</h1>
      <p className="text-center text-gray-600 mb-6">
        Please create your clinic to get started
      </p>
      
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
          {isLoading ? 'Creating Clinic...' : 'Create Clinic'}
        </button>
      </form>
    </div>
  );
}