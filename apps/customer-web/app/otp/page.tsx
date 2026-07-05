'use client';

import type { CustomerSession } from '@aranyam/shared-types';
import { AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';
import { safeReturnPath } from '../../lib/safe-return-path';

export default function OtpPage() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('customerMobile')) router.replace('/login');
  }, [router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const mobileNumber = sessionStorage.getItem('customerMobile') ?? '';
      if (!mobileNumber) {
        router.replace('/login');
        return;
      }
      const session = await apiRequest<CustomerSession>(
        '/auth/customer/verify-otp',
        { method: 'POST', body: JSON.stringify({ mobileNumber, otp }) },
      );
      setSession(session);
      const requestedReturnTo = sessionStorage.getItem('customerReturnTo');
      const returnTo = safeReturnPath(requestedReturnTo, '/packages');
      sessionStorage.removeItem('customerReturnTo');
      router.push(returnTo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <form
        onSubmit={submit}
        className="surface-card mx-auto max-w-md p-6 sm:p-8"
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Change mobile number
        </Link>
        <span className="mt-7 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-semibold">
          Enter verification code
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We sent a 6-digit OTP to your mobile number. In local development,
          check the API console.
        </p>

        <Field
          label="OTP code"
          hint="The code expires shortly for your security."
          className="mt-7"
        >
          <Input
            aria-label="OTP code"
            className="text-center text-xl font-semibold tracking-[0.45em]"
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            required
          />
        </Field>

        {error && (
          <div
            role="alert"
            className="mt-4 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          className="mt-5 w-full"
          disabled={submitting || otp.length !== 6}
        >
          {submitting ? 'Verifying...' : 'Verify and continue'}
        </Button>
        <p className="mt-5 flex gap-2 rounded-xl bg-primary/[0.055] p-3 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Your profile, addresses, and order progress are protected behind this
          OTP session.
        </p>
      </form>
    </main>
  );
}
