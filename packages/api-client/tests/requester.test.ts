import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiRequestError, createApiRequester } from '../src/index';

type Session = { accessToken: string; refreshToken: string };

function requester() {
  return createApiRequester<Session>({
    baseUrl: 'https://api.test',
    auth: {
      getSession: () => undefined,
      getAccessToken: (session) => session.accessToken,
      getRefreshToken: (session) => session.refreshToken,
      refresh: async () => {
        throw new Error('not used');
      },
      setSession: () => undefined,
      clearSession: () => undefined,
      expiredMessage: 'Session expired',
    },
  });
}

test('returns undefined for a successful empty response body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    assert.equal(await requester().request('/cart'), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parses a successful JSON response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ id: 'cart-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  try {
    assert.deepEqual(await requester().request('/cart'), { id: 'cart-1' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not expose an HTML error document to the user', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html><h1>Proxy error</h1>', { status: 502, headers: { 'content-type': 'text/html' } });
  try {
    await assert.rejects(requester().request('/cart'), { message: 'The server could not complete the request. Please try again.' });
  } finally { globalThis.fetch = originalFetch; }
});

test('preserves an API error status for caller recovery', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'Active cart not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  try {
    await assert.rejects(requester().request('/cart/missing'), (error) => {
      assert.ok(error instanceof ApiRequestError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'Active cart not found');
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects an unexpected successful HTML response with a friendly message', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    await assert.rejects(requester().request('/cart'), { message: 'The server returned an unexpected response. Please try again.' });
  } finally { globalThis.fetch = originalFetch; }
});
