// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeCarts } from '../../test/fake-carts';

const world = createFakeCarts();
const qrPost = vi.fn();
const qrGet = vi.fn();
const qrWithKey = vi.fn();
const customerGet = vi.fn();
const customerDelete = vi.fn(async () => ({}));
const unitGet = vi.fn();
const unitDelete = vi.fn(async () => ({}));
const roleGet = vi.fn();
const cartDelete = vi.fn(async () => ({}));
const exec = <T,>(fn: () => Promise<T>) => ({ execute: fn });
vi.mock('./client', () => ({
  apiRoot: {
    ...new Proxy({}, { get: (_t, p) => (world.root as Record<string, unknown>)[p as string] }),
    asAssociate: () => ({ withAssociateIdValue: () => ({ inBusinessUnitKeyWithBusinessUnitKeyValue: () => ({
      quoteRequests: () => ({ post: (a: unknown) => exec(() => qrPost(a)), get: (a: unknown) => exec(() => qrGet(a)), withKey: (a: unknown) => ({ get: () => exec(() => qrWithKey(a)) }) }),
      carts: () => world.associate(),
    }) }) }),
    customers: () => ({ withId: ({ ID }: { ID: string }) => ({ get: () => exec(() => customerGet(ID)), delete: () => exec(customerDelete) }) }),
    businessUnits: () => ({ withKey: () => ({ get: () => exec(unitGet) }) }),
    associateRoles: () => ({ withKey: ({ key }: { key: string }) => ({ get: () => exec(() => roleGet(key)) }) }),
  },
  provisioningRoot: { businessUnits: () => ({ withKey: () => ({ get: () => exec(unitGet), delete: () => exec(unitDelete) }) }) },
}));
const qr = await import('./quote-requests');

