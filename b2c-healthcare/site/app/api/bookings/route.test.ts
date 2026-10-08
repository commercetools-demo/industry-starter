// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { makeJsonRequest, makeRequest } from '@/test/request';

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
const getDoctorByKey = vi.fn();
vi.mock('@/lib/ct/doctors', () => ({ getDoctorByKey: (...a: unknown[]) => getDoctorByKey(...a) }));

import { BOOKING_COOKIE, verifyBookingRefs } from '@/lib/booking-access-core';
import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import type { Booking } from '@/lib/clinical/types';
import { resolveSecret } from '@/lib/session-core';
import { POST } from './route';

const DOC = 'mlv-doc-test';
const SLOT = '2026-10-08T14:00:00.000Z'; // Thu 10:00 in New York, 9 h after the faked "now"
const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const doctor = { key: DOC, modes: ['remote', 'office'], fees: { remote: money(3500), office: money(5500) } };

const guestBody = (o: Record<string, unknown> = {}) => ({
  requestId: 'req-guest-0001',
  doctorKey: DOC,
  mode: 'remote',
  startsAt: SLOT,
  name: 'Gina Guest',
  email: 'gina.guest@example.com',
  phone: '(555) 010-2030',
  reason: 'Persistent cough',
  ...o,
});
const post = (body: unknown) => POST(makeJsonRequest('/api/bookings', body));
const stored = (container: string) => fake.objects.filter((o) => o.container === container);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
  fake = createFakeObjects();
  jar.clear();
  getSession.mockReset().mockResolvedValue({});
  getBookingPatient.mockReset();
  getDoctorByKey.mockReset().mockResolvedValue(doctor);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'] } });
});
afterEach(() => vi.useRealTimers());

describe('design-pdp: POST /api/bookings (guest)', () => {
  it('claims the slot, stores the booking with the guest contact and an expiry, and returns the reference', async () => {
    const response = await post(guestBody());
    expect(response.status).toBe(201);
    const { reference } = (await response.json()) as { reference: string };
    expect(reference).toMatch(/^BK-[A-Z0-9]{10}$/);
    const [booking] = stored(CONTAINERS.booking).map((o) => o.value as Booking);
    expect(booking).toMatchObject({
      reference,
      doctorKey: DOC,
      mode: 'remote',
      startsAt: SLOT,
      reason: 'Persistent cough',
      guest: { name: 'Gina Guest', email: 'gina.guest@example.com', phone: '(555) 010-2030' },
      status: 'booked',
    });
    expect(booking.patientRef).toBeUndefined();
    expect(Date.parse(booking.expiresAt as string)).toBe(Date.parse(SLOT) + 90 * 86_400_000);
    expect(stored(CONTAINERS.slotClaim)).toHaveLength(1);
  });

  it('the browser remembers the booking in the signed malva_bk cookie (references only)', async () => {
    const { reference } = (await (await post(guestBody())).json()) as { reference: string };
    const token = jar.get(BOOKING_COOKIE);
    expect(await verifyBookingRefs(token, resolveSecret(undefined, 'test'))).toEqual([reference]);
    expect(Buffer.from((token as string).split('.')[1], 'base64url').toString()).not.toMatch(/gina|cough|555/i);
  });

  it('requestId idempotency: a retry returns the same reference, writes one booking and renews the cookie', async () => {
    const first = (await (await post(guestBody())).json()) as { reference: string };
    jar.clear();
    const retry = await post(guestBody());
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { reference: string }).reference).toBe(first.reference);
    expect(stored(CONTAINERS.booking)).toHaveLength(1);
    expect(jar.has(BOOKING_COOKIE)).toBe(true);
  });

  it('a replayed request id from another visitor gets "no longer available", never the booking and no access', async () => {
    await post(guestBody());
    jar.clear();
    const replay = await post(guestBody({ email: 'mallory@example.com', name: 'Mallory' }));
    expect(replay.status).toBe(409);
    expect(jar.has(BOOKING_COOKIE)).toBe(false);
    const other = await post(guestBody({ mode: 'office' }));
    expect(other.status).toBe(409);
  });

  it('missing or invalid contact fields: 400 with codes only and nothing is written', async () => {
    const response = await post(guestBody({ name: '', email: 'nope', phone: '', reason: '' }));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string; fields: Record<string, string> };
    expect(json.fields).toEqual({ name: 'nameRequired', email: 'emailInvalid', phone: 'phoneRequired', reason: 'reasonRequired' });
    expect(fake.objects.filter((o) => o.container !== CONTAINERS.schedule)).toHaveLength(0);
  });

  it('a malformed request (no request id, unknown mode, bad date, not JSON) is a 400', async () => {
    for (const body of [guestBody({ requestId: 'x' }), guestBody({ mode: 'video' }), guestBody({ startsAt: 'tomorrow' }), guestBody({ doctorKey: '../x' })]) {
      expect((await post(body)).status).toBe(400);
    }
    expect((await POST(makeRequest('/api/bookings', { method: 'POST', body: 'not json' }))).status).toBe(400);
    expect(getDoctorByKey).not.toHaveBeenCalled();
  });

  it('unknown doctor: 404; a mode the doctor does not offer or has no fee for: 400', async () => {
    getDoctorByKey.mockResolvedValue(null);
    expect((await post(guestBody())).status).toBe(404);
    getDoctorByKey.mockResolvedValue({ ...doctor, modes: ['office'], fees: { office: money(5500) } });
    expect((await post(guestBody({ mode: 'remote' }))).status).toBe(400);
    getDoctorByKey.mockResolvedValue({ ...doctor, fees: { office: money(5500) } });
    expect((await post(guestBody({ mode: 'remote' }))).status).toBe(400);
    expect(stored(CONTAINERS.booking)).toHaveLength(0);
  });

  it('Slot taken meanwhile: the second booking of the same time is a 409 and writes nothing', async () => {
    expect((await post(guestBody())).status).toBe(201);
    const second = await post(guestBody({ requestId: 'req-guest-0002', email: 'other@example.com' }));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: 'That time is no longer available.' });
    expect(stored(CONTAINERS.booking)).toHaveLength(1);
  });

  it('a time that is not offered (not in the pattern, or less than 2 hours away) is a 409', async () => {
    expect((await post(guestBody({ requestId: 'req-guest-0003', startsAt: '2026-10-08T14:30:00.000Z' }))).status).toBe(409);
    vi.setSystemTime(new Date('2026-10-08T13:00:00Z'));
    expect((await post(guestBody({ requestId: 'req-guest-0004' }))).status).toBe(409);
  });

  it('concurrent claims: of five simultaneous bookings for one slot exactly one wins', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => post(guestBody({ requestId: `req-race-000${i}`, email: `racer${i}@example.com` }))),
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(stored(CONTAINERS.slotClaim)).toHaveLength(1);
    expect(stored(CONTAINERS.booking)).toHaveLength(1);
  });
});

