import 'server-only';
import { createHash } from 'node:crypto';
import { CONTAINERS, createOnly, getObject, putObject, queryObjects } from '@/lib/ct/custom-objects';
import { claimSlot, getClaim, listFreeSlots, releaseSlot, SlotTakenError } from '@/lib/ct/scheduling';
import { MIN_LEAD_MS, MODES, type Mode } from '@/lib/clinical/slots';
import type { Booking, GuestContact } from '@/lib/clinical/types';

/** Bookings are Custom Objects, not Orders, and are not paid online (D-011). Health data rule: never log or put a booking in a URL. */

export type { Booking, BookingStatus, GuestContact } from '@/lib/clinical/types';

export interface BookingInput {
  requestId: string;
  doctorKey: string;
  mode: Mode;
  startsAt: string;
  reason: string;
  patientRef?: string;
  guest?: GuestContact;
}

/** Who is asking: a signed-in patient (by `patientRef`) or a guest (by the booking's email). */
export interface Requester { patientRef?: string; guestEmail?: string }

export const GUEST_RETENTION_DAYS = 7;
export const CANCEL_LEAD_MS = MIN_LEAD_MS;

export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingValidationError';
  }
}
export class SlotUnavailableError extends Error {
  constructor() {
    super('slot unavailable');
    this.name = 'SlotUnavailableError';
  }
}
export class BookingNotFoundError extends Error {
  constructor() {
    super('booking not found');
    this.name = 'BookingNotFoundError';
  }
}
export class CancelTooLateError extends Error {
  constructor() {
    super('too late to cancel');
    this.name = 'CancelTooLateError';
  }
}
export class BookingNotCancellableError extends Error {
  constructor() {
    super('booking cannot be cancelled');
    this.name = 'BookingNotCancellableError';
  }
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no I, L, O, U, 0, 1

/** `BK-` + 10 base32-ish characters derived from the request id. */
export function bookingReference(requestId: string): string {
  const bytes = createHash('sha256').update(`malva-booking:${requestId}`).digest();
  let out = '';
  for (let i = 0; i < 10; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `BK-${out}`;
}

function validate(input: BookingInput): string {
  if (!input.requestId || input.requestId.length < 8 || input.requestId.length > 100) throw new BookingValidationError('requestId required');
  if (!input.doctorKey) throw new BookingValidationError('doctorKey required');
  if (!MODES.includes(input.mode)) throw new BookingValidationError('mode must be remote or office');
  const ms = Date.parse(input.startsAt);
  if (Number.isNaN(ms)) throw new BookingValidationError('startsAt must be an ISO date-time');
  const reason = input.reason?.trim() ?? '';
  if (reason.length === 0 || reason.length > 500) throw new BookingValidationError('reason must be 1 to 500 characters');
  if (Boolean(input.patientRef) === Boolean(input.guest)) throw new BookingValidationError('exactly one of patientRef and guest is required');
  if (input.guest && (!input.guest.name.trim() || !/^[^@\s]+@[^@\s]+$/.test(input.guest.email) || !input.guest.phone.trim())) {
    throw new BookingValidationError('guest name, email and phone are required');
  }
  return new Date(ms).toISOString();
}

/**
 * Claims the slot, then writes the booking; the claim is rolled back when the write fails.
 * Idempotent on `requestId`: a retry returns the stored booking (`created: false`) and resumes a claim left by a crashed attempt.
 * Throws {@link SlotTakenError} when someone else holds the slot and {@link SlotUnavailableError} when the slot is not offered.
 */
export async function createBooking(input: BookingInput, now: Date = new Date()): Promise<{ booking: Booking; created: boolean }> {
  const startsAt = validate(input);
  const reference = bookingReference(input.requestId);
  const existing = await getObject<Booking>(CONTAINERS.booking, reference);
  if (existing) return { booking: existing.value, created: false };

  const claim = await getClaim(input.doctorKey, input.mode, startsAt);
  let claimedHere = false;
  if (claim) {
    if (claim.requestId !== input.requestId) throw new SlotTakenError();
  } else {
    const offered = (await listFreeSlots(input.doctorKey, input.mode, now)).some((s) => s.startsAt === startsAt);
    if (!offered) throw new SlotUnavailableError();
    await claimSlot(input.doctorKey, input.mode, startsAt, input.requestId);
    claimedHere = true;
  }

  const booking: Booking = {
    reference,
    requestId: input.requestId,
    doctorKey: input.doctorKey,
    mode: input.mode,
    startsAt,
    ...(input.patientRef ? { patientRef: input.patientRef } : {}),
    ...(input.guest ? { guest: { name: input.guest.name.trim(), email: input.guest.email.trim(), phone: input.guest.phone.trim() } } : {}),
    reason: input.reason.trim(),
    createdAt: now.toISOString(),
    status: 'booked',
    ...(input.guest ? { expiresAt: new Date(Date.parse(startsAt) + GUEST_RETENTION_DAYS * 86_400_000).toISOString() } : {}),
  };
  try {
    if (!(await createOnly(CONTAINERS.booking, reference, booking))) {
      // a concurrent retry with the same request id won the write; hand back its booking and keep the claim
      const winner = await getObject<Booking>(CONTAINERS.booking, reference);
      if (winner) return { booking: winner.value, created: false };
    }
  } catch (e) {
    if (claimedHere) await releaseSlot(input.doctorKey, input.mode, startsAt).catch(() => undefined);
    throw e;
  }
  return { booking, created: true };
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function visibleTo(b: Booking, who: Requester, now: Date): boolean {
  if (b.expiresAt && Date.parse(b.expiresAt) < now.getTime()) return false;
  if (b.patientRef) return !!who.patientRef && who.patientRef === b.patientRef;
  return !!b.guest && !!who.guestEmail && sameEmail(b.guest.email, who.guestEmail);
}

/** The booking if it exists and belongs to the requester; null for an unknown or foreign reference (same answer for both). */
export async function getBookingForSession(reference: string, who: Requester, now: Date = new Date()): Promise<Booking | null> {
  if (!/^BK-[A-Z0-9]{10}$/.test(reference)) return null;
  const stored = await getObject<Booking>(CONTAINERS.booking, reference);
  return stored && visibleTo(stored.value, who, now) ? stored.value : null;
}

/** A patient's bookings, soonest first. */
export async function listBookingsForPatient(patientRef: string): Promise<Booking[]> {
  const all = await queryObjects<Booking>(CONTAINERS.booking, `value(patientRef="${patientRef.replace(/[^\w-]/g, '')}")`);
  return all.map((o) => o.value).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Cancels at least 2 h before the start and releases the slot. Cancelling twice returns the cancelled booking. */
export async function cancelBooking(reference: string, who: Requester, now: Date = new Date()): Promise<Booking> {
  const booking = await getBookingForSession(reference, who, now);
  if (!booking) throw new BookingNotFoundError();
  if (booking.status === 'cancelled') return booking;
  if (booking.status !== 'booked') throw new BookingNotCancellableError();
  if (Date.parse(booking.startsAt) - now.getTime() < CANCEL_LEAD_MS) throw new CancelTooLateError();
  const stored = await getObject<Booking>(CONTAINERS.booking, reference);
  const cancelled: Booking = { ...booking, status: 'cancelled' };
  await putObject(CONTAINERS.booking, reference, cancelled, stored?.version);
  await releaseSlot(booking.doctorKey, booking.mode, booking.startsAt);
  return cancelled;
}
