// Date-only (UTC) arithmetic for price schedules. Never use local Date getters: a buyer in another time zone would see shifted dates.

/** Injectable clock; tests pass a fixed one. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** 'YYYY-MM-DD' in UTC. */
export function toDateOnly(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

/** null when the text is not /^\d{4}-\d{2}-\d{2}$/ or not a real calendar date. Returns midnight UTC. */
export function parseDateOnly(s: string): Date | null {
  const match = DATE_ONLY.exec(s);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC maps years 0..99 to 1900..1999
  d.setUTCFullYear(year);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

function mustParse(s: string): Date {
  const d = parseDateOnly(s);
  if (!d) throw new Error(`Invalid date-only value: ${s}`);
  return d;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Clamps to the month end: addMonths('2026-01-31', 1) === '2026-02-28'. Always add from the order date, never repeatedly. */
export function addMonths(date: string, n: number): string {
  const d = mustParse(date);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const year = Math.floor(total / 12);
  const monthIndex = total - year * 12;
  const day = Math.min(d.getUTCDate(), daysInMonth(year, monthIndex));
  return `${pad(year, 4)}-${pad(monthIndex + 1, 2)}-${pad(day, 2)}`;
}

export function addDays(date: string, n: number): string {
  return toDateOnly(new Date(mustParse(date).getTime() + n * MS_PER_DAY));
}

/** b - a in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((mustParse(b).getTime() - mustParse(a).getTime()) / MS_PER_DAY);
}
