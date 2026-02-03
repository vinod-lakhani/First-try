/**
 * Signup Page
 * 
 * User signup with Terms of Service and Privacy Policy consent.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TOS_VERSION, PRIVACY_POLICY_VERSION } from '@/lib/legal/constants';
import Link from 'next/link';
import { ArrowRight, Mail, Lock } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSigningUp(true);

    try {
      // Record consent via API
      const userId = `user-${Date.now()}`; // TODO: Generate proper user ID from auth system
      
      const consentResponse = await fetch('/api/consent/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          tosVersion: TOS_VERSION,
          ppVersion: PRIVACY_POLICY_VERSION,
        }),
      });

      if (!consentResponse.ok) {
        throw new Error('Failed to record consent');
      }

      // Store consent locally for now (until backend is fully implemented)
      const consentData = {
        id: Date.now().toString(),
        userId,
        consentType: 'signup' as const,
        tosVersion: TOS_VERSION,
        ppVersion: PRIVACY_POLICY_VERSION,
        createdAt: new Date().toISOString(),
      };
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(`weleap_consent_${userId}_signup`, JSON.stringify(consentData));
        localStorage.setItem('weleap_user_id', userId);
      }

      // TODO: Create user account via auth API
      // For now, redirect to onboarding
      router.push('/onboarding');
    } catch (error) {
      console.error('Signup error:', error);
      setError('Failed to create account. Please try again.');
      setIsSigningUp(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-4 py-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold">
            Create your account
          </CardTitle>
          <CardDescription className="text-base">
            Get started with WeLeap and take control of your financial future.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            {/* Consent Text */}
            <p className="text-sm text-slate-600 dark:text-slate-400">
              By signing up, you agree to our{' '}
              <Link href="/legal/terms" className="font-medium text-primary hover:underline" target="_blank">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="/legal/privacy" className="font-medium text-primary hover:underline" target="_blank">
                Privacy Policy
              </Link>
              .
            </p>

            {/* Sign Up Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSigningUp}
            >
              {isSigningUp ? 'Creating account...' : 'Sign Up'}
              {!isSigningUp && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

