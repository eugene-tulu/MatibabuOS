'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { validatePassword } from '@/utils/authUtils';

type Mode = 'sign-in' | 'sign-up';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();
  
  // Rate limiting for magic link
  const magicLinkTimestamps = useRef<number[]>([]);
  const MAGIC_LINK_RATE_LIMIT = 3; // max 3 attempts
  const MAGIC_LINK_RATE_WINDOW_MS = 60 * 1000; // per minute

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    // Validate password strength only during sign-up
    if (mode === 'sign-up') {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.errors.join(' '));
        return;
      }
    }

    setIsLoading(true);

    try {
      let userId: string | null = null;
      
      if (mode === 'sign-in') {
        const { error: signInError, data } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }
        userId = data.user?.id ?? null;
      } else {
        const { error: signUpError, data } = await getSupabase().auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // Check if email confirmation is required
        // If email_confirmed_at is null, the user needs to confirm their email
        if (data?.user && !data.user.email_confirmed_at) {
          // User was created but needs to confirm email
          setInfo('Please check your email to confirm your account. You will be redirected after confirmation.');
          // Don't redirect yet - wait for email confirmation
          return;
        }
        userId = data.user?.id ?? null;
      }

      // Check if user already has a clinic
      if (userId) {
        const { data: userClinics } = await getSupabase()
          .from('user_clinics')
          .select('clinic_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (userClinics) {
          // User already has a clinic, redirect to home
          router.push('/');
          return;
        }
      }

      // User doesn't have a clinic yet, redirect to create clinic
      router.push('/create-clinic');
    } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You appear to be offline. Please check your internet connection and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!magicEmail) {
      setError('Please enter your email for magic link.');
      return;
    }

    // Client-side rate limiting
    const now = Date.now();
    const oneMinuteAgo = now - MAGIC_LINK_RATE_WINDOW_MS;
    
    // Remove timestamps older than 1 minute
    magicLinkTimestamps.current = magicLinkTimestamps.current.filter(t => t > oneMinuteAgo);
    
    if (magicLinkTimestamps.current.length >= MAGIC_LINK_RATE_LIMIT) {
      setError(`Too many requests. Please wait ${Math.ceil((magicLinkTimestamps.current[0] + MAGIC_LINK_RATE_WINDOW_MS - now) / 1000)} seconds before trying again.`);
      return;
    }
    
    magicLinkTimestamps.current.push(now);

    setIsLoading(true);

    try {
      const { error: magicError } = await getSupabase().auth.signInWithOtp({
        email: magicEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (magicError) {
        setError(magicError.message);
        return;
      }

      setInfo('Magic link sent! Please check your email and click the link to sign in.');
      // Clear the magic link rate limit on success to allow sending to another email if needed
      magicLinkTimestamps.current = [];
    } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You appear to be offline. Please check your internet connection and try again.');
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Clear rate limit when email changes
  useState(() => {
    return () => {
      magicLinkTimestamps.current = [];
    };
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Welcome to MatibabuOS</h1>
          <p className="text-sm text-gray-600">
            {mode === 'sign-in' ? 'Sign in to your account' : 'Create your account to get started'}
          </p>
        </div>

        <div className="flex justify-center gap-2 text-sm">
          <button
            type="button"
            className={`px-3 py-1 rounded-full border ${
              mode === 'sign-in' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
            }`}
            onClick={() => setMode('sign-in')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-full border ${
              mode === 'sign-up' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700'
            }`}
            onClick={() => setMode('sign-up')}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            />
            {mode === 'sign-up' && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">Password must contain:</p>
                <ul className="text-xs space-y-0.5">
                  <li className={password.length >= 8 ? 'text-green-600' : 'text-gray-500'}>
                    • At least 8 characters
                  </li>
                  <li className={/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • At least one lowercase letter
                  </li>
                  <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • At least one uppercase letter
                  </li>
                  <li className={/\d/.test(password) ? 'text-green-600' : 'text-gray-500'}>
                    • At least one number
                  </li>
                </ul>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-green-600">{info}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (mode === 'sign-in' ? 'Signing in...' : 'Signing up...') : mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="border-t pt-4 space-y-3">
          <p className="text-xs text-gray-500 text-center">Or use a magic link</p>
          <form onSubmit={handleMagicLink} className="space-y-3">
            <input
              type="email"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              {isLoading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

