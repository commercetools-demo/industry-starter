import 'server-only';
import { CONTAINERS, createOnly, deleteObject, getObject, queryObjects } from '@/lib/ct/custom-objects';
import { candidateSlots, slotClaimKey, type Mode, type Schedule, type Slot } from '@/lib/clinical/slots';

export type { Mode, Schedule, Slot } from '@/lib/clinical/slots';

export class SlotTakenError extends Error {
  constructor() {
    super('slot taken');
    this.name = 'SlotTakenError';
  }
}

export interface SlotClaim {
  doctorKey: string;
  mode: Mode;
  startsAt: string;
  claimedAt: string;
  /** Client request id of the booking that holds the claim (lets a retried booking resume). */
  requestId?: string;
}

export async function getSchedule(doctorKey: string): Promise<Schedule | null> {
  return (await getObject<Schedule>(CONTAINERS.schedule, doctorKey))?.value ?? null;
}

/**
 * Free slots = weekly pattern of the next `days` days in the doctor's zone (today = today in that zone)
 * minus claimed slots of this mode minus slots less than 2 h from `now` (Q-003). `fromDate` is "now".
 */
export async function listFreeSlots(doctorKey: string, mode: Mode, fromDate: Date = new Date(), days = 7): Promise<Slot[]> {
  const schedule = await getSchedule(doctorKey);
  if (!schedule) return [];
  const claims = await queryObjects<SlotClaim>(CONTAINERS.slotClaim, `value(doctorKey="${doctorKey}" and mode="${mode}")`);
  const taken = new Set(claims.map((c) => new Date(c.value.startsAt).toISOString()));
  return candidateSlots(schedule, fromDate, days).filter((s) => !taken.has(s.startsAt));
}

/** Creates the claim with `version: 0` (create-only); a second claim of the same slot throws {@link SlotTakenError}. */
export async function claimSlot(doctorKey: string, mode: Mode, startsAt: string, requestId?: string): Promise<void> {
  const iso = new Date(startsAt).toISOString();
  const claim: SlotClaim = { doctorKey, mode, startsAt: iso, claimedAt: new Date().toISOString(), ...(requestId ? { requestId } : {}) };
  if (!(await createOnly(CONTAINERS.slotClaim, slotClaimKey(doctorKey, mode, iso), claim))) throw new SlotTakenError();
}

export async function getClaim(doctorKey: string, mode: Mode, startsAt: string): Promise<SlotClaim | null> {
  return (await getObject<SlotClaim>(CONTAINERS.slotClaim, slotClaimKey(doctorKey, mode, startsAt)))?.value ?? null;
}

export async function releaseSlot(doctorKey: string, mode: Mode, startsAt: string): Promise<void> {
  await deleteObject(CONTAINERS.slotClaim, slotClaimKey(doctorKey, mode, startsAt));
}
