import 'server-only';
import { candidateSlots, zoneDate, type Schedule } from '@/lib/clinical/slots';
import { loadFixtures } from '@/lib/ct/fixtures';
import { getSchedule, listFreeSlots, type Mode, type Slot } from '@/lib/ct/scheduling';
import type { SlotDay, SlotsResponse } from '@/lib/types';

export const SLOT_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');

/** The next `days` dates (`YYYY-MM-DD`) of the clinic zone, today first. */
export function zoneDates(timezone: string, now: Date, days = SLOT_DAYS): string[] {
  const today = zoneDate(timezone, now.getTime());
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  });
}

/** Groups free slots under every day of the picker (a day without free time stays in the list with no slots). */
export function groupByDay(timezone: string, slots: Slot[], now: Date, days = SLOT_DAYS): SlotDay[] {
  return zoneDates(timezone, now, days).map((date) => ({
    date,
    slots: slots.filter((s) => s.localDate === date).map((s) => ({ startsAt: s.startsAt, time: s.localTime })),
  }));
}

/**
 * The booking panel's data: the next 7 days of the doctor's clinic zone with the free times of `mode`
 * (weekly pattern minus claimed slots minus anything less than 2 h away). Always read live, never cached.
 * Null when the doctor has no schedule (unknown doctor).
 */
export async function getSlotDays(doctorKey: string, mode: Mode, now: Date = new Date()): Promise<SlotsResponse | null> {
  const fx = await loadFixtures();
  let schedule: Schedule | null;
  let slots: Slot[];
  if (fx) {
    schedule = fx.fixtureSchedule(doctorKey);
    slots = schedule ? candidateSlots(schedule, now, SLOT_DAYS) : [];
  } else {
    schedule = await getSchedule(doctorKey);
    slots = schedule ? await listFreeSlots(doctorKey, mode, now, SLOT_DAYS) : [];
  }
  if (!schedule) return null;
  return { mode, timezone: schedule.timezone, days: groupByDay(schedule.timezone, slots, now) };
}
