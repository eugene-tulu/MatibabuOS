'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface Clinic {
  id: string;
  name: string;
  createdAt: string;
}

interface ClinicContextType {
  activeClinicId: string | null;
  setActiveClinicId: (id: string | null) => void;
  userClinics: Clinic[];
  setUserClinics: (clinics: Clinic[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [userClinics, setUserClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from localStorage
  useEffect(() => {
    const savedClinicId = localStorage.getItem('activeClinicId');
    if (savedClinicId) {
      setActiveClinicId(savedClinicId);
    }
    setLoading(false);
  }, []);

  // Update localStorage when active clinic changes
  useEffect(() => {
    if (activeClinicId) {
      localStorage.setItem('activeClinicId', activeClinicId);
    } else {
      localStorage.removeItem('activeClinicId');
    }
  }, [activeClinicId]);

  return (
    <ClinicContext.Provider
      value={{
        activeClinicId,
        setActiveClinicId,
        userClinics,
        setUserClinics,
        loading,
        setLoading,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}