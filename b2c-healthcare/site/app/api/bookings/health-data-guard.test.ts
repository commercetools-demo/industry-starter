// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { makeJsonRequest } from '@/test/request';

/**
 * Health-data guard (health-data-minimization, design-pdp "Health data minimization"): boots the real booking route
 * (real `handle`, real redacting logger, real `createBooking` over in-memory Custom Objects) and asserts that the
 * reason, phone and email of the request never reach a log call or any response body, on the happy path and on every
 * failure path, including a platform error that echoes the request body (as SDK errors do).
 */
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
// the spy logger: every call is recorded in the form the logger emits it (`redact` is the logger's own boundary: an Error
// reaches `log.*` as an object and leaves it as `{ name, status }`), and then goes through the real logger
const logCalls: unknown[][] = [];
vi.mock('@/lib/log', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/log')>();
  const wrap = (level: 'error' | 'warn' | 'info') => (...args: Parameters<typeof real.log.error>) => {
    logCalls.push(real.redact([level, ...args]) as unknown[]);
    real.log[level](...args);
  };
  return { ...real, log: { error: wrap('error'), warn: wrap('warn'), info: wrap('info') } };
});

import { CONTAINERS, putObject } from '@/lib/ct/custom-objects';
import { POST } from './route';

const REASON = 'Chest tightness when climbing stairs';
const PHONE = '(555) 010-2030';
const PHONE_DIGITS = '5550102030';
const EMAIL = 'gina.guest@example.com';
const NAME = 'Gina Guest';
const SECRETS = [REASON, 'Chest tightness', PHONE, PHONE_DIGITS, EMAIL, 'gina.guest'];

const DOC = 'mlv-doc-test';
const SLOT = '2026-10-08T14:00:00.000Z';
const money = (centAmount: number) => ({ centAmount, currencyCode: 'USD', fractionDigits: 2 });
const body = (o: Record<string, unknown> = {}) => ({
  requestId: 'req-guard-0001',
  doctorKey: DOC,
  mode: 'remote',
  startsAt: SLOT,
  name: NAME,
  email: EMAIL,
  phone: PHONE,
  reason: REASON,
  ...o,
});

const consoleCalls: unknown[][] = [];
function spyConsole() {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void consoleCalls.push([method, ...args]));
  }
}
/** What a log pipeline would see: every argument serialized, including error properties. */
const serialize = (calls: unknown[][]) =>
  JSON.stringify(calls, (_key, value) => (value instanceof Error ? { ...value, name: value.name, message: value.message } : value));

function expectNoSecrets(label: string, text: string) {
  for (const secret of SECRETS) expect(text, `${label} leaked ${secret}`).not.toContain(secret);
}

