'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { track } from '@/lib/analytics';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          signupType: 'salary_tool',
          page: '/salary-to-apartment',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setIsSuccess(true);
      setEmail('');
      track('offer_tool_waitlist_submitted', { email });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-[#D1D5DB] bg-white">
        <CardHeader>
          <CardTitle className="text-xl text-[#111827]">Thank you!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[#111827]/80">
            You&apos;ve been added to the waitlist. We&apos;ll let you know when WeLeap is ready
            to help you plan your full financial picture.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#D1D5DB] bg-white">
      <CardHeader>
        <CardTitle className="text-xl text-[#111827]">Want the full plan when you start?</CardTitle>
        <CardDescription className="text-[#111827]/70">
          Join the WeLeap waitlist to get personalized financial planning when you start your new job.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 border-[#D1D5DB]"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#3F6B42] text-white hover:bg-[#3F6B42]/90"
            >
              {isSubmitting ? 'Joining...' : 'Join waitlist'}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
