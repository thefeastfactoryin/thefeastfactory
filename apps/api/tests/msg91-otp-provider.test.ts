import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { ConsoleOtpProvider } from '../src/modules/auth/providers/console-otp.provider';

const config = {
  get: (key: string) => {
    if (key === 'MSG91_AUTH_KEY') return 'auth-key';
    if (key === 'MSG91_FLOW_ID') return 'flow-id';
    if (key === 'MSG91_SENDER_ID') return 'AMGHM';
    return undefined;
  },
};

async function withFetch(
  response: Response,
  callback: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('accepts an explicit MSG91 success response', async () => {
  await withFetch(
    new Response(JSON.stringify({ type: 'success', message: 'OTP sent' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    async () => {
      const provider = new ConsoleOtpProvider(config as never);
      await provider.sendOtp('9999999999', '123456');
    },
  );
});

test('sends the approved SMS flow variable as number', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({ type: 'success', message: 'request-id' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const provider = new ConsoleOtpProvider(config as never);
    await provider.sendOtp('9999999999', '123456');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestedUrl, 'https://api.msg91.com/api/v5/flow/');
  assert.equal(
    (requestedInit?.headers as Record<string, string>).authkey,
    'auth-key',
  );
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    flow_id: 'flow-id',
    sender: 'AMGHM',
    recipients: [{ mobiles: '919999999999', number: '123456' }],
  });
});

test('rejects an MSG91 application error returned with HTTP 200', async () => {
  await withFetch(
    new Response(
      JSON.stringify({
        status: 'fail',
        hasError: true,
        errors: 'Unauthorized',
        code: '401',
        apiError: '418',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
    async () => {
      const provider = new ConsoleOtpProvider(config as never);
      await assert.rejects(
        () => provider.sendOtp('9999999999', '123456'),
        (error: unknown) =>
          error instanceof HttpException && error.getStatus() === 502,
      );
    },
  );
});

test('rejects an ambiguous HTTP 200 response', async () => {
  await withFetch(
    new Response(JSON.stringify({ message: 'Request received' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    async () => {
      const provider = new ConsoleOtpProvider(config as never);
      await assert.rejects(
        () => provider.sendOtp('9999999999', '123456'),
        (error: unknown) =>
          error instanceof HttpException && error.getStatus() === 502,
      );
    },
  );
});

test('rejects an MSG91 HTTP error', async () => {
  await withFetch(
    new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    async () => {
      const provider = new ConsoleOtpProvider(config as never);
      await assert.rejects(
        () => provider.sendOtp('9999999999', '123456'),
        (error: unknown) =>
          error instanceof HttpException && error.getStatus() === 502,
      );
    },
  );
});
