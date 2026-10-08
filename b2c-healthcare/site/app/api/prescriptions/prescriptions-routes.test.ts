// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectSanitizedError, expectUnauthenticated } from '@/test/api';
import { makeJsonRequest, makeRequest } from '@/test/request';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { ALEX_REF, ALL_RX, CATALOG, SAM_REF } from '@/test/rx-fixtures-for-tests';
import type { Prescription } from '@/lib/clinical/types';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));

let rxData: Prescription[];
const listForPatient = vi.fn();
const getByNumber = vi.fn();
vi.mock('@/lib/ct/clinical-store', () => ({
  prescriptionSource: { listForPatient: (r: string) => listForPatient(r), getByNumber: (n: string) => getByNumber(n) },
}));

const getPatient = vi.fn();
vi.mock('@/lib/ct/patient', () => ({ getPatient: (id: string) => getPatient(id) }));

let supply: Map<string, { sku: string; available: number; expiryDate?: string }>;
vi.mock('@/lib/ct/shelf-life', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ct/shelf-life')>()),
  getSupplyBySku: async () => supply,
}));
vi.mock('@/lib/ct/rx-catalog', () => ({
  getCatalogBySku: async (skus: string[]) => new Map(skus.filter((s) => CATALOG[s]).map((s) => [s, { medication: CATALOG[s], shortDatedPrice: null }])),
}));

import { GET as listRoute } from './route';
import { POST as lookupRoute } from './lookup/route';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import { consumeAuthorization } from '@/lib/ct/dispense-ledger';

const lookup = (rx: unknown) => lookupRoute(makeJsonRequest('/api/prescriptions/lookup', { rx }));
const signedIn = (customerId = 'c-sam') => getSession.mockResolvedValue({ customerId, locale: 'en-US', currency: 'USD', country: 'US' });
const stockAll = () => new Map(Object.keys(CATALOG).map((sku) => [sku, { sku, available: 600 }]));

