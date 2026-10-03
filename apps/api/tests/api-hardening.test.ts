import assert from 'node:assert/strict';
import test from 'node:test';
import {
  apiSecurityHeaders,
  shouldEnableSwagger,
} from '../src/config/api-hardening';
import { validateEnv } from '../src/config/env.validation';

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/aranyam',
  JWT_ACCESS_SECRET: 'test-access-secret-long-enough',
  JWT_REFRESH_SECRET: 'test-refresh-secret-long-enough',
};

test('Swagger is disabled by default and cannot be enabled in production', () => {
  assert.equal(shouldEnableSwagger('development', false), false);
  assert.equal(shouldEnableSwagger('development', true), true);
  assert.equal(shouldEnableSwagger('test', true), true);
  assert.equal(shouldEnableSwagger('production', true), false);
});

test('API responses receive restrictive browser security headers', () => {
  const headers = apiSecurityHeaders(false);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Content-Security-Policy'], /default-src 'none'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
});

test('production configuration rejects the test login bypass', () => {
  assert.throws(
    () =>
      validateEnv({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        TEST_LOGIN_OTP_ENABLED: 'true',
        TEST_LOGIN_MOBILE: '9999999999',
        TEST_LOGIN_OTP: '123456',
      }),
    /Test login OTP cannot be enabled in production/,
  );
});
