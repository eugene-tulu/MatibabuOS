'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getUserClinics, validateActiveClinic } from '@/utils/sessionValidation';

interface Clinic {
  id: string;
  name: string;
  createdAt: string;
  role?: string;
}

interface ClinicContextType {
  activeClinicId: string | null;
  setActiveClinicId: (id: string | null) => void;
  userClinics: Clinic[];
  setUserClinics: (clinics: Clinic[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  switchClinic: (clinicId: string) => Promise<void>;
  refreshClinics: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

const ACTIVE_CLINIC_STORAGE_KEY = 'activeClinicId';
const ACTIVE_CLINIC_COOKIE_NAME = 'active_clinic_id';

function setActiveClinicCookie(id: string | null) {
  if (typeof document === 'undefined') return;

  if (id) {
    document.cookie = `${ACTIVE_CLINIC_COOKIE_NAME}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 30}`;
  } else {
    document.cookie = `${ACTIVE_CLINIC_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [userClinics, setUserClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const setActiveClinicId = useCallback((id: string | null) => {
    setActiveClinicIdState(id);

    if (typeof window !== 'undefined') {
      if (id) {
        window.localStorage.setItem(ACTIVE_CLINIC_STORAGE_KEY, id);
      } else {
        window.localStorage.removeItem(ACTIVE_CLINIC_STORAGE_KEY);
      }
    }

    setActiveClinicCookie(id);
  }, []);

  const refreshClinics = useCallback(async () => {
    try {
      const clinics = await getUserClinics();
      setUserClinics(clinics);
      return clinics;
    } catch (error) {
      console.error('Failed to refresh clinics', error);
      setUserClinics([]);
      return [];
    }
  }, []);

  const switchClinic = useCallback(
    async (clinicId: string) => {
      if (!clinicId) return;

      const isValid = await validateActiveClinic(clinicId);
      if (!isValid) {
        console.warn('Attempted to switch to invalid clinic', clinicId);
        return;
      }

      setActiveClinicId(clinicId);
    },
    [setActiveClinicId],
  );

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (!isMounted) return;
          setUserClinics([]);
          setActiveClinicId(null);
          setLoading(false);
          return;
        }

        const clinics = await refreshClinics();

        let initialActiveClinicId: string | null = null;

        if (typeof window !== 'undefined') {
          const fromStorage = window.localStorage.getItem(ACTIVE_CLINIC_STORAGE_KEY);
          if (fromStorage && clinics.some((c) => c.id === fromStorage)) {
            const isValid = await validateActiveClinic(fromStorage);
            if (isValid) {
              initialActiveClinicId = fromStorage;
            }
          }
        }

        if (!initialActiveClinicId && clinics.length > 0) {
          initialActiveClinicId = clinics[0].id;
        }

        if (isMounted) {
          setActiveClinicId(initialActiveClinicId);
        }
      } catch (error) {
        console.error('Error initializing clinic context', error);
        if (isMounted) {
          setUserClinics([]);
          setActiveClinicId(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [refreshClinics, setActiveClinicId]);

  return (
    <ClinicContext.Provider
      value={{
        activeClinicId,
        setActiveClinicId,
        userClinics,
        setUserClinics,
        loading,
        setLoading,
        switchClinic,
        refreshClinics,
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