import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from '../src/common/interceptors/request-logging.interceptor';

function harness(statusCode = 201) {
  const messages: string[] = [];
  const request = {
    header: () => 'request-id',
    method: 'POST',
    originalUrl: '/payments/razorpay/verify',
  };
  const response = {
    statusCode,
    setHeader: () => undefined,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const interceptor = new RequestLoggingInterceptor();
  Object.assign(interceptor, {
    logger: { log: (message: string) => messages.push(message) },
  });
  return { context, interceptor, messages };
}

test('request logger records the final successful response status', async () => {
  const { context, interceptor, messages } = harness(202);

  await lastValueFrom(interceptor.intercept(context, { handle: () => of({}) }));

  assert.equal(JSON.parse(messages[0]).statusCode, 202);
});

test('request logger records HttpException status instead of the route default', async () => {
  const { context, interceptor, messages } = harness(201);

  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(context, {
        handle: () => throwError(() => new BadRequestException()),
      }),
    ),
    BadRequestException,
  );

  assert.equal(JSON.parse(messages[0]).statusCode, 400);
});

test('request logger records unexpected errors as internal server errors', async () => {
  const { context, interceptor, messages } = harness(201);

  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(context, {
        handle: () => throwError(() => new Error('unexpected')),
      }),
    ),
    /unexpected/,
  );

  assert.equal(JSON.parse(messages[0]).statusCode, 500);
});
