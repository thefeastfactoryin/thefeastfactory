import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpException } from '@nestjs/common';
import { ConsoleOtpProvider } from '../src/modules/auth/providers/console-otp.provider';

const config = {
  get: (key: string) => {
    if (key === 'MSG91_AUTH_KEY') return 'auth-key';
    if (key === 'MSG91_TEMPLATE_ID') return 'template-id';
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
