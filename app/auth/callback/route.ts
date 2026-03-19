import { NextResponse } from 'next/server';
import { createSupabaseClientFromRequest } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/create-clinic';

  // Handle OAuth errors from Supabase
  if (error) {
    const errorMsg = encodeURIComponent(
      errorDescription || 'Authentication failed. Please try again.'
    );
    return NextResponse.redirect(`${origin}/auth?error=${errorMsg}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=Missing%20authorization%20code`);
  }

  try {
    const supabase = await createSupabaseClientFromRequest(request);
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const errorMsg = encodeURIComponent(
        exchangeError.message || 'Failed to verify authentication. Please try again.'
      );
      return NextResponse.redirect(`${origin}/auth?error=${errorMsg}`);
    }

    // Check if user has a clinic, if not redirect to create clinic
    if (data?.user) {
      const { data: userClinics } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!userClinics) {
        return NextResponse.redirect(`${origin}/create-clinic`);
      }
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch {
    const errorMsg = encodeURIComponent('Authentication failed. Please try again.');
    return NextResponse.redirect(`${origin}/auth?error=${errorMsg}`);
  }
}