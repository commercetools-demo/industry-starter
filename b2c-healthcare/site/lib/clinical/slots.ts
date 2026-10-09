/**
 * Pure slot maths (no server imports, no SDK): a weekly pattern in the clinic's IANA time zone becomes UTC instants.
 * Time zones use `Intl` only (DST-safe: a wall time that does not exist on a spring-forward day yields no slot).
 */

export type Mode = 'remote' | 'office';
export const MODES: readonly Mode[] = ['remote', 'office'];

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** `malva-schedule` value. */
export interface Schedule {
  timezone: string;
  weekly: Partial<Record<Weekday, string[]>>;
  slotMinutes: number;
}

export interface Slot {
  /** UTC instant, ISO 8601 with milliseconds (`2026-10-09T13:00:00.000Z`). */
  startsAt: string;
  /** Clinic-local date and time (`YYYY-MM-DD`, `HH:mm`). */
  localDate: string;
  localTime: string;
  /** IANA zone of the clinic, so remote slots can name it for the visitor. */
  timezone: string;
}

export const MIN_LEAD_MS = 2 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formatters.set(zone, f);
  }
  return f;
}

interface Parts { y: number; m: number; d: number; h: number; mi: number; s: number }

function partsIn(zone: string, ms: number): Parts {
  const p: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute, s: p.second };
}

/** Offset of the zone from UTC at an instant, in ms (positive east of Greenwich). */
export function zoneOffsetMs(zone: string, ms: number): number {
  const p = partsIn(zone, ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Calendar date in the zone at an instant. */
export function zoneDate(zone: string, ms: number): { y: number; m: number; d: number } {
  const p = partsIn(zone, ms);
  return { y: p.y, m: p.m, d: p.d };
}

/** The UTC instant of a wall-clock time in the zone; null when that wall time does not exist (DST gap). */
export function zonedToUtc(zone: string, y: number, m: number, d: number, h: number, mi: number): number | null {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const o1 = zoneOffsetMs(zone, wall);
  let t = wall - o1;
  const o2 = zoneOffsetMs(zone, t);
  if (o2 !== o1) t = wall - o2;
  return t + zoneOffsetMs(zone, t) === wall ? t : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Candidate slots of `days` clinic-local days starting with today in the clinic zone (not the server's),
 * minus slots earlier than `now + minLeadMs`. Claims are subtracted by the caller.
 */
export function candidateSlots(schedule: Schedule, now: Date, days = 7, minLeadMs = MIN_LEAD_MS): Slot[] {
  const today = zoneDate(schedule.timezone, now.getTime());
  const earliest = now.getTime() + minLeadMs;
  const out: Slot[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const times = [...(schedule.weekly[WEEKDAYS[day.getUTCDay()]] ?? [])].sort();
    for (const time of times) {
      const [h, mi] = time.split(':').map(Number);
      const at = zonedToUtc(schedule.timezone, y, m, d, h, mi);
      if (at === null || at < earliest) continue;
      out.push({ startsAt: new Date(at).toISOString(), localDate: `${y}-${pad(m)}-${pad(d)}`, localTime: `${pad(h)}:${pad(mi)}`, timezone: schedule.timezone });
    }
  }
  return out;
}

/** Container key of a slot claim. Custom Object keys allow only `[-_~.a-zA-Z0-9]`, so the instant is written compactly. */
export function slotClaimKey(doctorKey: string, mode: Mode, startsAtIso: string): string {
  const compact = new Date(startsAtIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${doctorKey}.${mode}.${compact}`;
}
