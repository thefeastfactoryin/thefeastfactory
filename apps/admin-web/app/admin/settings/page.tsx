'use client';
import type { IntegrationReadiness } from '@aranyam/shared-types';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { apiRequest } from '../../../lib/api';
import { useAdminSessionStore } from '../../../store/session.store';

const businessKeys = [
  'business_legal_name',
  'business_trade_name',
  'business_address',
  'business_gstin',
  'business_state_code',
  'business_pan',
  'business_support_email',
  'business_support_phone',
  'business_logo_url',
  'invoice_prefix',
  'receipt_prefix',
  'credit_note_prefix',
  'tax_cgst_rate',
  'tax_sgst_rate',
  'tax_igst_rate',
  'tax_sac_code',
  'invoice_legal_footer',
];

const operationalSettings = [
  {
    key: 'min_booking_lead_hours',
    label: 'Minimum booking lead time',
    suffix: 'hours',
    type: 'number',
    min: 0,
  },
  {
    key: 'event_service_start_time',
    label: 'Earliest event time',
    type: 'time',
  },
  { key: 'event_service_end_time', label: 'Latest event time', type: 'time' },
  {
    key: 'event_time_interval_minutes',
    label: 'Event-time interval',
    suffix: 'minutes',
    type: 'number',
    min: 1,
  },
  {
    key: 'otp_expiry_seconds',
    label: 'OTP expiry',
    suffix: 'seconds',
    type: 'number',
    min: 60,
  },
  {
    key: 'otp_max_attempts',
    label: 'OTP maximum attempts',
    type: 'number',
    min: 1,
  },
  { key: 'razorpay_currency', label: 'Razorpay currency', type: 'text' },
] as const;
type PlatformSetting = { key: string; value: string };
export default function Settings() {
  const session = useAdminSessionStore((state) => state.session);
  const [values, setValues] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<IntegrationReadiness>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiRequest<PlatformSetting[]>('/admin/settings', {}, session.accessToken),
      apiRequest<IntegrationReadiness>(
        '/admin/integrations/readiness',
        {},
        session.accessToken,
      ),
    ]).then(([settings, nextReadiness]) => {
      setValues(
        Object.fromEntries(
          settings.map((setting) => [setting.key, setting.value]),
        ),
      );
      setReadiness(nextReadiness);
    });
  }, [session]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session || saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiRequest(
      '/admin/settings',
      {
        method: 'PATCH',
        body: JSON.stringify({
          settings: Object.entries(values)
            .filter(
              ([key]) =>
                businessKeys.includes(key) ||
                operationalSettings.some((setting) => setting.key === key),
            )
            .map(([key, value]) => ({ key, value })),
        }),
      },
        session.accessToken,
      );
      setMessage('Settings saved.');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="admin-page">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        Configuration
      </p>
      <h1 className="admin-title mt-2">Platform settings</h1>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_.7fr]">
        <form onSubmit={save} className="admin-card">
          <h2 className="text-xl font-semibold">Business and invoice data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            GST invoices remain unavailable until legal name, address, GSTIN,
            and state code are complete.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {businessKeys.map((key) => (
              <label
                key={key}
                className={
                  key.includes('address') || key.includes('footer')
                    ? 'md:col-span-2'
                    : ''
                }
              >
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {key.replaceAll('_', ' ')}
                </span>
                <Input
                  value={values[key] || ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {message && (
            <p className="mt-4 text-sm text-emerald-700">{message}</p>
          )}
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          <Button className="mt-5" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
        <aside className="space-y-6">
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Integration readiness</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Provider credentials are deployment secrets. Image storage uses
              Cloudflare R2 when configured and local disk only in development.
            </p>
            <div className="mt-4 space-y-3">
              {readiness &&
                Object.entries(readiness).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border p-3"
                  >
                    <span className="capitalize">
                      {key.replaceAll(/([A-Z])/g, ' $1')}
                    </span>
                    <span
                      className={
                        value === true || value === 'configured-client-side'
                          ? 'text-emerald-700'
                          : value === 'deferred'
                            ? 'text-muted-foreground'
                            : 'text-amber-700'
                      }
                    >
                      {value === true
                        ? 'Configured'
                        : value === false
                          ? 'Not configured'
                          : String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </section>
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Operational defaults</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These values are read from the database by booking,
              authentication, and payment flows.
            </p>
            {operationalSettings.map((setting) => (
              <label key={setting.key} className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  {setting.label}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type={setting.type}
                    min={'min' in setting ? setting.min : undefined}
                    value={values[setting.key] || ''}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [setting.key]: event.target.value,
                      }))
                    }
                  />
                  {'suffix' in setting && (
                    <span className="text-xs text-muted-foreground">
                      {setting.suffix}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}
