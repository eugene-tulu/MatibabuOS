import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================================
// CLIENT-SIDE BROWSER CLIENT (for React components)
// ============================================================================
// This is used in client components via the useSupabase hook or getSupabase()
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase client not initialized. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.'
    );
  }

  // Create browser client if it doesn't exist
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

// ============================================================================
// SERVER-SIDE CLIENT FROM REQUEST (for server components, API routes)
// ============================================================================
export async function createSupabaseClientFromRequest(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables not set. Cannot create client from request.'
    );
  }

  // Import cookies dynamically - only available on server
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options });
      }
    }
  });
}

// ============================================================================
// MIDDLEWARE CLIENT (for middleware.ts)
// ============================================================================
export function createSupabaseClientForMiddleware(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase environment variables not set. Cannot create middleware client.'
    );
  }

  // For middleware, we need to manually parse cookies from request headers
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = new Map<string, string>();
  
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      if (name && value) {
        cookies.set(name, value);
      }
    });
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookies.get(name) ?? null;
      },
      set: () => {
        // Middleware can't set cookies directly - handled by NextResponse
      },
      remove: () => {
        // Middleware can't remove cookies directly
      }
    }
  });
}

// ============================================================================
// LEGACY SUPPORT
// ============================================================================
// Create a singleton client for backward compatibility (use with caution)
let supabase: ReturnType<typeof createBrowserClient> | null = null;

if (typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey) {
  supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Default export for backward compatibility
export { supabase };
