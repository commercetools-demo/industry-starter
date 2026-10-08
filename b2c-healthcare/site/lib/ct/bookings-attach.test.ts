import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking } from '@/lib/clinical/types';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));
const patient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => patient(...a) }));
// The fake does not model nested predicates (`guest(email in (...))`): it returns every booking and the module's own
// filter must do the matching. The predicate text is recorded to check what would be sent.
const wheres: Array<string | undefined> = [];
vi.mock('@/lib/ct/custom-objects', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/ct/custom-objects')>();
  return {
    ...real,
    queryObjects: async <T,>(container: string, where?: string) => {
      wheres.push(where);
      return fake.objects.filter((o) => o.container === container).map((o) => ({ key: o.key, version: o.version, value: o.value as T }));
    },
  };
});

import { CONTAINERS, getObject, putObject } from '@/lib/ct/custom-objects';
import { attachGuestBookings } from './bookings-attach';

const NOW = new Date('2026-10-08T12:00:00Z');
const ref = (n: number) => `BK-AAAAAAAA${String(n).padStart(2, '0')}`.replace(/[01]/g, '2');
const guestBooking = (n: number, email: string, over: Partial<Booking> = {}): Booking => ({
  reference: ref(n), requestId: `req-0000000${n}`, doctorKey: 'mlv-doc-test', mode: 'remote', startsAt: '2026-10-20T14:00:00.000Z',
  guest: { name: 'Guest', email, phone: '+15125550100' }, reason: 'Check-up', createdAt: '2026-10-01T10:00:00.000Z', status: 'booked',
  expiresAt: '2027-01-18T14:00:00.000Z', ...over,
});
const read = async (n: number) => (await getObject<Booking>(CONTAINERS.booking, ref(n)))?.value;

beforeEach(async () => {
  fake = createFakeObjects();
  wheres.length = 0;
  patient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', email: 'sam@example.com' });
  await putObject(CONTAINERS.booking, ref(2), guestBooking(2, 'sam@example.com'));
  await putObject(CONTAINERS.booking, ref(3), guestBooking(3, 'Sam@Example.com'));
  await putObject(CONTAINERS.booking, ref(4), guestBooking(4, 'other@example.com'));
  await putObject(CONTAINERS.booking, ref(5), { ...guestBooking(5, 'sam@example.com'), guest: undefined, patientRef: 'pt_alex' });
});

describe('design-account-area: guest bookings attach (R-07)', () => {
  it('a verified email attaches its guest bookings (any letter case) and leaves other guests untouched', async () => {
    const count = await attachGuestBookings('c1', 'sam@example.com', [], NOW);
    expect(count).toBe(2);
    for (const n of [2, 3]) {
      const b = await read(n);
      expect(b?.patientRef).toBe('pt_sam');
      expect(b?.guest).toBeUndefined();
      expect(b?.expiresAt).toBeUndefined();
      expect(b?.phone).toBe('+15125550100');
      expect(b?.status).toBe('booked');
    }
    expect((await read(4))?.guest?.email).toBe('other@example.com');
    expect((await read(4))?.patientRef).toBeUndefined();
    expect((await read(5))?.patientRef).toBe('pt_alex');
    expect(wheres[0]).toBe('value(guest(email in ("sam@example.com")))');
  });

  it('an unverified account (email null) attaches nothing by email and never queries by it', async () => {
    expect(await attachGuestBookings('c1', null, [], NOW)).toBe(0);
    expect(wheres).toHaveLength(0);
    expect((await read(2))?.patientRef).toBeUndefined();
  });

  it('cookie references attach the bookings this browser made, whatever email was typed', async () => {
    expect(await attachGuestBookings('c1', null, [ref(4)], NOW)).toBe(1);
    expect((await read(4))?.patientRef).toBe('pt_sam');
    expect((await read(2))?.patientRef).toBeUndefined();
  });

  it('a cookie reference to a booking of another patient is not taken over', async () => {
    expect(await attachGuestBookings('c1', null, [ref(5)], NOW)).toBe(0);
    expect((await read(5))?.patientRef).toBe('pt_alex');
  });

  it('a booking found by both paths is attached once', async () => {
    expect(await attachGuestBookings('c1', 'sam@example.com', [ref(2)], NOW)).toBe(2);
  });

  it('an expired guest booking stays as it was', async () => {
    await putObject(CONTAINERS.booking, ref(6), guestBooking(6, 'sam@example.com', { expiresAt: '2026-09-01T00:00:00.000Z' }));
    await attachGuestBookings('c1', 'sam@example.com', [ref(6)], NOW);
    expect((await read(6))?.patientRef).toBeUndefined();
  });

  it('an email that cannot be put in a predicate is not queried', async () => {
    expect(await attachGuestBookings('c1', 'a"b@example.com', [], NOW)).toBe(0);
    expect(wheres).toHaveLength(0);
  });

  it('a customer without a patient reference attaches nothing', async () => {
    patient.mockResolvedValue({ email: 'sam@example.com' });
    expect(await attachGuestBookings('c1', 'sam@example.com', [ref(2)], NOW)).toBe(0);
    expect((await read(2))?.patientRef).toBeUndefined();
  });

  it('a booking that changed meanwhile (409) is skipped, not an error', async () => {
    fake.failOn = (_op, _container, key) => (key === ref(2) ? Object.assign(new Error('version'), { statusCode: 409 }) : undefined);
    expect(await attachGuestBookings('c1', 'sam@example.com', [], NOW)).toBe(1);
  });
});
