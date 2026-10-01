export function localDateTime(instant: string | number): string {
  const d = new Date(instant);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Reject normalized invalid dates (Feb 30) and nonexistent local times (DST gaps). */
export function toInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) && localDateTime(d.getTime()) === value
    ? d.toISOString()
    : '';
}
export const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Keep the chosen duration when the host moves the start date or time. */
export function endAfterStartChange(start: string, end: string, nextStart: string): string {
  const previousStart = Date.parse(toInstant(start));
  const previousEnd = Date.parse(toInstant(end));
  const next = Date.parse(toInstant(nextStart));
  const duration = previousEnd - previousStart;
  return Number.isFinite(next) && Number.isFinite(duration) && duration > 0
    ? localDateTime(next + duration)
    : end;
}
export const meetupTime = (instant: string) =>
  new Date(instant).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