describe('design-pdp: POST /api/bookings (signed in)', () => {
  const sam = { patientRef: 'pt_sam12345', firstName: 'Sam', lastName: 'Rivera', email: 'sam.rivera@example.com' };
  beforeEach(() => {
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    getBookingPatient.mockResolvedValue(sam);
  });

  it('books as the patient record: patientRef and phone stored, no guest block, no guest cookie, name and email from the body are ignored', async () => {
    const response = await post(guestBody({ name: 'Someone Else', email: 'else@example.com' }));
    expect(response.status).toBe(201);
    const [booking] = stored(CONTAINERS.booking).map((o) => o.value as Booking);
    expect(booking).toMatchObject({ patientRef: 'pt_sam12345', phone: '(555) 010-2030', reason: 'Persistent cough' });
    expect(booking.guest).toBeUndefined();
    expect(booking.expiresAt).toBeUndefined();
    expect(JSON.stringify(booking)).not.toMatch(/else@example|Someone Else/);
    expect(jar.has(BOOKING_COOKIE)).toBe(false);
  });

  it('only phone and reason are required', async () => {
    const response = await post({ ...guestBody({ name: undefined, email: undefined }) });
    expect(response.status).toBe(201);
    const missing = await post(guestBody({ requestId: 'req-guest-0009', name: undefined, email: undefined, phone: '' }));
    expect(((await missing.json()) as { fields: object }).fields).toEqual({ phone: 'phoneRequired' });
  });

  it('a signed-in customer without a patient reference is refused', async () => {
    getBookingPatient.mockResolvedValue({ email: 'x@example.com' });
    expect((await post(guestBody())).status).toBe(403);
  });

  it('a session whose customer no longer exists books as a guest (needs the guest fields)', async () => {
    getBookingPatient.mockResolvedValue(null);
    const response = await post(guestBody({ name: '' }));
    expect(response.status).toBe(400);
  });

  it('a replayed request id of another patient is refused', async () => {
    await post(guestBody());
    getBookingPatient.mockResolvedValue({ ...sam, patientRef: 'pt_other999' });
    expect((await post(guestBody())).status).toBe(409);
  });
});