const session = { customerId: 'c1', businessUnitKey: 'mpw-co', currency: 'USD', country: 'US', locale: 'en-US', storeKey: 'mpw-web' };
const site = { addressLine1: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US' };
beforeEach(() => { world.carts.clear(); world.calls.length = 0; for (const m of [qrPost, qrGet, qrWithKey, customerGet, unitGet, roleGet, customerDelete, unitDelete, cartDelete]) m.mockReset(); customerDelete.mockResolvedValue({}); unitDelete.mockResolvedValue({}); cartDelete.mockResolvedValue({}); });

describe('malva-request-a-quote › Request shape', () => {
  it('the cart gets the site as shipping address, drops discount codes and keeps single shipping; custom fields go on the Quote Request', async () => {
    const ql = await import('./quote-list');
    const first = await ql.createListCart(session, [{ productId: 'p1', variantId: 1, frequency: 'annual' }]);
    world.carts.set(first.id, { ...first, discountCodes: [{ discountCode: { id: 'dc' }, state: 'MatchesCart' }] } as never);
    const prepared = await qr.prepareRequestCart(session, { cart: world.carts.get(first.id)!, site });
    expect(prepared).toMatchObject({ shippingMode: 'Single', shippingAddress: { country: 'US', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114' }, discountCodes: [] });
    qrPost.mockResolvedValue({ body: { id: 'qr-1' } });
    await qr.createQuoteRequest(session, prepared, 'key-12345678', { sector: 'healthcare', siteCount: '1', contactName: 'Ada', reference: 'MQ-ABC234', notes: '', phone: undefined as never });
    expect(qrPost.mock.calls[0]![0].body).toMatchObject({ cart: { typeId: 'cart', id: prepared.id }, cartVersion: prepared.version, key: 'mpw-qr-key-12345678', custom: { type: { typeId: 'type', key: 'mpw-quote-request' }, fields: { sector: 'healthcare', siteCount: '1', contactName: 'Ada', reference: 'MQ-ABC234' } } });
    expect(qrPost.mock.calls[0]![0].body.custom.fields).not.toHaveProperty('notes');
  });
  it('a request needs at least one line; excluded (unavailable) lines are removed', async () => {
    const ql = await import('./quote-list');
    const cart = await ql.createListCart(session, [{ productId: 'p1', variantId: 1 }]);
    await expect(qr.prepareRequestCart(session, { cart, site, dropLineItemIds: [cart.lineItems[0]!.id] })).rejects.toMatchObject({ status: 400, message: 'Please choose a service.' });
  });
  it('a duplicate key returns the request that already exists; a refused role is a 403 with a safe message', async () => {
    qrPost.mockRejectedValueOnce({ statusCode: 400, body: { errors: [{ code: 'DuplicateField' }] } });
    qrWithKey.mockResolvedValue({ body: { id: 'qr-old', custom: { fields: { reference: 'MQ-OLD111' } } } });
    expect(await qr.createQuoteRequest(session, { id: 'x', version: 1 } as never, 'key-12345678', { sector: 'other', siteCount: '1', contactName: 'A', reference: 'MQ-NEW111' })).toEqual({ id: 'qr-old', reference: 'MQ-OLD111' });
    qrPost.mockRejectedValueOnce({ statusCode: 403, body: {} });
    await expect(qr.createQuoteRequest(session, { id: 'x', version: 1 } as never, 'key-87654321', { sector: 'other', siteCount: '1', contactName: 'A', reference: 'MQ-NEW222' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('malva-request-a-quote › Signed-in clients (data)', () => {
  it('Request appears in the portal: listQuoteRequests reads the unit\'s requests through the associate chain, newest first, with reference and state', async () => {
    qrGet.mockResolvedValue({ body: { results: [{ id: 'q1', key: 'mpw-qr-1', createdAt: '2026-10-09T10:00:00Z', quoteRequestState: 'Submitted', lineItems: [{ name: { 'en-US': 'Drain cleaning' } }], customLineItems: [], shippingAddress: { streetName: '1 Mill Lane', city: 'Cleveland' }, custom: { fields: { reference: 'MQ-ABC234', sector: 'manufacturing', siteCount: '1' } } }] } });
    const rows = await qr.listQuoteRequests(session);
    expect(qrGet.mock.calls[0]![0].queryArgs.sort).toEqual(['createdAt desc']);
    expect(rows).toEqual([{ id: 'q1', reference: 'MQ-ABC234', state: 'Submitted', createdAt: '2026-10-09T10:00:00Z', services: ['Drain cleaning'], site: '1 Mill Lane, Cleveland', sector: 'manufacturing', siteCount: '1' }]);
  });
  it('Prefill: company, sector, sites and contact come from the unit and the customer; the role may submit', async () => {
    customerGet.mockResolvedValue({ body: { id: 'c1', email: 'a@b.co', firstName: 'Dana', lastName: 'Admin', custom: { fields: { jobTitle: 'Head', phone: '555' } } } });
    unitGet.mockResolvedValue({ body: { name: 'Northfield', custom: { fields: { sector: 'manufacturing' } }, addresses: [{ id: 'a1', streetName: '1 Mill Lane', city: 'Cleveland', postalCode: '44114', country: 'US' }, { id: 'a2', streetName: '22 Depot Road', city: 'Columbus', postalCode: '43215', country: 'US' }], associates: [{ customer: { id: 'c1' }, associateRoleAssignments: [{ associateRole: { key: 'mpw-admin' } }] }] } });
    roleGet.mockResolvedValue({ body: { permissions: ['CreateMyQuoteRequestsFromMyCarts'] } });
    const ctx = await qr.getRequestContext(session);
    expect(ctx).toMatchObject({ signedIn: true, canSubmit: true, company: 'Northfield', sector: 'manufacturing', contact: { name: 'Dana Admin', email: 'a@b.co', jobTitle: 'Head', phone: '555' } });
    expect(ctx.sites.map((s) => s.label)).toEqual(['1 Mill Lane, Cleveland', '22 Depot Road, Columbus']);
  });
  it('Missing permission: a role without CreateMyQuoteRequestsFromMyCarts cannot submit and the administrator is named', async () => {
    customerGet.mockImplementation(async (id: string) => ({ body: id === 'c1' ? { id, email: 'f@b.co', firstName: 'Fin', lastName: 'Ance' } : { id, email: 'd@b.co', firstName: 'Dana', lastName: 'Admin' } }));
    unitGet.mockResolvedValue({ body: { name: 'Northfield', addresses: [], associates: [{ customer: { id: 'c1' }, associateRoleAssignments: [{ associateRole: { key: 'mpw-finance' } }] }, { customer: { id: 'c2' }, associateRoleAssignments: [{ associateRole: { key: 'mpw-admin' } }] }] } });
    roleGet.mockResolvedValue({ body: { permissions: ['ViewMyQuoteRequests'] } });
    expect(await qr.getRequestContext(session)).toMatchObject({ canSubmit: false, adminName: 'Dana Admin' });
  });
  it('an anonymous visitor gets an empty, submit-able context without any commercetools call', async () => {
    expect(await qr.getRequestContext({})).toEqual({ signedIn: false, canSubmit: true, sites: [] });
    expect(customerGet).not.toHaveBeenCalled();
  });
});

describe('malva-request-a-quote › Delivery failure (compensation)', () => {
  it('removes the cart, the company and the customer, and carries on when one step fails', async () => {
    unitGet.mockResolvedValue({ body: { version: 3 } });
    customerGet.mockResolvedValue({ body: { version: 2 } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ql = await import('./quote-list');
    const cart = await ql.createListCart(session, [{ productId: 'p1', variantId: 1 }]);
    await qr.compensateRegistration({ customerId: 'c9', businessUnitKey: 'mpw-acme-1', cart });
    expect(world.carts.has(cart.id)).toBe(false);
    expect(unitDelete).toHaveBeenCalled();
    expect(customerDelete).toHaveBeenCalled();
  });
});
