import { createApiRequester } from '@aranyam/api-client';
import type { AdminSession } from '@aranyam/shared-types';
import { useAdminSessionStore } from '../store/session.store';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const client = createApiRequester<AdminSession>({
  baseUrl,
  auth: {
    getSession: () => useAdminSessionStore.getState().session,
    getAccessToken: (session) => session.accessToken,
    getRefreshToken: (session) => session.refreshToken,
    refresh: async (refreshToken) => {
      const response = await fetch(`${baseUrl}/auth/admin/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) throw new Error('Refresh failed');
      return response.json() as Promise<AdminSession>;
    },
    setSession: (session) => useAdminSessionStore.getState().setSession(session),
    clearSession: () => useAdminSessionStore.getState().clear(),
    expiredMessage: 'Your admin session expired. Please sign in again.',
  },
});

export const apiRequest = client.request;
export const downloadAuthenticated = client.download;
export { baseUrl as apiBaseUrl };
