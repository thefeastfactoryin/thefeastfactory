'use client';

import {
  AlertCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { apiRequest } from '../../lib/api';
import { safeReturnPath } from '../../lib/safe-return-path';
import { useSessionStore } from '../../store/session.store';

function LoginContent() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = safeReturnPath(requestedReturnTo, '/packages');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) router.replace(returnTo);
  }, [session, returnTo, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/auth/customer/request-otp', {
        method: 'POST',
        body: JSON.stringify({ mobileNumber }),
      });
      sessionStorage.setItem('customerMobile', mobileNumber);
      sessionStorage.setItem('customerReturnTo', returnTo);
      router.push('/otp');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="max-w-2xl">
          <p className="eyebrow">Secure customer access</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold sm:text-6xl">
            Plan catering without back-and-forth calls.
          </h1>
          <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
            Sign in with your mobile number to save venues, build menus, pay
            securely, and track every order update.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['OTP verified', 'No password to remember'],
              ['Saved venues', 'Faster checkout next time'],
              ['Live status', 'Order updates in one place'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border bg-white/70 p-4">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="surface-card p-6 sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <h2 className="mt-5 font-serif text-3xl font-semibold">
            Continue with mobile
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We will send a 6-digit OTP to verify your number.
          </p>

          <Field
            label="Mobile number"
            hint="Use a 10-digit Indian mobile number."
            className="mt-7"
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                +91
              </span>
              <Input
                aria-label="Mobile number"
                className="pl-14"
                value={mobileNumber}
                onChange={(event) =>
                  setMobileNumber(
                    event.target.value.replace(/\D/g, '').slice(0, 10),
                  )
                }
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                placeholder="9876543210"
                required
              />
              <Smartphone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
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
            disabled={submitting || mobileNumber.length !== 10}
          >
            {submitting ? 'Sending OTP...' : 'Send OTP'}
          </Button>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            By continuing, your order details stay linked to this verified
            mobile number.
          </p>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="page-shell">
          <div className="h-96 animate-pulse rounded-xl bg-white/60" />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
