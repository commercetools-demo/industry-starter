// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allServices, plumbingServices, wasteServices } from '@/components/service/test-fixtures';
import { ApiError } from '@/lib/errors';
import { REFERENCE_PATTERN } from '@/lib/quote/constants';
import { createFakeCarts } from '../../../test/fake-carts';
import { mockSession, sessionMock } from '../../../test/api-helpers';

const world = createFakeCarts();
const save = vi.fn(async (s: Record<string, string>) => { sessionMock.current = s; });
const enforce = vi.fn(async () => undefined);
const registerCompany = vi.fn();
const createQuoteRequest = vi.fn();
const findQuoteRequest = vi.fn();
const getRequestContext = vi.fn();
const compensateRegistration = vi.fn(async () => undefined);
const hazardous = { ...wasteServices[2]!, needsWasteDetails: true };
const services = allServices.map((s) => (s.id === hazardous.id ? hazardous : s));
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: save }));
vi.mock('@/lib/auth-limits', () => ({ clientKey: () => 'ip', enforce }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (world.root as Record<string, unknown>)[p as string] }), provisioningRoot: {} }));
vi.mock('@/lib/ct/services', () => ({ fetchAllServices: async () => services }));
vi.mock('@/lib/ct/registration', () => ({ registerCompany }));
vi.mock('@/lib/ct/stores', () => ({ getStoreChannelData: async () => ({ storeKey: 'mpw-web', storeId: 'store-1' }) }));
vi.mock('@/lib/ct/quote-requests', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/quote-requests')>()), createQuoteRequest, findQuoteRequest, getRequestContext, compensateRegistration }));
const { POST } = await import('./route');
const { addService } = await import('@/lib/ct/quote-list');
const { clearServicesMemo } = await import('@/lib/quote/list-api');

const drain = plumbingServices[1]!;
const fields = { company: 'Acme Plant Ltd', sector: 'manufacturing', addressLine1: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US', siteCount: '2-10', contactName: 'Ada Lovelace', jobTitle: 'Head of Facilities', email: 'ada@acme.co', phone: '555 0100', password: 'a-long-passphrase-1', wasteTypes: ['clinical'], permitNumber: 'P-1' };
const post = (body: unknown) => POST(new Request('http://x/api/quote-requests', { method: 'POST', body: JSON.stringify(body) }));
const guestSession = { storeKey: 'mpw-web' };
let n = 0;
const key = () => `idem-key-${++n}`;
const registered = { status: 'created', customer: { id: 'cust-9', email: 'ada@acme.co', firstName: 'Ada', lastName: 'Lovelace' }, businessUnitKey: 'mpw-acme-1234' };

async function guestWithList(...list: Array<typeof drain>) {
  mockSession({ ...guestSession });
  let cartId: string | undefined;
  for (const s of list) cartId = (await addService({ ...sessionMock.current, cartId } as never, s, services, { frequency: 'annual' })).cartId;
  mockSession({ ...guestSession, ...(cartId ? { cartId } : {}) });
  world.calls.length = 0;
  return cartId;
}

beforeEach(() => {
  world.carts.clear(); world.calls.length = 0; save.mockClear(); clearServicesMemo();
  for (const m of [enforce, registerCompany, createQuoteRequest, findQuoteRequest, getRequestContext, compensateRegistration]) m.mockReset();
  enforce.mockResolvedValue(undefined);
  registerCompany.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 5)); return registered; });
  createQuoteRequest.mockImplementation(async (_s: unknown, _c: unknown, _k: string, f: { reference: string }) => ({ id: 'qr-1', reference: f.reference }));
  findQuoteRequest.mockResolvedValue(null);
  compensateRegistration.mockResolvedValue(undefined);
});

