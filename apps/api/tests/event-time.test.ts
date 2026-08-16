import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eventLocalInstant,
  storedEventInstant,
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
