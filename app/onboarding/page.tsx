'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useClinic } from '@/contexts/ClinicContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { activeClinicId, loading, refreshClinics } = useClinic();

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      const clinics = await refreshClinics();

      if (clinics.length === 0 || !activeClinicId) {
        router.replace('/create-clinic');
      } else {
        router.replace('/');
      }
    };

    if (!loading) {
      void run();
    }
  }, [activeClinicId, loading, refreshClinics, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Preparing your workspace...</p>
    </div>
  );
}