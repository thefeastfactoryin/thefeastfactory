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
type PlatformSetting = { key: string; value: string };
export default function Settings() {
  const session = useAdminSessionStore((state) => state.session);
  const [values, setValues] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<IntegrationReadiness>();
  const [message, setMessage] = useState('');
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
    await apiRequest(
      '/admin/settings',
      {
        method: 'PATCH',
        body: JSON.stringify({
          settings: Object.entries(values)
            .filter(
              ([key]) =>
                businessKeys.includes(key) ||
                [
                  'min_booking_lead_hours',
                  'otp_expiry_seconds',
                  'otp_max_attempts',
                  'razorpay_currency',
                ].includes(key),
            )
            .map(([key, value]) => ({ key, value })),
        }),
      },
      session!.accessToken,
    );
    setMessage('Settings saved.');
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
          <Button className="mt-5">Save settings</Button>
        </form>
        <aside className="space-y-6">
          <section className="admin-card">
            <h2 className="text-xl font-semibold">Integration readiness</h2>
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
            {[
              'min_booking_lead_hours',
              'otp_expiry_seconds',
              'otp_max_attempts',
              'razorpay_currency',
            ].map((key) => (
              <label key={key} className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
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
          </section>
        </aside>
      </div>
    </main>
  );
}
