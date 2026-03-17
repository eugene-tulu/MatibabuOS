import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

// Routes that require the user to be authenticated (excluding /auth itself)
const protectedRoutes = ['/', '/create-clinic', '/onboarding', '/patient'];
// Routes that additionally require a clinic to be selected
const clinicRequiredRoutes = ['/', '/patient'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Get supabase client - will throw if env vars not set
  let supabase;
  try {
    supabase = getSupabase();
  } catch (error) {
    // In development, allow passing through if Supabase not configured
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.next();
    }
    // In production, this should never happen - redirect to auth error
    return NextResponse.redirect(`${request.nextUrl.origin}/auth?error=Server%20configuration%20error`);
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
    const activeClinicIdCookie = request.cookies.get('active_clinic_id')?.value;

    if (!activeClinicIdCookie) {
      const url = request.nextUrl.clone();
      url.pathname = '/create-clinic';
      return NextResponse.redirect(url);
    }

    // Validate that the user has access to this clinic
    const { data: userClinic, error: clinicError } = await supabase
      .from('user_clinics')
      .select('clinic_id')
      .eq('user_id', user.id)
      .eq('clinic_id', activeClinicIdCookie)
      .maybeSingle();

    if (clinicError || !userClinic) {
      // User doesn't have access to this clinic, redirect to create clinic
      const url = request.nextUrl.clone();
      url.pathname = '/create-clinic';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};