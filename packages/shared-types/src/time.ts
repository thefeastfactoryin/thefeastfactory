/**
 * Format a stored time-of-day without applying a timezone conversion.
 *
 * The API returns HH:mm, while this also accepts the legacy ISO-shaped value
 * produced when a PostgreSQL TIME column was serialized as a JavaScript Date.
 */
export function formatTimeOfDay(
  value?: string | null,
  fallback = 'Time unavailable',
) {
  const match = value?.trim().match(/(?:^|T)([01]\d|2[0-3]):([0-5]\d)/);
  if (!match) return fallback;

  const hours = Number(match[1]);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${match[2]} ${suffix}`;
}
