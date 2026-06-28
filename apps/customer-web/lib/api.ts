import { createApiRequester } from '@aranyam/api-client';
import type { CustomerSession } from '@aranyam/shared-types';
import { useSessionStore } from '../store/session.store';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const client = createApiRequester<CustomerSession>({
  baseUrl,
  auth: {
    getSession: () => useSessionStore.getState().session,
    getAccessToken: (session) => session.accessToken,
    getRefreshToken: (session) => session.refreshToken,
    refresh: async (refreshToken) => {
      const response = await fetch(`${baseUrl}/auth/customer/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) throw new Error('Refresh failed');
      return response.json() as Promise<CustomerSession>;
    },
    setSession: (session) => useSessionStore.getState().setSession(session),
    clearSession: () => useSessionStore.getState().clear(),
    expiredMessage: 'Your session expired. Please sign in again.',
  },
});

export const apiRequest = client.request;
export const downloadAuthenticated = client.download;
