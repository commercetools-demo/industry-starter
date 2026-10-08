// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectUnauthenticated } from '@/test/api';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { makeRequest } from '@/test/request';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
const patient = vi.fn();
vi.mock('@/lib/ct/booking-patient', () => ({ getBookingPatient: (...a: unknown[]) => patient(...a) }));

import { createBooking } from '@/lib/ct/bookings';
import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import { getClaim, listFreeSlots } from '@/lib/ct/scheduling';
import { POST } from './route';

const DOC = 'mlv-doc-test';
const BOOKED_AT = new Date('2026-10-05T05:00:00Z');
const SLOT = '2026-10-08T14:00:00.000Z'; // Thu 10:00 New York
const ctx = (ref: string) => ({ params: Promise.resolve({ ref }) });
let reference: string;

/** Runs the route "at" a given time (the cancel window is relative to now). */
async function cancelAt(now: string, ref = reference) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  try {
    return await POST(makeRequest('/x', { method: 'POST' }), ctx(ref));
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(async () => {
  fake = createFakeObjects();
  getSession.mockReset().mockResolvedValue({ customerId: 'c1' });
  patient.mockReset().mockResolvedValue({ patientRef: 'pt_sam', email: 's@example.com' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'] } });
  ({ booking: { reference } } = await createBooking({ requestId: 'req-cancel-01', doctorKey: DOC, mode: 'office', startsAt: SLOT, reason: 'Check-up', patientRef: 'pt_sam' }, BOOKED_AT));
});

describe('design-account-area: Appointments, Cancel', () => {
  it('cancels an own upcoming booking at least 2 h before and releases the slot', async () => {
    expect(await getClaim(DOC, 'office', SLOT)).not.toBeNull();
    const response = await cancelAt('2026-10-08T09:00:00Z');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'cancelled', reference });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await getClaim(DOC, 'office', SLOT)).toBeNull();
    const free = await listFreeSlots(DOC, 'office', new Date('2026-10-07T12:00:00Z'));
    expect(free.some((s) => s.startsAt === SLOT)).toBe(true);
  });

  it('less than 2 h before the start: 409 with code too-late, the booking and its slot stay', async () => {
    const response = await cancelAt('2026-10-08T12:30:00Z');
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'too-late' });
    expect(await getClaim(DOC, 'office', SLOT)).not.toBeNull();
  });

  it('exactly 2 h before is still allowed', async () => {
    expect((await cancelAt('2026-10-08T12:00:00Z')).status).toBe(200);
  });

  it('Cross-patient access: another patient\'s booking and an unknown reference answer the same 404', async () => {
    patient.mockResolvedValue({ patientRef: 'pt_alex', email: 'a@example.com' });
    const foreign = await cancelAt('2026-10-08T09:00:00Z');
    const unknown = await cancelAt('2026-10-08T09:00:00Z', 'BK-ZZZZZZZZZZ');
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await foreign.json()).toEqual(await unknown.json());
    expect(await getClaim(DOC, 'office', SLOT)).not.toBeNull();
  });

  it('a customer without a patient reference owns nothing: 404', async () => {
    patient.mockResolvedValue({ email: 'x@example.com' });
    expect((await cancelAt('2026-10-08T09:00:00Z')).status).toBe(404);
  });

  it('signed out: 401 before any read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated((r) => POST(r, ctx(reference)), [patient]);
  });

  it('cancelling twice is not an error (the cancelled booking is returned)', async () => {
    await cancelAt('2026-10-08T09:00:00Z');
    expect((await cancelAt('2026-10-08T09:00:00Z')).status).toBe(200);
  });
});
