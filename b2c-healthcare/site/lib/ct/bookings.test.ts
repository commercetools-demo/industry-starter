import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import {
  BookingNotFoundError, BookingValidationError, bookingReference, cancelBooking, CancelTooLateError, createBooking, getBookingForSession, listBookingsForPatient,
  SlotUnavailableError, type BookingInput,
} from '@/lib/ct/bookings';
import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import { claimSlot, getClaim, SlotTakenError } from '@/lib/ct/scheduling';

const DOC = 'mlv-doc-test';
const NOW = new Date('2026-10-08T05:00:00Z'); // Thu 01:00 New York
const SLOT = '2026-10-08T14:00:00.000Z'; // 10:00 New York, 9 h away
const input = (o: Partial<BookingInput> = {}): BookingInput => ({ requestId: 'req-00000001', doctorKey: DOC, mode: 'office', startsAt: SLOT, reason: 'Check-up', patientRef: 'pt_a', ...o });

describe('bookings', () => {
  beforeEach(async () => {
    fake = createFakeObjects();
    await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'] } });
  });

  it('claims the slot, then writes the booking', async () => {
    const { booking, created } = await createBooking(input(), NOW);
    expect(created).toBe(true);
    expect(booking).toMatchObject({ doctorKey: DOC, status: 'booked', patientRef: 'pt_a', startsAt: SLOT });
    expect(booking.reference).toMatch(/^BK-[A-Z0-9]{10}$/);
    expect(booking.expiresAt).toBeUndefined();
    expect(await getClaim(DOC, 'office', SLOT)).toMatchObject({ requestId: 'req-00000001' });
    const order = fake.calls.filter((c) => c.op === 'post').map((c) => c.container);
    expect(order).toEqual([CONTAINERS.schedule, CONTAINERS.slotClaim, CONTAINERS.booking]);
  });

  it('rolls the claim back when the booking write fails', async () => {
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.booking ? Object.assign(new Error('write failed'), { statusCode: 500 }) : undefined);
    await expect(createBooking(input(), NOW)).rejects.toThrow('write failed');
    expect(await getClaim(DOC, 'office', SLOT)).toBeNull();
    fake.failOn = undefined;
    await expect(createBooking(input({ requestId: 'req-00000002' }), NOW)).resolves.toMatchObject({ created: true });
  });

  it('is idempotent on requestId: a retry returns the same booking and writes nothing', async () => {
    const a = await createBooking(input(), NOW);
    const writes = fake.calls.filter((c) => c.op === 'post').length;
    const b = await createBooking(input(), NOW);
    expect(b).toEqual({ booking: a.booking, created: false });
    expect(fake.calls.filter((c) => c.op === 'post').length).toBe(writes);
    expect(bookingReference('req-00000001')).toBe(a.booking.reference);
  });

  it('resumes after a crash between claim and write (same requestId)', async () => {
    await claimSlot(DOC, 'office', SLOT, 'req-00000001'); // the crashed attempt left its claim
    await expect(createBooking(input(), NOW)).resolves.toMatchObject({ created: true });
  });

  it('a second patient for the same slot gets "slot taken"', async () => {
    await createBooking(input(), NOW);
    await expect(createBooking(input({ requestId: 'req-00000002', patientRef: 'pt_b' }), NOW)).rejects.toBeInstanceOf(SlotTakenError);
  });

  it('two simultaneous bookings of one slot: exactly one succeeds', async () => {
    const r = await Promise.allSettled([createBooking(input({ requestId: 'req-aaaaaaaa' }), NOW), createBooking(input({ requestId: 'req-bbbbbbbb', patientRef: 'pt_b' }), NOW)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(fake.objects.filter((o) => o.container === CONTAINERS.booking)).toHaveLength(1);
  });

  it('refuses a time that is not an offered slot', async () => {
    await expect(createBooking(input({ startsAt: '2026-10-08T14:30:00.000Z' }), NOW)).rejects.toBeInstanceOf(SlotUnavailableError);
    await expect(createBooking(input(), new Date('2026-10-08T13:00:00Z'))).rejects.toBeInstanceOf(SlotUnavailableError); // < 2 h
  });

  it('validates input', async () => {
    for (const bad of [input({ reason: '  ' }), input({ mode: 'x' as never }), input({ startsAt: 'nope' }), input({ patientRef: undefined }), input({ guest: { name: 'G', email: 'g@example.com', phone: '1' } }), input({ requestId: 'x' })]) {
      await expect(createBooking(bad, NOW)).rejects.toBeInstanceOf(BookingValidationError);
    }
    await expect(createBooking(input({ patientRef: undefined, guest: { name: 'G', email: 'bad', phone: '1' } }), NOW)).rejects.toBeInstanceOf(BookingValidationError);
  });

  it('a guest booking carries an expiry and is readable only with its email, until it expires', async () => {
    const guest = { name: 'Guest Example', email: 'guest@example.com', phone: '+1 212 555 0100' };
    const { booking } = await createBooking(input({ patientRef: undefined, guest }), NOW);
    expect(booking.guest).toEqual(guest);
    expect(Date.parse(booking.expiresAt as string)).toBe(Date.parse(SLOT) + 7 * 86_400_000);
    expect(await getBookingForSession(booking.reference, { guestEmail: 'GUEST@example.com' }, NOW)).toMatchObject({ reference: booking.reference });
    expect(await getBookingForSession(booking.reference, { guestEmail: 'other@example.com' }, NOW)).toBeNull();
    expect(await getBookingForSession(booking.reference, { patientRef: 'pt_a' }, NOW)).toBeNull();
    expect(await getBookingForSession(booking.reference, { guestEmail: guest.email }, new Date('2026-12-01T00:00:00Z'))).toBeNull();
  });

  it('getBookingForSession: unknown, malformed and foreign references all give null', async () => {
    const { booking } = await createBooking(input(), NOW);
    expect(await getBookingForSession(booking.reference, { patientRef: 'pt_a' })).toMatchObject({ patientRef: 'pt_a' });
    expect(await getBookingForSession(booking.reference, { patientRef: 'pt_b' })).toBeNull();
    expect(await getBookingForSession('BK-ZZZZZZZZZZ', { patientRef: 'pt_a' })).toBeNull();
    expect(await getBookingForSession('nope', { patientRef: 'pt_a' })).toBeNull();
    expect(await getBookingForSession(booking.reference, {})).toBeNull();
  });

  it('lists a patient\'s bookings, soonest first, and only theirs', async () => {
    await createBooking(input({ requestId: 'req-00000001' }), NOW);
    await createBooking(input({ requestId: 'req-00000002', startsAt: '2026-10-08T20:00:00.000Z' }), NOW);
    await createBooking(input({ requestId: 'req-00000003', mode: 'remote', patientRef: 'pt_b' }), NOW);
    expect((await listBookingsForPatient('pt_a')).map((b) => b.startsAt)).toEqual([SLOT, '2026-10-08T20:00:00.000Z']);
    expect(await listBookingsForPatient('pt_zzz')).toEqual([]);
  });

  it('cancel releases the slot, so it can be booked again', async () => {
    const { booking } = await createBooking(input(), NOW);
    const cancelled = await cancelBooking(booking.reference, { patientRef: 'pt_a' }, NOW);
    expect(cancelled.status).toBe('cancelled');
    expect(await getClaim(DOC, 'office', SLOT)).toBeNull();
    await expect(createBooking(input({ requestId: 'req-00000009', patientRef: 'pt_b' }), NOW)).resolves.toMatchObject({ created: true });
    expect((await cancelBooking(booking.reference, { patientRef: 'pt_a' }, NOW)).status).toBe('cancelled'); // repeat is harmless
  });

  it('cancel is refused less than 2 h before the start (exactly 2 h is allowed)', async () => {
    const { booking } = await createBooking(input(), NOW);
    await expect(cancelBooking(booking.reference, { patientRef: 'pt_a' }, new Date('2026-10-08T12:00:01Z'))).rejects.toBeInstanceOf(CancelTooLateError);
    expect((await getBookingForSession(booking.reference, { patientRef: 'pt_a' }))?.status).toBe('booked');
    expect(await getClaim(DOC, 'office', SLOT)).not.toBeNull();
    await expect(cancelBooking(booking.reference, { patientRef: 'pt_a' }, new Date('2026-10-08T12:00:00Z'))).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('cancel of someone else\'s or an unknown booking looks like "not found"', async () => {
    const { booking } = await createBooking(input(), NOW);
    await expect(cancelBooking(booking.reference, { patientRef: 'pt_b' }, NOW)).rejects.toBeInstanceOf(BookingNotFoundError);
    await expect(cancelBooking('BK-AAAAAAAAAA', { patientRef: 'pt_a' }, NOW)).rejects.toBeInstanceOf(BookingNotFoundError);
  });
});
