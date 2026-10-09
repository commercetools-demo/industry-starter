// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const getBookingPatient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => getBookingPatient(...a) }));

import { getBookingForVisitor, grantGuestBookingAccess, readGuestBookingRefs } from '@/lib/booking-access';
import { createBooking } from '@/lib/ct/bookings';
import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';

const DOC = 'mlv-doc-test';
const NOW = new Date('2026-10-08T05:00:00Z');
const SLOT = '2026-10-08T14:00:00.000Z';
const SLOT_2 = '2026-10-08T20:00:00.000Z';
const guest = { name: 'Gina Guest', email: 'gina@example.com', phone: '(555) 010-2030' };

let guestRef: string;
let samRef: string;

beforeEach(async () => {
  fake = createFakeObjects();
  jar.clear();
  getSession.mockReset().mockResolvedValue({});
  getBookingPatient.mockReset();
  await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'] } });
  guestRef = (await createBooking({ requestId: 'req-guest-0001', doctorKey: DOC, mode: 'remote', startsAt: SLOT, reason: 'Cough', guest }, NOW)).booking.reference;
  samRef = (await createBooking({ requestId: 'req-sam-00001', doctorKey: DOC, mode: 'remote', startsAt: SLOT_2, reason: 'Check-up', patientRef: 'pt_sam12345', phone: '212 555 0100' }, NOW)).booking.reference;
});

describe('design-pdp: Access to a booking', () => {
  it("the browser that created a guest booking sees it", async () => {
    await grantGuestBookingAccess(guestRef);
    expect(await readGuestBookingRefs()).toEqual([guestRef]);
    expect(await getBookingForVisitor(guestRef, NOW)).toMatchObject({ reference: guestRef });
  });

  it('a different visitor (no cookie, no session) gets null, the same as for an unknown reference', async () => {
    expect(await getBookingForVisitor(guestRef, NOW)).toBeNull();
    expect(await getBookingForVisitor('BK-ZZZZZZZZZZ', NOW)).toBeNull();
    expect(await getBookingForVisitor('not-a-reference', NOW)).toBeNull();
  });

  it("another browser's cookie does not open this booking", async () => {
    await grantGuestBookingAccess(samRef.replace(/.$/, samRef.endsWith('A') ? 'B' : 'A'));
    expect(await getBookingForVisitor(guestRef, NOW)).toBeNull();
  });

  it('a signed-in patient sees their own booking and not another patient\'s', async () => {
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    getBookingPatient.mockResolvedValue({ patientRef: 'pt_sam12345', email: 'sam@example.com' });
    expect(await getBookingForVisitor(samRef, NOW)).toMatchObject({ reference: samRef });
    getBookingPatient.mockResolvedValue({ patientRef: 'pt_other999', email: 'o@example.com' });
    expect(await getBookingForVisitor(samRef, NOW)).toBeNull();
  });

  it('a patient booking is never opened by the guest cookie, even if its reference is in it', async () => {
    await grantGuestBookingAccess(samRef);
    expect(await getBookingForVisitor(samRef, NOW)).toBeNull();
  });

  it('a signed-in visitor still sees the guest booking made in this browser', async () => {
    await grantGuestBookingAccess(guestRef);
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    getBookingPatient.mockResolvedValue({ patientRef: 'pt_sam12345', email: 'sam@example.com' });
    expect(await getBookingForVisitor(guestRef, NOW)).toMatchObject({ reference: guestRef });
  });

  it('an account that cannot be read falls back to the cookie rule instead of failing', async () => {
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    getBookingPatient.mockRejectedValue(new Error('down'));
    expect(await getBookingForVisitor(samRef, NOW)).toBeNull();
    await grantGuestBookingAccess(guestRef);
    expect(await getBookingForVisitor(guestRef, NOW)).not.toBeNull();
  });

  it('an expired guest booking is gone even with the cookie', async () => {
    await grantGuestBookingAccess(guestRef);
    expect(await getBookingForVisitor(guestRef, new Date('2027-02-01T00:00:00Z'))).toBeNull();
  });
});