beforeEach(() => {
  fake = createFakeObjects();
  rxData = structuredClone(ALL_RX);
  listForPatient.mockReset().mockImplementation(async (ref: string) => rxData.filter((r) => r.patientRef === ref));
  getByNumber.mockReset().mockImplementation(async (n: string) => rxData.find((r) => r.number === n) ?? null);
  getPatient.mockReset().mockImplementation(async (id: string) =>
    id === 'c-sam' ? { patientRef: SAM_REF, name: 'Sam Rivera' } : id === 'c-alex' ? { patientRef: ALEX_REF, name: 'Alex Chen' } : null,
  );
  supply = stockAll();
  signedIn();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

describe('design-plp › Prescription lookup by RX number: Lookup', () => {
  it.each(['RX-77102', 'rx 77102', 'RX77102', ' rx-77102 '])('accepts "%s" and returns the card', async (input) => {
    const response = await lookup(input);
    expect(response.status).toBe(200);
    const view = await response.json();
    expect(view).toMatchObject({ number: 'RX-77102', prescriber: 'Dr. Sofia Marchetti', issuedAt: '2026-09-24', refillsLeft: 3, patientName: 'Sam Rivera' });
    expect(view.lines).toHaveLength(2);
    expect(view.lines[0]).toMatchObject({ lineRef: 'RX-77102-1', name: 'Atorvastatin 20 mg tablets', sig: '1 tablet nightly', qty: 30, status: 'ok', selectable: true, price: { centAmount: 1875 } });
  });

  it('the answer is not cacheable and sets no location', async () => {
    const response = await lookup('RX-77102');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('location')).toBeNull();
  });

  it('lookups write nothing: malva-rx and the ledger are unchanged (abandoned cart consumes nothing)', async () => {
    await lookup('RX-77102');
    expect(fake.objects.filter((o) => o.container !== CONTAINERS.ratelimit)).toHaveLength(0);
    expect(getByNumber).toHaveBeenCalledTimes(1);
  });
});

describe('design-plp › Prescription lookup by RX number: Unknown or foreign RX', () => {
  it('Unknown or foreign RX: the same message and status for both', async () => {
    const unknown = await lookup('RX-00000');
    const foreign = await lookup('RX-90001');
    expect(unknown.status).toBe(404);
    expect(foreign.status).toBe(404);
    const [a, b] = [await unknown.json(), await foreign.json()];
    expect(a).toEqual({ code: 'NOT_FOUND', error: "We couldn't find “RX-00000”. Check the number printed on your prescription." });
    expect(b.code).toBe(a.code);
    expect(b.error).toBe("We couldn't find “RX-90001”. Check the number printed on your prescription.");
    // identical apart from the echoed input
    expect(b.error.replace('RX-90001', 'X')).toBe(a.error.replace('RX-00000', 'X'));
    expect(JSON.stringify(b)).not.toMatch(/Alvarez|Amlodipine|Alex/);
  });

  it('a malformed number gets the same refusal', async () => {
    const response = await lookup('hello');
    expect(response.status).toBe(404);
    expect((await response.json()).error).toContain('We couldn\'t find “hello”.');
  });

  it('the echoed input is HTML-escaped and capped', async () => {
    const body = await (await lookup('<img src=x onerror=1>' + 'a'.repeat(100))).json();
    expect(body.error).toContain('&lt;img src=x');
    expect(body.error).not.toContain('<img');
    expect(body.error.length).toBeLessThan(160);
  });

  it('a non-string input is a refusal, not an error', async () => {
    expect((await lookup(12345)).status).toBe(404);
    expect((await lookupRoute(makeRequest('/api/prescriptions/lookup', { method: 'POST', body: 'not json' }))).status).toBe(404);
  });

  it('the attempt is rate limited: 5 failed lookups, then 429 even for a number that exists', async () => {
    for (let i = 0; i < 5; i += 1) expect((await lookup(`RX-0000${i}`)).status).toBe(404);
    const limited = await lookup('RX-77102');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({ code: 'RATE_LIMITED', error: expect.stringContaining('Too many') });
  });

  it('successful lookups do not count toward the limit', async () => {
    for (let i = 0; i < 8; i += 1) expect((await lookup('RX-77102')).status).toBe(200);
  });

  it('the limit is per customer', async () => {
    for (let i = 0; i < 5; i += 1) await lookup(`RX-0000${i}`);
    signedIn('c-alex');
    expect((await lookup('RX-90001')).status).toBe(200);
  });

  it('an account without a patient record gets the same refusal', async () => {
    signedIn('c-nobody');
    const response = await lookup('RX-77102');
    expect(response.status).toBe(404);
    expect(getByNumber).not.toHaveBeenCalled();
  });
});

describe('health-data-minimization: lookup input and prescriptions are never logged', () => {
  it('no log line carries the input, the RX number or a medication, on success, refusal and failure', async () => {
    const spies = [console.error, console.warn, console.info, console.log];
    await lookup('RX-77102');
    await lookup('RX-90001');
    getByNumber.mockRejectedValueOnce(Object.assign(new Error('boom RX-77102 Atorvastatin'), { statusCode: 500 }));
    await lookup('RX-77102');
    const logged = JSON.stringify(spies.flatMap((s) => (s as unknown as { mock: { calls: unknown[] } }).mock.calls));
    expect(logged).not.toMatch(/RX-\d|Atorvastatin|90001|77102/);
  });

  it('a failure from the store is sanitized for the browser', async () => {
    getByNumber.mockRejectedValue(Object.assign(new Error('secret RX-77102 detail'), { statusCode: 500 }));
    await expectSanitizedError(lookupRoute, ['RX-77102', 'secret'], makeJsonRequest('/api/prescriptions/lookup', { rx: 'RX-77102' }));
  });
});

describe('design-plp › Prescription lookup by RX number: Medication that cannot be dispensed', () => {
  it('no refills left: every row is shown with the reason and cannot be selected (RX-48213)', async () => {
    const view = await (await lookup('RX-48213')).json();
    expect(view.refillsLeft).toBe(0);
    for (const row of view.lines) expect(row).toMatchObject({ status: 'NO_REFILLS', selectable: false, remaining: 0 });
  });

  it('authorization expired: the reason is expiry, not exhaustion', async () => {
    const view = await (await lookup('RX-31877')).json();
    expect(view.lines[0]).toMatchObject({ status: 'EXPIRED', selectable: false });
  });

  it('medication out of stock', async () => {
    supply.set('MED-ator', { sku: 'MED-ator', available: 0 });
    const view = await (await lookup('RX-77102')).json();
    expect(view.lines[0]).toMatchObject({ status: 'OUT_OF_STOCK', selectable: false, remaining: 0 });
    expect(view.lines[1]).toMatchObject({ status: 'ok', selectable: true });
  });

  it('a prescribed SKU the catalog does not sell is shown as unavailable', async () => {
    delete CATALOG['MED-lis'];
    try {
      const view = await (await lookup('RX-77102')).json();
      expect(view.lines[1]).toMatchObject({ status: 'OUT_OF_STOCK', selectable: false });
    } finally {
      CATALOG['MED-lis'] = { ...CATALOG['MED-ator'], id: 'MED-lis', key: 'MED-lis', sku: 'MED-lis', name: 'Lisinopril' };
    }
  });

  it('over the calendar-month ceiling: refused with the ceiling and what remains', async () => {
    // two orders this month already used the ceiling of 3 packs of MED-ator
    const NOW = new Date();
    for (const id of ['o1', 'o2', 'o3']) {
      rxData.push({ ...structuredClone(ALL_RX[1]), number: `RX-${id}`, refillsLeft: 5, lines: [{ lineRef: `${id}-1`, sku: 'MED-ator', name: 'x', sig: 's', qty: 30 }] });
    }
    for (const id of ['o1', 'o2', 'o3']) {
      fake.objects.push({ id, container: CONTAINERS.rx, key: `RX-${id}`, version: 1, value: rxData.find((r) => r.number === `RX-${id}`), createdAt: '', lastModifiedAt: '' });
      await consumeAuthorization(`ord-${id}`, [{ patientRef: SAM_REF, rxNumber: `RX-${id}`, lineRef: `${id}-1`, sku: 'MED-ator', qty: 30, packs: 1, perOrderMax: 3, periodCeiling: 3 }], NOW);
    }
    const view = await (await lookup('RX-77102')).json();
    expect(view.lines[0]).toMatchObject({ status: 'CEILING', selectable: false, ceiling: 3, remaining: 0, scope: 'period' });
    expect(view.lines[1]).toMatchObject({ status: 'ok' });
  });

  it('shelf life below the promise: refused with the actual expiry; a dated stock that meets it shows the promise', async () => {
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10);
    supply.set('MED-ator', { sku: 'MED-ator', available: 600, expiryDate: soon });
    supply.set('MED-lis', { sku: 'MED-lis', available: 600, expiryDate: later });
    const view = await (await lookup('RX-77102')).json();
    expect(view.lines[0]).toMatchObject({ status: 'SHELF_LIFE', selectable: false, expiryDate: soon });
    expect(view.lines[1]).toMatchObject({ status: 'ok', selectable: true, minShelfLifeMonths: 3 });
  });

  it('undated goods carry no shelf-life promise on the row', async () => {
    const view = await (await lookup('RX-77102')).json();
    expect(view.lines[0].minShelfLifeMonths).toBeNull();
  });
});

describe('design-plp › Prescription lookup by RX number: Quick-pick badges', () => {
  it('lists the patient own prescriptions only, numbers and dates, no store', async () => {
    const response = await listRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      prescriptions: [
        { number: 'RX-48213', issuedAt: '2026-10-02' },
        { number: 'RX-77102', issuedAt: '2026-09-24' },
        { number: 'RX-31877', issuedAt: '2025-09-01' },
      ],
    });
  });

  it('never lists another patient (Alex sees only RX-90001) and shows no medication data', async () => {
    signedIn('c-alex');
    const text = await (await listRoute()).text();
    expect(JSON.parse(text).prescriptions.map((p: { number: string }) => p.number)).toEqual(['RX-90001']);
    expect(text).not.toMatch(/Amlodipine|sig|refills/i);
  });

  it('without a session: 401 and nothing read', async () => {
    getSession.mockResolvedValue({});
    await expectUnauthenticated(listRoute, [listForPatient, getPatient]);
    await expectUnauthenticated(lookupRoute, [getByNumber, getPatient], makeJsonRequest('/api/prescriptions/lookup', { rx: 'RX-77102' }));
  });
});
