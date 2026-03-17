import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/create-clinic';

  if (code) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error) {
        // Check if user has a clinic, if not redirect to create clinic
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userClinics } = await supabase
            .from('user_clinics')
            .select('clinic_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!userClinics) {
            return NextResponse.redirect(`${origin}/create-clinic`);
          }
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch (err) {
      console.error('Auth callback error:', err);
    }
  }

  // Return an error response if code exchange fails
  return NextResponse.redirect(`${origin}/auth?error=Invalid%20authentication%20link`);
}