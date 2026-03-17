'use client';

import { useRouter } from 'next/navigation';
import { useClinic } from '@/contexts/ClinicContext';
import { getSupabase } from '@/lib/supabaseClient';

export function Navbar() {
  const router = useRouter();
  const { userClinics, activeClinicId, switchClinic } = useClinic();

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    router.push('/auth');
  };

  const handleClinicChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = event.target.value;
    if (!newId) return;
    await switchClinic(newId);
  };

  if (userClinics.length === 0) {
    return null;
  }

  return (
    <nav className="w-full border-b bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="font-semibold text-gray-900">MatibabuOS</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Clinic</span>
            <select
              value={activeClinicId ?? ''}
              onChange={handleClinicChange}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {userClinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}

