// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { roleDrafts } from '../../../seed/src/data/roles';

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const world = vi.hoisted(() => ({ requests: [] as Rec[], quotes: [] as Rec[], writes: [] as Rec[], role: 'mpw-admin' }));
vi.mock('./client', () => ({ apiRoot: {}, provisioningRoot: {} }));

const notFound = () => Object.assign(new Error('nf'), { statusCode: 404 });
const bad = () => Object.assign(new Error('bad'), { statusCode: 400 });
vi.mock('./associate', () => ({
  asAssociate: () => ({
    quoteRequests: () => ({
      get: () => ({ execute: async () => ({ body: { results: world.requests } }) }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => { const r = world.requests.find((x) => x.id === ID); if (!r) throw notFound(); return { body: r }; } }),
        post: ({ body }: { body: Rec }) => ({ execute: async () => { const r = world.requests.find((x) => x.id === ID)!; world.writes.push({ on: 'request', ...body }); if (body.version !== r.version) throw Object.assign(new Error('c'), { statusCode: 409 }); r.quoteRequestState = body.actions[0].quoteRequestState; r.version += 1; return { body: r }; } }),
      }),
    }),
    quotes: () => ({
      get: ({ queryArgs }: { queryArgs: { where?: string } }) => ({ execute: async () => {
        const id = queryArgs.where?.match(/id="([^"]+)"/)?.[1];
        return { body: { results: world.quotes.filter((q) => !id || q.quoteRequest.id === id) } };
      } }),
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => { const q = world.quotes.find((x) => x.id === ID); if (!q) throw notFound(); return { body: q }; } }),
        post: ({ body }: { body: Rec }) => ({ execute: async () => {
          const q = world.quotes.find((x) => x.id === ID)!; world.writes.push({ on: 'quote', ...body });
          if (body.version !== q.version) throw Object.assign(new Error('c'), { statusCode: 409 });
          const a = body.actions[0];
          if (a.action === 'changeQuoteState') q.quoteState = a.quoteState;
          if (a.action === 'requestQuoteRenegotiation') { q.quoteState = 'DeclinedForRenegotiation'; q.buyerComment = a.buyerComment; }
          q.version += 1; return { body: q };
        } }),
      }),
    }),
    orders: () => ({ orderQuote: () => ({ post: ({ body }: { body: Rec }) => ({ execute: async () => {
      const q = world.quotes.find((x) => x.id === body.quote.id)!; world.writes.push({ on: 'order', ...body });
      if (q.quoteState !== 'Pending' || body.version !== q.version) throw bad();
      q.quoteState = 'Accepted'; q.version += 1; return { body: { id: 'order1' } };
    } }) }) }),
  }),
}));
vi.mock('./team-unit', async (original) => ({
  ...(await original<typeof import('./team-unit')>()),
  getAssociateContext: async () => ({ unit: {}, me: {}, roleKeys: [world.role], permissions: new Set(roleDrafts.find((r) => r.key === world.role)!.permissions) }),
}));
const q = await import('./portal-quotes');

const line = (name: string, extra: Rec = {}) => ({ name: { 'en-US': name, 'de-DE': `${name} (de)` }, quantity: 1, custom: { fields: { frequency: 'monthly' } }, ...extra });
const request = (over: Rec = {}) => ({
  id: 'r1', version: 3, createdAt: '2026-10-01T09:00:00.000Z', quoteRequestState: 'Submitted', customer: { id: 'me' }, businessUnit: { key: 'co' },
  custom: { fields: { reference: 'MQ-ABC123' } }, shippingAddress: { key: 'site-1', company: 'Main plant', country: 'US' }, lineItems: [line('Drain clearing'), line('Waste collection')], comment: 'Please call first', ...over,
});
const quote = (over: Rec = {}) => ({
  id: 'q1', version: 2, createdAt: '2026-10-03T09:00:00.000Z', quoteState: 'Pending', customer: { id: 'me' }, businessUnit: { key: 'co' }, quoteRequest: { typeId: 'quote-request', id: 'r1', obj: { comment: 'Please call first' } },
  sellerComment: 'Prices valid for 30 days', validTo: '2999-01-01T00:00:00.000Z', totalPrice: { centAmount: 12500, currencyCode: 'USD', fractionDigits: 2 },
  shippingAddress: { key: 'site-1', company: 'Main plant', country: 'US' },
  lineItems: [line('Drain clearing', { price: { value: { centAmount: 5000, currencyCode: 'USD', fractionDigits: 2 } }, totalPrice: { centAmount: 5000, currencyCode: 'USD', fractionDigits: 2 } })], ...over,
});
const session = { customerId: 'me', businessUnitKey: 'co', locale: 'en-US' };
beforeEach(() => { world.requests = [request()]; world.quotes = []; world.writes = []; world.role = 'mpw-admin'; });

