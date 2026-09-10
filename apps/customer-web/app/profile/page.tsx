'use client';

import { ClipboardList, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { UserProfile } from '@aranyam/shared-types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { AuthRequiredPanel, StatePanel } from '../../components/ui/state-panel';
import { apiRequest } from '../../lib/api';
import { useSessionStore } from '../../store/session.store';
import { clearCustomerState } from '../../lib/customer-auth';

export default function ProfilePage() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    mobileNumber: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    apiRequest<UserProfile>('/me', {}, session.accessToken)
      .then((data) =>
        setProfile({
          name: data.name ?? '',
          email: data.email ?? '',
          mobileNumber: data.mobileNumber,
        }),
      )
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session)
    return (
      <AuthRequiredPanel
        title="Sign in to manage your profile"
        description="Manage your details, saved venues, and order history."
        returnHref="/profile"
      />
    );
  if (loading)
    return (
      <main className="page-shell">
        <StatePanel tone="loading" title="Loading your profile" />
      </main>
    );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(
        '/me',
        {
          method: 'PATCH',
          body: JSON.stringify({ name: profile.name, email: profile.email }),
        },
        session!.accessToken,
      );
      setMessage('Profile updated');
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function logout() {
    try {
      await apiRequest(
        '/auth/customer/logout',
        { method: 'POST' },
        session!.accessToken,
      );
    } finally {
      clearCustomerState();
      router.replace('/');
    }
  }

  return (
    <main className="page-shell pb-28">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold sm:mt-3 sm:text-5xl">Profile</h1>
      <div className="mt-5 grid gap-5 sm:mt-8 sm:gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={save} className="surface-card space-y-4 p-5 sm:p-8">
          <Field label="Verified mobile">
            <Input value={profile.mobileNumber} disabled />
          </Field>
          <Field label="Name" optional>
            <Input
              placeholder="Name"
              value={profile.name}
              onChange={(event) =>
                setProfile({ ...profile, name: event.target.value })
              }
            />
          </Field>
          <Field label="Email" optional>
            <Input
              placeholder="Email"
              type="email"
              value={profile.email}
              onChange={(event) =>
                setProfile({ ...profile, email: event.target.value })
              }
            />
          </Field>
          {message && (
            <p className="rounded-xl bg-primary/[0.055] p-3 text-sm font-medium text-primary">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button>Save profile</Button>
            <Button type="button" variant="outline" onClick={logout}>
              Log out
            </Button>
          </div>
        </form>
        <aside className="space-y-3">
          <Link
            href="/orders"
            className="surface-card flex items-center gap-4 p-5 transition hover:border-primary/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span>
              <strong className="block">Your orders</strong>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                History and live status
              </span>
            </span>
          </Link>
          <Link
            href="/addresses?tab=saved"
            className="surface-card flex items-center gap-4 p-5 transition hover:border-primary/30"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            <span>
              <strong className="block">Saved addresses</strong>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                Homes and event venues
              </span>
            </span>
          </Link>
        </aside>
      </div>
    </main>
  );
}
