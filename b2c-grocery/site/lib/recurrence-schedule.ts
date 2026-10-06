/** A policy schedule as the Recurring Orders API returns it. */
export type Schedule = { type: 'standard'; value: number; intervalUnit: string } | { type: 'dayOfMonth'; day: number } | { type: string };

/** Adds calendar months in UTC, clamping the day (31 Jan + 1 month = 28/29 Feb). */
function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function addInterval(start: Date, unit: string, count: number): Date | null {
  if (unit === 'Days') return new Date(start.getTime() + count * 86_400_000);
  if (unit === 'Weeks') return new Date(start.getTime() + count * 7 * 86_400_000);
  if (unit === 'Months') return addMonthsUtc(start, count);
  return null;
}

/**
 * The first scheduled date after `now`, counted from `startsAt` (standard schedules: `startsAt` + n intervals; day of
 * month: that day, at the time of `startsAt`). The API's plain resume would reuse a past `nextOrderAt` and order at once,
 * so resume passes this date as `resumesAt` (PROJECT-FINDINGS §19). `null` for a schedule this app does not know.
 */
export function nextOccurrence(startsAt: string, schedule: Schedule, now: Date = new Date()): string | null {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  if (schedule.type === 'standard') {
    const { value, intervalUnit } = schedule as { value: number; intervalUnit: string };
    if (!Number.isInteger(value) || value < 1) return null;
    for (let n = 0; n < 5000; n += 1) {
      const next = addInterval(start, intervalUnit, n * value);
      if (!next) return null;
      if (next.getTime() > now.getTime()) return next.toISOString();
    }
    return null;
  }
  if (schedule.type === 'dayOfMonth') {
    const { day } = schedule as { day: number };
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    for (let m = 0; m < 14; m += 1) {
      const base = addMonthsUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds())), m);
      const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
      base.setUTCDate(Math.min(day, lastDay));
      if (base.getTime() > now.getTime()) return base.toISOString();
    }
  }
  return null;
}