describe('malva-client-portal › Quotes and requests › status words', () => {
  it.each([
    [{ quoteRequestState: 'Submitted' }, undefined, 'submitted'],
    [{ quoteRequestState: 'Accepted' }, undefined, 'preparing'],
    [{ quoteRequestState: 'Cancelled' }, undefined, 'cancelled'],
    [{ quoteRequestState: 'Rejected' }, undefined, 'declined'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'Pending' }, 'ready'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'RenegotiationAddressed' }, 'ready'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'DeclinedForRenegotiation' }, 'renegotiation'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'Accepted' }, 'accepted'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'Declined' }, 'declined'],
    [{ quoteRequestState: 'Accepted' }, { quoteState: 'Withdrawn' }, 'cancelled'],
  ])('request %j with quote %j is %s', (request, latest, expected) => {
    expect(q.statusOf(request, latest)).toBe(expected);
  });
});

describe('malva-client-portal › Quotes and requests › list and detail', () => {
  it('one row per request: reference, date, service names, site, status, no prices', async () => {
    const [row] = await q.listThreads(session);
    expect(row).toMatchObject({ id: 'r1', reference: 'MQ-ABC123', createdAt: '2026-10-01T09:00:00.000Z', services: ['Drain clearing', 'Waste collection'], site: 'Main plant', status: 'submitted', rounds: 0 });
    expect(JSON.stringify(row)).not.toMatch(/centAmount|price/i);
  });
  it('names follow the session locale', async () => {
    expect((await q.listThreads({ ...session, locale: 'de-DE' }))[0]?.services[0]).toBe('Drain clearing (de)');
  });
  it('the latest quote drives the row; several quotes of one request are one row with a round count', async () => {
    world.requests = [request({ quoteRequestState: 'Accepted' })];
    world.quotes = [quote({ id: 'q1', quoteState: 'RenegotiationAddressed', createdAt: '2026-10-03T09:00:00.000Z' }), quote({ id: 'q2', createdAt: '2026-10-05T09:00:00.000Z' })];
    const rows = await q.listThreads(session);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'ready', rounds: 2, quoteId: 'q2' });
  });
  it('requests are listed newest first and a quote whose request is not visible still gets a row', async () => {
    world.requests = [request({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' }), request({ id: 'new', createdAt: '2026-10-09T00:00:00.000Z' })];
    world.quotes = [quote({ id: 'qx', quoteRequest: { id: 'hidden' }, createdAt: '2026-10-05T00:00:00.000Z' })];
    expect((await q.listThreads(session)).map((r) => r.id)).toEqual(['new', 'hidden', 'old']);
  });
  it('the detail shows lines without prices until a quote exists, and with the quote\'s prices and seller comment afterwards', async () => {
    const before = await q.getThread(session, 'r1');
    expect(before.history).toEqual([]);
    expect(before.lines.every((l) => l.unitPrice === undefined && l.total === undefined)).toBe(true);
    expect(before).toMatchObject({ comment: 'Please call first' });
    world.requests = [request({ quoteRequestState: 'Accepted' })]; world.quotes = [quote()];
    const after = await q.getThread(session, 'r1');
    expect(after.lines[0]).toMatchObject({ name: 'Drain clearing', frequency: 'monthly', unitPrice: { centAmount: 5000 }, total: { centAmount: 5000 } });
    expect(after.history[0]).toMatchObject({ quoteId: 'q1', sellerComment: 'Prices valid for 30 days', total: { centAmount: 12500, currencyCode: 'USD' } });
  });
  it('another company\'s request, a missing one and a malformed id all answer the same not-found', async () => {
    world.requests = [request({ businessUnit: { key: 'other-co' } })];
    const answers = await Promise.all(['r1', 'zzz', 'a"b'].map((id) => q.getThread(session, id).catch((e) => ({ status: e.status, message: e.message }))));
    expect(answers).toEqual([{ status: 404, message: 'Not found.' }, { status: 404, message: 'Not found.' }, { status: 404, message: 'Not found.' }]);
  });
  it('open requests for the overview skip accepted, declined and cancelled ones', async () => {
    world.requests = [request({ id: 'a' }), request({ id: 'b', quoteRequestState: 'Cancelled' })];
    expect((await q.listOpenThreads(session)).map((t) => t.id)).toEqual(['a']);
  });
});

describe('malva-client-portal › Quotes and requests › Accept a quote', () => {
  beforeEach(() => { world.requests = [request({ quoteRequestState: 'Accepted' })]; world.quotes = [quote()]; });
  it('an administrator accepts: the order is created from the quote with quoteStateToAccepted, the quote shows Accepted', async () => {
    const thread = await q.actOnQuote(session, 'q1', 'accept');
    expect(world.writes[0]).toMatchObject({ on: 'order', quote: { id: 'q1' }, version: 2, quoteStateToAccepted: true });
    expect(thread.status).toBe('accepted');
    expect(thread.can).toEqual({ accept: false, decline: false, renegotiate: false, cancel: false });
  });
  it('the action cannot be repeated: the second call is refused and writes nothing', async () => {
    await q.actOnQuote(session, 'q1', 'accept');
    const before = world.writes.length;
    await expect(q.actOnQuote(session, 'q1', 'accept')).rejects.toMatchObject({ status: 409 });
    await expect(q.actOnQuote(session, 'q1', 'decline')).rejects.toMatchObject({ status: 409 });
    expect(world.writes).toHaveLength(before);
  });
  it('a double click (two parallel calls) accepts once: the second finds a moved version and is refused', async () => {
    const results = await Promise.allSettled([q.actOnQuote(session, 'q1', 'accept'), q.actOnQuote(session, 'q1', 'accept')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
  });
  it('a role without the create-order permission for the quote falls back to changing the quote state', async () => {
    world.quotes = [quote({ customer: { id: 'someone-else' } })];
    await q.actOnQuote(session, 'q1', 'accept');
    expect(world.writes[0]).toMatchObject({ on: 'quote', actions: [{ action: 'changeQuoteState', quoteState: 'Accepted' }] });
  });
  it('decline changes the state to Declined; renegotiate needs a comment and stores it', async () => {
    expect((await q.actOnQuote(session, 'q1', 'decline')).status).toBe('declined');
    world.quotes = [quote({ id: 'q9' })];
    await expect(q.actOnQuote(session, 'q9', 'renegotiate', '  ')).rejects.toMatchObject({ status: 400 });
    const after = await q.actOnQuote(session, 'q9', 'renegotiate', ' Can the price include VAT? ');
    expect(world.writes.at(-1)).toMatchObject({ actions: [{ action: 'requestQuoteRenegotiation', buyerComment: 'Can the price include VAT?' }] });
    expect(after.status).toBe('renegotiation');
    expect(after.history[0]?.buyerComment).toBe('Can the price include VAT?');
  });
  it('an expired quote cannot be accepted', async () => {
    world.quotes = [quote({ validTo: '2020-01-01T00:00:00.000Z' })];
    await expect(q.actOnQuote(session, 'q1', 'accept')).rejects.toMatchObject({ status: 409, message: expect.stringContaining('expired') });
    expect((await q.getThread(session, 'r1')).can.accept).toBe(false);
  });
  it('another company\'s quote is not found and nothing is written', async () => {
    world.quotes = [quote({ businessUnit: { key: 'other-co' } })];
    await expect(q.actOnQuote(session, 'q1', 'accept')).rejects.toMatchObject({ status: 404 });
    await expect(q.actOnQuote(session, 'missing', 'accept')).rejects.toMatchObject({ status: 404 });
    expect(world.writes).toEqual([]);
  });
});

describe('malva-client-portal › Quotes and requests › Without permission', () => {
  beforeEach(() => { world.requests = [request({ quoteRequestState: 'Accepted' })]; world.quotes = [quote()]; world.role = 'mpw-finance'; });
  it('Finance sees the quote and its prices but no action is offered', async () => {
    const thread = await q.getThread(session, 'r1');
    expect(thread.status).toBe('ready');
    expect(thread.history[0]?.total?.centAmount).toBe(12500);
    expect(thread.can).toEqual({ accept: false, decline: false, renegotiate: false, cancel: false });
  });
  it('and the API refuses every action; nothing is written', async () => {
    for (const action of ['accept', 'decline', 'renegotiate'] as const) await expect(q.actOnQuote(session, 'q1', action, 'x')).rejects.toMatchObject({ status: 403 });
    expect(world.writes).toEqual([]);
  });
  it('a Site contact acts on their own quotes but not on a colleague\'s', async () => {
    world.role = 'mpw-site-contact';
    expect((await q.getThread(session, 'r1')).can).toMatchObject({ accept: true, decline: true, renegotiate: true });
    world.quotes = [quote({ customer: { id: 'colleague' } })];
    expect((await q.getThread(session, 'r1')).can).toMatchObject({ accept: false, decline: false, renegotiate: false });
    await expect(q.actOnQuote(session, 'q1', 'decline')).rejects.toMatchObject({ status: 403 });
  });
});

describe('malva-client-portal › Quotes and requests › cancel a request', () => {
  it('a Submitted request is cancelled once; a second attempt is refused', async () => {
    expect((await q.cancelRequest(session, 'r1')).status).toBe('cancelled');
    await expect(q.cancelRequest(session, 'r1')).rejects.toMatchObject({ status: 409 });
  });
  it('Finance cannot cancel; the control is absent', async () => {
    world.role = 'mpw-finance';
    expect((await q.getThread(session, 'r1')).can.cancel).toBe(false);
    await expect(q.cancelRequest(session, 'r1')).rejects.toMatchObject({ status: 403 });
    expect(world.writes).toEqual([]);
  });
  it('an administrator is offered Cancel only while Submitted', async () => {
    expect((await q.getThread(session, 'r1')).can.cancel).toBe(true);
    world.requests = [request({ quoteRequestState: 'Accepted' })];
    expect((await q.getThread(session, 'r1')).can.cancel).toBe(false);
  });
});
