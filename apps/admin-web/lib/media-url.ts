import { apiBaseUrl } from './api';

const customerBaseUrl =
  process.env.NEXT_PUBLIC_CUSTOMER_BASE_URL ??
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ??
  'http://localhost:3000';

export function resolveMediaUrl(value?: string | null) {
  if (!value) return '';
  if (/^(https?:|blob:|data:)/.test(value)) return value;
  if (value.startsWith('/uploads/')) return `${apiBaseUrl}${value}`;
  if (value.startsWith('/')) return `${customerBaseUrl}${value}`;
  return value;
}
