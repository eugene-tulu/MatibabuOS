import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create Supabase client only if env vars are present
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Only log warning in development, will be caught by middleware in production
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Supabase environment variables not set. Some features may not work.');
  }
}

// Export a safe wrapper that throws a helpful error if supabase is not initialized
export const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    throw new Error(
      'Supabase client not initialized. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
    );
  }
  return supabase;
};

// Default export for backward compatibility - will throw if used without env vars
export { supabase };