export type AuthAdapter<Session> = {
  getSession: () => Session | undefined;
  getAccessToken: (session: Session) => string;
  getRefreshToken: (session: Session) => string | undefined;
  refresh: (refreshToken: string) => Promise<Session>;
  setSession: (session: Session) => void;
  clearSession: () => void;
  expiredMessage: string;
};

export type ApiRequesterOptions<Session> = {
  baseUrl: string;
  auth: AuthAdapter<Session>;
};

async function parseError(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response.status >= 500
      ? 'The server could not complete the request. Please try again.'
      : `Request failed (${response.status}). Please try again.`;
  }
  const payload = await response.json().catch(() => ({ message: `Request failed (${response.status})` }));
  return Array.isArray(payload.message)
    ? payload.message.join(', ')
    : payload.message;
}

export function createApiRequester<Session>({
  baseUrl,
  auth,
}: ApiRequesterOptions<Session>) {
  let refreshPromise: Promise<Session> | undefined;

  async function fetchWithToken(
    path: string,
    init: RequestInit,
    token?: string,
  ) {
    const isFormData =
      typeof FormData !== 'undefined' && init.body instanceof FormData;
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  }

  async function authenticatedFetch(
    path: string,
    init: RequestInit,
    token?: string,
  ) {
    const session = auth.getSession();
    let response = await fetchWithToken(
      path,
      init,
      token && session ? auth.getAccessToken(session) : token,
    );
    const refreshToken = session && auth.getRefreshToken(session);
    if (response.status !== 401 || !token || !refreshToken) return response;

    try {
      refreshPromise ??= auth.refresh(refreshToken).finally(() => {
        refreshPromise = undefined;
      });
      const refreshed = await refreshPromise;
      auth.setSession(refreshed);
      response = await fetchWithToken(
        path,
        init,
        auth.getAccessToken(refreshed),
      );
      return response;
    } catch {
      auth.clearSession();
      throw new Error(auth.expiredMessage);
    }
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const response = await authenticatedFetch(path, init, token);
    if (!response.ok) throw new Error(await parseError(response));
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    if (!body) return undefined as T;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('The server returned an unexpected response. Please try again.');
    }
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error('The server returned an invalid response. Please try again.');
    }
  }

  async function download(path: string, token: string) {
    const response = await authenticatedFetch(path, {}, token);
    if (!response.ok) throw new Error(await parseError(response));
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename =
      disposition.match(/filename="([^"]+)"/)?.[1] || 'document.pdf';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return { request, download };
}