/** The shape of an SDK error: the message and `body` repeat what was sent. */
const echoing = (statusCode: number) =>
  Object.assign(new Error(`failed to write ${REASON} for ${EMAIL} ${PHONE}`), {
    statusCode,
    body: { message: `value ${REASON}`, errors: [{ detail: `${EMAIL} ${PHONE}` }] },
    originalRequest: { body: JSON.stringify(body()) },
  });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T05:00:00Z'));
  fake = createFakeObjects();
  jar.clear();
  logCalls.length = 0;
  consoleCalls.length = 0;
  spyConsole();
  getSession.mockReset().mockResolvedValue({});
  getBookingPatient.mockReset();
  getDoctorByKey.mockReset().mockResolvedValue({ key: DOC, modes: ['remote', 'office'], fees: { remote: money(3500), office: money(5500) } });
  await putObject(CONTAINERS.schedule, DOC, { timezone: 'America/New_York', slotMinutes: 30, weekly: { thu: ['10:00', '16:00'] } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function run(label: string, request: Request, expectedStatus: number | ((s: number) => boolean)) {
  const response = await POST(request);
  const text = await response.text();
  if (typeof expectedStatus === 'number') expect(response.status, label).toBe(expectedStatus);
  else expect(expectedStatus(response.status), label).toBe(true);
  expectNoSecrets(`${label}: response body`, text);
  expectNoSecrets(`${label}: response headers`, JSON.stringify([...response.headers.entries()].filter(([k]) => k !== 'set-cookie')));
  expectNoSecrets(`${label}: console`, serialize(consoleCalls));
  expectNoSecrets(`${label}: log()`, serialize(logCalls));
  return { response, text };
}

describe('design-pdp: Health data minimization (L-08 guard)', () => {
  it('Health data minimization: a successful booking logs nothing with the reason, phone or email and answers with the reference only', async () => {
    const { text } = await run('success', makeJsonRequest('/api/bookings', body()), 201);
    expect(JSON.parse(text)).toEqual({ reference: expect.stringMatching(/^BK-[A-Z0-9]{10}$/) });
  });

  it('Health data minimization: validation failures answer with codes, never with the submitted values', async () => {
    const { text } = await run('validation', makeJsonRequest('/api/bookings', body({ email: `${EMAIL} oops`, phone: `${PHONE} x`, name: '' })), 400);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['error', 'fields']);
  });

  it('Health data minimization: a platform error that echoes the request body (booking write) is a generic 500 and is logged without it', async () => {
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.booking ? echoing(500) : undefined);
    const { text } = await run('booking write fails', makeJsonRequest('/api/bookings', body()), 500);
    expect(JSON.parse(text)).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(logCalls.length).toBeGreaterThan(0); // the failure was logged ... without the data (asserted in run)
  });

  it('Health data minimization: a 4xx platform error that echoes the body gets a safe fixed text', async () => {
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.booking ? echoing(400) : undefined);
    await run('booking write 400', makeJsonRequest('/api/bookings', body()), 400);
  });

  it('Health data minimization: errors from the claim, the doctor read and the account read do not leak either', async () => {
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.slotClaim ? echoing(503) : undefined);
    await run('claim fails', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0002' })), 503);
    fake.failOn = undefined;
    getDoctorByKey.mockRejectedValueOnce(echoing(500));
    await run('doctor read fails', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0003' })), 500);
    getSession.mockResolvedValue({ customerId: 'c-1' });
    getBookingPatient.mockRejectedValueOnce(echoing(500));
    await run('account read fails', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0004' })), 500);
  });

  it('Health data minimization: a taken slot and an unknown doctor answer with fixed texts', async () => {
    await run('first booking', makeJsonRequest('/api/bookings', body()), 201);
    await run('slot taken', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0005', email: 'racer@example.com' })), 409);
    getDoctorByKey.mockResolvedValueOnce(null);
    await run('unknown doctor', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0006' })), 404);
  });

  it('Health data minimization: signed-in booking (phone and reason) is just as quiet', async () => {
    getSession.mockResolvedValue({ customerId: 'c-sam' });
    getBookingPatient.mockResolvedValue({ patientRef: 'pt_sam12345', firstName: 'Sam', email: 'sam.rivera@example.com' });
    await run('patient', makeJsonRequest('/api/bookings', body({ name: undefined, email: undefined })), 201);
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.booking ? echoing(500) : undefined);
    await run('patient write fails', makeJsonRequest('/api/bookings', body({ requestId: 'req-guard-0007', startsAt: '2026-10-08T20:00:00.000Z', name: undefined, email: undefined })), 500);
  });

  it('Health data minimization: the reason is stored in the booking object and nowhere else (claims, cookie)', async () => {
    await run('success', makeJsonRequest('/api/bookings', body()), 201);
    const holders = fake.objects.filter((o) => JSON.stringify(o).includes('Chest tightness'));
    expect(holders.map((o) => o.container)).toEqual([CONTAINERS.booking]);
    expect(fake.objects.filter((o) => o.container !== CONTAINERS.booking && JSON.stringify(o).includes(EMAIL))).toEqual([]);
    expectNoSecrets('cookie', [...jar.values()].map((token) => Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).join(' '));
  });

  it('the guard itself works: the redacting logger would catch a leak (self-test of the harness)', () => {
    console.error(`oops ${REASON}`);
    expect(() => expectNoSecrets('harness', serialize(consoleCalls))).toThrow();
  });
});
