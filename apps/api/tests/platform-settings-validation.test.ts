import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { OperationsService } from '../src/modules/operations/operations.service';

function operations(current: Array<{ key: string; value: string }> = []) {
  return new OperationsService(
    {
      platformSetting: {
        findMany: async () => current,
        upsert: () => ({}),
      },
      $transaction: async () => [],
    } as never,
    {} as never,
    {} as never,
  );
}

test('critical operational settings reject malformed values', async () => {
  const service = operations();
  for (const setting of [
    { key: 'event_time_interval_minutes', value: '0' },
    { key: 'otp_max_attempts', value: '5attempts' },
    { key: 'event_service_start_time', value: '25:00' },
    { key: 'razorpay_currency', value: 'inr' },
    { key: 'tax_cgst_rate', value: '101' },
  ]) {
    await assert.rejects(
      service.updateSettings({ settings: [setting] }),
      BadRequestException,
    );
  }
});

test('event service hours must form an increasing range', async () => {
  const service = operations([
    { key: 'event_service_start_time', value: '06:00' },
    { key: 'event_service_end_time', value: '23:30' },
  ]);
  await assert.rejects(
    service.updateSettings({
      settings: [{ key: 'event_service_start_time', value: '23:45' }],
    }),
    /start time must be earlier/,
  );
});

test('duplicate setting keys are rejected before the transaction', async () => {
  await assert.rejects(
    operations().updateSettings({
      settings: [
        { key: 'otp_max_attempts', value: '5' },
        { key: 'otp_max_attempts', value: '6' },
      ],
    }),
    /Duplicate setting keys/,
  );
});

test('public settings safely fall back when legacy numeric values are malformed', async () => {
  const catalog = new CatalogService({
    platformSetting: {
      findMany: async () => [
        { key: 'min_booking_lead_hours', value: 'not-a-number' },
        { key: 'event_time_interval_minutes', value: '0' },
      ],
    },
  } as never);

  const settings = await catalog.publicSettings();
  assert.equal(settings.minBookingLeadHours, 48);
  assert.equal(settings.eventTimeIntervalMinutes, 30);
});

test('zero-hour lead time remains a valid explicit setting', async () => {
  const catalog = new CatalogService({
    platformSetting: {
      findMany: async () => [
        { key: 'min_booking_lead_hours', value: '0' },
      ],
    },
  } as never);
  assert.equal((await catalog.publicSettings()).minBookingLeadHours, 0);
});
