import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTimeOfDay } from '@aranyam/shared-types';
import {
  eventLocalInstant,
  storedEventInstant,
  storedEventTime,
} from '../src/common/event-time';

test('customer event time is interpreted as India Standard Time', () => {
  assert.equal(
    eventLocalInstant('2026-08-07', '18:00').toISOString(),
    '2026-08-07T12:30:00.000Z',
  );
});

test('stored date and time reconstruct the same customer event instant', () => {
  const eventDate = new Date('2026-08-07T00:00:00.000Z');
  const eventTime = new Date('1970-01-01T18:00:00.000Z');

  assert.equal(
    storedEventInstant(eventDate, eventTime).toISOString(),
    '2026-08-07T12:30:00.000Z',
  );
});

test('stored delivery time is serialized without the placeholder date', () => {
  assert.equal(storedEventTime(new Date('1970-01-01T17:30:00.000Z')), '17:30');
});

test('delivery time is displayed consistently for current and legacy API values', () => {
  assert.equal(formatTimeOfDay('17:30'), '5:30 PM');
  assert.equal(formatTimeOfDay('1970-01-01T17:30:00.000Z'), '5:30 PM');
});
