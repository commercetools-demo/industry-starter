import { SLOT_CONFIG } from '../config/slots';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
const SLOT_ID = /^(\d{4})(\d{2})(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');
export const startOfUtcDay = (d: Date): number => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** `YYYYMMDD-HH` for a UTC day (ms) and a window start hour. */
export function slotIdOf(dayMs: number, hour: number): string {
  const d = new Date(dayMs);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(hour)}`;
}

/** Start and day (UTC ms) of a slot when `id` names a configured window, else `null`. */
export function parseSlotId(id: string): { startMs: number; dayMs: number } | null {
  const m = SLOT_ID.exec(id);
  if (!m) return null;
  const [, y, mo, d, h] = m;
  const hour = Number(h);
  if (!(SLOT_CONFIG.windows as readonly number[]).includes(hour)) return null;
  const dayMs = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (slotIdOf(dayMs, hour) !== id) return null;
  return { startMs: dayMs + hour * HOUR_MS, dayMs };
}

/** ISO start and end of a slot id, or `null` for an unknown id. */
export function slotWindow(id: string): { start: string; end: string } | null {
  const parsed = parseSlotId(id);
  if (!parsed) return null;
  return { start: new Date(parsed.startMs).toISOString(), end: new Date(parsed.startMs + SLOT_CONFIG.windowHours * HOUR_MS).toISOString() };
}
