import { WEEKDAYS, weekdayIn } from '@/lib/hours';
import type { OpeningHours, Weekday } from '@/lib/types';

export type Readiness =
  | { kind: 'ready'; minutes: number }
  | { kind: 'later'; dayOffset: number; weekday: Weekday; time: string }
  | { kind: 'closed' };

interface StoreTiming { hours: OpeningHours; timeZone: string; collectionMinutes: number }

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (minutes: number): string => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function minutesNow(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return n('hour') * 60 + n('minute');
}

/**
 * When an order reserved now can be collected (workstream H, 3.8). "Ready" only while the store is open and the
 * preparation time still ends before closing; never a promise past closing. Otherwise the next opening: the first open
 * day (today when the store has not opened yet) with the time the order would be ready (opening plus preparation).
 * Pure: `now` is a parameter; times are in the store's own time zone.
 */
export function collectionReadiness(store: StoreTiming, now: Date): Readiness {
  const minutes = store.collectionMinutes;
  const nowMin = minutesNow(now, store.timeZone);
  const todayIdx = WEEKDAYS.indexOf(weekdayIn(now, store.timeZone));
  for (let d = 0; d <= 7; d += 1) {
    const day = WEEKDAYS[(todayIdx + d) % 7] as Weekday;
    const window = store.hours[day];
    if (!window) continue;
    const open = toMinutes(window.open);
    const close = toMinutes(window.close);
    if (d === 0) {
      if (nowMin >= open && nowMin + minutes <= close) return { kind: 'ready', minutes };
      if (nowMin < open) return { kind: 'later', dayOffset: 0, weekday: day, time: toHhmm(open + minutes) };
      continue; // already closed (or too late to prepare): look at the following days
    }
    return { kind: 'later', dayOffset: d, weekday: day, time: toHhmm(open + minutes) };
  }
  return { kind: 'closed' };
}
