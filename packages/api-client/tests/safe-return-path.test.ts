import assert from 'node:assert/strict';
import test from 'node:test';
import { safeReturnPath } from '../../../apps/customer-web/lib/safe-return-path';

test('safe return paths preserve internal routes and query strings', () => {
  assert.equal(
    safeReturnPath('/cart?package=one#review', '/packages'),
    '/cart?package=one#review',
  );
});

test('safe return paths reject browser-normalized external redirects', () => {
  for (const value of [
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example/path',
    '/%2f%2fevil.example/path',
    '/%5cevil.example/path',
    '/cart\nLocation:https://evil.example',
  ]) {
    assert.equal(safeReturnPath(value, '/packages'), '/packages');
  }
});