describe('malva-request-a-quote › An account is required to submit', () => {
  it('Account and request in one action + Request shape: the company cart is single-shipping with the site address, no discount code, zero-priced service lines and custom fields; the visitor ends signed in', async () => {
    const guestCart = await guestWithList(drain, hazardous);
    const res = await post({ idempotencyKey: key(), locale: 'en-US', fields });
    expect(res.status).toBe(200);
    const { reference } = await res.json();
    expect(reference).toMatch(REFERENCE_PATTERN);
    expect(registerCompany).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Acme Plant Ltd', firstName: 'Ada', lastName: 'Lovelace', sector: 'manufacturing', email: 'ada@acme.co', password: fields.password }));
    const [session, cart, , qrFields] = createQuoteRequest.mock.calls[0]!;
    expect(session).toMatchObject({ customerId: 'cust-9', businessUnitKey: 'mpw-acme-1234' });
    expect(cart).toMatchObject({ shippingMode: 'Single', businessUnit: { key: 'mpw-acme-1234' }, shippingAddress: { country: 'US', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114' }, discountCodes: [] });
    expect(cart.lineItems.map((l: { productId: string }) => l.productId)).toEqual([drain.id, hazardous.id]);
    expect(cart.lineItems[0].custom.fields).toEqual({ frequency: 'annual' });
    expect(qrFields).toMatchObject({ sector: 'manufacturing', siteCount: '2-10', wasteTypes: 'Medical / clinical waste', permitNumber: 'P-1', contactName: 'Ada Lovelace', jobTitle: 'Head of Facilities', phone: '555 0100', reference });
    // Created through the associate chain, never project-level; the guest cart is gone and the session now belongs to the client.
    expect(world.calls.filter((c) => c.op === 'create').every((c) => c.api === 'associate')).toBe(true);
    expect(world.carts.has(guestCart!)).toBe(false);
    expect(sessionMock.current).toMatchObject({ customerId: 'cust-9', businessUnitKey: 'mpw-acme-1234', storeKey: 'mpw-web' });
    expect(sessionMock.current.cartId).toBeUndefined();
  });
  it('Email already has an account: nothing is created, the answer says to sign in, and the guest list stays', async () => {
    const guestCart = await guestWithList(drain);
    registerCompany.mockResolvedValue({ status: 'duplicate' });
    const res = await post({ idempotencyKey: key(), fields });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'account-exists', error: expect.stringMatching(/sign in/i) });
    expect(createQuoteRequest).not.toHaveBeenCalled();
    expect(compensateRegistration).not.toHaveBeenCalled();
    expect(world.carts.has(guestCart!)).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
  it('Invalid email: 400 with the field error, and nothing is created', async () => {
    await guestWithList(drain);
    const res = await post({ idempotencyKey: key(), fields: { ...fields, email: 'not-an-email' } });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toMatchObject({ email: 'email' });
    expect(registerCompany).not.toHaveBeenCalled();
  });
  it('a common password is refused before anything is created', async () => {
    await guestWithList(drain);
    const res = await post({ idempotencyKey: key(), fields: { ...fields, password: '1111111111' } });
    expect((await res.json()).fieldErrors).toMatchObject({ password: 'passwordCommon' });
    expect(registerCompany).not.toHaveBeenCalled();
  });
  it('Missing service: no list and no choice is refused; an empty list with a choice becomes a general enquiry line', async () => {
    mockSession({ ...guestSession });
    expect((await (await post({ idempotencyKey: key(), fields })).json()).fieldErrors).toMatchObject({ choice: 'service' });
    const res = await post({ idempotencyKey: key(), fields: { ...fields, choice: 'both', need: 'Quarterly grease trap servicing' } });
    expect(res.status).toBe(200);
    const [, cart, , qrFields] = createQuoteRequest.mock.calls[0]!;
    expect(cart.lineItems).toEqual([]);
    expect(cart.customLineItems[0]).toMatchObject({ name: { 'en-US': 'General enquiry: Plumbing and waste management' }, money: { centAmount: 0, currencyCode: 'USD' } });
    expect(qrFields.notes).toContain('Quarterly grease trap servicing');
  });
});

describe('malva-request-a-quote › Submission creates exactly one request', () => {
  it('Successful submission: one reference, and waste details are dropped when no service needs them', async () => {
    await guestWithList(drain);
    const res = await post({ idempotencyKey: key(), fields });
    expect(res.status).toBe(200);
    expect(createQuoteRequest.mock.calls[0]![3]).not.toHaveProperty('wasteTypes');
    expect(createQuoteRequest.mock.calls[0]![3]).not.toHaveProperty('permitNumber');
  });
  it('Double submit or reload: two concurrent posts with one key register and create once and agree on the reference; a later post finds the request', async () => {
    await guestWithList(drain);
    const k = key();
    const [a, b] = await Promise.all([post({ idempotencyKey: k, fields }), post({ idempotencyKey: k, fields })]);
    expect((await a.json()).reference).toBe((await b.json()).reference);
    expect(registerCompany).toHaveBeenCalledTimes(1);
    expect(createQuoteRequest).toHaveBeenCalledTimes(1);
    // Reload while signed in: the key already has a request.
    mockSession({ ...sessionMock.current });
    findQuoteRequest.mockResolvedValue({ id: 'qr-1', reference: 'MQ-ABC234' });
    const again = await post({ idempotencyKey: k, fields });
    expect(await again.json()).toEqual({ reference: 'MQ-ABC234' });
    expect(createQuoteRequest).toHaveBeenCalledTimes(1);
  });
  it('Delivery failure: the account, company and cart are removed, nothing is reported as received, the session is not written', async () => {
    await guestWithList(drain);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createQuoteRequest.mockRejectedValue(new Error('SDK-INTERNAL secret'));
    const res = await post({ idempotencyKey: key(), fields });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|SDK-INTERNAL/);
    expect(compensateRegistration).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-9', businessUnitKey: 'mpw-acme-1234', cart: expect.objectContaining({ id: expect.any(String) }) }));
    expect(save).not.toHaveBeenCalled();
  });
});

describe('malva-request-a-quote › Signed-in clients', () => {
  const signedIn = () => mockSession({ ...guestSession, customerId: 'c1', businessUnitKey: 'mpw-co' });
  it('submits the Business Unit list as the client, clears cartId and creates no account', async () => {
    signedIn();
    getRequestContext.mockResolvedValue({ signedIn: true, canSubmit: true, sites: [] });
    const first = await addService({ ...sessionMock.current } as never, drain, services, {});
    mockSession({ ...sessionMock.current, cartId: first.cartId! });
    const res = await post({ idempotencyKey: key(), fields: { ...fields, password: '' } });
    expect(res.status).toBe(200);
    expect(registerCompany).not.toHaveBeenCalled();
    expect(createQuoteRequest.mock.calls[0]![0]).toMatchObject({ customerId: 'c1', businessUnitKey: 'mpw-co' });
    expect(sessionMock.current.cartId).toBeUndefined();
    expect(world.carts.size).toBe(0);
  });
  it('Missing permission: refused with a message naming the company administrator, nothing created', async () => {
    signedIn();
    getRequestContext.mockResolvedValue({ signedIn: true, canSubmit: false, adminName: 'Dana Admin', sites: [] });
    const first = await addService({ ...sessionMock.current } as never, drain, services, {});
    mockSession({ ...sessionMock.current, cartId: first.cartId! });
    const res = await post({ idempotencyKey: key(), fields: { ...fields, password: '' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'no-permission', error: expect.stringContaining('Dana Admin') });
    expect(createQuoteRequest).not.toHaveBeenCalled();
  });
});

describe('malva-request-a-quote › Consent, abuse protection and contact alternatives', () => {
  it('Automated submission: a filled honeypot is rejected without a challenge and nothing is created or delivered', async () => {
    await guestWithList(drain);
    const res = await post({ idempotencyKey: key(), fields, website: 'https://spam.example' });
    expect(res.status).toBe(400);
    expect(registerCompany).not.toHaveBeenCalled();
    expect(createQuoteRequest).not.toHaveBeenCalled();
  });
  it('a missing or malformed key is rejected, and the shared limiter is consulted before anything else', async () => {
    expect((await post({ idempotencyKey: 'x', fields })).status).toBe(400);
    expect((await post({ fields })).status).toBe(400);
    enforce.mockRejectedValueOnce(new ApiError(429, 'Too many attempts. Please try again later.'));
    expect((await post({ idempotencyKey: key(), fields })).status).toBe(429);
    expect(registerCompany).not.toHaveBeenCalled();
  });
});
