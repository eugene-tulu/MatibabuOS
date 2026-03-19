import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForMiddleware } from '@/lib/supabaseClient';

// Routes that require the user to be authenticated (excluding /auth itself)
const protectedRoutes = ['/', '/create-clinic', '/onboarding', '/patient'];
// Routes that additionally require a clinic to be selected
const clinicRequiredRoutes = ['/', '/patient'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Get supabase client with request cookies for proper auth checking
  let supabase;
  try {
    supabase = createSupabaseClientForMiddleware(request);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    // Always require Supabase configuration - this should never happen in any environment
    // Redirect to auth page with a clear error message
    const errorParams = new URLSearchParams({
      error: 'Server configuration error. Please check environment variables.'
    });
    return NextResponse.redirect(`${request.nextUrl.origin}/auth?${errorParams.toString()}`);
  }

  // Special handling for auth pages
  if (pathname.startsWith('/auth')) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // For all protected routes, check authentication first
  const isProtectedRoute = protectedRoutes.some((route) =>
    route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`)
  );

  let user = null;
  
  if (isProtectedRoute) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      return NextResponse.redirect(url);
    }
    
    user = authUser;
  }

  // Check clinic requirement for routes that need it
  const requiresClinic = clinicRequiredRoutes.some((route) =>
    route === '/'
      ? pathname === '/'
      : pathname === route || pathname.startsWith(`${route}/`),
  );

  if (requiresClinic && user) {
    // First, check if user has any clinics at all
    const { data: existingClinics } = await supabase
      .from('user_clinics')
      .select('clinic_id')
      .eq('user_id', user.id);

    if (!existingClinics || existingClinics.length === 0) {
      // User has no clinics, redirect to create clinic
      const url = request.nextUrl.clone();
      url.pathname = '/create-clinic';
      return NextResponse.redirect(url);
    }

    // User has at least one clinic. If an active_clinic_id cookie is present, validate it.
    // If invalid, we'll ignore it and let the client handle clinic selection.
    const activeClinicIdCookie = request.cookies.get('active_clinic_id')?.value;
    if (activeClinicIdCookie) {
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', user.id)
        .eq('clinic_id', activeClinicIdCookie)
        .maybeSingle();

      if (!userClinic) {
        // Invalid cookie - clear it so client can set a new one
        const response = NextResponse.next();
        response.cookies.delete('active_clinic_id');
        return response;
      }
    }
    // Allow request to proceed - client will set active clinic if needed
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};