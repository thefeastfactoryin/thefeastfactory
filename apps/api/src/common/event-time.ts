/**
 * Customer event dates and times are entered and displayed in India Standard
 * Time. PostgreSQL `date` and `time` columns are serialized as UTC-shaped
 * values, so always reconstruct the actual instant explicitly.
 */
export const EVENT_TIME_ZONE_OFFSET = '+05:30';

export function eventLocalInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00.000${EVENT_TIME_ZONE_OFFSET}`);
}

export function storedEventInstant(eventDate: Date, eventTime: Date) {
  const date = eventDate.toISOString().slice(0, 10);
  const time = eventTime.toISOString().slice(11, 16);
  return eventLocalInstant(date, time);
}
