import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const authOnlyRoutes = ['/create-clinic', '/onboarding', '/patient'];
const clinicRequiredRoutes = ['/', '/patient'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authUrl = request.nextUrl.clone();
    authUrl.pathname = '/auth';
    authUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(authUrl);
  }

  const requiresClinic = clinicRequiredRoutes.some((route) =>
    route === '/'
      ? pathname === '/'
      : pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!requiresClinic && authOnlyRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  const activeClinicIdCookie = request.cookies.get('active_clinic_id')?.value;

  if (!requiresClinic) {
    return NextResponse.next();
  }

  if (!activeClinicIdCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/create-clinic';
    return NextResponse.redirect(url);
  }

  const { data, error } = await supabase
    .from('user_clinics')
    .select('clinic_id')
    .eq('user_id', user.id)
    .eq('clinic_id', activeClinicIdCookie)
    .maybeSingle();

  if (error || !data) {
    const url = request.nextUrl.clone();
    url.pathname = '/create-clinic';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};